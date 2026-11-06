import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const require = createRequire(import.meta.url);
const { createApp } = require("../../gadget-aid-server/app.js");
const {
  createReceiptVault,
} = require("../../gadget-aid-server/receipt-vault.js");
const { randomBytes } = require("node:crypto");
const {
  createFixture,
  verifyIdToken,
  identityDirectory,
  users,
  fixedTime,
} = require("../../gadget-aid-server/tests/fixtures.cjs");
const fixture = createFixture({
  seedBooking: true,
  seedInProgress: true,
  seedAdminRoles: true,
});
const { ObjectId } = require("../../gadget-aid-server/node_modules/mongodb");
const {
  technicianId,
  defaultAvailability,
} = require("../../gadget-aid-server/technicians");
for (const key of ["provider", "other"]) {
  const u = users[key];
  fixture.db.applications.rows.push({
    _id: u.uid,
    uid: u.uid,
    email: u.email,
    businessName: u.name,
    statement: "Synthetic approved technician application for isolated QA.",
    state: "approved",
    publicNote: "Demo approval only.",
    revision: 1,
    createdAt: fixedTime,
  });
  fixture.db.technicians.rows.push({
    _id: new ObjectId(technicianId(u.email)),
    ownerUid: u.uid,
    ownerEmail: u.email,
    businessName: u.name,
    photo: null,
    bio: "Demo technician profile for isolated operations testing.",
    skills: ["Diagnostics"],
    categories: ["Electronics"],
    area: "Dhaka",
    yearsExperience: null,
    certifications: [],
    availability: defaultAvailability(),
    reservations: [],
    revision: 0,
    createdAt: fixedTime,
    profileVersion: 1,
  });
}
const qaStartedAt = Date.now();
const api = createApp({
  receiptVault: createReceiptVault({
    activeKeyId: "qa-v1",
    keys: { "qa-v1": randomBytes(32).toString("base64") },
  }),
  getCollections: async () => fixture.db,
  identityDirectory,
  verifyIdToken: async (token, ...args) => ({
    ...(await verifyIdToken(token, ...args)),
    auth_time: Math.floor(
      (fixedTime.getTime() + Date.now() - qaStartedAt) / 1000,
    ),
  }),
  clock: () => new Date(fixedTime.getTime() + Date.now() - qaStartedAt),
  origins: ["http://127.0.0.1:5176", "http://localhost:5176"],
});
const apiServer = api.listen(5055, "127.0.0.1");
const clientRoot = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  configFile: false,
  root: resolve(clientRoot, "tests/qa"),
  envDir: clientRoot,
  publicDir: resolve(clientRoot, "public"),
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify("http://127.0.0.1:5055"),
  },
  resolve: {
    alias: [
      {
        find: /^.*\/utils\/authFetch(?:\.js)?$/,
        replacement: resolve(clientRoot, "tests/qa/transport.js"),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5176,
    strictPort: true,
    fs: { allow: [resolve(clientRoot, "..")] },
  },
  clearScreen: false,
});
await server.listen();
console.log(
  "Isolated QA ready: http://127.0.0.1:5176/booked-services (memory database, fixed demo identities; no production connection)",
);
const close = async () => {
  await server.close();
  apiServer.closeAllConnections();
  apiServer.close(() => process.exit(0));
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
