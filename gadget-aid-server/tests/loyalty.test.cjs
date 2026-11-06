const test = require("node:test"),
  assert = require("node:assert/strict");
const { once } = require("node:events"),
  { ObjectId } = require("mongodb");
const { createApp } = require("../app"),
  { initialRepair } = require("../workflow"),
  { POLICY, discountForLabor } = require("../loyalty");
const {
  createFixture,
  verifyIdToken,
  fixedTime,
  ids,
  users,
} = require("./fixtures.cjs");
async function setup(t) {
  const f = createFixture({ seedBooking: true });
  let now = new Date(fixedTime);
  const server = createApp({
    getCollections: async () => f.db,
    verifyIdToken,
    clock: () => new Date(now),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const request = async (method, path, body, token = "customer") => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  return { ...f, request, setNow: (value) => (now = new Date(value)) };
}
function earnedSource(
  c,
  time,
  owner = users.customer,
  provider = users.provider,
) {
  const b = {
    ...c.booking,
    _id: new ObjectId(),
    userUid: owner.uid,
    userEmail: owner.email,
    userName: owner.name,
    providerUid: provider.uid,
    providerEmail: provider.email,
    createdAt: new Date(time),
    status: "completed",
    loyaltyPolicyVersion: POLICY,
    loyaltyCompletedAt: new Date(time),
    loyaltyRewardChecked: false,
  };
  Object.assign(b, initialRepair(b, provider, new Date(time), true));
  const quote = {
    id: new ObjectId().toHexString(),
    number: 1,
    parts: [],
    labor: 100,
    total: 100,
    currency: "USD",
    status: "approved",
    clarifications: [],
    sentAt: new Date(time),
  };
  b.repair.quotations.push(quote);
  b.repair.currentQuotationId = quote.id;
  b.repair.events.push({
    type: "status_changed",
    status: "completed",
    actor: { uid: provider.uid, role: "provider" },
    createdAt: new Date(time),
  });
  c.db.bookings.rows.push(b);
  return b;
}
function seedUsable(
  c,
  points = 100,
  expiry = new Date(+fixedTime + 365 * 86400000),
) {
  c.db.loyaltyCredits.rows.push({
    _id: new ObjectId(),
    ownerUid: users.customer.uid,
    type: "repair",
    points,
    remainingPoints: points,
    issuedAt: new Date(+fixedTime - 10 * 86400000),
    availableAt: new Date(+fixedTime - 3 * 86400000),
    expiresAt: expiry,
    day: "2026-10-26",
    month: "2026-10",
    policy: POLICY,
  });
}
async function offer(c, id = ids.booking) {
  const b = c.db.bookings.rows.find((row) => String(row._id) === id);
  Object.assign(b, initialRepair(b, users.provider, new Date(fixedTime), true));
  b.status = "diagnosing";
  b.repair.diagnoses.push({
    id: new ObjectId().toHexString(),
    summary: "An inspected issue",
    issue: "Hardware issue",
    recommendedRepair: "Qualified replacement",
    createdAt: new Date(fixedTime),
  });
  const r = await c.request(
    "POST",
    `/bookings/${id}/quotations`,
    {
      parts: [{ name: "Part", quantity: 1, unitPrice: 20 }],
      labor: 200,
      estimatedCompletion: "Two business days",
      loyaltyDiscount: true,
      expectedRevision: 0,
    },
    "provider",
  );
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.booking;
}
async function approve(c, b) {
  return c.request(
    "POST",
    `/bookings/${b._id}/quotations/${b.currentQuotation.id}/decision`,
    {
      decision: "approve",
      redeemPoints: true,
      expectedRevision: b.repairRevision,
    },
  );
}
test("rewards use trusted new handovers, once per day, seven-day maturity and original 365-day expiry", async (t) => {
  const c = await setup(t);
  earnedSource(c, fixedTime);
  earnedSource(c, new Date(+fixedTime + 1000));
  c.setNow(new Date(+fixedTime + 2000));
  let r = await c.request("GET", "/loyalty?limit=20");
  assert.equal(r.status, 200);
  assert.equal(r.data.pendingPoints, 20);
  assert.equal(r.data.availablePoints, 0);
  assert.equal(r.data.items.length, 1);
  assert.equal(
    new Date(r.data.items[0].expiresAt) - new Date(r.data.items[0].issuedAt),
    365 * 86400000,
  );
  assert.equal(
    (await c.request("GET", "/loyalty?limit=20")).data.items.length,
    1,
  );
  assert.ok(!JSON.stringify(r.data.items).includes(users.customer.uid));
  c.setNow(new Date(+fixedTime + 8 * 86400000));
  assert.equal(
    (await c.request("GET", "/loyalty?limit=20")).data.availablePoints,
    20,
  );
  c.setNow(new Date(+fixedTime + 366 * 86400000));
  assert.equal(
    (await c.request("GET", "/loyalty?limit=20")).data.availablePoints,
    0,
  );
  assert.equal(
    (await c.request("GET", "/loyalty?limit=20", undefined, "second")).data
      .items.length,
    0,
  );
});
test("old completions, self repairs and unquoted/low-value handovers do not mint rewards", async (t) => {
  const c = await setup(t);
  const old = earnedSource(c, fixedTime);
  delete old.loyaltyPolicyVersion;
  const low = earnedSource(c, fixedTime);
  low.repair.quotations[0].labor = 1;
  low.repair.quotations[0].total = 1;
  const self = earnedSource(c, fixedTime, users.provider);
  const r = await c.request("GET", "/loyalty?limit=20");
  assert.equal(r.data.availablePoints + r.data.pendingPoints, 0);
  const other = await c.request(
    "GET",
    "/loyalty?limit=20",
    undefined,
    "provider",
  );
  assert.equal(other.data.items.length, 0);
  assert.equal(self.userUid, self.providerUid);
});
test("referrals are single-choice before any booking, reject self/loops and award only first independent completion", async (t) => {
  const c = await setup(t);
  const inviter = (await c.request("GET", "/loyalty?limit=20")).data
    .referralCode;
  assert.equal(
    (
      await c.request("POST", "/loyalty/referral", {
        code: inviter,
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await c.request(
        "POST",
        "/loyalty/referral",
        { code: inviter, confirmed: true },
        "second",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await c.request(
        "POST",
        "/loyalty/referral",
        { code: inviter, confirmed: true },
        "second",
      )
    ).status,
    409,
  );
  earnedSource(c, fixedTime, users.second);
  await c.request("GET", "/loyalty?limit=20", undefined, "second");
  let wallet = (await c.request("GET", "/loyalty?limit=20")).data;
  assert.equal(wallet.pendingPoints, 40);
  assert.equal(wallet.items[0].type, "referral");
  assert.ok(!JSON.stringify(wallet.items).includes(users.second.uid));
  earnedSource(c, new Date(+fixedTime + 86400000), users.second);
  c.setNow(new Date(+fixedTime + 86400000));
  await c.request("GET", "/loyalty?limit=20", undefined, "second");
  wallet = (await c.request("GET", "/loyalty?limit=20")).data;
  assert.equal(wallet.pendingPoints, 40);
  const other = (
    await c.request("GET", "/loyalty?limit=20", undefined, "other")
  ).data.referralCode;
  assert.equal(
    (
      await c.request("POST", "/loyalty/referral", {
        code: other,
        confirmed: true,
      })
    ).status,
    409,
  );
});
test("provider offers only capped labor discount; explicit customer points consent is required", async (t) => {
  const c = await setup(t);
  seedUsable(c);
  const b = await offer(c);
  assert.equal(b.currentQuotation.loyalty.discount, 5);
  assert.equal(b.currentQuotation.labor, 195);
  assert.equal(b.currentQuotation.total, 215);
  const noConsent = await c.request(
    "POST",
    `/bookings/${ids.booking}/quotations/${b.currentQuotation.id}/decision`,
    { decision: "approve", expectedRevision: b.repairRevision },
  );
  assert.equal(noConsent.status, 400);
  assert.equal(c.db.loyaltySpends.rows.length, 0);
  assert.equal(discountForLabor(9.99), 0.49);
  const approved = await approve(c, b);
  assert.equal(approved.status, 200);
  assert.equal(c.db.loyaltySpends.rows.length, 1);
  assert.equal(c.db.loyaltyCredits.rows[0].remainingPoints, 0);
  assert.equal((await approve(c, b)).status, 409);
});
test("two competing approvals cannot double spend one available balance", async (t) => {
  const c = await setup(t);
  seedUsable(c);
  c.db.bookings.rows.push({
    ...c.booking,
    _id: new ObjectId("666666666666666666666666"),
  });
  const one = await offer(c),
    two = await offer(c, "666666666666666666666666");
  const results = await Promise.all([approve(c, one), approve(c, two)]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  assert.equal(c.db.loyaltySpends.rows.length, 1);
  assert.equal(
    c.db.bookings.rows.filter((row) => row.status === "approved").length,
    1,
  );
});
test("ledger failure rolls back approval; cancellation restores only unexpired credits once", async (t) => {
  const c = await setup(t);
  seedUsable(c, 60, new Date(+fixedTime + 86400000));
  seedUsable(c, 40);
  const b = await offer(c),
    original = c.db.loyaltySpends.insertOne;
  c.db.loyaltySpends.insertOne = async () => {
    throw Error("ledger failure");
  };
  assert.equal((await approve(c, b)).status, 500);
  assert.equal(c.db.bookings.rows[0].status, "awaiting_approval");
  assert.equal(
    c.db.loyaltyCredits.rows.reduce((sum, r) => sum + r.remainingPoints, 0),
    100,
  );
  c.db.loyaltySpends.insertOne = original;
  const approved = await approve(c, b);
  assert.equal(approved.status, 200);
  c.setNow(new Date(+fixedTime + 2 * 86400000));
  const cancelled = await c.request(
    "PATCH",
    `/all-bookings/${ids.booking}`,
    {
      status: "cancelled",
      note: "Customer and provider agreed to cancel",
      expectedRevision: approved.data.booking.repairRevision,
    },
    "provider",
  );
  assert.equal(cancelled.status, 200);
  assert.equal(c.db.loyaltySpends.rows[0].restoredPoints, 40);
  assert.equal(c.db.loyaltySpends.rows[0].refunded, true);
  assert.equal(
    c.db.loyaltyCredits.rows.reduce((sum, r) => sum + r.remainingPoints, 0),
    40,
  );
  assert.equal(
    (
      await c.request(
        "GET",
        "/loyalty/redemptions?limit=10",
        undefined,
        "second",
      )
    ).data.items.length,
    0,
  );
});
test("maturity, expiry and account restrictions cannot be bypassed by quote approval", async (t) => {
  const c = await setup(t);
  seedUsable(c, 100, new Date(+fixedTime - 1));
  const b = await offer(c);
  assert.equal((await approve(c, b)).status, 409);
  c.db.loyaltyCredits.rows[0].expiresAt = new Date(+fixedTime + 10 * 86400000);
  c.db.loyaltyCredits.rows[0].availableAt = new Date(+fixedTime + 86400000);
  assert.equal((await approve(c, b)).status, 409);
  c.db.loyaltyCredits.rows[0].availableAt = new Date(+fixedTime - 1);
  c.db.accountControls.rows.push({
    _id: users.customer.uid,
    state: "restricted",
  });
  assert.equal((await approve(c, b)).status, 403);
  assert.equal(c.db.loyaltySpends.rows.length, 0);
});
test("a revoked funding provider cannot authorize a points redemption", async (t) => {
  const c = await setup(t);
  seedUsable(c);
  const b = await offer(c);
  c.db.accountControls.rows.push({
    _id: users.provider.uid,
    state: "restricted",
  });
  const result = await approve(c, b);
  assert.equal(result.status, 409);
  assert.equal(result.data.code, "LOYALTY_PROVIDER_UNAVAILABLE");
  assert.equal(c.db.loyaltySpends.rows.length, 0);
  assert.equal(c.db.loyaltyCredits.rows[0].remainingPoints, 100);
});
test("referral cycles and monthly reward-cap bypasses are rejected", async (t) => {
  const c = await setup(t);
  const a = (await c.request("GET", "/loyalty?limit=20", undefined, "second"))
      .data.referralCode,
    b = (await c.request("GET", "/loyalty?limit=20", undefined, "other")).data
      .referralCode;
  assert.equal(
    (
      await c.request(
        "POST",
        "/loyalty/referral",
        { code: b, confirmed: true },
        "second",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await c.request(
        "POST",
        "/loyalty/referral",
        { code: a, confirmed: true },
        "other",
      )
    ).status,
    409,
  );
  const d = await setup(t),
    code = (await d.request("GET", "/loyalty?limit=20")).data.referralCode;
  await d.request(
    "POST",
    "/loyalty/referral",
    { code, confirmed: true },
    "second",
  );
  for (let i = 0; i < 3; i++)
    d.db.loyaltyCredits.rows.push({
      _id: new ObjectId(),
      ownerUid: users.customer.uid,
      type: "referral",
      points: 40,
      remainingPoints: 40,
      issuedAt: new Date(fixedTime),
      availableAt: new Date(+fixedTime + 7 * 86400000),
      expiresAt: new Date(+fixedTime + 365 * 86400000),
      month: "2026-11",
    });
  earnedSource(d, fixedTime, users.second);
  await d.request("GET", "/loyalty?limit=20", undefined, "second");
  assert.equal(
    d.db.loyaltyCredits.rows.filter(
      (row) => row.ownerUid === users.customer.uid && row.type === "referral",
    ).length,
    3,
  );
});
