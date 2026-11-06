// Explicit local-only integration suite. Does not import dotenv or index.js.
// Start the documented disposable replica set on loopback port 27028 first.
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
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
      getCollections: async () => ({
        ...db,
        transaction: (work) =>
          db.transaction((tx) =>
            work({
              ...tx,
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
    const request = async (method, path, body, token = "provider") => {
      const r = await fetch(
        `http://127.0.0.1:${server.address().port}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
      return { status: r.status, data: await r.json() };
    };
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
    t.diagnostic(
      "12 competing reservations: exactly one committed; failed insert/cancellation rolled back; conflicting closure serialized; real moderation audit/report commit verified; admin audit failures rolled back grants/restrictions/visibility and private inspections failed closed; committed role revocation denied the next request. All data is in a disposable local database.",
    );
  },
);
