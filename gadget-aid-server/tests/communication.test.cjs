const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { ObjectId } = require("mongodb");
const { createApp } = require("../app");
const { createEmailSender } = require("../email");
const {
  createFixture,
  users,
  ids,
  fixedTime,
  verifyIdToken,
} = require("./fixtures.cjs");
const secret = "test-only-job-secret-at-least-32-characters";
const setup = async (t, options = {}) => {
  const fixture = createFixture({ seedBooking: true });
  let now = new Date(fixedTime);
  const app = createApp({
    getCollections: async () => fixture.db,
    verifyIdToken,
    clock: () => new Date(now),
    jobSecret: secret,
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const request = async (method, path, body, token = "customer") => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  return {
    ...fixture,
    request,
    advance: (ms) => {
      now = new Date(now.getTime() + ms);
    },
  };
};
const message = (
  text = "Can you confirm the drop-off time?",
  requestId = "message-reference-0001",
) => ({ text, requestId });
const path = `/bookings/${ids.booking}/messages`;
const transition = (w, status, revision) =>
  w.request(
    "PATCH",
    `/all-bookings/${ids.booking}`,
    { status, expectedRevision: revision },
    "provider",
  );
test("repair events create deduplicated recipient alerts; reads are private, explicit and idempotent", async (t) => {
  const w = await setup(t);
  assert.equal((await transition(w, "confirmed", 0)).status, 200);
  let result = await w.request("GET", "/notifications");
  assert.equal(result.status, 200);
  assert.equal(result.data.unreadCount, 1);
  assert.equal(result.data.items[0].title, "Repair update: Confirmed");
  const id = result.data.items[0]._id;
  assert.ok(!JSON.stringify(result.data).includes(users.customer.email));
  await w.request("GET", "/notifications");
  assert.equal(w.db.notifications.rows.length, 1);
  assert.equal(
    (
      await w.request(
        "GET",
        "/notifications?email=customer@example.test",
        undefined,
        "other",
      )
    ).data.items.length,
    0,
  );
  assert.equal(
    (await w.request("POST", "/notifications/read", { ids: [id] }, "other"))
      .status,
    404,
  );
  assert.equal(
    (await w.request("POST", "/notifications/read", { ids: [id] })).status,
    200,
  );
  const at = w.db.notifications.rows[0].readAt;
  w.advance(10000);
  await w.request("POST", "/notifications/read", { ids: [id] });
  assert.deepEqual(w.db.notifications.rows[0].readAt, at);
  assert.equal((await w.request("GET", "/notifications")).data.unreadCount, 0);
});
test("new bookings notify the canonical provider and legacy phase-6 history is not emailed retrospectively", async (t) => {
  const w = await setup(t);
  const result = await w.request("POST", "/bookings", {
    serviceId: ids.service,
    date: "2026-11-07",
  });
  assert.equal(result.status, 201);
  const alerts = await w.request(
    "GET",
    "/notifications",
    undefined,
    "provider",
  );
  assert.equal(alerts.data.items.length, 1);
  assert.equal(alerts.data.items[0].title, "New booking request");
  await transition(w, "confirmed", 0);
  delete w.db.bookings.rows
    .find((b) => String(b._id) === ids.booking)
    .repair.events.at(-1).notify;
  assert.equal((await w.request("GET", "/notifications")).data.items.length, 0);
});
test("conversation is participant-only, strips private identities and resends do not duplicate messages", async (t) => {
  const w = await setup(t);
  w.db.bookings.rows[0].providerEmail = users.other.email;
  for (const method of ["GET", "POST"])
    assert.equal(
      (
        await w.request(
          method,
          path,
          method === "POST" ? message() : undefined,
          "other",
        )
      ).status,
      403,
    );
  const first = await w.request("POST", path, message());
  assert.equal(first.status, 201);
  assert.equal(first.data.messages[0].self, true);
  assert.equal((await w.request("POST", path, message())).status, 201);
  assert.equal(w.db.threads.rows[0].messages.length, 1);
  assert.equal(
    (await w.request("POST", path, message("Changed text"))).status,
    409,
  );
  const provider = await w.request("GET", path, undefined, "provider");
  assert.equal(provider.data.unreadCount, 1);
  assert.equal(provider.data.messages[0].self, false);
  assert.equal(provider.data.messages[0].role, "customer");
  assert.ok(!JSON.stringify(provider.data).includes(users.customer.email));
  assert.ok(!JSON.stringify(provider.data).includes(users.customer.uid));
  assert.equal(
    (await w.request("GET", "/notifications", undefined, "provider")).data
      .unreadMessages,
    1,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        path,
        message("Next message", "message-reference-0002"),
      )
    ).status,
    429,
  );
});
test("read receipts cover only displayed messages, even when projection runs later", async (t) => {
  const w = await setup(t);
  const first = await w.request("POST", path, message());
  const id = first.data.lastMessageId;
  w.advance(6000);
  await w.request(
    "POST",
    path,
    message("Second message", "message-reference-0002"),
  );
  const read = await w.request(
    "POST",
    path + "/read",
    { throughId: id },
    "provider",
  );
  assert.equal(read.data.unreadCount, 1);
  let alerts = await w.request("GET", "/notifications", undefined, "provider");
  assert.equal(alerts.data.unreadMessages, 1);
  assert.equal(alerts.data.unreadCount, 1);
  const thread = await w.request("GET", path, undefined, "provider");
  await w.request(
    "POST",
    path + "/read",
    { throughId: thread.data.lastMessageId },
    "provider",
  );
  alerts = await w.request("GET", "/notifications", undefined, "provider");
  assert.equal(alerts.data.unreadMessages, 0);
  assert.equal(alerts.data.unreadCount, 0);
  await w.request("POST", path + "/read", { throughId: id }, "provider");
  assert.equal(
    (await w.request("GET", path, undefined, "provider")).data.unreadCount,
    0,
  );
});
test("concurrent messages and read receipts do not erase messages or regress cursors", async (t) => {
  const w = await setup(t);
  const results = await Promise.all([
    w.request("POST", path, message()),
    w.request(
      "POST",
      path,
      message("Please bring the charger.", "provider-reference-0001"),
      "provider",
    ),
  ]);
  assert.ok(results.every((r) => r.status === 201));
  assert.equal(w.db.threads.rows[0].messages.length, 2);
  const thread = await w.request("GET", path);
  const last = thread.data.lastMessageId;
  await Promise.all([
    w.request("POST", path + "/read", { throughId: last }),
    w.request("POST", path + "/read", {
      throughId: thread.data.messages[0].id,
    }),
  ]);
  assert.equal((await w.request("GET", path)).data.unreadCount, 0);
});
test("message input, participant availability and explicit history limits are enforced", async (t) => {
  const w = await setup(t);
  for (const value of [
    message(" "),
    message("x".repeat(2001)),
    { ...message(), senderUid: "victim" },
    message("Hello", "short"),
  ])
    assert.equal((await w.request("POST", path, value)).status, 400);
  await w.request("POST", path, message());
  const stored = w.db.threads.rows[0];
  stored.messages = Array.from({ length: 200 }, (_, i) => ({
    ...stored.messages[0],
    id: `seed-${i}`,
  }));
  w.advance(6000);
  assert.equal(
    (
      await w.request(
        "POST",
        path,
        message("Another message", "message-reference-0003"),
      )
    ).status,
    409,
  );
  assert.equal((await w.request("GET", path)).data.messages.length, 200);
  w.db.bookings.rows[0].serviceId = "bad-reference";
  assert.equal((await w.request("GET", path)).status, 200);
  assert.equal(
    (await w.request("POST", path, message())).data.code,
    "PARTICIPANT_UNAVAILABLE",
  );
  assert.equal(
    (await w.request("GET", path, undefined, "provider")).status,
    403,
  );
});
test("projection failures cannot corrupt a successful repair action and recover without duplicates", async (t) => {
  const w = await setup(t);
  const insert = w.db.notifications.insertOne.bind(w.db.notifications);
  w.db.notifications.insertOne = async () => {
    throw new Error("projection outage");
  };
  assert.equal((await transition(w, "confirmed", 0)).status, 200);
  assert.equal((await w.request("GET", "/notifications")).status, 500);
  assert.equal(w.db.bookings.rows[0].status, "confirmed");
  w.db.notifications.insertOne = insert;
  assert.equal((await w.request("GET", "/notifications")).data.items.length, 1);
  assert.equal((await w.request("GET", "/notifications")).data.items.length, 1);
});
test("email job is secret-protected and missing delivery configuration never falls back to fake success", async (t) => {
  const w = await setup(t);
  assert.equal((await w.request("GET", "/internal/jobs/email")).status, 401);
  assert.equal(
    (await w.request("GET", "/internal/jobs/email", undefined, secret)).status,
    503,
  );
  for (const route of ["/notifications", path])
    assert.equal((await w.request("GET", route, undefined, null)).status, 401);
});
test("email failures persist retry state without corrupting repair, and acceptance is deduplicated", async (t) => {
  const sent = [];
  let failing = true;
  const w = await setup(t, {
    sendEmail: async (payload) => {
      sent.push(payload);
      if (failing) throw new Error("temporary outage");
      return { id: "provider-id" };
    },
  });
  await transition(w, "confirmed", 0);
  let result = await w.request(
    "GET",
    "/internal/jobs/email",
    undefined,
    secret,
  );
  assert.equal(result.data.retry, 1);
  assert.equal(w.db.bookings.rows[0].status, "confirmed");
  assert.equal(w.db.notifications.rows[0].deliveryState, "retry");
  await w.request("GET", "/internal/jobs/email", undefined, secret);
  assert.equal(sent.length, 1);
  w.advance(61000);
  failing = false;
  result = await w.request("GET", "/internal/jobs/email", undefined, secret);
  assert.equal(result.data.accepted, 1);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(w.db.notifications.rows[0].deliveryState, "accepted");
  await w.request("GET", "/internal/jobs/email", undefined, secret);
  assert.equal(sent.length, 2);
  assert.ok(!JSON.stringify(result.data).includes(users.customer.email));
});
test("overlapping delivery jobs lease each email once and uncertain expired attempts require review", async (t) => {
  let sends = 0;
  const w = await setup(t, {
    sendEmail: async () => {
      sends++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { id: "accepted" };
    },
  });
  await transition(w, "confirmed", 0);
  await Promise.all([
    w.request("GET", "/internal/jobs/email", undefined, secret),
    w.request("GET", "/internal/jobs/email", undefined, secret),
  ]);
  assert.equal(sends, 1);
  const row = w.db.notifications.rows[0];
  Object.assign(row, {
    deliveryState: "sending",
    leaseUntil: new Date(fixedTime),
    nextAttemptAt: new Date(fixedTime),
    firstAttemptAt: new Date(fixedTime),
  });
  w.advance(24 * 60 * 60 * 1000);
  await w.request("GET", "/internal/jobs/email", undefined, secret);
  assert.equal(sends, 1);
  assert.equal(row.deliveryState, "failed");
  assert.equal(row.failureCode, "REVIEW_REQUIRED");
});
test("permanent delivery failure is retained for review; lost ownership suppresses queued delivery", async (t) => {
  let sends = 0;
  const w = await setup(t, {
    sendEmail: async () => {
      sends++;
      throw Object.assign(new Error("Invalid sender"), { retryable: false });
    },
  });
  await transition(w, "confirmed", 0);
  await w.request("GET", "/internal/jobs/email", undefined, secret);
  assert.equal(w.db.notifications.rows[0].deliveryState, "failed");
  await w.request("POST", path, message());
  await w.request("GET", "/notifications", undefined, "provider");
  w.db.services.rows[0].providerEmail = users.other.email;
  w.db.services.rows[0].providerUid = users.other.uid;
  await w.request("GET", "/internal/jobs/email", undefined, secret);
  assert.equal(
    w.db.notifications.rows.find(
      (r) => r.recipientEmail === users.provider.email,
    ).deliveryState,
    "suppressed",
  );
  assert.equal(sends, 2);
});
test("Resend adapter uses fixed destination, private key, stable idempotency and classified errors", async () => {
  assert.equal(createEmailSender({}), null);
  let request;
  const sender = createEmailSender({
    apiKey: "private-test-key",
    from: "Repairs <repairs@example.test>",
    fetchImpl: async (url, options) => {
      request = { url, ...options };
      return new Response(JSON.stringify({ id: "provider-message" }), {
        status: 200,
      });
    },
  });
  assert.deepEqual(
    await sender({
      to: "customer@example.test",
      subject: "Booking update",
      text: "Open the repair.",
      idempotencyKey: "event-123",
    }),
    { id: "provider-message" },
  );
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.headers["Idempotency-Key"], "event-123");
  assert.equal(request.headers.Authorization, "Bearer private-test-key");
  assert.deepEqual(JSON.parse(request.body).to, ["customer@example.test"]);
  for (const [status, retryable] of [
    [429, true],
    [503, true],
    [400, false],
    [401, false],
  ])
    await assert.rejects(
      createEmailSender({
        apiKey: "key",
        from: "sender",
        fetchImpl: async () => new Response("provider internals", { status }),
      })({}),
      (error) =>
        error.retryable === retryable && !error.message.includes("internals"),
    );
});
test("notification projection racing a read receipt is repaired from the authoritative cursor",async t=>{
 const w=await setup(t);const sent=await w.request("POST",path,message());
 let entered,release;const blocked=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const insert=w.db.notifications.insertOne.bind(w.db.notifications);
 w.db.notifications.insertOne=async record=>{entered();await gate;return insert(record);};
 const projecting=w.request("GET","/notifications",undefined,"provider");await blocked;
 await w.request("POST",path+"/read",{throughId:sent.data.lastMessageId},"provider");release();await projecting;
 const reconciled=await w.request("GET","/notifications",undefined,"provider");assert.equal(reconciled.data.unreadMessages,0);assert.equal(reconciled.data.unreadCount,0);assert.ok(w.db.notifications.rows[0].readAt);
});
