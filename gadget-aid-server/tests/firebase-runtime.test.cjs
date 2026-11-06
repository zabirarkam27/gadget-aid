const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { generateKeyPairSync, sign, verify } = require("node:crypto");
const { once } = require("node:events");
const http = require("node:http");

test("Firebase Auth initializes when serverless require(ESM) is disabled", () => {
  const child = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", "require('firebase-admin/app');require('firebase-admin/auth');"], { cwd: require("node:path").resolve(__dirname, ".."), encoding: "utf8", timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
});
test("compatible JWKS dependency retrieves the correct RSA public signing key", async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: "jwk" }), kid: "synthetic-runtime-test", use: "sig", alg: "RS256" };
  const server = http.createServer((req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ keys: [key] })); }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const client = require("jwks-rsa")({ jwksUri: `http://127.0.0.1:${server.address().port}/jwks`, cache: false });
  const signingKey = await client.getSigningKey(key.kid);
  const payload = Buffer.from("synthetic runtime compatibility check");
  const signature = sign("RSA-SHA256", payload, privateKey);
  assert.equal(verify("RSA-SHA256", payload, signingKey.getPublicKey(), signature), true);
  assert.equal(verify("RSA-SHA256", Buffer.from("tampered"), signingKey.getPublicKey(), signature), false);
});
