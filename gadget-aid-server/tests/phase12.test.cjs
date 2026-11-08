const test = require("node:test"),
  assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");
const sharp = require("sharp");
const { createApp } = require("../app"),
  {
    createFixture,
    verifyIdToken,
    identityDirectory,
    fixedTime,
    ids,
    users,
  } = require("./fixtures.cjs");
const { createReceiptVault } = require("../receipt-vault");
const { initialRepair } = require("../workflow");
const { POLICY } = require("../repair-gallery");
async function setup(t) {
  const f = createFixture({ seedBooking: true, seedAdminRoles: true });
  const b = f.db.bookings.rows[0];
  Object.assign(
    b,
    initialRepair(b, { ...users.provider }, new Date(fixedTime), true),
  );
  b.status = "completed";
  b.repair.events.push({
    type: "status_changed",
    status: "completed",
    actor: { uid: users.provider.uid, role: "provider" },
    createdAt: new Date(fixedTime),
  });
  const app = createApp({
    getCollections: async () => f.db,
    verifyIdToken,
    identityDirectory,
    clock: () => new Date(fixedTime),
    receiptVault: createReceiptVault({
      activeKeyId: "test",
      keys: { test: randomBytes(32).toString("base64") },
    }),
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const request = async (
    method,
    path,
    body,
    token = "customer",
    headers = {},
  ) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": Buffer.isBuffer(body)
          ? "image/png"
          : "application/json",
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: r.headers.get("content-type")?.startsWith("image/")
        ? Buffer.from(await r.arrayBuffer())
        : await r.json(),
      headers: r.headers,
    };
  };
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#4488aa" },
  })
    .png()
    .toBuffer();
  return { ...f, request, png };
}
async function draft(ctx) {
  assert.equal(
    (
      await ctx.request(
        "POST",
        `/bookings/${ids.booking}/example`,
        {
          title: "A reviewed laptop repair",
          description:
            "Synthetic public example, with no customer or device identifiers.",
        },
        "provider",
      )
    ).status,
    201,
  );
  return (
    await ctx.request(
      "GET",
      `/bookings/${ids.booking}/example`,
      undefined,
      "provider",
    )
  ).data.item;
}
async function uploaded(ctx) {
  let item = await draft(ctx);
  for (const slot of ["before", "after"]) {
    assert.equal(
      (
        await ctx.request(
          "POST",
          `/examples/${item._id}/images/${slot}`,
          ctx.png,
          "provider",
          {
            "X-Example-Revision": String(item.revision),
            "X-Example-Policy": POLICY,
            "X-Image-Rights": "confirmed",
          },
        )
      ).status,
      200,
    );
    item = (
      await ctx.request(
        "GET",
        `/bookings/${ids.booking}/example`,
        undefined,
        "provider",
      )
    ).data.item;
  }
  return item;
}
async function consented(ctx) {
  let item = await uploaded(ctx);
  assert.equal(
    (
      await ctx.request(
        "POST",
        `/examples/${item._id}/submit`,
        { expectedRevision: item.revision, confirmed: true },
        "provider",
      )
    ).status,
    200,
  );
  item = (await ctx.request("GET", `/bookings/${ids.booking}/example`)).data
    .item;
  assert.equal(
    (
      await ctx.request("POST", `/examples/${item._id}/consent`, {
        expectedRevision: item.revision,
        confirmed: true,
        grant: true,
        policyVersion: POLICY,
      })
    ).status,
    200,
  );
  return (await ctx.request("GET", `/bookings/${ids.booking}/example`)).data
    .item;
}
const adminInput = (row) => ({
  expectedRevision: row.revision,
  confirmed: true,
  reason: "Reviewed the exact images and text for identifiers.",
});
test("comparison returns only visible canonical fields and validates selection", async (t) => {
  const c = await setup(t);
  const r = await c.request(
    "GET",
    `/tools/compare?ids=${ids.service},${ids.otherService}`,
    undefined,
    null,
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.items.length, 2);
  assert.ok(!JSON.stringify(r.data).includes(users.provider.email));
  c.db.entityControls.rows.push({
    _id: `service:${ids.otherService}`,
    state: "hidden",
  });
  assert.deepEqual(
    (
      await c.request(
        "GET",
        `/tools/compare?ids=${ids.otherService},${ids.service}`,
      )
    ).data.unavailableIds,
    [ids.otherService],
  );
  for (const value of [
    "bad",
    `${ids.service},${ids.service}`,
    `${ids.service},${ids.otherService},${ids.booking},${ids.service}`,
  ])
    assert.equal(
      (await c.request("GET", `/tools/compare?ids=${value}`)).status,
      400,
    );
});
test("price estimates are bounded visible listed prices, not fabricated model-specific quotes", async (t) => {
  const c = await setup(t);
  const r = await c.request(
    "POST",
    "/tools/estimate",
    { symptom: "diagnostic" },
    null,
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.min, 85);
  assert.equal(r.data.modelSpecific, false);
  assert.equal(r.data.currency, null);
  const unknown = await c.request(
    "POST",
    "/tools/estimate",
    { symptom: "diagnostic", model: "Not a known model" },
    null,
  );
  assert.equal(unknown.data.sampleSize, 0);
  assert.equal(unknown.data.min, null);
  assert.equal(unknown.data.modelSpecific, false);
  assert.equal(
    (await c.request("POST", "/tools/estimate", { symptom: "[no match]" })).data
      .sampleSize,
    0,
  );
  assert.equal(
    (await c.request("POST", "/tools/estimate", { symptom: { $ne: "" } }))
      .status,
    400,
  );
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        symptom: "screen",
        category: "bad",
      })
    ).status,
    400,
  );
});
test("providers publish validated model rates; estimates separate exact model variants and repairs", async (t) => {
  const c = await setup(t);
  const { serviceFields } = require("./fixtures.cjs");
  const rates = [
    { model: "iPhone 13", repair: "Screen replacement", price: 80 },
    { model: "iPhone 13 Pro", repair: "Screen replacement", price: 150 },
    { model: "iPhone 13", repair: "Battery replacement", price: 30 },
  ];
  assert.equal(
    (
      await c.request(
        "PUT",
        `/services/${ids.service}`,
        { ...serviceFields, modelPrices: rates },
        "provider",
      )
    ).status,
    200,
  );
  const result = await c.request(
    "POST",
    "/tools/estimate",
    { model: "  IPHONE   13 ", symptom: "replacement screen" },
    null,
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.modelSpecific, true);
  assert.equal(result.data.currency, "USD");
  assert.equal(result.data.min, 80);
  assert.equal(result.data.max, 80);
  assert.equal(result.data.sampleSize, 1);
  assert.deepEqual(result.data.items[0].matchedPrices, [
    {
      model: "iPhone 13",
      repair: "Screen replacement",
      price: 80,
      currency: "USD",
    },
  ]);
  assert.ok(!JSON.stringify(result.data).includes("modelKey"));
  assert.ok(!JSON.stringify(result.data).includes(users.provider.email));
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "iPhone 13 Pro",
        symptom: "screen",
      })
    ).data.min,
    150,
  );
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "iPhone 13 Pro",
        symptom: "battery",
      })
    ).data.sampleSize,
    0,
  );
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "iPhone 13 Plus",
        symptom: "screen",
      })
    ).data.sampleSize,
    0,
  );
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "iPhone 13",
        symptom: "screen",
        category: ids.otherService,
      })
    ).data.sampleSize,
    0,
  );
  c.db.entityControls.rows.push({
    _id: `service:${ids.service}`,
    state: "hidden",
  });
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "iPhone 13",
        symptom: "screen",
      })
    ).data.sampleSize,
    0,
  );
});
test("model rates reject invalid/duplicate input, preserve legacy edits and require service ownership", async (t) => {
  const c = await setup(t);
  const { serviceFields } = require("./fixtures.cjs");
  const rate = { model: "Phone X+", repair: "[panel] replacement", price: 0 };
  const path = `/services/${ids.service}`;
  assert.equal(
    (
      await c.request(
        "PUT",
        path,
        { ...serviceFields, modelPrices: [rate] },
        "other",
      )
    ).status,
    403,
  );
  for (const rates of [
    null,
    {},
    Array(21).fill(rate),
    [rate, { ...rate, model: "phone x+" }],
    [{ ...rate, price: true }],
    [{ ...rate, price: 1.001 }],
    [{ ...rate, price: -1 }],
    [{ ...rate, model: " " }],
    [{ ...rate, modelKey: "forged" }],
  ])
    assert.equal(
      (
        await c.request(
          "PUT",
          path,
          { ...serviceFields, modelPrices: rates },
          "provider",
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await c.request(
        "PUT",
        path,
        { ...serviceFields, modelPrices: [rate] },
        "provider",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "Phone X+",
        symptom: "[panel]",
      })
    ).data.min,
    0,
  );
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "Phone X",
        symptom: "[panel]",
      })
    ).data.sampleSize,
    0,
  );
  assert.equal(
    (
      await c.request("POST", "/tools/estimate", {
        model: "Phone X+",
        symptom: "panel.*",
      })
    ).data.sampleSize,
    0,
  );
  assert.equal(
    (await c.request("PUT", path, serviceFields, "provider")).status,
    200,
  );
  assert.equal(
    (await c.request("GET", `/services/${ids.service}`)).data.modelPrices
      .length,
    1,
  );
  assert.equal(
    (
      await c.request(
        "PUT",
        path,
        { ...serviceFields, modelPrices: [] },
        "provider",
      )
    ).status,
    200,
  );
  assert.equal(
    (await c.request("GET", `/services/${ids.service}`)).data.modelPrices
      .length,
    0,
  );
  const created = await c.request(
    "POST",
    "/services",
    { ...serviceFields, modelPrices: [rate] },
    "provider",
  );
  assert.equal(created.status, 201);
  assert.equal(
    (await c.request("GET", `/services/${created.data.insertedId}`)).data
      .modelPrices[0].currency,
    "USD",
  );
});
test("model matching happens before the bounded price sample", async (t) => {
  const c = await setup(t);
  const { ObjectId } = require("mongodb");
  const { normalizeModelPrices } = require("../model-pricing");
  const { priceValue } = require("../domain");
  c.db.services.rows[0].modelPrices = normalizeModelPrices(
    [{ model: "Target 12", repair: "Screen", price: 42 }],
    priceValue,
  );
  for (let i = 0; i < 105; i++)
    c.db.services.rows.push({
      ...c.service,
      _id: new ObjectId(),
      createdAt: new Date(+fixedTime + 1000),
      modelPrices: normalizeModelPrices(
        [{ model: "Different 12", repair: "Screen", price: 999 }],
        priceValue,
      ),
    });
  const result = await c.request("POST", "/tools/estimate", {
    model: "Target 12",
    symptom: "screen",
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.min, 42);
  assert.equal(result.data.sampleSize, 1);
});
test("saved technicians are owner scoped, idempotent, limited and respect current visibility", async (t) => {
  const c = await setup(t);
  assert.equal(
    (
      await c.request(
        "POST",
        "/saved-technicians",
        { serviceId: ids.service },
        null,
      )
    ).status,
    401,
  );
  const a = await c.request("POST", "/saved-technicians", {
    serviceId: ids.service,
  });
  assert.equal(a.status, 200);
  const b = await c.request("POST", "/saved-technicians", {
    serviceId: ids.service,
  });
  assert.equal(a.data.id, b.data.id);
  assert.equal(
    (await c.request("GET", "/saved-technicians?limit=20")).data.items.length,
    1,
  );
  assert.equal(
    (await c.request("GET", "/saved-technicians?limit=20", undefined, "second"))
      .data.items.length,
    0,
  );
  assert.equal(
    (
      await c.request(
        "DELETE",
        `/saved-technicians/${a.data.id}`,
        undefined,
        "second",
      )
    ).data.deletedCount,
    0,
  );
  c.db.entityControls.rows.push({
    _id: `service:${ids.service}`,
    state: "hidden",
  });
  assert.equal(
    (await c.request("GET", "/saved-technicians?limit=20")).data.items[0]
      .available,
    false,
  );
  assert.equal(
    (await c.request("DELETE", `/saved-technicians/${a.data.id}`)).data
      .deletedCount,
    1,
  );
});
test("gallery drafts require a recorded handover and canonical provider and remain private", async (t) => {
  const c = await setup(t);
  assert.equal(
    (
      await c.request(
        "POST",
        `/bookings/${ids.booking}/example`,
        {
          title: "Title sufficient",
          description: "A sufficiently long description",
        },
        "other",
      )
    ).status,
    404,
  );
  c.db.bookings.rows[0].repair.events = [];
  assert.equal(
    (
      await c.request(
        "POST",
        `/bookings/${ids.booking}/example`,
        {
          title: "Title sufficient",
          description: "A sufficiently long description",
        },
        "provider",
      )
    ).status,
    403,
  );
});
test("images are normalized/encrypted and require provider rights, matching revision and actual image bytes", async (t) => {
  const c = await setup(t),
    item = await draft(c),
    path = `/examples/${item._id}/images/before`,
    h = {
      "X-Example-Revision": "0",
      "X-Example-Policy": POLICY,
      "X-Image-Rights": "confirmed",
    };
  assert.equal(
    (await c.request("POST", path, c.png, "customer", h)).status,
    403,
  );
  assert.equal(
    (await c.request("POST", path, c.png, "provider", {})).status,
    409,
  );
  assert.equal(
    (await c.request("POST", path, Buffer.from("<svg/>"), "provider", h))
      .status,
    415,
  );
  assert.equal(
    (await c.request("POST", path, c.png, "provider", h)).status,
    200,
  );
  const file = c.db.exampleFiles.rows[0];
  assert.ok(file.ciphertext);
  assert.ok(!file.ciphertext.includes(c.png.toString("base64")));
  const image = await c.request("GET", path);
  assert.equal(image.status, 200);
  assert.equal(image.data[0], 255);
  assert.equal(image.headers.get("cache-control"), "no-store");
  assert.equal((await c.request("GET", path, undefined, "second")).status, 404);
  assert.equal(
    (
      await c.request(
        "GET",
        `/repair-gallery/${item._id}/images/before`,
        undefined,
        null,
      )
    ).status,
    404,
  );
  assert.equal(
    (await c.request("POST", path, c.png, "provider", h)).status,
    409,
  );
});
test("customer consent is bound to exact content; provider and stale revision cannot approve", async (t) => {
  const c = await setup(t);
  let item = await uploaded(c);
  assert.equal(
    (
      await c.request("POST", `/examples/${item._id}/consent`, {
        expectedRevision: item.revision,
        confirmed: true,
        grant: true,
        policyVersion: POLICY,
      })
    ).status,
    403,
  );
  await c.request(
    "POST",
    `/examples/${item._id}/submit`,
    { expectedRevision: item.revision, confirmed: true },
    "provider",
  );
  item = (await c.request("GET", `/bookings/${ids.booking}/example`)).data.item;
  const input = {
    expectedRevision: item.revision,
    confirmed: true,
    grant: true,
    policyVersion: POLICY,
  };
  assert.equal(
    (
      await c.request(
        "POST",
        `/examples/${item._id}/consent`,
        input,
        "provider",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await c.request("POST", `/examples/${item._id}/consent`, {
        ...input,
        expectedRevision: 0,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await c.request("POST", `/examples/${item._id}/consent`, {
        ...input,
        policyVersion: "old",
      })
    ).status,
    403,
  );
  assert.equal(
    (await c.request("GET", "/repair-gallery?limit=6", undefined, null)).data
      .items.length,
    0,
  );
});
test("audited moderation is mandatory; public DTO/media omit private identifiers and withdrawal erases files", async (t) => {
  const c = await setup(t),
    item = await consented(c),
    input = adminInput(item);
  assert.equal(
    (
      await c.request(
        "POST",
        `/admin/gallery/${item._id}/moderate`,
        { ...input, publish: true },
        "customer",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await c.request(
        "POST",
        `/admin/gallery/${item._id}/moderate`,
        { ...input, publish: true },
        "admin",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await c.request(
        "POST",
        `/admin/gallery/${item._id}/inspect`,
        input,
        "admin",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await c.request(
        "GET",
        `/admin/gallery/${item._id}/images/before`,
        undefined,
        "admin",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await c.request(
        "POST",
        `/admin/gallery/${item._id}/moderate`,
        { ...input, publish: true },
        "admin",
      )
    ).status,
    200,
  );
  const pub = await c.request(
    "GET",
    "/repair-gallery?limit=6",
    undefined,
    null,
  );
  assert.equal(pub.data.items.length, 1);
  for (const value of [
    ids.booking,
    ids.service,
    users.customer.uid,
    users.customer.email,
    users.provider.uid,
  ])
    assert.ok(!JSON.stringify(pub.data).includes(value));
  assert.equal(
    (
      await c.request(
        "GET",
        `/repair-gallery/${item._id}/images/before`,
        undefined,
        null,
      )
    ).status,
    200,
  );
  assert.equal(
    c.db.auditLogs.rows.filter((r) => r.action.startsWith("gallery.")).length,
    2,
  );
  const current = (await c.request("GET", `/bookings/${ids.booking}/example`))
    .data.item;
  assert.equal(
    (
      await c.request("POST", `/examples/${item._id}/withdraw`, {
        expectedRevision: current.revision,
        confirmed: true,
      })
    ).status,
    200,
  );
  assert.equal(c.db.exampleFiles.rows.length, 0);
  assert.equal(c.db.examples.rows.length, 0);
  assert.equal(
    (
      await c.request(
        "GET",
        `/repair-gallery/${item._id}/images/before`,
        undefined,
        null,
      )
    ).status,
    404,
  );
});
test("moderation audit failure rolls back publication and customer decline removes media", async (t) => {
  const c = await setup(t);
  let item = await consented(c);
  await c.request(
    "POST",
    `/admin/gallery/${item._id}/inspect`,
    adminInput(item),
    "admin",
  );
  const old = c.db.auditLogs.insertOne;
  c.db.auditLogs.insertOne = async () => {
    throw Error("audit unavailable");
  };
  assert.equal(
    (
      await c.request(
        "POST",
        `/admin/gallery/${item._id}/moderate`,
        { ...adminInput(item), publish: true },
        "admin",
      )
    ).status,
    500,
  );
  assert.equal(c.db.examples.rows[0].state, "pending_moderation");
  c.db.auditLogs.insertOne = old;
  await c.request("POST", `/examples/${item._id}/withdraw`, {
    expectedRevision: item.revision,
    confirmed: true,
  });
  item = await uploaded(c);
  await c.request(
    "POST",
    `/examples/${item._id}/submit`,
    { expectedRevision: item.revision, confirmed: true },
    "provider",
  );
  item = (await c.request("GET", `/bookings/${ids.booking}/example`)).data.item;
  assert.equal(
    (
      await c.request("POST", `/examples/${item._id}/consent`, {
        expectedRevision: item.revision,
        confirmed: true,
        grant: false,
      })
    ).status,
    200,
  );
  assert.equal(c.db.exampleFiles.rows.length, 0);
  assert.equal(c.db.examples.rows[0].customerConsent, false);
});
test("known identifiers, missing image rights and global storage capacity fail closed", async (t) => {
  const c = await setup(t);
  assert.equal(
    (
      await c.request(
        "POST",
        `/bookings/${ids.booking}/example`,
        {
          title: "Repair for Demo Customer",
          description: "A private customer name must not be published.",
        },
        "provider",
      )
    ).status,
    400,
  );
  const item = await draft(c),
    path = `/examples/${item._id}/images/before`,
    headers = { "X-Example-Revision": "0", "X-Example-Policy": POLICY };
  assert.equal(
    (await c.request("POST", path, c.png, "provider", headers)).status,
    400,
  );
  c.db.operationMeta.rows.push({
    _id: "gallery:storage",
    bytes: 100 * 1024 * 1024,
  });
  assert.equal(
    (
      await c.request("POST", path, c.png, "provider", {
        ...headers,
        "X-Image-Rights": "confirmed",
      })
    ).status,
    409,
  );
  assert.equal(c.db.exampleFiles.rows.length, 0);
  assert.equal(c.db.examples.rows[0].revision, 0);
});
test("publication follows current visibility and restricted participants can withdraw", async (t) => {
  const c = await setup(t),
    item = await consented(c);
  await c.request(
    "POST",
    `/admin/gallery/${item._id}/inspect`,
    adminInput(item),
    "admin",
  );
  await c.request(
    "POST",
    `/admin/gallery/${item._id}/moderate`,
    { ...adminInput(item), publish: true },
    "admin",
  );
  c.db.entityControls.rows.push({
    _id: `service:${ids.service}`,
    state: "hidden",
  });
  assert.equal(
    (await c.request("GET", "/repair-gallery?limit=6")).data.items.length,
    0,
  );
  assert.equal(
    (await c.request("GET", `/repair-gallery/${item._id}/images/after`)).status,
    404,
  );
  c.db.accountControls.rows.push({
    _id: users.customer.uid,
    state: "restricted",
  });
  const latest = (await c.request("GET", `/bookings/${ids.booking}/example`))
    .data.item;
  assert.equal(
    (
      await c.request("POST", `/examples/${item._id}/withdraw`, {
        confirmed: true,
        expectedRevision: latest.revision,
      })
    ).status,
    200,
  );
  assert.equal(c.db.exampleFiles.rows.length, 0);
});
