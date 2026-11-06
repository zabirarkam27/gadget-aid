// Run locally with the existing server .env; never prints encryption material.
const fs = require("node:fs"),
  path = require("node:path"),
  { randomBytes } = require("node:crypto");
const dotenv = require("dotenv"),
  { MongoClient } = require("mongodb"),
  { receiptVaultFromEnv } = require("../receipt-vault");
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });
const run = async () => {
  if (process.env.RECEIPT_ENCRYPTION_KEY) {
    receiptVaultFromEnv();
    console.log(
      "Existing receipt encryption configuration is valid; no key was changed.",
    );
    return;
  }
  if (!process.env.DB_USER || !process.env.DB_PASSWORD)
    throw Error("Existing server database configuration is required.");
  require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);
  const client = new MongoClient(
    `mongodb+srv://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@cluster0.cuvfj.mongodb.net/?retryWrites=true&w=majority`,
  );
  try {
    await client.connect();
    const db = client.db("gadgetAidDB");
    if (
      await db
        .collection("privateReceiptFiles")
        .countDocuments({}, { limit: 1 })
    )
      throw Error(
        "Encrypted files already exist. Restore their key from a secure backup; do not generate a replacement.",
      );
    await db
      .collection("deviceReceipts")
      .createIndex({ ownerUid: 1, deviceId: 1, _id: -1 });
    await db
      .collection("privateReceiptFiles")
      .createIndex({ ownerUid: 1, deviceId: 1, _id: -1 });
    const key = randomBytes(32).toString("base64");
    fs.appendFileSync(
      envPath,
      `\n# Private receipt encryption: back up securely, never copy to VITE variables or Git.\nRECEIPT_KEY_ID=v1\nRECEIPT_ENCRYPTION_KEY=${key}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    console.log(
      "Private receipt encryption configured in the ignored server .env; storage indexes are ready. Back up the key securely before storing real receipts.",
    );
  } finally {
    await client.close();
  }
};
run().catch((e) => {
  console.error(
    e.message.startsWith("Encrypted files")
      ? e.message
      : "Receipt storage configuration failed. Check server database permissions and existing key configuration. No key is logged.",
  );
  process.exitCode = 1;
});
