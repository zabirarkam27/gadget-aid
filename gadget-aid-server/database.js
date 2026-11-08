const collectionNames = {
  services: "services",
  bookings: "bookings",
  notifications: "notifications",
  threads: "bookingThreads",
  technicians: "technicians",
  reviews: "reviews",
  reviewReports: "reviewReports",
  roleGrants: "roleGrants",
  accountControls: "accountControls",
  entityControls: "entityControls",
  auditLogs: "auditLogs",
  applications: "technicianApplications",
  disputes: "disputes",
  categories: "categories",
  operationMeta: "operationMeta",
  devices: "devices",
  warranties: "repairWarranties",
  receipts: "deviceReceipts",
  receiptFiles: "privateReceiptFiles",
  savedTechnicians: "savedTechnicians",
  examples: "repairExamples",
  exampleFiles: "repairExampleFiles",
  loyaltyProfiles: "loyaltyProfiles",
  loyaltyCredits: "loyaltyCredits",
  loyaltySpends: "loyaltySpends",
};
const createDatabase = (client, databaseName = "gadgetAidDB") => {
  const bind = (session) =>
    Object.fromEntries(
      Object.entries(collectionNames).map(([key, name]) => {
        const collection = client.db(databaseName).collection(name);
        return [
          key,
          session
            ? {
                find: (query, options = {}) =>
                  collection.find(query, { ...options, session }),
                countDocuments: (query) =>
                  collection.countDocuments(query, { session }),
                updateMany: (query, update) =>
                  collection.updateMany(query, update, { session }),
                findOne: (query) => collection.findOne(query, { session }),
                insertOne: (record) =>
                  collection.insertOne(record, { session }),
                updateOne: (query, update) =>
                  collection.updateOne(query, update, { session }),
                deleteOne: (query) => collection.deleteOne(query, { session }),
                deleteMany: (query) =>
                  collection.deleteMany(query, { session }),
              }
            : collection,
        ];
      }),
    );
  const db = bind();
  // A maintenance checkpoint enables persisted sort keys only after backfill/indexes.
  // No index builds or collection migrations run inside a request.
  db.services.catalogueIndexed = async () => !!(await db.operationMeta.findOne({ _id: "catalogue-index-v1", state: "ready" }));
  db.transaction = (work) =>
    client.withSession((session) =>
      session.withTransaction(() => work(bind(session)), {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
        maxCommitTimeMS: 10000,
      }),
    );
  return db;
};
module.exports = { createDatabase };
