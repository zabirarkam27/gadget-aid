const { catalogueFields } = require("./catalogue-fields");
const INDEXES = {
  services: [
    [{ deletedAt: 1, catalogueDateMissing: 1, catalogueDate: -1, _id: -1 }, "catalogue_newest_v1"],
    [{ deletedAt: 1, cataloguePriceMissing: 1, cataloguePrice: 1, _id: -1 }, "catalogue_low_v1"],
    [{ deletedAt: 1, cataloguePriceMissing: 1, cataloguePrice: -1, _id: -1 }, "catalogue_high_v1"],
    [{ deletedAt: 1, categoryId: 1, catalogueDateMissing: 1, catalogueDate: -1, _id: -1 }, "catalogue_category_v1"],
    [{ technicianId: 1, deletedAt: 1, _id: -1 }, "technician_services_v1"],
    [{ providerEmail: 1, deletedAt: 1, _id: -1 }, "provider_services_v1"],
    [{ deletedAt: 1, "modelPrices.modelKey": 1, catalogueDateMissing: 1, catalogueDate: -1, _id: -1 }, "model_estimates_v1"],
  ],
  reviews: [[{ technicianId: 1, moderationState: 1, reviewVersion: 1, createdAt: -1, _id: -1 }, "technician_reviews_v1"]],
  bookings: [[{ userEmail: 1, _id: -1 }, "customer_bookings_v1"], [{ serviceId: 1, _id: -1 }, "service_bookings_v1"]],
};
const maintainCatalogue = async (db, { activate = false } = {}) => {
  let after, updated = 0;
  for (;;) {
    const rows = await db.services.find(after ? { _id: { $gt: after } } : {}, {
      projection: { _id: 1, providerEmail: 1, price: 1, createdAt: 1, updatedAt: 1 }, maxTimeMS: 10000,
    }).sort({ _id: 1 }).limit(200).toArray();
    if (!rows.length) break;
    const result = await db.services.bulkWrite(rows.map(row => ({ updateOne: {
      // A concurrent listing edit must not leave stale derived keys behind.
      filter: { _id: row._id, providerEmail: row.providerEmail ?? null, price: row.price ?? null, createdAt: row.createdAt ?? null, updatedAt: row.updatedAt ?? null },
      update: { $set: catalogueFields(row) },
    } })), { ordered: false });
    if (result.matchedCount !== rows.length) throw Error("Concurrent catalogue edits: rerun maintenance before activation.");
    updated += rows.length;
    after = rows.at(-1)._id;
  }
  for (const [collection, indexes] of Object.entries(INDEXES))
    for (const [key, name] of indexes) await db[collection].createIndex(key, { name });
  if (activate) await db.operationMeta.updateOne({ _id: "catalogue-index-v1" }, { $set: { state: "ready", completedAt: new Date() } }, { upsert: true });
  return { updated, indexes: Object.values(INDEXES).reduce((n, rows) => n + rows.length, 0), activated: activate };
};
module.exports = { maintainCatalogue, INDEXES };
