require("dotenv").config({ quiet: true });
const dns = require("node:dns");
const { MongoClient } = require("mongodb");
const { createDatabase } = require("../database");
const { maintainCatalogue } = require("../catalogue-maintenance");
const run = async () => {
  const mode = process.argv[2];
  if (!["prepare", "activate"].includes(mode)) throw Error("Choose prepare or activate.");
  if (!process.env.DB_USER || !process.env.DB_PASSWORD) throw Error("Database configuration is missing.");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  const client = new MongoClient(`mongodb+srv://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@cluster0.cuvfj.mongodb.net/?retryWrites=true&w=majority&appName=GadgetAidCatalogueMaintenance`, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await maintainCatalogue(createDatabase(client), { activate: mode === "activate" })));
  } finally { await client.close(); }
};
run().catch(() => {
  console.error("Catalogue maintenance did not finish. Check configuration, index permissions or concurrent writes, then rerun. No private data is logged.");
  process.exitCode = 1;
});
