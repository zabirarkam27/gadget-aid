require("dotenv").config();
const admin = require("firebase-admin");
const { MongoClient } = require("mongodb");
const { createDatabase } = require("../database");
const { bootstrapSuperAdmin } = require("../bootstrap");
const run = async () => {
  const [action, uid, ...reason] = process.argv.slice(2);
  if (
    !["grant", "revoke"].includes(action) ||
    !uid ||
    process.env.SUPER_ADMIN_CONFIRM_UID !== uid ||
    process.env.SUPER_ADMIN_ALLOW_WRITE !== "yes" ||
    !process.env.SUPER_ADMIN_OPERATOR ||
    reason.join(" ").trim().length < 10
  )
    throw new Error(
      "Confirm the exact target UID and configure explicit operator/write opt-in before bootstrap.",
    );
  if (!admin.apps.length)
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FB_PROJECT_ID,
        clientEmail: process.env.FB_CLIENT_EMAIL,
        privateKey: process.env.FB_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  const client = new MongoClient(
    `mongodb+srv://${encodeURIComponent(process.env.DB_USER || "")}:${encodeURIComponent(process.env.DB_PASSWORD || "")}@cluster0.cuvfj.mongodb.net/?retryWrites=true&w=majority&appName=GadgetAidBootstrap`,
  );
  try {
    await client.connect();
    const result = await bootstrapSuperAdmin({
      db: createDatabase(client),
      directory: admin.auth(),
      uid,
      operator: process.env.SUPER_ADMIN_OPERATOR,
      reason: reason.join(" "),
      active: action === "grant",
    });
    console.log(JSON.stringify(result));
  } finally {
    await client.close();
  }
};
run().catch(() => {
  console.error(
    "Bootstrap did not complete. Check target UID confirmation, operator/write opt-in, verified account and server credentials. No credentials are logged.",
  );
  process.exitCode = 1;
});
