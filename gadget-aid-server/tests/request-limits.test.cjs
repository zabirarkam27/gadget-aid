const test = require("node:test");
const assert = require("node:assert/strict");
const { requestLimiter } = require("../request-limits");
const request = (limit, { address = "127.0.0.1", forwarded = "", path = "/services" } = {}) => {
  const result = { headers: {}, statusCode: 200, passed: false };
  const res = { set: (key, value) => { result.headers[key] = value; }, status: (code) => { result.statusCode = code; return res; }, json: (body) => { result.body = body; } };
  limit({ path, socket: { remoteAddress: address }, get: () => forwarded }, res, () => { result.passed = true; });
  return result;
};
test("limits expensive estimates, gives retry timing and recovers after expiry", () => {
  let now = 1000;
  const limit = requestLimiter({ clock: () => now, limit: 6 });
  assert.equal(request(limit, { path: "/tools/estimate" }).passed, true);
  const denied = request(limit);
  assert.equal(denied.statusCode, 429);
  assert.equal(denied.headers["Retry-After"], "60");
  assert.equal(denied.headers["Cache-Control"], "no-store");
  now += 60000;
  assert.equal(request(limit).passed, true);
});
test("untrusted forwarded IP cannot evade local quotas; Vercel uses a valid edge-overwritten IP", () => {
  const local = requestLimiter({ limit: 1 });
  assert.equal(request(local, { forwarded: "1.2.3.4" }).passed, true);
  assert.equal(request(local, { forwarded: "5.6.7.8" }).statusCode, 429);
  const edge = requestLimiter({ vercel: true, limit: 1 });
  assert.equal(request(edge, { forwarded: "1.2.3.4" }).passed, true);
  assert.equal(request(edge, { forwarded: "5.6.7.8" }).passed, true);
  assert.equal(request(edge, { forwarded: "1.2.3.4" }).statusCode, 429);
});
test("bucket capacity is bounded and expired clients release capacity", () => {
  let now = 0;
  const limit = requestLimiter({ clock: () => now, capacity: 1 });
  assert.equal(request(limit).passed, true);
  assert.equal(request(limit, { address: "127.0.0.2" }).statusCode, 429);
  now = 60001;
  assert.equal(request(limit, { address: "127.0.0.2" }).passed, true);
});
