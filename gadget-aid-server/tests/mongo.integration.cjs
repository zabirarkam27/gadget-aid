// Explicit local-only integration suite. Does not import dotenv or index.js.
// Start the documented disposable replica set on loopback port 27028 first.
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID, randomBytes } = require("node:crypto");
const sharp = require("sharp");
const { createReceiptVault } = require("../receipt-vault");
const { MongoClient } = require("mongodb");
const { createDatabase } = require("../database");
const { createApp } = require("../app");
const {
  createFixture,
  users,
  ids,
  fixedTime,
  identityDirectory,
} = require("./fixtures.cjs");
const { defaultAvailability } = require("../technicians");
const { moderateReview } = require("../reviews");
test(
  "real local MongoDB transactions prevent slot contention and roll back partial booking/cancellation/moderation writes",
  { timeout: 60000 },
  async (t) => {
    const client = new MongoClient(
      "mongodb://127.0.0.1:27028/?replicaSet=rs0&directConnection=true",
      { serverSelectionTimeoutMS: 10000 },
    );
    await client.connect();
    t.after(() => client.close());
    const hello = await client.db("admin").command({ hello: 1 });
    assert.equal(hello.setName, "rs0");
    assert.equal(hello.isWritablePrimary, true);
    const databaseName = `gadgetaid_phase8_qa_${randomUUID().replaceAll("-", "")}`;
    const db = createDatabase(client, databaseName),
      fixture = createFixture({ seedAdminRoles: true });
    await db.services.insertOne(fixture.service);
    for (const grant of fixture.db.roleGrants.rows)
      await db.roleGrants.insertOne(grant);
    let failMode = "";
    const app = createApp({
      repairClassifier: async () => ({ issues: ["power"], questions: ["onset"] }),
      receiptVault: createReceiptVault({
        activeKeyId: "qa-v1",
        keys: { "qa-v1": randomBytes(32).toString("base64") },
      }),
      getCollections: async () => ({
        ...db,
        transaction: (work) =>
          db.transaction((tx) =>
            work({
              ...tx,
              receipts:
                failMode === "receipt-meta"
                  ? {
                      ...tx.receipts,
                      insertOne: async () => {
                        throw Error("Synthetic receipt metadata outage");
                      },
                    }
                  : tx.receipts,
              receiptFiles:
                failMode === "receipt-cascade"
                  ? {
                      ...tx.receiptFiles,
                      deleteMany: async () => {
                        throw Error("Synthetic receipt erasure outage");
                      },
                    }
                  : tx.receiptFiles,
              devices:
                failMode === "passport-delete"
                  ? {
                      ...tx.devices,
                      deleteOne: async () => {
                        throw Error("Synthetic device deletion failure");
                      },
                    }
                  : tx.devices,
              warranties:
                failMode === "warranty-insert"
                  ? {
                      ...tx.warranties,
                      insertOne: async () => {
                        throw Error("Synthetic warranty insertion failure");
                      },
                    }
                  : tx.warranties,
              auditLogs:
                failMode === "audit"
                  ? {
                      ...tx.auditLogs,
                      insertOne: async () => {
                        throw new Error("Synthetic audit outage");
                      },
                    }
                  : tx.auditLogs,
              bookings:
                failMode === "insert"
                  ? {
                      ...tx.bookings,
                      insertOne: async () => {
                        throw new Error("Synthetic insertion outage");
                      },
                    }
                  : tx.bookings,
              technicians:
                failMode === "cancel"
                  ? {
                      ...tx.technicians,
                      updateOne: async () => {
                        throw new Error("Synthetic calendar outage");
                      },
                    }
                  : tx.technicians,
            }),
          ),
      }),
      identityDirectory,
      clock: () => new Date(fixedTime),
      verifyIdToken: async (token) =>
        users[token]
          ? {
              ...users[token],
              email_verified: true,
              auth_time: Math.floor(fixedTime.getTime() / 1000),
            }
          : {
              uid: `qa-${token}`,
              email: `${token}@example.test`,
              name: "Synthetic race customer",
            },
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
      token = "provider",
      headers = {},
    ) => {
      const r = await fetch(
        `http://127.0.0.1:${server.address().port}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
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
        },
      );
      return {
        status: r.status,
        data: r.headers.get("content-type")?.startsWith("image/")
          ? Buffer.from(await r.arrayBuffer())
          : await r.json(),
      };
    };
    // Exercise actual Mongo aggregation semantics, not just the memory fixture.
    for (let i = 0; i < 16; i++) await db.services.insertOne({ ...fixture.service, _id: new (require("mongodb").ObjectId)(), name: `Pagination QA ${i}`, price: i % 2 ? "9.50" : 100, createdAt: new Date(+fixedTime + i * 1000) });
    const listed = await request("GET", "/services?paged=1&limit=3&sort=low&q=Pagination");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.data.items.map(s => s.price), [9.5, 9.5, 9.5]);
    const listedNext = await request("GET", `/services?paged=1&limit=3&sort=low&q=Pagination&cursor=${listed.data.nextCursor}`);
    assert.equal(listedNext.status, 200);
    assert.equal(new Set([...listed.data.items, ...listedNext.data.items].map(s => s._id)).size, 6);
    const newest = await request("GET", "/services?paged=1&limit=1&sort=newest&q=Pagination");
    assert.equal(newest.data.items[0].name, "Pagination QA 15");
    const free = await request("GET", "/services?paged=1&maxPrice=0");
    assert.equal(free.data.items.length, 0);
    await db.services.insertOne({ ...fixture.service, _id: new (require("mongodb").ObjectId)(), name: "Pagination QA fractional", price: "1.234" });
    assert.equal((await request("GET", "/services?paged=1&q=Pagination&maxPrice=2")).data.items.length, 0);
    const privatePage = await request("GET", "/bookings?paged=1", undefined, "customer");
    assert.equal(privatePage.status, 200);
    assert.deepEqual(privatePage.data.summary.map(c => c.value), [0, 0, 0]);
    await db.bookings.insertOne({ ...fixture.booking, _id: new (require("mongodb").ObjectId)(), serviceName: "Pagination booking", status: "working" });
    const workingPage = await request("GET", "/bookings?paged=1&status=repairing", undefined, "customer");
    assert.equal(workingPage.status, 200);
    assert.equal(workingPage.data.items.length, 1);
    assert.deepEqual(workingPage.data.summary.map(c => c.value), [0, 1, 0]);
    await db.bookings.deleteMany({ serviceName: "Pagination booking" });
    await db.services.deleteMany({ name: /^Pagination QA / });
    // Shared AI quota guards must survive real concurrent transaction retries.
    const assistantInput = { category: "Laptop", brand: "", model: "", symptoms: "Laptop does not start at all", onset: "", danger: false, useAi: true, consentVersion: "repair-ai-v1" };
    for (let i = 0; i < 8; i++) assert.equal((await request("POST", "/repair-assistant", assistantInput, "customer")).data.mode, "ai");
    const competingAi = await Promise.all(Array.from({ length: 6 }, () => request("POST", "/repair-assistant", assistantInput, "customer")));
    assert.equal(competingAi.filter(r => r.data.mode === "ai").length, 2);
    assert.ok(competingAi.filter(r => r.data.mode !== "ai").every(r => r.status === 429));
    assert.equal((await db.operationMeta.findOne({ _id: "assistant:user:qa-customer" })).count, 10);
    assert.equal((await db.operationMeta.findOne({ _id: "assistant:global" })).count, 10);
    const a = defaultAvailability();
    const body = {
      businessName: "Local integration repairs",
      photo: "",
      bio: "Synthetic local transaction test.",
      skills: [],
      categories: [],
      area: "Dhaka",
      yearsExperience: null,
      certifications: [],
      availability: {
        configured: true,
        mode: "appointments",
        weekly: a.weekly.map((row) => ({ ...row, closed: false })),
        exceptions: [],
      },
      expectedRevision: 0,
    };
    const saved = await request("PUT", "/my-technician", body);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const input = {
      serviceId: ids.service,
      date: "2026-11-06",
      time: "10:00",
      instruction: "Synthetic appointment.",
    };
    const attempts = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        request("POST", "/bookings", input, `race-${i}`),
      ),
    );
    assert.equal(
      attempts.filter((r) => r.status === 201).length,
      1,
      JSON.stringify(attempts),
    );
    assert.equal(
      attempts.filter((r) => r.data.code === "SLOT_UNAVAILABLE").length,
      11,
    );
    let profile = await db.technicians.findOne({});
    assert.equal(profile.reservations.length, 1);
    assert.equal((await db.bookings.find({}).toArray()).length, 1);
    const winningIndex = attempts.findIndex((r) => r.status === 201),
      bookingId = attempts[winningIndex].data.bookingId;
    failMode = "cancel";
    const failedCancel = await request(
      "POST",
      `/bookings/${bookingId}/cancel`,
      { note: "Synthetic cancellation rollback", expectedRevision: 0 },
      `race-${winningIndex}`,
    );
    assert.equal(failedCancel.status, 500);
    assert.equal(
      (
        await db.bookings.findOne({
          _id: require("../domain").idValue(bookingId),
        })
      ).status,
      "pending",
    );
    assert.equal((await db.technicians.findOne({})).reservations.length, 1);
    failMode = "";
    assert.equal(
      (
        await request(
          "POST",
          `/bookings/${bookingId}/cancel`,
          { note: "Release synthetic appointment", expectedRevision: 0 },
          `race-${winningIndex}`,
        )
      ).status,
      200,
    );
    assert.equal((await db.technicians.findOne({})).reservations.length, 0);
    assert.equal(
      (await request("POST", "/bookings", input, "replacement-customer"))
        .status,
      201,
    );
    const before = await db.technicians.findOne({}),
      serviceBefore = await db.services.findOne({ _id: fixture.service._id });
    failMode = "insert";
    assert.equal(
      (
        await request(
          "POST",
          "/bookings",
          { ...input, date: "2026-11-07" },
          "failure-customer",
        )
      ).status,
      500,
    );
    failMode = "";
    profile = await db.technicians.findOne({});
    assert.equal(profile.revision, before.revision);
    assert.equal(profile.reservations.length, before.reservations.length);
    assert.equal(
      (await db.services.findOne({ _id: fixture.service._id })).lastBookingId,
      serviceBefore.lastBookingId,
    );
    const closure = {
      ...body,
      expectedRevision: profile.revision,
      availability: {
        ...body.availability,
        exceptions: [
          { date: "2026-11-07", closed: true, start: "09:00", end: "17:00" },
        ],
      },
    };
    const closing = await Promise.all([
      request(
        "POST",
        "/bookings",
        { ...input, date: "2026-11-07" },
        "closure-race",
      ),
      request("PUT", "/my-technician", closure),
    ]);
    assert.equal(closing.filter((r) => r.status < 300).length, 1);
    assert.equal(closing.filter((r) => r.status === 409).length, 1);
    // Exercise real stored handover eligibility and moderation/report transaction too.
    const booking = { ...fixture.booking, status: "working" };
    await db.bookings.insertOne(booking);
    let revision = 0;
    for (const status of ["quality_check", "ready_for_collection", "completed"])
      assert.equal(
        (
          await request("PATCH", `/all-bookings/${ids.booking}`, {
            status,
            expectedRevision: revision++,
          })
        ).status,
        200,
      );
    const reviewed = await request(
      "POST",
      `/bookings/${ids.booking}/review`,
      {
        rating: 4,
        feedback:
          "A synthetic local review after a recorded completed handover.",
      },
      "customer",
    );
    assert.equal(reviewed.status, 201);
    assert.equal(
      (
        await request(
          "POST",
          `/reviews/${reviewed.data._id}/report`,
          { category: "other", details: "Synthetic moderation queue test." },
          "other",
        )
      ).status,
      201,
    );
    await moderateReview(
      db,
      {
        reviewId: reviewed.data._id,
        action: "hide",
        reason: "Synthetic operator decision for integration testing.",
        actor: "local-integration-test",
      },
      fixedTime,
    );
    assert.equal((await db.reviews.findOne({})).moderationState, "hidden");
    assert.equal((await db.reviewReports.findOne({})).state, "resolved");
    const publicProfile = await request(
      "GET",
      `/technicians/${saved.data._id}`,
    );
    assert.equal(publicProfile.data.reviewCount, 0);
    assert.equal(publicProfile.data.averageRating, null);
    const privileged = {
      reason: "Review the isolated operational target and its audit state.",
      confirmed: true,
      expectedRevision: 0,
    };
    assert.equal(
      (await request("GET", "/admin/overview", undefined, "admin")).status,
      200,
    );
    failMode = "audit";
    assert.equal(
      (
        await request(
          "POST",
          "/admin/accounts/qa-customer/state",
          { ...privileged, state: "restricted" },
          "admin",
        )
      ).status,
      500,
    );
    assert.equal(
      await db.accountControls.findOne({ _id: users.customer.uid }),
      null,
    );
    assert.equal(
      (
        await request(
          "POST",
          `/admin/services/${ids.service}/publication`,
          { ...privileged, state: "hidden" },
          "admin",
        )
      ).status,
      500,
    );
    assert.equal(
      await db.entityControls.findOne({ _id: `service:${ids.service}` }),
      null,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/admin/roles/qa-second",
          { ...privileged, role: "admin", active: true },
          "superadmin",
        )
      ).status,
      500,
    );
    assert.equal(await db.roleGrants.findOne({ _id: users.second.uid }), null);
    const privateFailure = await request(
      "POST",
      `/admin/inspect/booking/${ids.booking}`,
      { reason: privileged.reason, confirmed: true },
      "admin",
    );
    assert.equal(privateFailure.status, 500);
    assert.ok(
      !JSON.stringify(privateFailure.data).includes(booking.instruction),
    );
    failMode = "";
    assert.equal(
      (
        await request(
          "POST",
          "/admin/roles/qa-second",
          { ...privileged, role: "admin", active: true },
          "superadmin",
        )
      ).status,
      200,
    );
    assert.equal(
      (await request("GET", "/admin/overview", undefined, "second")).status,
      200,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/admin/roles/qa-second",
          { ...privileged, expectedRevision: 1, role: "admin", active: false },
          "superadmin",
        )
      ).status,
      200,
    );
    assert.equal(
      (await request("GET", "/admin/overview", undefined, "second")).status,
      403,
    );
    assert.equal(
      (
        await request(
          "POST",
          `/admin/services/${ids.service}/publication`,
          { ...privileged, state: "hidden" },
          "admin",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/bookings",
          { ...input, date: "2026-11-09" },
          "new-after-hide",
        )
      ).data.code,
      "SERVICE_UNAVAILABLE",
    );
    assert.equal(
      (await request("GET", "/admin/audit", undefined, "admin")).status,
      200,
    );
    const passport = await request(
      "POST",
      "/devices",
      {
        label: "Local QA laptop",
        type: "Laptop",
        brand: "Demo",
        model: "Integration",
        serialNumber: "LOCAL-PRIVATE-SERIAL",
        purchaseDate: null,
      },
      "customer",
    );
    assert.equal(passport.status, 201);
    assert.equal(
      (
        await request(
          "PUT",
          `/bookings/${ids.booking}/device`,
          { deviceId: passport.data._id, expectedDeviceId: null },
          "customer",
        )
      ).status,
      200,
    );
    failMode = "warranty-insert";
    const warrantyTerms = {
      durationDays: 30,
      coverage: "Synthetic connector workmanship coverage only.",
      exclusions: "Unrelated faults excluded.",
      confirmed: true,
      expectedRevision: 3,
    };
    assert.equal(
      (
        await request(
          "POST",
          `/bookings/${ids.booking}/warranty`,
          warrantyTerms,
          "provider",
        )
      ).status,
      500,
    );
    assert.equal(
      (await db.bookings.findOne({ _id: booking._id })).warrantyGuard,
      undefined,
    );
    failMode = "";
    assert.equal(
      (
        await request(
          "POST",
          `/bookings/${ids.booking}/warranty`,
          warrantyTerms,
          "provider",
        )
      ).status,
      201,
    );
    const competingClaims = await Promise.all(
      [1, 2].map(() =>
        request(
          "POST",
          `/bookings/${ids.booking}/warranty/claims`,
          {
            description: "Synthetic warranty claim after connector failure.",
            expectedRevision: 0,
          },
          "customer",
        ),
      ),
    );
    assert.equal(competingClaims.filter((r) => r.status === 201).length, 1);
    assert.equal(competingClaims.filter((r) => r.status === 409).length, 1);
    failMode = "passport-delete";
    assert.equal(
      (
        await request(
          "DELETE",
          `/devices/${passport.data._id}`,
          { confirmed: true, expectedRevision: 0 },
          "customer",
        )
      ).status,
      500,
    );
    assert.equal(
      (await db.bookings.findOne({ _id: booking._id })).deviceId,
      passport.data._id,
    );
    assert.ok(await db.devices.findOne({ ownerUid: users.customer.uid }));
    failMode = "";
    assert.equal(
      (
        await request(
          "DELETE",
          `/devices/${passport.data._id}`,
          { confirmed: true, expectedRevision: 0 },
          "customer",
        )
      ).status,
      200,
    );
    assert.equal(
      (await db.bookings.findOne({ _id: booking._id })).deviceId,
      null,
    );
    assert.equal(
      await db.devices.findOne({ ownerUid: users.customer.uid }),
      null,
    );
    assert.equal(
      await db.warranties.countDocuments({ bookingId: ids.booking }),
      1,
    );
    const receiptDevice = await request(
      "POST",
      "/devices",
      {
        label: "Receipt QA device",
        type: "Laptop",
        brand: "Demo",
        model: "Receipt",
        serialNumber: "",
        purchaseDate: null,
      },
      "customer",
    );
    assert.equal(receiptDevice.status, 201);
    const receiptPhoto = await sharp({
        create: { width: 96, height: 64, channels: 3, background: "#336699" },
      })
        .png()
        .toBuffer(),
      receiptPath = `/devices/${receiptDevice.data._id}/receipts`,
      receiptHeaders = {
        "X-Upload-Id": randomUUID(),
        "X-Receipt-Policy": "private-receipts-v1",
        "X-Receipt-Label": "Local%20receipt",
      };
    failMode = "receipt-meta";
    assert.equal(
      (
        await request(
          "POST",
          receiptPath,
          receiptPhoto,
          "customer",
          receiptHeaders,
        )
      ).status,
      500,
    );
    assert.equal(await db.receiptFiles.countDocuments({}), 0);
    assert.equal(await db.receipts.countDocuments({}), 0);
    failMode = "";
    const storedReceipt = await request(
      "POST",
      receiptPath,
      receiptPhoto,
      "customer",
      receiptHeaders,
    );
    assert.equal(storedReceipt.status, 201);
    assert.equal(
      (
        await request(
          "POST",
          receiptPath,
          receiptPhoto,
          "customer",
          receiptHeaders,
        )
      ).status,
      200,
    );
    const encryptedReceipt = await db.receiptFiles.findOne({});
    assert.ok(encryptedReceipt.ciphertext);
    assert.equal(encryptedReceipt.encryptionVersion, 1);
    assert.equal(
      (
        await request(
          "GET",
          `${receiptPath}/${storedReceipt.data._id}/content`,
          undefined,
          "customer",
        )
      ).data[0],
      255,
    );
    failMode = "receipt-cascade";
    assert.equal(
      (
        await request(
          "DELETE",
          `/devices/${receiptDevice.data._id}`,
          { confirmed: true, expectedRevision: 0 },
          "customer",
        )
      ).status,
      500,
    );
    assert.equal(await db.receipts.countDocuments({}), 1);
    assert.equal(await db.receiptFiles.countDocuments({}), 1);
    assert.ok(await db.devices.findOne({ ownerUid: users.customer.uid }));
    failMode = "";
    assert.equal(
      (
        await request(
          "DELETE",
          `/devices/${receiptDevice.data._id}`,
          { confirmed: true, expectedRevision: 0 },
          "customer",
        )
      ).status,
      200,
    );
    assert.equal(await db.receipts.countDocuments({}), 0);
    assert.equal(await db.receiptFiles.countDocuments({}), 0);
    t.diagnostic(
      "Private receipts: metadata failures rolled back ciphertext; idempotent retries retained one file; encrypted content round-tripped through authorized download; failed device cascade preserved both metadata and ciphertext; successful deletion erased both atomically.",
    );
    t.diagnostic(
      "Phase 10: failed warranty insertion and device deletion rolled back; concurrent claims committed exactly once; device erasure detached repair links while preserving provider warranty history.",
    );
    t.diagnostic(
      "12 competing reservations: exactly one committed; failed insert/cancellation rolled back; conflicting closure serialized; real moderation audit/report commit verified; admin audit failures rolled back grants/restrictions/visibility and private inspections failed closed; committed role revocation denied the next request. All data is in a disposable local database.",
    );
  },
);
