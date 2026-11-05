import test from "node:test";
import assert from "node:assert/strict";
import { returnPath, authMessage } from "../src/utils/authFeedback.js";
import { readJson } from "../src/utils/readJson.js";

test("login returns to the guarded page with search and hash", () => {
  assert.equal(returnPath({ from: { pathname: "/services/abc", search: "?source=bookings", hash: "#booking" } }), "/services/abc?source=bookings#booking");
  assert.equal(returnPath({ form: { pathname: "/booked-services" } }), "/booked-services");
});

test("login rejects external destinations, malformed paths and auth loops", () => {
  for (const pathname of ["https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "/login", "/register", "/forgot-password", "javascript:alert(1)"]) {
    assert.equal(returnPath({ from: { pathname } }), "/");
  }
  assert.equal(returnPath(null), "/");
  assert.equal(returnPath({ from: "//example.com" }), "/");
});

test("auth feedback does not disclose raw provider errors or account existence on login", () => {
  assert.equal(authMessage({ code: "auth/user-not-found" }), authMessage({ code: "auth/wrong-password" }));
  assert.equal(authMessage({ code: "unknown", message: "private provider diagnostics" }).includes("private"), false);
  assert.match(authMessage({ code: "auth/network-request-failed" }), /connection/);
});

test("public API response handling accepts valid data and preserves missing status", async () => {
  assert.deepEqual(await readJson(new Response(JSON.stringify([{ _id: "service" }]), { status: 200 })), [{ _id: "service" }]);
  await assert.rejects(readJson(new Response("private server text", { status: 404 })), error => error.status === 404 && !error.message.includes("private"));
  await assert.rejects(readJson(new Response("private server text", { status: 500 })), error => error.status === 500 && !error.message.includes("private"));
});

test("invalid JSON is rejected instead of being displayed as service data", async () => {
  await assert.rejects(readJson(new Response("<html>error page</html>", { status: 200 })), error => error.code === "INVALID_RESPONSE" && !error.message.includes("<html>"));
});
