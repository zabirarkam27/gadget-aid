const test = require("node:test"),
  assert = require("node:assert/strict"),
  { once } = require("node:events");
const { createApp } = require("../app"),
  {
    createFixture,
    verifyIdToken,
    identityDirectory,
    ids,
    users,
    fixedTime,
  } = require("./fixtures.cjs");
const setup = async (t) => {
  const fixture = createFixture({ seedBooking: true, seedAdminRoles: true });
  let now = new Date(fixedTime);
  const server = createApp({
    getCollections: async () => fixture.db,
    verifyIdToken,
    identityDirectory,
    clock: () => now,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
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
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  return {
    ...fixture,
    request,
    advance: (days) => {
      now = new Date(now.getTime() + days * 86400000);
    },
  };
};
const device = {
  label: "Work laptop",
  type: "Laptop",
  brand: "Demo",
  model: "Model One",
  serialNumber: "PRIVATE-SERIAL-123",
  purchaseDate: "2025-05-02",
};
const make = async (w) => {
  const r = await w.request("POST", "/devices", device);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
};
const complete = async (w) => {
  w.db.bookings.rows[0].status = "working";
  let revision = 0;
  for (const status of ["quality_check", "ready_for_collection", "completed"]) {
    const r = await w.request(
      "PATCH",
      `/all-bookings/${ids.booking}`,
      { status, expectedRevision: revision++ },
      "provider",
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  return revision;
};
const terms = {
  durationDays: 30,
  coverage: "Replacement charging connector workmanship only.",
  exclusions: "Liquid damage and unrelated components are excluded.",
  confirmed: true,
  expectedRevision: 3,
};
test("canonical identifiers prevent duplicate warranties and uppercase device references remain linked", async (t) => {
  const w = await setup(t),
    d = await make(w);
  await complete(w);
  const { ObjectId } = require("mongodb"),
    id = "abcdefabcdefabcdefabcdef";
  w.db.bookings.rows[0]._id = new ObjectId(id);
  assert.equal(
    (
      await w.request("PUT", `/bookings/${id}/device`, {
        deviceId: d._id.toUpperCase(),
        expectedDeviceId: null,
      })
    ).status,
    200,
  );
  assert.equal(w.db.bookings.rows[0].deviceId, d._id);
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${id.toUpperCase()}/warranty`,
        terms,
        "provider",
      )
    ).status,
    201,
  );
  assert.equal(
    (await w.request("POST", `/bookings/${id}/warranty`, terms, "provider"))
      .data.code,
    "WARRANTY_EXISTS",
  );
  assert.equal(
    (await w.request("GET", `/devices/${d._id}/history`)).data.items[0].warranty
      .bookingId,
    id,
  );
});
test("restricted members retain export, deletion and warranty support, but cannot create or relink devices", async (t) => {
  const w = await setup(t),
    d = await make(w);
  await complete(w);
  await w.request(
    "POST",
    `/bookings/${ids.booking}/warranty`,
    terms,
    "provider",
  );
  w.db.accountControls.rows.push({
    _id: users.customer.uid,
    state: "restricted",
    revision: 1,
  });
  assert.equal(
    (await w.request("GET", `/devices/${d._id}/export`)).status,
    200,
  );
  assert.equal(
    (await w.request("POST", "/devices", device)).data.code,
    "ACCOUNT_RESTRICTED",
  );
  assert.equal(
    (
      await w.request("PUT", `/bookings/${ids.booking}/device`, {
        deviceId: d._id,
        expectedDeviceId: null,
      })
    ).data.code,
    "ACCOUNT_RESTRICTED",
  );
  assert.equal(
    (
      await w.request("POST", `/bookings/${ids.booking}/warranty/claims`, {
        description:
          "Please review an existing repair warranty while this account is restricted.",
        expectedRevision: 0,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await w.request("DELETE", `/devices/${d._id}`, {
        confirmed: true,
        expectedRevision: 0,
      })
    ).status,
    200,
  );
});
test("passports are UID-private, reject forged fields and keep serials out of lists/public data", async (t) => {
  const w = await setup(t),
    d = await make(w);
  assert.equal(
    (await w.request("GET", `/devices/${d._id}`, undefined, null)).status,
    401,
  );
  for (const token of ["other", "provider", "admin", "superadmin"])
    assert.equal(
      (await w.request("GET", `/devices/${d._id}`, undefined, token)).status,
      404,
    );
  const list = await w.request("GET", "/devices");
  assert.equal(list.data.items[0]._id, d._id);
  assert.ok(!JSON.stringify(list.data).includes(device.serialNumber));
  assert.equal(list.headers.get("cache-control"), "no-store");
  assert.equal(
    (await w.request("GET", `/devices/${d._id}`)).data.serialNumber,
    device.serialNumber,
  );
  assert.ok(
    !JSON.stringify((await w.request("GET", "/services")).data).includes(
      device.serialNumber,
    ),
  );
  for (const extra of [
    { ownerUid: users.other.uid },
    { warranty: "forged" },
    { invoiceUrl: "https://example.test/private.pdf" },
  ])
    assert.equal(
      (await w.request("POST", "/devices", { ...device, ...extra })).status,
      400,
    );
  for (const purchaseDate of ["2026-02-30", "2027-01-01", {}])
    assert.equal(
      (await w.request("POST", "/devices", { ...device, purchaseDate })).status,
      400,
    );
});
test("device edits use revisions and paginated filters cannot cross owners or scopes", async (t) => {
  const w = await setup(t),
    d = await make(w);
  assert.equal(
    (
      await w.request("PUT", `/devices/${d._id}`, {
        ...device,
        model: "Updated",
        expectedRevision: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await w.request("PUT", `/devices/${d._id}`, {
        ...device,
        expectedRevision: 0,
      })
    ).data.code,
    "STALE_PASSPORT",
  );
  await make(w);
  const page = await w.request("GET", "/devices?limit=1");
  assert.ok(page.data.nextCursor);
  assert.equal(
    (await w.request("GET", `/devices?limit=1&cursor=${page.data.nextCursor}`))
      .data.items.length,
    1,
  );
  assert.equal(
    (
      await w.request(
        "GET",
        `/devices?q=changed&cursor=${page.data.nextCursor}`,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await w.request(
        "GET",
        "/devices?ownerUid=qa-customer",
        undefined,
        "other",
      )
    ).status,
    400,
  );
});
test("only the customer can link owned devices; providers see warranty without serial or device identifiers", async (t) => {
  const w = await setup(t),
    d = await make(w);
  assert.equal(
    (
      await w.request(
        "PUT",
        `/bookings/${ids.booking}/device`,
        { deviceId: d._id, expectedDeviceId: null },
        "provider",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await w.request(
        "PUT",
        `/bookings/${ids.booking}/device`,
        { deviceId: d._id, expectedDeviceId: null },
        "other",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await w.request("PUT", `/bookings/${ids.booking}/device`, {
        deviceId: d._id,
        expectedDeviceId: null,
      })
    ).status,
    200,
  );
  assert.equal(
    (await w.request("GET", `/devices/${d._id}/history`)).data.items[0]._id,
    ids.booking,
  );
  const p = await w.request(
    "GET",
    `/bookings/${ids.booking}/passport`,
    undefined,
    "provider",
  );
  assert.equal(p.data.device, null);
  assert.ok(!JSON.stringify(p.data).includes(device.serialNumber));
  assert.equal(
    (
      await w.request(
        "GET",
        `/bookings/${ids.booking}/passport`,
        undefined,
        "admin",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await w.request("PUT", `/bookings/${ids.booking}/device`, {
        deviceId: null,
        expectedDeviceId: null,
      })
    ).data.code,
    "STALE_PASSPORT",
  );
  assert.equal(
    (
      await w.request("PUT", `/bookings/${ids.booking}/device`, {
        deviceId: null,
        expectedDeviceId: d._id,
      })
    ).status,
    200,
  );
});
test("export is private and device deletion atomically erases the record and detaches history", async (t) => {
  const w = await setup(t),
    d = await make(w);
  await w.request("PUT", `/bookings/${ids.booking}/device`, {
    deviceId: d._id,
    expectedDeviceId: null,
  });
  assert.equal(
    (await w.request("GET", `/devices/${d._id}/export`, undefined, "admin"))
      .status,
    404,
  );
  const exported = await w.request("GET", `/devices/${d._id}/export`);
  assert.equal(exported.data.device.serialNumber, device.serialNumber);
  assert.equal(exported.data.repairs.length, 1);
  assert.equal(
    (await w.request("DELETE", `/devices/${d._id}`, { expectedRevision: 0 }))
      .data.code,
    "CONFIRMATION_REQUIRED",
  );
  const remove = w.db.devices.deleteOne.bind(w.db.devices);
  w.db.devices.deleteOne = async () => {
    throw Error("synthetic deletion outage");
  };
  assert.equal(
    (
      await w.request("DELETE", `/devices/${d._id}`, {
        expectedRevision: 0,
        confirmed: true,
      })
    ).status,
    500,
  );
  assert.equal(w.db.bookings.rows[0].deviceId, d._id);
  assert.equal(w.db.devices.rows.length, 1);
  w.db.devices.deleteOne = remove;
  assert.equal(
    (
      await w.request("DELETE", `/devices/${d._id}`, {
        expectedRevision: 0,
        confirmed: true,
      })
    ).status,
    200,
  );
  assert.equal(w.db.devices.rows.length, 0);
  assert.equal(w.db.bookings.rows[0].deviceId, null);
  assert.equal(
    (await w.request("GET", `/bookings/${ids.booking}`)).status,
    200,
  );
});
test("warranty issuance requires canonical provider and recorded completed handover; no automatic coverage", async (t) => {
  const w = await setup(t);
  assert.equal(
    (await w.request("GET", `/bookings/${ids.booking}/passport`)).data.warranty,
    null,
  );
  for (const token of ["customer", "other", "admin"])
    assert.equal(
      (
        await w.request(
          "POST",
          `/bookings/${ids.booking}/warranty`,
          terms,
          token,
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/warranty`,
        terms,
        "provider",
      )
    ).data.code,
    "HANDOVER_REQUIRED",
  );
  w.db.bookings.rows[0].status = "completed";
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/warranty`,
        terms,
        "provider",
      )
    ).data.code,
    "HANDOVER_REQUIRED",
  );
  await complete(w);
  const issued = await w.request(
    "POST",
    `/bookings/${ids.booking}/warranty`,
    terms,
    "provider",
  );
  assert.equal(issued.status, 201, JSON.stringify(issued.data));
  assert.equal(issued.data.startDate, "2026-11-05");
  assert.equal(issued.data.endDate, "2026-12-04");
  assert.equal(issued.data.coverage, terms.coverage);
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/warranty`,
        terms,
        "provider",
      )
    ).data.code,
    "WARRANTY_EXISTS",
  );
});
test("warranty claim lifecycle is participant-scoped, revision-safe and preserves provider decision history", async (t) => {
  const w = await setup(t);
  await complete(w);
  await w.request(
    "POST",
    `/bookings/${ids.booking}/warranty`,
    terms,
    "provider",
  );
  const path = `/bookings/${ids.booking}/warranty`,
    body = {
      description: "The replaced connector has stopped charging again.",
      expectedRevision: 0,
    };
  assert.equal(
    (await w.request("POST", `${path}/claims`, body, "provider")).status,
    403,
  );
  assert.equal((await w.request("POST", `${path}/claims`, body)).status, 201);
  assert.equal(
    (
      await w.request(
        "POST",
        `${path}/decision`,
        {
          state: "fulfilled",
          note: "Skipped assessment must not be allowed.",
          confirmed: true,
          expectedRevision: 1,
        },
        "provider",
      )
    ).data.code,
    "INVALID_CLAIM_TRANSITION",
  );
  let revision = 1;
  for (const state of ["in_review", "approved", "fulfilled"]) {
    const r = await w.request(
      "POST",
      `${path}/decision`,
      {
        state,
        note: "Provider reviewed the repair-specific coverage and recorded this action.",
        confirmed: true,
        expectedRevision: revision++,
      },
      "provider",
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  const saved = await w.request("GET", `/bookings/${ids.booking}/passport`);
  assert.equal(saved.data.warranty.claim.history.length, 4);
  assert.equal(saved.data.warranty.claim.state, "fulfilled");
  assert.equal(w.db.bookings.rows[0].status, "completed");
});
test("expired warranty cannot promise a new claim and a failed warranty insert rolls back its booking guard", async (t) => {
  const w = await setup(t);
  await complete(w);
  const insert = w.db.warranties.insertOne.bind(w.db.warranties);
  w.db.warranties.insertOne = async () => {
    throw Error("synthetic warranty failure");
  };
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/warranty`,
        terms,
        "provider",
      )
    ).status,
    500,
  );
  assert.equal(w.db.bookings.rows[0].warrantyGuard, undefined);
  w.db.warranties.insertOne = insert;
  await w.request(
    "POST",
    `/bookings/${ids.booking}/warranty`,
    terms,
    "provider",
  );
  w.advance(31);
  assert.equal(
    (await w.request("GET", `/bookings/${ids.booking}/passport`)).data.warranty
      .periodState,
    "expired",
  );
  assert.equal(
    (
      await w.request("POST", `/bookings/${ids.booking}/warranty/claims`, {
        description: "A claim made after the supplied warranty period.",
        expectedRevision: 0,
      })
    ).data.code,
    "WARRANTY_EXPIRED",
  );
});
