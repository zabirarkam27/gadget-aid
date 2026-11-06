const collectionNames = {
  services: "services",
  bookings: "bookings",
  notifications: "notifications",
  threads: "bookingThreads",
  technicians: "technicians",
  reviews: "reviews",
  reviewReports: "reviewReports",
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
                find: (query) => collection.find(query, { session }),
                findOne: (query) => collection.findOne(query, { session }),
                insertOne: (record) =>
                  collection.insertOne(record, { session }),
                updateOne: (query, update) =>
                  collection.updateOne(query, update, { session }),
              }
            : collection,
        ];
      }),
    );
  const db = bind();
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
