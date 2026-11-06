const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../app");
const { createFixture, verifyIdToken, fixedTime } = require("./fixtures.cjs");
const { createRepairClassifier } = require("../repair-ai");
const { POLICY } = require("../repair-assistant");
const body = { category: "Laptop", brand: "Demo", model: "Model X", symptoms: "The laptop will not start today.", onset: "Yesterday", useAi: false, danger: false };
const setup = async (t, classify = null) => {
  const fixture = createFixture();
  const server = createApp({ getCollections: async () => fixture.db, verifyIdToken, clock: () => new Date(fixedTime), repairClassifier: classify }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = async (input, token = "customer") => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/repair-assistant${input ? "" : "/config"}`, { method: input ? "POST" : "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: input ? JSON.stringify(input) : undefined });
    return { status: r.status, data: await r.json() };
  };
  return { ...fixture, request };
};
test("assistant enforces authentication, input allowlist and explicit external-processing consent", async t => {
  let calls = 0;
  const { request } = await setup(t, async () => { calls++; return { issues: ["power"], questions: [] }; });
  assert.equal((await request(body, null)).status, 401);
  assert.equal((await request({ ...body, symptoms: "short" })).status, 400);
  assert.equal((await request({ ...body, deviceId: "private" })).status, 400);
  assert.equal((await request({ ...body, symptoms: {} })).status, 400);
  assert.equal((await request({ ...body, useAi: true })).status, 400);
  assert.equal((await request({ ...body, useAi: true, consentVersion: "old" })).status, 400);
  assert.equal(calls, 0);
  assert.equal((await request()).data.policyVersion, POLICY);
});
test("hazard symptoms in English/Bangla and explicit safety flag bypass the model and ordinary troubleshooting", async t => {
  let calls = 0;
  const { request } = await setup(t, async () => { calls++; throw Error(); });
  for (const symptoms of ["Battery is swollen and not charging", "smo\u200bke from phone", "Burning smell from laptop", "Water spilled while connected", "Device is overheating", "ব্যাটারি ফুলে গেছে", "ফোন খুব গরম হচ্ছে", "Unknown dangerous situation"]) {
    const r = await request({ ...body, symptoms, useAi: true, consentVersion: POLICY, danger: symptoms.startsWith("Unknown") });
    assert.equal(r.status, 200); assert.equal(r.data.mode, "safety"); assert.equal(r.data.urgent, true);
    assert.equal(r.data.questions.length, 0); assert.match(r.data.steps[0], /Stop using and charging/);
    assert.ok(!r.data.steps.some(step => /restart/i.test(step)));
  }
  assert.equal(calls, 0);
  assert.equal((await request({ ...body, symptoms: "Smoke from the screen", useAi: true })).data.mode, "safety");
});
test("guided mode is honest, uses real visible listings and retains no descriptions", async t => {
  const { request, db, service } = await setup(t);
  const r = await request(body);
  assert.equal(r.data.mode, "guided"); assert.equal(r.data.aiState, "not_requested");
  assert.ok(r.data.services.some(s => s._id === String(service._id)));
  assert.equal(db.operationMeta.rows.length, 0);
  db.entityControls.rows.push({ _id: `service:${service._id}`, state: "hidden" });
  assert.ok(!(await request(body)).data.services.some(s => s._id === String(service._id)));
  assert.equal((await request({ ...body, useAi: true, consentVersion: POLICY })).data.aiState, "unavailable");
});
test("AI selection is mapped to safe text; untrusted model instructions fail to guided fallback", async t => {
  let captured, bad = false;
  const { request, db } = await setup(t, async input => { captured = input; return bad ? { issues: ["power"], questions: [], instructions: "open the battery" } : { issues: ["screen"], questions: ["scope"] }; });
  const input = { ...body, useAi: true, consentVersion: POLICY };
  const r = await request(input);
  assert.equal(r.data.mode, "ai"); assert.deepEqual(r.data.issueCategories, ["Screen or display issue"]);
  assert.deepEqual(Object.keys(captured).sort(), ["brand", "category", "model", "onset", "symptoms"]);
  assert.ok(db.operationMeta.rows.every(row => Object.keys(row).sort().join() === "_id,count,day"));
  bad = true;
  const fallback = await request(input);
  assert.equal(fallback.data.mode, "guided"); assert.equal(fallback.data.aiState, "failed");
  assert.ok(!JSON.stringify(fallback.data).includes("open the battery"));
});
test("AI outage fallback and persistent per-user quotas do not interrupt direct guided access", async t => {
  let calls = 0;
  const { request } = await setup(t, async () => { calls++; throw Error("private provider detail"); });
  for (let i = 0; i < 10; i++) {
    const r = await request({ ...body, useAi: true, consentVersion: POLICY });
    assert.equal(r.status, 200); assert.equal(r.data.aiState, "failed");
    assert.ok(!JSON.stringify(r.data).includes("private provider detail"));
  }
  assert.equal((await request({ ...body, useAi: true, consentVersion: POLICY })).status, 429);
  assert.equal(calls, 10);
  assert.equal((await request(body)).status, 200);
});
test("SDK adapter is disabled without operator enablement/key and bounds the consented payload", async () => {
  assert.equal(createRepairClassifier({ AI_REPAIR_ENABLED: "true" }), null);
  assert.equal(createRepairClassifier({ AI_GATEWAY_API_KEY: "fake" }), null);
  let options;
  const classify = createRepairClassifier({ AI_REPAIR_ENABLED: "true", AI_GATEWAY_API_KEY: "fake-only" }, async () => ({
    createGateway: config => { assert.equal(config.apiKey, "fake-only"); return id => id; },
    Output: { object: value => value }, jsonSchema: value => value,
    generateText: async value => { options = value; return { output: { issues: ["power"], questions: [] } }; },
  }));
  await classify({ category: "Laptop", symptoms: "Cannot start" });
  assert.equal(options.maxRetries, 0); assert.equal(options.maxOutputTokens, 500);
  assert.deepEqual(options.telemetry, { isEnabled: false, recordInputs: false, recordOutputs: false });
  assert.ok(options.abortSignal instanceof AbortSignal);
  assert.ok(!Object.hasOwn(options, "tools"));
});
