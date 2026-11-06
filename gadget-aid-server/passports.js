const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");
const {
  fail,
  checkKeys,
  idValue,
  validDate,
  todayInDhaka,
  customerQuery,
  serviceOwner,
  serializeBooking,
} = require("./domain");
const { completionVerified } = require("./reviews");
const { pageDocs, queryFilter } = require("./pagination");
const text = (value, min, max, label) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(400, `Check ${label} (${min}–${max} characters).`, "VALIDATION_ERROR");
  return value.trim();
};
const revision = (body) => {
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0)
    fail(400, "Refresh the record before changing it.", "VALIDATION_ERROR");
  return body.expectedRevision;
};
const same = (row, expected) => {
  if ((row.revision || 0) !== expected)
    fail(409, "The record changed. Refresh before retrying.", "STALE_PASSPORT");
};
const ownBooking = (row, user) =>
  row.userEmail === user.email && (!row.userUid || row.userUid === user.uid);
const deviceView = (row, privateFields = false) => ({
  _id: String(row._id),
  label: row.label,
  type: row.type,
  brand: row.brand,
  model: row.model,
  revision: row.revision,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  ...(privateFields
    ? { serialNumber: row.serialNumber, purchaseDate: row.purchaseDate }
    : {}),
});
const warrantyId = (id) =>
  new ObjectId(
    createHash("sha256")
      .update(`warranty-v1:${idValue(id).toHexString()}`)
      .digest("hex")
      .slice(0, 24),
  );
const warrantyView = (row, clock) =>
  row
    ? {
        _id: String(row._id),
        bookingId: row.bookingId,
        providerName: row.providerName,
        startDate: row.startDate,
        endDate: row.endDate,
        coverage: row.coverage,
        exclusions: row.exclusions,
        revision: row.revision,
        createdAt: row.createdAt,
        periodState:
          todayInDhaka(clock()) < row.startDate
            ? "not_started"
            : todayInDhaka(clock()) > row.endDate
              ? "expired"
              : "within_dates",
        claim: row.claim
          ? {
              description: row.claim.description,
              state: row.claim.state,
              history: row.claim.history.map(
                ({ state, note, actorRole, createdAt }) => ({
                  state,
                  note,
                  actorRole,
                  createdAt,
                }),
              ),
            }
          : null,
      }
    : null;
