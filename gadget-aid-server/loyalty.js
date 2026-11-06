const { retryTransaction } = require("./transaction-retry");
const { ObjectId } = require("mongodb");
const { createHash, randomBytes } = require("node:crypto");
const {
  fail,
  checkKeys,
  todayInDhaka,
  customerQuery,
  idValue,
  serviceOwner,
} = require("./domain");
const { accessFor } = require("./access");
const { completionVerified } = require("./reviews");
const { currentQuote } = require("./workflow-model");
const { pageDocs, queryFilter } = require("./pagination");
const POLICY = "discount-points-v1",
  DAY = 86400000;
const key = (value) =>
  new ObjectId(createHash("sha256").update(value).digest("hex").slice(0, 24));
const guard = async (tx, uid) => {
  const id = `loyalty:wallet:${uid}`,
    row = await tx.operationMeta.findOne({ _id: id });
  if (row)
    await tx.operationMeta.updateOne(
      { _id: id },
      { $set: { revision: (row.revision || 0) + 1 } },
    );
  else await tx.operationMeta.insertOne({ _id: id, revision: 1 });
};
const allowedOwner = async (tx, uid) =>
  (await tx.accountControls.findOne({ _id: uid }))?.state !== "restricted";
const discountForLabor = (labor) =>
  Math.min(500, Math.floor((Math.round(labor * 100) * 5) / 100)) / 100;
const creditView = (row) => ({
  _id: String(row._id),
  type: row.type,
  points: row.points,
  remainingPoints: row.remainingPoints,
  issuedAt: row.issuedAt,
  availableAt: row.availableAt,
  expiresAt: row.expiresAt,
});
const spendView = (row) => ({
  _id: String(row._id),
  points: row.points,
  discount: row.discount,
  currency: row.currency,
  createdAt: row.createdAt,
  refunded: row.refunded,
  restoredPoints: row.restoredPoints || 0,
});
const issue = async (
  tx,
  { ownerUid, source, issuedAt, type, points, month, day },
) => {
  const id = key(`loyalty-credit:${type}:${source}`);
  if (await tx.loyaltyCredits.findOne({ _id: id })) return;
  await tx.loyaltyCredits.insertOne({
    _id: id,
    ownerUid,
    sourceBookingId: source,
    type,
    points,
    remainingPoints: points,
    issuedAt,
    availableAt: new Date(+issuedAt + 7 * DAY),
    expiresAt: new Date(+issuedAt + 365 * DAY),
    month,
    day,
    policy: POLICY,
  });
};
const usable = async (tx, uid, now) =>
  tx.loyaltyCredits
    .find({
      ownerUid: uid,
      expiresAt: { $gt: now },
      availableAt: { $lte: now },
      remainingPoints: { $gt: 0 },
    })
    .sort({ expiresAt: 1, _id: 1 })
    .limit(501)
    .toArray();
