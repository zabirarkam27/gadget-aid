require("dotenv").config();
const { MongoClient } = require("mongodb");
const { createDatabase } = require("../database");
const { moderateReview } = require("../reviews");
const run = async () => {
  const actor = process.env.MODERATION_OPERATOR || "";
  if (actor.length < 3)
    throw new Error(
      "Set MODERATION_OPERATOR to an authorized operator reference first.",
    );
  if (!process.env.DB_USER || !process.env.DB_PASSWORD)
    throw new Error(
      "Configure the operator's authorized database credentials first.",
    );
  const [action, reviewId, ...reasonParts] = process.argv.slice(2);
  if (!["list", "hide", "restore"].includes(action))
    throw new Error(
      "Use list, or hide/restore <reviewId> <reason of at least 10 characters>.",
    );
  if (action !== "list" && process.env.MODERATION_ALLOW_WRITE !== "yes")
    throw new Error(
      "Review the report first, then explicitly set MODERATION_ALLOW_WRITE=yes for this operation.",
    );
  const client = new MongoClient(
    `mongodb+srv://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@cluster0.cuvfj.mongodb.net/?retryWrites=true&w=majority&appName=GadgetAidModeration`,
  );
  try {
    await client.connect();
    const db = createDatabase(client);
    if (action === "list") {
      const reports = await db.reviewReports
        .find({ state: "pending" })
        .toArray();
      console.log(
        JSON.stringify(
          reports.map((r) => ({
            reportId: String(r._id),
            reviewId: r.reviewId,
            category: r.category,
            details: r.details,
            createdAt: r.createdAt,
          })),
          null,
          2,
        ),
      );
    } else
      console.log(
        JSON.stringify(
          await moderateReview(db, {
            reviewId,
            action,
            reason: reasonParts.join(" "),
            actor,
          }),
        ),
      );
  } finally {
    await client.close();
  }
};
run().catch(() => {
  console.error(
    "Moderation did not complete. Check operator authorization, arguments, database configuration and write opt-in. No credentials are logged.",
  );
  process.exitCode = 1;
});