const createPassports = ({ collections, clock }) => {
  const dbReady = async () => {
    const db = await collections();
    if (!db.devices || !db.warranties || !db.transaction)
      fail(
        503,
        "Device records require a transaction-capable database.",
        "SERVICE_UNAVAILABLE",
      );
    return db;
  };
  const owned = async (db, id, user) => {
    const row = await db.devices.findOne({
      _id: idValue(id),
      ownerUid: user.uid,
    });
    if (!row) fail(404, "Device not found.", "NOT_FOUND");
    return row;
  };
  const fields = (body) => {
    const purchaseDate =
      body.purchaseDate === undefined || body.purchaseDate === ""
        ? null
        : body.purchaseDate;
    if (
      purchaseDate !== null &&
      (!validDate(purchaseDate) || purchaseDate > todayInDhaka(clock()))
    )
      fail(
        400,
        "Use a valid purchase date that is not in the future.",
        "VALIDATION_ERROR",
      );
    return {
      label: text(body.label, 2, 100, "device name"),
      type: text(body.type, 2, 60, "device type"),
      brand: text(body.brand, 0, 80, "brand"),
      model: text(body.model, 0, 120, "model"),
      serialNumber: text(body.serialNumber, 0, 160, "serial number"),
      purchaseDate,
    };
  };
  const context = async (req, db) => {
    const booking = await db.bookings.findOne({ _id: idValue(req.params.id) });
    if (!booking) fail(404, "Booking not found.", "NOT_FOUND");
    let service = null;
    try {
      service = await db.services.findOne({
        _id: idValue(String(booking.serviceId)),
      });
    } catch (e) {
      if (e.status !== 400) throw e;
    }
    const customer = ownBooking(booking, req.user),
      provider = serviceOwner(service, req.user);
    if (!customer && !provider)
      fail(403, "This booking is private to its participants.", "FORBIDDEN");
    return { booking, service, customer, provider };
  };
  const list = async (req, res) => {
    const db = await dbReady(),
      filter = queryFilter(req.query, {
        fields: ["label", "brand", "model", "type"],
      });
    res.json(
      await pageDocs(
        db.devices,
        { $and: [{ ownerUid: req.user.uid }, filter] },
        req.query,
        {
          scope: `devices:${req.user.uid}`,
          projection: {
            _id: 1,
            label: 1,
            type: 1,
            brand: 1,
            model: 1,
            revision: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ),
    );
  };
  const create = async (req, res) => {
    checkKeys(req.body, [
      "label",
      "type",
      "brand",
      "model",
      "serialNumber",
      "purchaseDate",
    ]);
    const value = fields(req.body),
      db = await dbReady();
    const row = {
      _id: new ObjectId(),
      ownerUid: req.user.uid,
      ...value,
      revision: 0,
      createdAt: clock(),
      updatedAt: clock(),
    };
    await db.transaction(async (tx) => {
      const id = `devices:${req.user.uid}`,
        guard = await tx.operationMeta.findOne({ _id: id });
      if (guard)
        await tx.operationMeta.updateOne(
          { _id: id },
          { $set: { nonce: new ObjectId().toHexString() } },
        );
      else
        await tx.operationMeta.insertOne({
          _id: id,
          nonce: new ObjectId().toHexString(),
        });
      if ((await tx.devices.countDocuments({ ownerUid: req.user.uid })) >= 200)
        fail(
          409,
          "Up to 200 devices can be kept in your passport.",
          "DEVICE_LIMIT",
        );
      await tx.devices.insertOne(row);
    });
    res.status(201).json(deviceView(row, true));
  };
  const read = async (req, res) => {
    res.json(
      deviceView(await owned(await dbReady(), req.params.id, req.user), true),
    );
  };
  const update = async (req, res) => {
    checkKeys(req.body, [
      "label",
      "type",
      "brand",
      "model",
      "serialNumber",
      "purchaseDate",
      "expectedRevision",
    ]);
    const expected = revision(req.body),
      value = fields(req.body),
      db = await dbReady();
    const result = await db.transaction(async (tx) => {
      const old = await owned(tx, req.params.id, req.user);
      same(old, expected);
      const next = { ...value, revision: old.revision + 1, updatedAt: clock() };
      const write = await tx.devices.updateOne(
        { _id: old._id, ownerUid: req.user.uid, revision: expected },
        { $set: next },
      );
      if (!write.matchedCount) fail(409, "Device changed.", "STALE_PASSPORT");
      return deviceView({ ...old, ...next }, true);
    });
    res.json(result);
  };
  const remove = async (req, res) => {
    checkKeys(req.body, ["confirmed", "expectedRevision"]);
    const expected = revision(req.body);
    if (req.body.confirmed !== true)
      fail(
        400,
        "Confirm deletion of this exact device.",
        "CONFIRMATION_REQUIRED",
      );
    const db = await dbReady();
    await db.transaction(async (tx) => {
      const row = await owned(tx, req.params.id, req.user);
      same(row, expected);
      await tx.bookings.updateMany(
        { deviceId: String(row._id) },
        { $set: { deviceId: null } },
      );
      const write = await tx.devices.deleteOne({
        _id: row._id,
        ownerUid: req.user.uid,
        revision: expected,
      });
      if (!write.deletedCount) fail(409, "Device changed.", "STALE_PASSPORT");
    });
    res.json({ acknowledged: true });
  };
  const historyRows = async (db, rows) => {
    const result = [];
    for (const b of rows)
      result.push({
        _id: String(b._id),
        serviceName: b.serviceName,
        status: serializeBooking(b).status,
        date: b.date,
        warranty: warrantyView(
          await db.warranties.findOne({ _id: warrantyId(String(b._id)) }),
          clock,
        ),
      });
    return result;
  };
  const history = async (req, res) => {
    const db = await dbReady(),
      row = await owned(db, req.params.id, req.user);
    queryFilter(req.query);
    const page = await pageDocs(
      db.bookings,
      { $and: [{ deviceId: String(row._id) }, customerQuery(req.user)] },
      req.query,
      { scope: `device-history:${row._id}:${req.user.uid}` },
    );
    res.json({ ...page, items: await historyRows(db, page.items) });
  };
  const exportData = async (req, res) => {
    const db = await dbReady();
    const result = await db.transaction(async (tx) => {
      const row = await owned(tx, req.params.id, req.user);
      const rows = await tx.bookings
        .find({
          $and: [{ deviceId: String(row._id) }, customerQuery(req.user)],
        })
        .sort({ _id: -1 })
        .limit(1001)
        .toArray();
      if (rows.length > 1000)
        fail(
          409,
          "This history is too large for a single export. Use the paginated history view.",
          "EXPORT_LIMIT",
        );
      return {
        format: "gadgetaid-passport-v1",
        exportedAt: clock(),
        device: deviceView(row, true),
        repairs: await historyRows(tx, rows),
      };
    });
    res
      .set("Cache-Control", "no-store")
      .set(
        "Content-Disposition",
        `attachment; filename="device-${req.params.id}.json"`,
      )
      .json(result);
  };
  const link = async (req, res) => {
    checkKeys(req.body, ["deviceId", "expectedDeviceId"]);
    const deviceId =
      req.body.deviceId === null
        ? null
        : idValue(req.body.deviceId).toHexString();
    const expectedDeviceId =
      req.body.expectedDeviceId === null
        ? null
        : idValue(req.body.expectedDeviceId).toHexString();
    const db = await dbReady();
    await db.transaction(async (tx) => {
      const ctx = await context(req, tx);
      if (!ctx.customer)
        fail(
          403,
          "Only the booking customer can associate a device.",
          "FORBIDDEN",
        );
      if ((ctx.booking.deviceId || null) !== expectedDeviceId)
        fail(
          409,
          "The linked device changed. Refresh first.",
          "STALE_PASSPORT",
        );
      if (deviceId !== null) {
        const row = await owned(tx, deviceId, req.user);
        await tx.devices.updateOne(
          { _id: row._id },
          { $set: { linkGuard: new ObjectId().toHexString() } },
        );
      }
      await tx.bookings.updateOne(
        { _id: ctx.booking._id },
        { $set: { deviceId } },
      );
    });
    res.json({ acknowledged: true });
  };
  const bookingRead = async (req, res) => {
    const db = await dbReady(),
      ctx = await context(req, db),
      row = await db.warranties.findOne({ _id: warrantyId(req.params.id) });
    let device = null;
    if (ctx.customer && ctx.booking.deviceId) {
      const d = await db.devices.findOne({
        _id: idValue(ctx.booking.deviceId),
        ownerUid: req.user.uid,
      });
      if (d) device = deviceView(d);
    }
    res.json({
      device,
      warranty: warrantyView(row, clock),
      customer: ctx.customer,
      canIssue:
        ctx.provider &&
        req.access.canProvide &&
        !req.access.restricted &&
        !row &&
        completionVerified(ctx.booking, ctx.service),
      canManageClaim:
        ctx.provider &&
        req.access.canProvide &&
        !req.access.restricted &&
        (!row || row.providerUid === req.user.uid),
      repairRevision: ctx.booking.repairRevision || 0,
    });
  };
  const issue = async (req, res) => {
    checkKeys(req.body, [
      "durationDays",
      "coverage",
      "exclusions",
      "confirmed",
      "expectedRevision",
    ]);
    const expected = revision(req.body),
      coverage = text(req.body.coverage, 20, 2000, "coverage"),
      exclusions = text(req.body.exclusions, 0, 2000, "exclusions");
    if (
      req.body.confirmed !== true ||
      !Number.isInteger(req.body.durationDays) ||
      req.body.durationDays < 1 ||
      req.body.durationDays > 730
    )
      fail(
        400,
        "Confirm provider terms and choose 1–730 days.",
        "VALIDATION_ERROR",
      );
    const db = await dbReady();
    const result = await db.transaction(async (tx) => {
      const ctx = await context(req, tx);
      if (!ctx.provider || !req.access.canProvide)
        fail(
          403,
          "Only the authorized repair provider can issue warranty terms.",
          "FORBIDDEN",
        );
      if (!completionVerified(ctx.booking, ctx.service))
        fail(
          409,
          "Warranty issuance requires a recorded completed handover.",
          "HANDOVER_REQUIRED",
        );
      if ((ctx.booking.repairRevision || 0) !== expected)
        fail(409, "Repair changed. Refresh first.", "STALE_PASSPORT");
      const id = warrantyId(req.params.id);
      if (await tx.warranties.findOne({ _id: id }))
        fail(
          409,
          "Warranty terms have already been issued and are permanent.",
          "WARRANTY_EXISTS",
        );
      const completion = ctx.booking.repair.events.find(
          (e) =>
            e.status === "completed" &&
            e.type === "status_changed" &&
            e.actor?.role === "provider" &&
            (!ctx.service.providerUid ||
              e.actor.uid === ctx.service.providerUid) &&
            e.createdAt instanceof Date,
        ),
        startDate = todayInDhaka(completion.createdAt),
        end = new Date(`${startDate}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + req.body.durationDays - 1);
      const row = {
        _id: id,
        warrantyVersion: 1,
        bookingId: String(ctx.booking._id),
        providerUid: req.user.uid,
        providerName:
          req.user.name || ctx.service.providerName || "Repair provider",
        startDate,
        endDate: end.toISOString().slice(0, 10),
        coverage,
        exclusions,
        revision: 0,
        createdAt: clock(),
        claim: null,
      };
      await tx.bookings.updateOne(
        { _id: ctx.booking._id },
        { $set: { warrantyGuard: new ObjectId().toHexString() } },
      );
      await tx.warranties.insertOne(row);
      return warrantyView(row, clock);
    });
    res.status(201).json(result);
  };
  const claim = async (req, res) => {
    checkKeys(req.body, ["description", "expectedRevision"]);
    const expected = revision(req.body),
      description = text(req.body.description, 20, 4000, "claim description"),
      db = await dbReady();
    const result = await db.transaction(async (tx) => {
      const ctx = await context(req, tx);
      if (!ctx.customer)
        fail(403, "Only the repair customer can submit a claim.", "FORBIDDEN");
      const row = await tx.warranties.findOne({
        _id: warrantyId(req.params.id),
      });
      if (!row) fail(404, "No provider warranty was issued.", "NOT_FOUND");
      same(row, expected);
      if (row.claim)
        fail(
          409,
          "A claim already exists for this repair warranty.",
          "CLAIM_EXISTS",
        );
      const today = todayInDhaka(clock());
      if (today < row.startDate || today > row.endDate)
        fail(
          409,
          "This warranty is outside its stated dates. Contact booking support.",
          "WARRANTY_EXPIRED",
        );
      const next = {
        revision: row.revision + 1,
        claim: {
          description,
          state: "submitted",
          history: [
            {
              state: "submitted",
              note: "Claim submitted for provider review; coverage is not yet approved.",
              actorRole: "customer",
              createdAt: clock(),
            },
          ],
        },
      };
      await tx.warranties.updateOne(
        { _id: row._id, revision: expected },
        { $set: next },
      );
      return warrantyView({ ...row, ...next }, clock);
    });
    res.status(201).json(result);
  };
  const decide = async (req, res) => {
    checkKeys(req.body, ["state", "note", "expectedRevision", "confirmed"]);
    const expected = revision(req.body),
      note = text(req.body.note, 10, 2000, "claim decision");
    if (req.body.confirmed !== true)
      fail(400, "Confirm this claim decision.", "CONFIRMATION_REQUIRED");
    const db = await dbReady();
    const result = await db.transaction(async (tx) => {
      const ctx = await context(req, tx);
      if (!ctx.provider || !req.access.canProvide)
        fail(403, "Provider authorization required.", "FORBIDDEN");
      const row = await tx.warranties.findOne({
        _id: warrantyId(req.params.id),
      });
      if (!row || row.providerUid !== req.user.uid)
        fail(404, "Warranty not found.", "NOT_FOUND");
      same(row, expected);
      const allowed = {
        submitted: ["in_review"],
        in_review: ["approved", "rejected"],
        approved: ["fulfilled"],
      };
      if (!row.claim || !allowed[row.claim.state]?.includes(req.body.state))
        fail(
          409,
          "This claim transition is not available.",
          "INVALID_CLAIM_TRANSITION",
        );
      const next = {
        revision: row.revision + 1,
        claim: {
          ...row.claim,
          state: req.body.state,
          history: [
            ...row.claim.history,
            {
              state: req.body.state,
              note,
              actorRole: "provider",
              createdAt: clock(),
            },
          ],
        },
      };
      await tx.warranties.updateOne(
        { _id: row._id, revision: expected },
        { $set: next },
      );
      return warrantyView({ ...row, ...next }, clock);
    });
    res.json(result);
  };
  return {
    list,
    create,
    read,
    update,
    remove,
    history,
    exportData,
    link,
    bookingRead,
    issue,
    claim,
    decide,
  };
};
module.exports = { createPassports };
