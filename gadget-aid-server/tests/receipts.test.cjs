const test = require("node:test"),
  assert = require("node:assert/strict"),
  { once } = require("node:events"),
  { randomBytes, randomUUID } = require("node:crypto"),
  { ObjectId } = require("mongodb"),
  sharp = require("sharp");
const { createApp } = require("../app"),
  { createReceiptVault, receiptVaultFromEnv } = require("../receipt-vault"),
  { MAX_BYTES } = require("../receipts"),
  {
    createFixture,
    verifyIdToken,
    identityDirectory,
    fixedTime,
    users,
  } = require("./fixtures.cjs");
const key = randomBytes(32).toString("base64"),
  vault = createReceiptVault({
    activeKeyId: "test-v1",
    keys: { "test-v1": key },
  });
const photo = async (color = "#336699") =>
  sharp({ create: { width: 96, height: 64, channels: 3, background: color } })
    .withMetadata({ exif: { IFD0: { Copyright: "PRIVATE_EXIF_MARKER" } } })
    .png()
    .toBuffer();
const setup = async (t, options = {}) => {
  const fixture = createFixture({ seedAdminRoles: true });
  const app = createApp({
    getCollections: async () => fixture.db,
    verifyIdToken,
    identityDirectory,
    receiptVault: vault,
    clock: () => new Date(fixedTime),
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const request = async (
    method,
    path,
    body,
    token = "customer",
    headers = {},
  ) => {
    const raw = Buffer.isBuffer(body),
      r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined
            ? { "Content-Type": raw ? "image/png" : "application/json" }
            : {}),
          ...headers,
        },
        body:
          body === undefined ? undefined : raw ? body : JSON.stringify(body),
      });
    return {
      status: r.status,
      headers: r.headers,
      data: r.headers.get("content-type")?.startsWith("image/")
        ? Buffer.from(await r.arrayBuffer())
        : await r.json(),
    };
  };
  const d = await request("POST", "/devices", {
    label: "Test receipt device",
    type: "Laptop",
    brand: "Demo",
    model: "One",
    serialNumber: "",
    purchaseDate: null,
  });
  return {
    ...fixture,
    request,
    device: d.data,
    upload: async (
      bytes,
      extra = {},
      token = "customer",
      deviceId = d.data._id,
    ) =>
      request("POST", `/devices/${deviceId}/receipts`, bytes, token, {
        "X-Upload-Id": randomUUID(),
        "X-Receipt-Policy": "private-receipts-v1",
        "X-Receipt-Label": "Demo%20invoice",
        ...extra,
      }),
  };
};
test("receipt encryption authenticates owner/device/id, rejects tampering and supports explicit old-key reads", () => {
  const context = { ownerUid: "owner", deviceId: "device", id: "receipt" },
    clear = Buffer.from("sensitive receipt"),
    sealed = vault.seal(clear, context);
  assert.ok(!JSON.stringify(sealed).includes("sensitive receipt"));
  assert.deepEqual(vault.open(sealed, context), clear);
  assert.notEqual(vault.seal(clear, context).iv, sealed.iv);
  assert.throws(() => vault.open(sealed, { ...context, ownerUid: "other" }));
  assert.throws(() =>
    vault.open(
      { ...sealed, tag: Buffer.alloc(16).toString("base64") },
      context,
    ),
  );
  const rotated = createReceiptVault({
    activeKeyId: "v2",
    keys: { v2: randomBytes(32).toString("base64"), "test-v1": key },
  });
  assert.deepEqual(rotated.open(sealed, context), clear);
  assert.throws(() =>
    createReceiptVault({ activeKeyId: "bad", keys: { bad: "not-a-key" } }),
  );
  assert.equal(receiptVaultFromEnv({}), null);
});
test("uploads are owner-only, consented, normalized to metadata-free JPEG and encrypted at rest", async (t) => {
  const w = await setup(t),
    input = await photo();
  const accepted = await w.upload(input);
  assert.equal(accepted.status, 201, JSON.stringify(accepted.data));
  const receipt = accepted.data;
  assert.equal(receipt.mediaType, "image/jpeg");
  assert.equal(receipt.ownerUid, undefined);
  assert.equal(receipt.ciphertext, undefined);
  const file = w.db.receiptFiles.rows[0];
  assert.equal(file.encryptionVersion, 1);
  assert.ok(file.ciphertext);
  assert.ok(!JSON.stringify(file).includes("PRIVATE_EXIF_MARKER"));
  const download = await w.request(
    "GET",
    `/devices/${w.device._id}/receipts/${receipt._id}/content`,
  );
  assert.equal(download.status, 200);
  assert.equal(download.data[0], 255);
  assert.equal(download.data[1], 216);
  assert.equal((await sharp(download.data).metadata()).exif, undefined);
  assert.ok(!download.data.includes(Buffer.from("PRIVATE_EXIF_MARKER")));
  assert.equal(download.headers.get("cache-control"), "no-store");
  assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  assert.ok(
    download.headers.get("content-disposition").startsWith("attachment;"),
  );
  for (const token of [null, "provider", "admin", "superadmin", "other"]) {
    const r = await w.request(
      "GET",
      `/devices/${w.device._id}/receipts/${receipt._id}/content`,
      undefined,
      token,
    );
    assert.equal(r.status, token ? 404 : 401);
  }
  const manifest = await w.request("GET", `/devices/${w.device._id}/export`);
  assert.equal(manifest.data.receipts[0]._id, receipt._id);
  assert.ok(!JSON.stringify(manifest.data).includes(file.ciphertext));
});
test("upload admission rejects absent policy, invalid references, wrong content and oversized images", async (t) => {
  const w = await setup(t),
    input = await photo();
  assert.equal(
    (await w.upload(input, { "X-Receipt-Policy": "" })).data.code,
    "RECEIPT_POLICY_REQUIRED",
  );
  assert.equal(
    (await w.upload(input, { "X-Upload-Id": "bad-reference" })).status,
    400,
  );
  assert.equal(
    (await w.upload(input, { "Content-Type": "application/pdf" })).status,
    415,
  );
  for (const body of [
    Buffer.from("<svg><script>alert(1)</script></svg>"),
    Buffer.from("%PDF-1.7 private file"),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  ])
    assert.equal((await w.upload(body)).status, 415);
  assert.equal((await w.upload(Buffer.alloc(MAX_BYTES + 1))).status, 413);
  const wide = await sharp({
    create: { width: 10001, height: 32, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  assert.equal((await w.upload(wide)).status, 415);
  assert.equal(w.db.receipts.rows.length, 0);
});
test("same-reference retries are idempotent, while a changed receipt cannot reuse the reference", async (t) => {
  const w = await setup(t),
    ref = randomUUID(),
    input = await photo();
  assert.equal((await w.upload(input, { "X-Upload-Id": ref })).status, 201);
  assert.equal(
    (await w.upload(input, { "X-Upload-Id": ref.toUpperCase() })).status,
    200,
  );
  assert.equal(
    (await w.upload(await photo("#dd0000"), { "X-Upload-Id": ref })).data.code,
    "UPLOAD_REFERENCE_CONFLICT",
  );
  assert.equal(w.db.receipts.rows.length, 1);
  assert.equal(w.db.receiptFiles.rows.length, 1);
});
test("failed metadata/file writes roll back encrypted content, device guards and deletions", async (t) => {
  const w = await setup(t),
    input = await photo(),
    insert = w.db.receipts.insertOne.bind(w.db.receipts);
  w.db.receipts.insertOne = async () => {
    throw Error("metadata unavailable");
  };
  assert.equal((await w.upload(input)).status, 500);
  assert.equal(w.db.receiptFiles.rows.length, 0);
  assert.equal(w.db.devices.rows[0].receiptGuard, undefined);
  w.db.receipts.insertOne = insert;
  const uploaded = await w.upload(input),
    id = uploaded.data._id;
  const remove = w.db.receiptFiles.deleteOne.bind(w.db.receiptFiles);
  w.db.receiptFiles.deleteOne = async () => {
    throw Error("file deletion failed");
  };
  assert.equal(
    (
      await w.request("DELETE", `/devices/${w.device._id}/receipts/${id}`, {
        confirmed: true,
      })
    ).status,
    500,
  );
  assert.equal(w.db.receipts.rows.length, 1);
  assert.equal(w.db.receiptFiles.rows.length, 1);
  w.db.receiptFiles.deleteOne = remove;
  assert.equal(
    (
      await w.request("DELETE", `/devices/${w.device._id}/receipts/${id}`, {
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await w.request("DELETE", `/devices/${w.device._id}`, {
        confirmed: true,
        expectedRevision: 0,
      })
    ).status,
    200,
  );
  assert.equal(w.db.receipts.rows.length, 0);
  assert.equal(w.db.receiptFiles.rows.length, 0);
});
test("concurrent uploads cannot exceed device quota, and corrupted ciphertext fails closed", async (t) => {
  const w = await setup(t),
    input = await photo();
  for (let i = 0; i < 9; i++)
    w.db.receipts.rows.push({
      _id: new ObjectId(),
      deviceId: w.device._id,
      ownerUid: users.customer.uid,
      size: 1,
    });
  const results = await Promise.all([w.upload(input), w.upload(input)]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(
    results.filter((r) => r.data.code === "RECEIPT_QUOTA").length,
    1,
  );
  assert.equal(w.db.receipts.rows.length, 10);
  const row = w.db.receiptFiles.rows[0];
  row.tag = Buffer.alloc(16).toString("base64");
  const denied = await w.request(
    "GET",
    `/devices/${w.device._id}/receipts/${row._id}/content`,
  );
  assert.equal(denied.status, 503);
  assert.ok(!JSON.stringify(denied.data).includes(row.ciphertext));
});
test("missing keys disable upload; restricted owners can still download and erase receipts", async (t) => {
  const unavailable = await setup(t, { receiptVault: null });
  assert.equal(
    (
      await unavailable.request(
        "GET",
        `/devices/${unavailable.device._id}/receipts`,
      )
    ).data.available,
    false,
  );
  assert.equal((await unavailable.upload(await photo())).status, 503);
  const w = await setup(t),
    uploaded = await w.upload(await photo());
  w.db.accountControls.rows.push({
    _id: users.customer.uid,
    state: "restricted",
    revision: 1,
  });
  assert.equal((await w.upload(await photo())).status, 403);
  assert.equal(
    (
      await w.request(
        "GET",
        `/devices/${w.device._id}/receipts/${uploaded.data._id}/content`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await w.request(
        "DELETE",
        `/devices/${w.device._id}/receipts/${uploaded.data._id}`,
        { confirmed: true },
      )
    ).status,
    200,
  );
});
