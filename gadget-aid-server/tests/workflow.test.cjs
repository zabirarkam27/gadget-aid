const test = require("node:test");
const assert = require("node:assert/strict");
const {once} = require("node:events");
const {ObjectId} = require("mongodb");
const {createApp} = require("../app");
const {validateService,todayInDhaka} = require("../domain");
const {createFixture,users,ids,fixedTime,serviceFields,verifyIdToken} = require("./fixtures.cjs");

const setup=async(t,options={})=>{
  const fixture=createFixture(options);
  const app=createApp({getCollections:async()=>fixture.db,verifyIdToken,clock:()=>new Date(fixedTime),...options.app});
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(method,path,body,token="customer")=>{
    const response=await fetch(base+path,{method,headers:{...(token ? {Authorization:`Bearer ${token}`} : {}),...(body === undefined ? {} : {"Content-Type":"application/json"})},body:body === undefined ? undefined : JSON.stringify(body)});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
    return {status:response.status,data};
  };
  return {...fixture,request,base};
};
const bookingInput={serviceId:ids.service,date:"2026-11-06",instruction:"Screen does not turn on."};

const workflowSetup = async (t, options = {}) => {
  const fixture = await setup(t, { seedBooking: true, ...options });
  let booking;
  const read = async (token = "provider") => {
    const r = await fixture.request(
      "GET",
      `/bookings/${ids.booking}`,
      undefined,
      token,
    );
    assert.equal(r.status, 200);
    booking = r.data;
    return booking;
  };
  const act = async (
    path,
    body,
    token = "provider",
    method = "POST",
    expected = 200,
  ) => {
    const r = await fixture.request(
      method,
      path,
      { ...body, expectedRevision: booking.repairRevision },
      token,
    );
    assert.equal(r.status, expected, JSON.stringify(r.data));
    if (r.data.booking) booking = r.data.booking;
    return r;
  };
  const step = (status) =>
    act(`/all-bookings/${ids.booking}`, { status }, "provider", "PATCH");
  const diagnose = () =>
    act(
      `/bookings/${ids.booking}/diagnoses`,
      {
        summary: "Power connector is damaged.",
        issue: "Broken power connector",
        recommendedRepair: "Replace power connector",
      },
      "provider",
      "POST",
      201,
    );
  const quote = (extra = {}) =>
    act(
      `/bookings/${ids.booking}/quotations`,
      {
        parts: [{ name: "Power connector", quantity: 2, unitPrice: 15.25 }],
        labor: 40,
        estimatedCompletion: "2 days after approval",
        ...extra,
      },
      "provider",
      "POST",
      201,
    );
  const prepare = async () => {
    await read();
    await step("confirmed");
    await step("device_received");
    await step("diagnosing");
    await diagnose();
    await quote();
    return booking;
  };
  return {
    ...fixture,
    read,
    act,
    step,
    diagnose,
    quote,
    prepare,
    get booking() {
      return booking;
    },
  };
};
test("repair lifecycle requires diagnosis and customer approval, then records every handover step", async (t) => {
  const w = await workflowSetup(t);
  await w.read();
  for (const status of ["working", "repairing", "approved", "completed"])
    assert.equal(
      (
        await w.request(
          "PATCH",
          `/all-bookings/${ids.booking}`,
          { status, expectedRevision: 0 },
          "provider",
        )
      ).status,
      409,
    );
  await w.step("confirmed");
  await w.step("diagnosing");
  await w.act(
    `/bookings/${ids.booking}/quotations`,
    { parts: [], labor: 10, estimatedCompletion: "One day" },
    "provider",
    "POST",
    409,
  );
  await w.diagnose();
  await w.quote();
  const q = w.booking.currentQuotation;
  assert.equal(q.total, 70.5);
  assert.equal(w.booking.status, "awaiting_approval");
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/quotations/${q.id}/decision`,
        { decision: "approve", expectedRevision: w.booking.repairRevision },
        "provider",
      )
    ).status,
    403,
  );
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/decision`,
    { decision: "approve" },
    "customer",
  );
  assert.equal(w.booking.status, "approved");
  const approved = JSON.stringify(w.booking.currentQuotation);
  await w.act(
    `/bookings/${ids.booking}/quotations`,
    { parts: [], labor: 1, estimatedCompletion: "One day" },
    "provider",
    "POST",
    409,
  );
  for (const status of [
    "repairing",
    "quality_check",
    "ready_for_collection",
    "completed",
  ])
    await w.step(status);
  assert.equal(JSON.stringify(w.booking.currentQuotation), approved);
  assert.equal(w.booking.repair.events.at(-1).status, "completed");
  assert.ok(
    w.booking.repair.events.every(
      (e) =>
        e.bookingId === ids.booking &&
        e.actor.uid &&
        e.actor.role &&
        e.createdAt &&
        e.customerVisible,
    ),
  );
  await w.act(
    `/bookings/${ids.booking}/cancel`,
    { note: "Changed plans" },
    "customer",
    "POST",
    409,
  );
});
test("quotation questions pause approval, provider answers are permanent and rejected quotes can be revised", async (t) => {
  const w = await workflowSetup(t);
  await w.prepare();
  const q = w.booking.currentQuotation;
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/questions`,
    { question: "Does this include parts?" },
    "customer",
    "POST",
    201,
  );
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/decision`,
    { decision: "approve" },
    "customer",
    "POST",
    409,
  );
  const question = w.booking.currentQuotation.clarifications[0];
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/questions/${question.id}/answer`,
    { answer: "Yes, both connectors are included." },
  );
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/questions/${question.id}/answer`,
    { answer: "Changed answer" },
    "provider",
    "POST",
    409,
  );
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/decision`,
    { decision: "reject", note: "Need a cheaper option" },
    "customer",
  );
  assert.equal(w.booking.status, "diagnosing");
  await w.quote({ labor: 30 });
  assert.equal(w.booking.repair.quotations.length, 2);
  assert.equal(w.booking.repair.quotations[0].status, "rejected");
  assert.equal(w.booking.repair.quotations[0].total, 70.5);
  assert.equal(w.booking.currentQuotation.total, 60.5);
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/decision`,
    { decision: "approve" },
    "customer",
    "POST",
    409,
  );
});
test("concurrent quotation revision and approval cannot overwrite each other", async (t) => {
  const w = await workflowSetup(t);
  await w.prepare();
  const q = w.booking.currentQuotation,
    expectedRevision = w.booking.repairRevision;
  const results = await Promise.all([
    w.request(
      "POST",
      `/bookings/${ids.booking}/quotations/${q.id}/decision`,
      { decision: "approve", expectedRevision },
      "customer",
    ),
    w.request(
      "POST",
      `/bookings/${ids.booking}/quotations`,
      {
        parts: [],
        labor: 20,
        estimatedCompletion: "Tomorrow",
        expectedRevision,
      },
      "provider",
    ),
  ]);
  assert.equal(results.filter((r) => r.status < 300).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  await w.read();
  assert.equal(w.booking.repairRevision, expectedRevision + 1);
});
test("expired quotations cannot authorize work; stale revisions cannot update diagnosis", async (t) => {
  let now = new Date(fixedTime);
  const w = await workflowSetup(t, { app: { clock: () => new Date(now) } });
  await w.prepare();
  await w.quote({ expiresOn: "2026-11-06" });
  const q = w.booking.currentQuotation;
  now = new Date("2026-11-06T18:00:00Z");
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/decision`,
    { decision: "approve" },
    "customer",
    "POST",
    410,
  );
  assert.equal((await w.read("customer")).actions.approve, false);
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/decision`,
    { decision: "reject", note: "Please update expiry" },
    "customer",
  );
  const stale = await w.request(
    "POST",
    `/bookings/${ids.booking}/diagnoses`,
    {
      summary: "A revised diagnosis summary",
      issue: "Connector issue",
      recommendedRepair: "Replace connector",
      expectedRevision: 0,
    },
    "provider",
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, "STALE_WORKFLOW");
});
test("legacy working repairs retain honest progress; forged JSON approval is ignored", async (t) => {
  const w = await workflowSetup(t);
  w.db.bookings.rows[0].status = "working";
  await w.read();
  assert.equal(w.booking.status, "repairing");
  assert.ok(w.booking.legacyNotice);
  await w.step("quality_check");
  await w.step("ready_for_collection");
  await w.step("completed");
  assert.equal(w.booking.repair.quotations.length, 0);
  assert.equal(w.booking.repair.legacyInProgress, true);
  const x = await workflowSetup(t);
  Object.assign(x.db.bookings.rows[0], {
    workflowVersion: 2,
    repairRevision: 0,
    repair: {
      startedAt: fixedTime.toISOString(),
      legacyInProgress: true,
      events: [],
      diagnoses: [],
      quotations: [{ id: "fake", status: "approved" }],
      currentQuotationId: "fake",
    },
  });
  await x.read();
  assert.equal(x.booking.currentQuotation, null);
  assert.equal(
    (
      await x.request(
        "PATCH",
        `/all-bookings/${ids.booking}`,
        { status: "repairing", expectedRevision: 0 },
        "provider",
      )
    ).status,
    409,
  );
  await x.step("confirmed");
  assert.equal(x.booking.repair.quotations.length, 0);
});
test("repair detail and actions enforce both participants, customer cancellation and required reasons", async (t) => {
  const w = await workflowSetup(t);
  await w.read();
  assert.equal(
    (await w.request("GET", `/bookings/${ids.booking}`, undefined, "other"))
      .status,
    403,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/diagnoses`,
        {},
        "customer",
      )
    ).status,
    403,
  );
  await w.act(
    `/all-bookings/${ids.booking}`,
    { status: "rejected" },
    "provider",
    "PATCH",
    400,
  );
  await w.act(
    `/bookings/${ids.booking}/cancel`,
    { note: "Changed my plans" },
    "customer",
  );
  assert.equal(w.booking.status, "cancelled");
  assert.equal(w.booking.repair.events.at(-1).actor.role, "customer");
});
test("quotation costs and expiry are validated without accepting client totals", async (t) => {
  const w = await workflowSetup(t);
  await w.read();
  await w.step("confirmed");
  await w.step("diagnosing");
  await w.diagnose();
  for (const change of [
    { total: 1 },
    { labor: -1 },
    { labor: 0.001 },
    { parts: [{ name: "part", quantity: 0, unitPrice: 1 }] },
    { parts: [{ name: "part", quantity: 100, unitPrice: 1000000 }] },
    { expiresOn: "2026-02-30" },
    { expiresOn: "2026-11-04" },
  ])
    await w.act(
      `/bookings/${ids.booking}/quotations`,
      { parts: [], labor: 10, estimatedCompletion: "One day", ...change },
      "provider",
      "POST",
      400,
    );
  await w.quote({ parts: [], labor: 0 });
  assert.equal(w.booking.currentQuotation.total, 0);
});
test("superseded quotes retain original content and stale decisions fail; quality rework requires a reason", async (t) => {
  const w = await workflowSetup(t);
  await w.prepare();
  const original = w.booking.currentQuotation;
  await w.quote({ labor: 35 });
  assert.equal(w.booking.repair.quotations[0].status, "superseded");
  assert.deepEqual(w.booking.repair.quotations[0].parts, original.parts);
  assert.equal(w.booking.repair.quotations[0].total, original.total);
  const q = w.booking.currentQuotation;
  await w.act(
    `/bookings/${ids.booking}/quotations/${original.id}/decision`,
    { decision: "approve" },
    "customer",
    "POST",
    409,
  );
  await w.act(
    `/bookings/${ids.booking}/quotations/${q.id}/decision`,
    { decision: "approve" },
    "customer",
  );
  await w.step("repairing");
  await w.step("quality_check");
  await w.act(
    `/all-bookings/${ids.booking}`,
    { status: "repairing" },
    "provider",
    "PATCH",
    400,
  );
  await w.act(
    `/all-bookings/${ids.booking}`,
    { status: "repairing", note: "Power test failed, checking connector" },
    "provider",
    "PATCH",
  );
  assert.equal(
    w.booking.repair.events.at(-1).note,
    "Power test failed, checking connector",
  );
});
test("orphan customer history remains readable and cancellable; mutation without revision fails", async (t) => {
  const w = await workflowSetup(t);
  w.db.bookings.rows[0].serviceId = "bad-reference";
  await w.read("customer");
  assert.equal(w.booking.permissions.provider, false);
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/cancel`,
        { note: "Cancel repair" },
        "customer",
      )
    ).data.code,
    "STALE_WORKFLOW",
  );
  await w.act(
    `/bookings/${ids.booking}/cancel`,
    { note: "Cancel repair" },
    "customer",
  );
  assert.equal(w.booking.status, "cancelled");
});