const loyaltyTransition = async (tx, previous, next, req, now) => {
  const quote = currentQuote(next),
    oldQuote = currentQuote(previous);
  if (
    quote?.loyalty &&
    quote.status === "approved" &&
    oldQuote?.status !== "approved"
  ) {
    if (
      !req.user.emailVerified ||
      req.user.uid !== next.userUid ||
      !(await allowedOwner(tx, next.userUid))
    )
      fail(
        403,
        "A verified unrestricted customer account is required for discount points.",
        "LOYALTY_VERIFICATION",
      );
    const offer = quote.loyalty;
    if (
      offer.policy !== POLICY ||
      offer.fundedBy !== "provider" ||
      typeof quote.actorUid !== "string" ||
      offer.points !== 100 ||
      offer.discount !== discountForLabor(offer.originalLabor) ||
      offer.discount <= 0 ||
      quote.labor !==
        Math.round((offer.originalLabor - offer.discount) * 100) / 100
    )
      fail(
        409,
        "This discount offer is invalid. Ask for a new quotation.",
        "LOYALTY_OFFER_INVALID",
      );
    const provider = await accessFor(tx, {
      uid: quote.actorUid,
      email: next.providerEmail,
      emailVerified: true,
    });
    const service = await tx.services.findOne({
      _id: idValue(String(next.serviceId)),
    });
    if (
      !provider.canProvide ||
      provider.restricted ||
      !serviceOwner(service, { uid: quote.actorUid, email: next.providerEmail })
    )
      fail(
        409,
        "The funding provider is no longer eligible. Contact booking support before approving.",
        "LOYALTY_PROVIDER_UNAVAILABLE",
      );
    await guard(tx, next.userUid);
    const spendId = key(`loyalty-spend:${next._id}`);
    if (await tx.loyaltySpends.findOne({ _id: spendId }))
      fail(
        409,
        "Points have already been redeemed for this repair.",
        "LOYALTY_DUPLICATE",
      );
    const credits = await usable(tx, next.userUid, now);
    if (
      credits.length > 500 ||
      credits.reduce((sum, row) => sum + row.remainingPoints, 0) < 100
    )
      fail(
        409,
        "100 available unexpired points are required. Ask for a new quotation without the points discount, or wait until pending points are available.",
        "LOYALTY_INSUFFICIENT",
      );
    let remaining = 100;
    const allocations = [];
    for (const row of credits) {
      if (!remaining) break;
      const amount = Math.min(remaining, row.remainingPoints);
      await tx.loyaltyCredits.updateOne(
        { _id: row._id, remainingPoints: row.remainingPoints },
        { $set: { remainingPoints: row.remainingPoints - amount } },
      );
      allocations.push({ creditId: String(row._id), points: amount });
      remaining -= amount;
    }
    await tx.loyaltySpends.insertOne({
      _id: spendId,
      ownerUid: next.userUid,
      bookingId: String(next._id),
      quoteId: quote.id,
      providerUid: quote.actorUid,
      points: 100,
      discount: offer.discount,
      currency: "USD",
      allocations,
      refunded: false,
      createdAt: now,
      policy: POLICY,
    });
  }
  if (
    ["cancelled", "rejected"].includes(next.status) &&
    oldQuote?.loyalty &&
    oldQuote.status === "approved"
  ) {
    await guard(tx, next.userUid);
    const spend = await tx.loyaltySpends.findOne({
      _id: key(`loyalty-spend:${next._id}`),
    });
    if (spend && !spend.refunded) {
      let restored = 0;
      for (const allocation of spend.allocations) {
        const row = await tx.loyaltyCredits.findOne({
          _id: idValue(allocation.creditId),
          ownerUid: next.userUid,
        });
        if (row && row.expiresAt > now) {
          const amount = Math.min(
            allocation.points,
            row.points - row.remainingPoints,
          );
          await tx.loyaltyCredits.updateOne(
            { _id: row._id },
            { $set: { remainingPoints: row.remainingPoints + amount } },
          );
          restored += amount;
        }
      }
      await tx.loyaltySpends.updateOne(
        { _id: spend._id, refunded: false },
        { $set: { refunded: true, restoredPoints: restored, refundedAt: now } },
      );
    }
  }
};
const createLoyalty = ({ collections, clock }) => {
  const profile = async (tx, uid) => {
    const old = await tx.loyaltyProfiles.findOne({ _id: uid });
    if (old) return old;
    const value = {
      _id: uid,
      code: randomBytes(12).toString("hex"),
      createdAt: clock(),
      referredByUid: null,
    };
    await tx.loyaltyProfiles.insertOne(value);
    return value;
  };
  const reconcile = async (db, req) => {
    const rows = await db.bookings
      .find({
        $and: [
          customerQuery(req.user),
          {
            status: "completed",
            loyaltyPolicyVersion: POLICY,
            loyaltyRewardChecked: { $ne: true },
          },
        ],
      })
      .sort({ loyaltyCompletedAt: 1, _id: 1 })
      .limit(26)
      .toArray();
    for (const source of rows.slice(0, 25))
      await retryTransaction(db, async (tx) => {
        const booking = await tx.bookings.findOne({
          _id: source._id,
          loyaltyRewardChecked: { $ne: true },
        });
        if (!booking) return;
        await guard(tx, req.user.uid);
        const service = await tx.services.findOne({
          _id: idValue(String(booking.serviceId)),
        });
        const quote = currentQuote(booking);
        const time = booking.loyaltyCompletedAt,
          valid =
            booking.userUid === req.user.uid &&
            booking.createdAt instanceof Date &&
            time instanceof Date &&
            time <= clock() &&
            service?.providerUid &&
            service.providerUid !== req.user.uid &&
            booking.providerUid === service.providerUid &&
            completionVerified(booking, service) &&
            quote?.status === "approved" &&
            quote.total >= 20 &&
            quote.labor >= 10;
        if (valid) {
          const day = todayInDhaka(time),
            month = day.slice(0, 7);
          if (
            !(await tx.loyaltyCredits.countDocuments({
              ownerUid: req.user.uid,
              type: "repair",
              day,
            }))
          )
            await issue(tx, {
              ownerUid: req.user.uid,
              source: String(booking._id),
              issuedAt: time,
              type: "repair",
              points: 20,
              day,
              month,
            });
          const me = await profile(tx, req.user.uid);
          if (me.referredByUid) {
            const inviter = me.referredByUid;
            await guard(tx, inviter);
            const first = await tx.loyaltyProfiles.findOne({
              _id: req.user.uid,
            });
            if (
              !first.referralRewardChecked &&
              inviter !== service.providerUid &&
              inviter !== req.user.uid
            ) {
              if (
                (await allowedOwner(tx, inviter)) &&
                (await tx.loyaltyCredits.countDocuments({
                  ownerUid: inviter,
                  type: "referral",
                  month,
                })) < 3
              )
                await issue(tx, {
                  ownerUid: inviter,
                  source: String(booking._id),
                  issuedAt: time,
                  type: "referral",
                  points: 40,
                  day,
                  month,
                });
              await tx.loyaltyProfiles.updateOne(
                { _id: req.user.uid },
                { $set: { referralRewardChecked: true } },
              );
            }
          }
        }
        await tx.bookings.updateOne(
          { _id: booking._id },
          { $set: { loyaltyRewardChecked: true } },
        );
      });
    return rows.length > 25;
  };
  return {
    wallet: async (req, res) => {
      const db = await collections();
      queryFilter(req.query);
      let me = null,
        more = false;
      if (req.user.emailVerified && !req.access.restricted) {
        await retryTransaction(db, async (tx) => {
          await guard(tx, req.user.uid);
          me = await profile(tx, req.user.uid);
        });
        more = await reconcile(db, req);
      } else me = await db.loyaltyProfiles.findOne({ _id: req.user.uid });
      const now = clock(),
        active = await db.loyaltyCredits
          .find({
            ownerUid: req.user.uid,
            expiresAt: { $gt: now },
            remainingPoints: { $gt: 0 },
          })
          .limit(501)
          .toArray();
      const page = await pageDocs(
        db.loyaltyCredits,
        { ownerUid: req.user.uid },
        req.query,
        { scope: `loyalty:${req.user.uid}` },
      );
      res.json({
        ...page,
        items: page.items.map(creditView),
        availablePoints: active
          .filter((row) => row.availableAt <= now)
          .reduce((sum, row) => sum + row.remainingPoints, 0),
        pendingPoints: active
          .filter((row) => row.availableAt > now)
          .reduce((sum, row) => sum + row.remainingPoints, 0),
        referralCode:
          req.user.emailVerified && !req.access.restricted ? me?.code : null,
        referralClaimed: !!me?.referredByUid,
        canClaimReferral:
          req.user.emailVerified &&
          !req.access.restricted &&
          !me?.referredByUid &&
          (await db.bookings.countDocuments(customerQuery(req.user))) === 0,
        reconciliationPending: more,
        emailVerified: req.user.emailVerified,
      });
    },
    redemptions: async (req, res) => {
      queryFilter(req.query);
      const page = await pageDocs(
        (await collections()).loyaltySpends,
        { ownerUid: req.user.uid },
        req.query,
        { scope: `loyalty-spends:${req.user.uid}` },
      );
      res.json({ ...page, items: page.items.map(spendView) });
    },
    claim: async (req, res) => {
      checkKeys(req.body, ["code", "confirmed"]);
      if (!req.user.emailVerified || req.access.restricted)
        fail(
          403,
          "Verify your email before joining a referral.",
          "LOYALTY_VERIFICATION",
        );
      if (
        req.body.confirmed !== true ||
        typeof req.body.code !== "string" ||
        !/^[a-f0-9]{24}$/.test(req.body.code)
      )
        fail(
          400,
          "Enter a valid referral code and confirm.",
          "VALIDATION_ERROR",
        );
      const db = await collections();
      await retryTransaction(db, async (tx) => {
        await guard(tx, req.user.uid);
        const me = await profile(tx, req.user.uid),
          inviter = await tx.loyaltyProfiles.findOne({ code: req.body.code });
        if (
          !inviter ||
          inviter._id === req.user.uid ||
          !(await allowedOwner(tx, inviter._id))
        )
          fail(400, "This referral code cannot be used.", "REFERRAL_INVALID");
        if (
          me.referredByUid ||
          (await tx.bookings.countDocuments(customerQuery(req.user)))
        )
          fail(
            409,
            "A referral can be selected once, before your first booking.",
            "REFERRAL_INELIGIBLE",
          );
        let cursor = inviter;
        for (let depth = 0; cursor; depth++) {
          if (cursor._id === req.user.uid || depth >= 32)
            fail(409, "Referral loops are not allowed.", "REFERRAL_INVALID");
          cursor = cursor.referredByUid
            ? await tx.loyaltyProfiles.findOne({ _id: cursor.referredByUid })
            : null;
        }
        await tx.loyaltyProfiles.updateOne(
          { _id: req.user.uid },
          { $set: { referredByUid: inviter._id, referralClaimedAt: clock() } },
        );
      });
      res.json({ acknowledged: true });
    },
  };
};
module.exports = { POLICY, createLoyalty, loyaltyTransition, discountForLabor };
