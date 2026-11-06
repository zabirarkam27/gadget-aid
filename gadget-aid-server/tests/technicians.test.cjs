const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { ObjectId } = require("mongodb");
const { createApp } = require("../app");
const {
  createFixture,
  users,
  ids,
  fixedTime,
  verifyIdToken,
} = require("./fixtures.cjs");
const { technicianId, defaultAvailability } = require("../technicians");
const { moderateReview } = require("../reviews");
const setup = async (t, options = {}) => {
  const fixture = createFixture({ seedBooking: options.seedBooking ?? false });
  let now = new Date(fixedTime);
  const app = createApp({
    getCollections: async () => fixture.db,
    verifyIdToken,
    clock: () => new Date(now),
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const request = async (method, path, body, token = "provider") => {
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
const profileBody = (extra = {}) => {
  const availability = defaultAvailability();
  availability.configured = true;
  availability.mode = "appointments";
  availability.weekly = availability.weekly.map((row) => ({
    ...row,
    closed: false,
  }));
  const { timeZone, slotMinutes, ...editable } = availability;
  return {
    businessName: "Careful Laptop Repairs",
    photo: "https://example.test/logo.png",
    bio: "We diagnose and repair laptop power and display problems.",
    skills: ["Board diagnostics", "Power repair"],
    categories: ["Laptops"],
    area: "Dhaka",
    yearsExperience: 7,
    certifications: ["Example training certificate"],
    availability: editable,
    expectedRevision: 0,
    ...extra,
  };
};
const book = (w, extra = {}, token = "customer") =>
  w.request(
    "POST",
    "/bookings",
    { serviceId: ids.service, date: "2026-11-06", time: "10:00", ...extra },
    token,
  );
const save = (w, body = profileBody()) =>
  w.request("PUT", "/my-technician", body);
const complete = async (w) => {
  w.db.bookings.rows[0].status = "working";
  let rev = 0;
  for (const status of ["quality_check", "ready_for_collection", "completed"]) {
    const result = await w.request("PATCH", `/all-bookings/${ids.booking}`, {
      status,
      expectedRevision: rev++,
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
};
const review = (w, extra = {}, token = "customer") =>
  w.request(
    "POST",
    `/bookings/${ids.booking}/review`,
    {
      rating: 5,
      feedback:
        "The power repair was clearly explained and the laptop works well.",
      ...extra,
    },
    token,
  );
test("technician profile is private to its owner, public claims are unverified and ratings start empty", async (t) => {
  const w = await setup(t);
  assert.equal(
    (await w.request("GET", "/my-technician", undefined, null)).status,
    401,
  );
  const result = await save(w);
  assert.equal(result.status, 200);
  assert.equal(result.data.claimsVerified, false);
  const id = result.data._id;
  const publicResult = await w.request(
    "GET",
    `/technicians/${id}`,
    undefined,
    null,
  );
  assert.equal(publicResult.status, 200);
  assert.equal(publicResult.data.reviewCount, 0);
  assert.equal(publicResult.data.averageRating, null);
  assert.equal(publicResult.data.services.length, 1);
  assert.ok(!JSON.stringify(publicResult.data).includes("ownerEmail"));
  assert.ok(!JSON.stringify(publicResult.data).includes(users.provider.email));
  assert.ok(!JSON.stringify(publicResult.data).includes("reservations"));
  const other = await w.request("GET", "/my-technician", undefined, "other");
  assert.notEqual(other.data._id, id);
  assert.equal(
    (
      await w.request(
        "PUT",
        "/my-technician",
        { ...profileBody(), ownerUid: users.provider.uid },
        "other",
      )
    ).status,
    400,
  );
  assert.equal((await save(w)).data.code, "STALE_PROFILE");
});
test("profile and schedule validation reject forged verification, malformed hours, duplicate days and invalid exceptions", async (t) => {
  const w = await setup(t);
  for (const extra of [
    { claimsVerified: true },
    { yearsExperience: 1.5 },
    { yearsExperience: 81 },
    { photo: "javascript:alert(1)" },
    { skills: ["dup", "dup"] },
  ])
    assert.equal((await save(w, profileBody(extra))).status, 400);
  const base = profileBody();
  for (const change of [
    { weekly: base.availability.weekly.map((row) => ({ ...row, day: 0 })) },
    {
      weekly: base.availability.weekly.map((row) => ({
        ...row,
        start: "10:30",
      })),
    },
    {
      exceptions: [
        { date: "2026-02-30", closed: true, start: "09:00", end: "17:00" },
      ],
    },
    { mode: "instant" },
    { timeZone: "UTC" },
  ])
    assert.equal(
      (
        await save(
          w,
          profileBody({ availability: { ...base.availability, ...change } }),
        )
      ).status,
      400,
    );
  assert.equal(w.db.technicians.rows.length, 0);
});
test("legacy listings expose a safe fallback profile without creating records", async (t) => {
  const w = await setup(t);
  delete w.db.services.rows[0].providerUid;
  const services = await w.request("GET", "/services", undefined, null);
  const id = services.data[0].technicianId;
  const result = await w.request("GET", `/technicians/${id}`, undefined, null);
  assert.equal(result.status, 200);
  assert.equal(result.data.businessName, users.provider.name);
  assert.equal(result.data.claimsVerified, false);
  assert.equal(w.db.technicians.rows.length, 0);
});
test("availability uses Bangladesh weekdays, date exceptions, horizon and elapsed time", async (t) => {
  const w = await setup(t);
  const body = profileBody();
  body.availability.weekly.find((row) => row.day === 5).closed = true;
  body.availability.exceptions = [
    { date: "2026-11-06", closed: false, start: "10:00", end: "12:00" },
  ];
  await save(w, body);
  const result = await w.request(
    "GET",
    `/services/${ids.service}/availability?date=2026-11-06`,
    undefined,
    null,
  );
  assert.equal(result.data.timeZone, "Asia/Dhaka");
  assert.deepEqual(result.data.slots, ["10:00", "11:00"]);
  const today = await w.request(
    "GET",
    `/services/${ids.service}/availability?date=2026-11-05`,
    undefined,
    null,
  );
  assert.deepEqual(today.data.slots, []);
  assert.equal(
    (
      await w.request(
        "GET",
        `/services/${ids.service}/availability?date=2027-05-01`,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await w.request(
        "GET",
        `/services/${ids.service}/availability?date=2026-02-30`,
      )
    ).status,
    400,
  );
});
test("server enforces slot selection and computes the reservation from canonical hours", async (t) => {
  const w = await setup(t);
  await save(w);
  for (const time of [undefined, "", "08:00", "10:30", "24:00", "10:00Z"])
    assert.equal((await book(w, { time })).data.code, "SLOT_REQUIRED");
  assert.equal(
    (await book(w, { appointment: { startsAt: "forged" } })).status,
    400,
  );
  const result = await book(w);
  assert.equal(result.status, 201);
  const record = w.db.bookings.rows[0];
  assert.equal(
    record.appointment.startsAt.toISOString(),
    "2026-11-06T04:00:00.000Z",
  );
  assert.equal(
    record.appointment.endsAt.toISOString(),
    "2026-11-06T05:00:00.000Z",
  );
  assert.equal(w.db.technicians.rows[0].reservations.length, 1);
  assert.ok(
    !(
      await w.request(
        "GET",
        `/services/${ids.service}/availability?date=2026-11-06`,
      )
    ).data.slots.includes("10:00"),
  );
  assert.equal(
    (await w.request("GET", "/bookings", undefined, "customer")).data[0]
      .appointment.time,
    "10:00",
  );
});
test("concurrent customers and different services cannot reserve the same technician time", async (t) => {
  const w = await setup(t);
  await save(w);
  const copy = {
    ...w.service,
    _id: new ObjectId("444444444444444444444444"),
    name: "Another repair by the same technician",
  };
  w.db.services.rows.push(copy);
  const results = await Promise.all([
    book(w),
    book(w, { serviceId: String(copy._id) }, "second"),
  ]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(
    results.filter((r) => r.data.code === "SLOT_UNAVAILABLE").length,
    1,
  );
  assert.equal(w.db.bookings.rows.length, 1);
  assert.equal(w.db.technicians.rows[0].reservations.length, 1);
});
test("failed booking insert rolls back the calendar and listing guard", async (t) => {
  const w = await setup(t);
  await save(w);
  const before = w.db.technicians.rows[0].revision;
  w.db.bookings.insertOne = async () => {
    throw new Error("write outage");
  };
  assert.equal((await book(w)).status, 500);
  assert.equal(w.db.technicians.rows[0].reservations.length, 0);
  assert.equal(w.db.technicians.rows[0].revision, before);
  assert.equal(w.db.services.rows[0].lastBookingId, undefined);
});
test("cancellation releases a reserved slot atomically and failed release rolls back repair history", async (t) => {
  const w = await setup(t);
  await save(w);
  const created = await book(w);
  const id = created.data.bookingId;
  const update = w.db.technicians.updateOne.bind(w.db.technicians);
  w.db.technicians.updateOne = async () => {
    throw new Error("calendar outage");
  };
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${id}/cancel`,
        { expectedRevision: 0, note: "Plans have changed" },
        "customer",
      )
    ).status,
    500,
  );
  assert.equal(w.db.bookings.rows[0].status, "pending");
  assert.equal(w.db.bookings.rows[0].repairRevision, 0);
  assert.equal(w.db.technicians.rows[0].reservations.length, 1);
  w.db.technicians.updateOne = update;
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${id}/cancel`,
        { expectedRevision: 0, note: "Plans have changed" },
        "customer",
      )
    ).status,
    200,
  );
  assert.equal(w.db.technicians.rows[0].reservations.length, 0);
  assert.equal((await book(w, {}, "second")).status, 201);
});
test("schedule changes cannot close existing reservations and stale profile revisions fail", async (t) => {
  const w = await setup(t);
  await save(w);
  await book(w);
  const body = profileBody({ expectedRevision: 2 });
  body.availability.exceptions = [
    { date: "2026-11-06", closed: true, start: "09:00", end: "17:00" },
  ];
  assert.equal((await save(w, body)).data.code, "AVAILABILITY_CONFLICT");
  assert.equal(
    (await save(w, profileBody({ expectedRevision: 1 }))).data.code,
    "STALE_PROFILE",
  );
  const current = await w.request("GET", "/my-technician");
  assert.equal(current.data.revision, 2);
  assert.equal(current.data.availability.exceptions.length, 0);
});
test("request-only schedules enforce closed days without claiming a reservation; unconfigured legacy dates remain compatible", async (t) => {
  const w = await setup(t);
  assert.equal((await book(w, { time: undefined })).status, 201);
  assert.equal(w.db.bookings.rows[0].appointment, undefined);
  const v = await setup(t);
  const body = profileBody();
  body.availability.mode = "requests";
  body.availability.weekly.find((row) => row.day === 5).closed = true;
  await save(v, body);
  assert.equal(
    (await book(v, { time: undefined })).data.code,
    "PROVIDER_CLOSED",
  );
  assert.equal(
    (await book(v, { date: "2026-11-07", time: undefined })).status,
    201,
  );
  assert.equal(v.db.technicians.rows[0].reservations.length, 0);
});
test("only the actual customer of a server-verified handover can review, with one immutable review", async (t) => {
  const w = await setup(t, { seedBooking: true });
  w.db.bookings.rows[0].status = "completed";
  assert.equal((await review(w)).data.code, "REVIEW_NOT_ELIGIBLE");
  await complete(w);
  assert.equal((await review(w, {}, "second")).status, 403);
  assert.equal((await review(w, {}, "provider")).status, 403);
  for (const extra of [
    { rating: 0 },
    { rating: 5.1 },
    { feedback: "short" },
    { providerUid: users.other.uid },
    { reviewVersion: 1 },
  ])
    assert.equal((await review(w, extra)).status, 400);
  const results = await Promise.all([review(w), review(w)]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(
    results.filter((r) => r.data.code === "REVIEW_EXISTS").length,
    1,
  );
  assert.equal(w.db.reviews.rows.length, 1);
  assert.equal(
    (
      await w.request(
        "GET",
        `/bookings/${ids.booking}/review`,
        undefined,
        "customer",
      )
    ).data.eligible,
    false,
  );
});
test("public ratings use only eligible published reviews and omit private booking/customer fields", async (t) => {
  const w = await setup(t, { seedBooking: true });
  await complete(w);
  await review(w, { rating: 4 });
  const id = technicianId(users.provider.email);
  let result = await w.request("GET", `/technicians/${id}`, undefined, null);
  assert.equal(result.data.averageRating, 4);
  assert.equal(result.data.reviewCount, 1);
  const serialized = JSON.stringify(result.data.reviews);
  assert.ok(!serialized.includes(users.customer.email));
  assert.ok(!serialized.includes(ids.booking));
  assert.ok(!serialized.includes(users.customer.uid));
  w.db.reviews.rows.push({
    ...w.db.reviews.rows[0],
    _id: new ObjectId(),
    rating: 1,
    reviewVersion: 1,
  });
  result = await w.request("GET", `/technicians/${id}`);
  assert.equal(result.data.reviewCount, 1);
  assert.equal(result.data.averageRating, 4);
});
test("provider responses are owner-only and permanent; reports deduplicate without suppressing ratings", async (t) => {
  const w = await setup(t, { seedBooking: true });
  await complete(w);
  const created = await review(w);
  const id = created.data._id;
  assert.equal(
    (
      await w.request(
        "POST",
        `/reviews/${id}/response`,
        { text: "Thank you for your review." },
        "other",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await w.request("POST", `/reviews/${id}/response`, {
        text: "Thank you for your review.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await w.request("POST", `/reviews/${id}/response`, {
        text: "Changed response",
      })
    ).data.code,
    "RESPONSE_EXISTS",
  );
  assert.equal(
    (
      await w.request(
        "POST",
        `/reviews/${id}/report`,
        {
          category: "privacy",
          details: "Please inspect the information in this review.",
        },
        "other",
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        `/reviews/${id}/report`,
        { category: "spam", details: "Reporting this a second time." },
        "other",
      )
    ).data.state,
    "already_reported",
  );
  assert.equal(w.db.reviewReports.rows.length, 1);
  assert.equal(w.db.reviews.rows[0].moderationState, "published");
  assert.equal(
    (
      await w.request(
        "GET",
        `/technicians/${technicianId(users.provider.email)}/reviews`,
        undefined,
        null,
      )
    ).data.length,
    1,
  );
});
test("authorized operator moderation is audited and atomically updates reports and public aggregates", async (t) => {
  const w = await setup(t, { seedBooking: true });
  await complete(w);
  const created = await review(w);
  const id = created.data._id;
  await w.request(
    "POST",
    `/reviews/${id}/report`,
    { category: "abuse", details: "Please inspect this reported wording." },
    "other",
  );
  await moderateReview(
    w.db,
    {
      reviewId: id,
      action: "hide",
      reason: "Confirmed violation of review conduct policy.",
      actor: "operator-test",
    },
    fixedTime,
  );
  let profile = await w.request(
    "GET",
    `/technicians/${technicianId(users.provider.email)}`,
  );
  assert.equal(profile.data.reviewCount, 0);
  assert.equal(profile.data.averageRating, null);
  assert.equal(w.db.reviewReports.rows[0].state, "resolved");
  assert.equal(w.db.reviews.rows[0].moderationHistory.length, 1);
  await moderateReview(
    w.db,
    {
      reviewId: id,
      action: "restore",
      reason: "Appeal reviewed and original decision overturned.",
      actor: "operator-test",
    },
    fixedTime,
  );
  profile = await w.request(
    "GET",
    `/technicians/${technicianId(users.provider.email)}`,
  );
  assert.equal(profile.data.reviewCount, 1);
  assert.equal(w.db.reviews.rows[0].moderationHistory.length, 2);
  assert.equal(
    (await w.request("POST", `/reviews/${id}/moderate`, { action: "hide" }))
      .status,
    404,
  );
});
test("profile identity collisions and self-reviews fail closed", async (t) => {
  const w = await setup(t, { seedBooking: true });
  await save(w);
  w.db.technicians.rows[0].ownerUid = "different-owner";
  assert.equal((await w.request("GET", "/my-technician")).status, 403);
  assert.equal(
    (await save(w, profileBody({ expectedRevision: 1 }))).status,
    403,
  );
  await complete(w);
  w.db.bookings.rows[0].userEmail = users.provider.email;
  w.db.bookings.rows[0].userUid = users.provider.uid;
  assert.equal(
    (await review(w, {}, "provider")).data.code,
    "REVIEW_NOT_ELIGIBLE",
  );
});
test("schedule closure and a simultaneous reservation cannot both succeed", async (t) => {
  const w = await setup(t);
  await save(w);
  const body = profileBody({ expectedRevision: 1 });
  body.availability.exceptions = [
    { date: "2026-11-06", closed: true, start: "09:00", end: "17:00" },
  ];
  const results = await Promise.all([book(w), save(w, body)]);
  assert.equal(results.filter((r) => r.status < 300).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
});
test("legacy JSON appointment lookalikes are ignored when cancelling old bookings", async (t) => {
  const w = await setup(t, { seedBooking: true });
  w.db.bookings.rows[0].appointment = {
    technicianId: "invalid",
    startsAt: fixedTime.toISOString(),
  };
  const result = await w.request(
    "POST",
    `/bookings/${ids.booking}/cancel`,
    { expectedRevision: 0, note: "Cancel old booking" },
    "customer",
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.booking.appointment, null);
});
test("failed report resolution rolls back the moderation state and its audit entry", async (t) => {
  const w = await setup(t, { seedBooking: true });
  await complete(w);
  const created = await review(w);
  await w.request(
    "POST",
    `/reviews/${created.data._id}/report`,
    { category: "other", details: "A report for operator inspection." },
    "other",
  );
  w.db.reviewReports.updateOne = async () => {
    throw new Error("report write outage");
  };
  await assert.rejects(
    moderateReview(w.db, {
      reviewId: created.data._id,
      action: "hide",
      reason: "A specific operator decision for this report.",
      actor: "operator-test",
    }),
  );
  assert.equal(w.db.reviews.rows[0].moderationState, "published");
  assert.equal(w.db.reviews.rows[0].moderationHistory.length, 0);
  assert.equal(w.db.reviewReports.rows[0].state, "pending");
});
test("MongoDB transaction adapter binds every operation to the same session", async () => {
  const { createDatabase } = require("../database");
  const calls = [];
  let options;
  const session = {
    withTransaction: async (work, value) => {
      options = value;
      return work();
    },
  };
  const client = {
    db: () => ({
      collection: (name) => ({
        find: (query, opts) => {
          calls.push([name, "find", opts]);
          return { toArray: async () => [] };
        },
        findOne: async (query, opts) => {
          calls.push([name, "findOne", opts]);
          return null;
        },
        insertOne: async (record, opts) => {
          calls.push([name, "insertOne", opts]);
          return { insertedId: record._id };
        },
        updateOne: async (query, update, opts) => {
          calls.push([name, "updateOne", opts]);
          return { matchedCount: 1 };
        },
      }),
    }),
    withSession: async (work) => work(session),
  };
  const db = createDatabase(client);
  const result = await db.transaction(async (tx) => {
    await tx.technicians.findOne({});
    await tx.services.updateOne({}, { $set: {} });
    await tx.bookings.insertOne({ _id: "test" });
    await tx.reviewReports.find({}).toArray();
    return "committed";
  });
  assert.equal(result, "committed");
  assert.equal(options.writeConcern.w, "majority");
  assert.equal(options.readConcern.level, "snapshot");
  assert.equal(calls.length, 4);
  assert.ok(calls.every(([, , opts]) => opts.session === session));
});
test("transaction validation rejects a listing edited after the initial booking read", async (t) => {
  const w = await setup(t);
  const transaction = w.db.transaction;
  w.db.transaction = async (work) => {
    w.db.services.rows[0].price = 99;
    return transaction(work);
  };
  const result = await book(w, { time: undefined });
  assert.equal(result.data.code, "INVALID_SERVICE_SNAPSHOT");
  assert.equal(w.db.bookings.rows.length, 0);
});
test("transaction validation rechecks the Bangladesh date after a delayed transaction starts", async (t) => {
  const w = await setup(t);
  const transaction = w.db.transaction;
  w.db.transaction = async (work) => {
    w.advance(24 * 60 * 60 * 1000);
    return transaction(work);
  };
  const result = await book(w, { date: "2026-11-05", time: undefined });
  assert.equal(result.status, 400);
  assert.equal(w.db.bookings.rows.length, 0);
});
