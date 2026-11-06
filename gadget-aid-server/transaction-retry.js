const { fail } = require("./domain");
// Cold guard/profile inserts can race on _id. Retry the rolled-back DB-only
// transaction once against a fresh snapshot; never replay external effects.
const retryTransaction = async (db, work) => {
  if (!db.transaction)
    fail(
      503,
      "A transaction-capable database is required.",
      "SERVICE_UNAVAILABLE",
    );
  try {
    return await db.transaction(work);
  } catch (error) {
    if (error.code !== 11000) throw error;
    return db.transaction(work);
  }
};
module.exports = { retryTransaction };
