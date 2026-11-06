const { retryTransaction } = require("./transaction-retry");
const { createHash } = require("node:crypto");
const { ObjectId } = require("mongodb");
const { fail, checkKeys, idValue, serializeService } = require("./domain");
const { visibleServices } = require("./access");
const { listPage, catalogueFilter } = require("./listings");
const { pageDocs, queryFilter } = require("./pagination");
const savedId = (uid, technicianId) =>
  new ObjectId(
    createHash("sha256")
      .update(JSON.stringify(["saved-technician-v1", uid, technicianId]))
      .digest("hex")
      .slice(0, 24),
  );
const card = (service) => {
  const s = serializeService(service);
  return Object.fromEntries(
    [
      "_id",
      "name",
      "categoryId",
      "categoryLabel",
      "description",
      "area",
      "price",
      "providerName",
      "technicianId",
      "image",
      "bookable",
    ].map((key) => [key, s[key]]),
  );
};
const createDiscoveryTools = ({ collections, clock }) => ({
  compare: async (req, res) => {
    if (
      Object.keys(req.query).some((key) => key !== "ids") ||
      typeof req.query.ids !== "string"
    )
      fail(400, "Choose up to three services.", "VALIDATION_ERROR");
    const ids = req.query.ids.split(",");
    if (
      !ids.length ||
      ids.length > 3 ||
      new Set(ids.map((id) => id.toLowerCase())).size !== ids.length
    )
      fail(400, "Choose one to three distinct services.", "VALIDATION_ERROR");
    const normalized = ids.map((id) => String(idValue(id)));
    const db = await collections();
    const rows = await visibleServices(
      db,
      await db.services
        .find({ _id: { $in: normalized.map(idValue) }, deletedAt: null })
        .toArray(),
    );
    const byId = new Map(rows.map((row) => [String(row._id), card(row)]));
    res.json({
      items: normalized.filter((id) => byId.has(id)).map((id) => byId.get(id)),
      unavailableIds: normalized.filter((id) => !byId.has(id)),
      pricingNote:
        "Listed service prices only. Diagnosis, parts and labor may change the final quotation. Confirm scope, compatibility and warranty with the provider.",
    });
  },
  estimate: async (req, res) => {
    checkKeys(req.body, ["category", "model", "symptom"]);
    const { category = "", model = "", symptom = "" } = req.body;
    if (
      typeof model !== "string" ||
      model.length > 80 ||
      typeof symptom !== "string" ||
      symptom.trim().length < 2 ||
      symptom.length > 80 ||
      typeof category !== "string"
    )
      fail(
        400,
        "Use a repair keyword of 2–80 characters and a model of up to 80 characters.",
        "VALIDATION_ERROR",
      );
    const db = await collections();
    const query = {
      q: symptom.trim(),
      limit: "100",
      ...(category ? { category } : {}),
    };
    const page = await listPage({
      collection: db.services,
      filter: catalogueFilter(query),
      query,
      scope: "estimate",
      visible: (rows) => visibleServices(db, rows),
    });
    const priced = page.items
      .map(serializeService)
      .filter((row) => row.price !== null);
    const prices = priced.map((row) => row.price).sort((a, b) => a - b);
    res.json({
      sampleSize: prices.length,
      hasMore: !!page.nextCursor,
      min: prices.length ? prices[0] : null,
      max: prices.length ? prices.at(-1) : null,
      modelSpecific: false,
      basis:
        "Current matching provider-listed service prices, not completed-repair bills. Model-specific parts, labor, taxes and warranty are not inferred. A technician must confirm the final quotation.",
      items: priced.slice(0, 6).map((row) => card(row)),
      currency: null,
      observedAt: clock(),
      pricingUnit:
        "Existing catalogue $ display; confirm currency with the provider.",
    });
  },
  saved: async (req, res) => {
    const db = await collections();
    queryFilter(req.query);
    const page = await pageDocs(
      db.savedTechnicians,
      { ownerUid: req.user.uid },
      req.query,
      { scope: `saved-technicians:${req.user.uid}` },
    );
    const items = [];
    for (const row of page.items) {
      const service = await db.services.findOne({
        _id: idValue(row.serviceId),
        deletedAt: null,
      });
      const available =
        service && (await visibleServices(db, [service])).length > 0;
      items.push({
        _id: String(row._id),
        technicianId: row.technicianId,
        createdAt: row.createdAt,
        available: !!available,
        name: available
          ? serializeService(service).providerName
          : "Technician currently unavailable",
        serviceId: available ? String(service._id) : null,
      });
    }
    res.json({ ...page, items });
  },
  save: async (req, res) => {
    checkKeys(req.body, ["serviceId"]);
    const db = await collections(),
      service = await db.services.findOne({
        _id: idValue(req.body.serviceId),
        deletedAt: null,
      });
    if (!service || !(await visibleServices(db, [service])).length)
      fail(404, "This listing is unavailable.", "NOT_FOUND");
    const technicianId = serializeService(service).technicianId,
      id = savedId(req.user.uid, technicianId);
    await retryTransaction(db, async (tx) => {
      const old = await tx.savedTechnicians.findOne({
        _id: id,
        ownerUid: req.user.uid,
      });
      const guard = `saved-technicians:${req.user.uid}`;
      const previous = await tx.operationMeta.findOne({ _id: guard });
      if (previous)
        await tx.operationMeta.updateOne(
          { _id: guard },
          { $set: { revision: (previous.revision || 0) + 1 } },
        );
      else await tx.operationMeta.insertOne({ _id: guard, revision: 1 });
      if (old)
        return tx.savedTechnicians.updateOne(
          { _id: id, ownerUid: req.user.uid },
          { $set: { serviceId: String(service._id) } },
        );
      if (
        (await tx.savedTechnicians.countDocuments({
          ownerUid: req.user.uid,
        })) >= 100
      )
        fail(
          409,
          "You can save up to 100 technicians. Remove one first.",
          "SAVED_LIMIT",
        );
      await tx.savedTechnicians.insertOne({
        _id: id,
        ownerUid: req.user.uid,
        technicianId,
        serviceId: String(service._id),
        createdAt: clock(),
      });
    });
    res.json({ acknowledged: true, id: String(id) });
  },
  remove: async (req, res) => {
    const result = await (
      await collections()
    ).savedTechnicians.deleteOne({
      _id: idValue(req.params.id),
      ownerUid: req.user.uid,
    });
    res.json({ acknowledged: true, deletedCount: result.deletedCount });
  },
});
module.exports = { createDiscoveryTools };
