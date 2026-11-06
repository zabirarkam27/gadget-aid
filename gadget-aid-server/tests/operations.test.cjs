const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");
const { createApp } = require("../app");
const { bootstrapSuperAdmin } = require("../bootstrap");
const {
  createFixture,
  users,
  ids,
  fixedTime,
  verifyIdToken,
  identityDirectory,
  serviceFields,
} = require("./fixtures.cjs");
const { technicianId } = require("../identities");
const { defaultAvailability } = require("../technicians");
const setup = async (t, options = {}) => {
  const fixture = createFixture({ seedBooking: true, seedAdminRoles: true });
  let now = new Date(fixedTime);
  const app = createApp({
    getCollections: async () => fixture.db,
    verifyIdToken,
    identityDirectory,
    clock: () => new Date(now),
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const request = async (method, path, body, token = "admin") => {
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
const action = (extra = {}) => ({
  reason: "Reviewed the exact target and documented the operational reason.",
  confirmed: true,
  expectedRevision: 0,
  ...extra,
});
test("revoked member sessions are denied on every private route before loading account data", async (t) => {
  let revoked = false;
  const seen = [];
  const w = await setup(t, {
    verifyIdToken: async (token, checkRevoked) => {
      seen.push(checkRevoked);
      if (revoked && checkRevoked)
        throw Error("Synthetic revoked password session");
      return verifyIdToken(token);
    },
  });
  assert.equal(
    (await w.request("GET", "/my-capabilities", undefined, "customer")).status,
    200,
  );
  revoked = true;
  for (const path of [
    "/my-capabilities",
    "/bookings",
    `/bookings/${ids.booking}`,
    "/my-disputes",
  ])
    assert.equal(
      (await w.request("GET", path, undefined, "customer")).status,
      401,
    );
  assert.ok(seen.length >= 5);
  assert.ok(seen.every((value) => value === true));
});
const categoryId = (slug) =>
  createHash("sha256").update(`category-v1:${slug}`).digest("hex").slice(0, 24);
const saveProfile = async (w) => {
  const a = defaultAvailability();
  return w.request(
    "PUT",
    "/my-technician",
    {
      businessName: "Demo Repairs",
      photo: "",
      bio: "Test technician publication profile.",
      skills: [],
      categories: [],
      area: "Dhaka",
      yearsExperience: null,
      certifications: [],
      availability: {
        configured: a.configured,
        mode: a.mode,
        weekly: a.weekly,
        exceptions: [],
      },
      expectedRevision: 0,
    },
    "provider",
  );
};
test("admin APIs reject anonymous, member, technician and forged client claims", async (t) => {
  const w = await setup(t);
  for (const token of [null, "customer", "provider", "other"])
    assert.equal(
      (await w.request("GET", "/admin/overview", undefined, token)).status,
      token ? 403 : 401,
    );
  assert.equal(
    (await w.request("POST", "/services", serviceFields, "customer")).data.code,
    "TECHNICIAN_REQUIRED",
  );
  const forged = await setup(t, {
    verifyIdToken: async (token) => ({
      ...(await verifyIdToken(token)),
      admin: true,
      role: "super_admin",
    }),
  });
  assert.equal(
    (await forged.request("GET", "/admin/customers", undefined, "customer"))
      .status,
    403,
  );
  for (const path of [
    "/admin/roles/qa-customer",
    "/admin/accounts/qa-provider/state",
    "/admin/reviews/111111111111111111111111/moderate",
  ])
    assert.equal(
      (
        await w.request(
          "POST",
          path,
          action({ role: "admin", active: true }),
          "customer",
        )
      ).status,
      403,
    );
  assert.equal(
    (await w.request("POST", "/my-technician", { role: "admin" }, "customer"))
      .status,
    404,
  );
});
test("approved role hierarchy denies peer promotion and browser Super Admin grants", async (t) => {
  const w = await setup(t);
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/roles/qa-customer",
        action({ role: "admin", active: true }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/roles/qa-superadmin",
        action({ role: "technician", active: false }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/roles/qa-customer",
        action({ role: "super_admin", active: true }),
        "superadmin",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/accounts/qa-superadmin/state",
        action({ state: "restricted" }),
        "superadmin",
      )
    ).status,
    403,
  );
  const granted = await w.request(
    "POST",
    "/admin/roles/qa-customer",
    action({ role: "admin", active: true }),
    "superadmin",
  );
  assert.equal(granted.status, 200, JSON.stringify(granted.data));
  assert.equal(
    (await w.request("GET", "/admin/overview", undefined, "customer")).status,
    200,
  );
  const last = w.db.auditLogs.rows.at(-1);
  assert.equal(last.actorUid, users.superadmin.uid);
  assert.equal(last.actorRole, "super_admin");
  assert.equal(last.after.role, "admin");
  assert.ok(!JSON.stringify(last).includes(users.customer.email));
});
test("every admin request rechecks active grants and uses Firebase revocation verification", async (t) => {
  const checks = [];
  let revoked = false;
  const w = await setup(t, {
    verifyIdToken: async (token, check) => {
      checks.push(check === true);
      if (check && revoked) throw new Error("revoked token");
      return verifyIdToken(token);
    },
  });
  assert.equal((await w.request("GET", "/admin/overview")).status, 200);
  assert.ok(checks.includes(true));
  revoked = true;
  assert.equal((await w.request("GET", "/admin/overview")).status, 401);
  revoked = false;
  w.db.roleGrants.rows.find((g) => g._id === users.admin.uid).active = false;
  assert.equal((await w.request("GET", "/admin/overview")).status, 403);
  const caps = await w.request("GET", "/my-capabilities");
  assert.equal(caps.data.admin, false);
  assert.equal(caps.data.role, "public_visitor");
});
test("recent-auth, exact confirmation and target revision are required for sensitive operations", async (t) => {
  const w = await setup(t);
  const path = `/admin/services/${ids.service}/publication`;
  for (const body of [
    { ...action({ state: "hidden" }), confirmed: false },
    action({ state: "hidden", reason: "short" }),
  ])
    assert.equal(
      (await w.request("POST", path, body)).data.code,
      "CONFIRMATION_REQUIRED",
    );
  assert.equal(
    (
      await w.request(
        "POST",
        path,
        action({ state: "hidden", expectedRevision: 10 }),
      )
    ).data.code,
    "STALE_OPERATION",
  );
  w.advance(601000);
  assert.equal(
    (await w.request("POST", path, action({ state: "hidden" }))).data.code,
    "ADMIN_REAUTH_REQUIRED",
  );
  assert.equal(w.db.entityControls.rows.length, 0);
  assert.equal(w.db.auditLogs.rows.length, 0);
});
test("audit failure rolls back restrictions, visibility controls, role grants and categories", async (t) => {
  const w = await setup(t);
  w.db.auditLogs.insertOne = async () => {
    throw new Error("audit outage");
  };
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/accounts/qa-customer/state",
        action({ state: "restricted" }),
      )
    ).status,
    500,
  );
  assert.equal(w.db.accountControls.rows.length, 0);
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/services/${ids.service}/publication`,
        action({ state: "hidden" }),
      )
    ).status,
    500,
  );
  assert.equal(w.db.entityControls.rows.length, 0);
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/roles/qa-customer",
        action({ role: "admin", active: true }),
        "superadmin",
      )
    ).status,
    500,
  );
  assert.equal(
    w.db.roleGrants.rows.some((g) => g._id === users.customer.uid),
    false,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/categories",
        action({ name: "Phones", slug: "phones", state: "active" }),
      )
    ).status,
    500,
  );
  assert.equal(w.db.categories.rows.length, 0);
});
test("admin lists use stable bounded pagination, literal search and allowlisted cursors/filters", async (t) => {
  const w = await setup(t);
  for (let i = 0; i < 35; i++)
    w.db.services.rows.push({
      ...w.service,
      _id: new ObjectId(),
      name: `Extra service ${i}`,
    });
  const first = await w.request("GET", "/admin/services?limit=10");
  assert.equal(first.status, 200);
  assert.equal(first.data.items.length, 10);
  assert.ok(first.data.nextCursor);
  const second = await w.request(
    "GET",
    `/admin/services?limit=10&cursor=${first.data.nextCursor}`,
  );
  assert.equal(second.data.items.length, 10);
  assert.ok(
    !second.data.items.some((a) =>
      first.data.items.some((b) => a._id === b._id),
    ),
  );
  assert.equal(
    (await w.request("GET", "/admin/services?q=.*")).data.items.length,
    0,
  );
  for (const query of [
    "limit=101",
    "limit=0",
    "limit=2.5",
    "cursor=bad",
    "q[$ne]=1",
    "sort=passwordHash",
    "status=invalid",
  ]) {
    assert.equal(
      (await w.request("GET", `/admin/services?${query}`)).status,
      400,
    );
  }
  assert.equal(
    (
      await w.request(
        "GET",
        `/admin/services?q=Extra&cursor=${first.data.nextCursor}`,
      )
    ).data.code,
    "INVALID_CURSOR",
  );
});
test("directory lists are masked and private inspections omit secrets while requiring a successful audit", async (t) => {
  const w = await setup(t);
  const page = await w.request("GET", "/admin/customers?limit=2");
  assert.equal(page.data.items.length, 2);
  assert.ok(page.data.nextCursor);
  const serialized = JSON.stringify(page.data);
  assert.ok(!serialized.includes(users.customer.email));
  assert.ok(!serialized.includes("NEVER_EXPOSE_THIS_HASH"));
  const inspected = await w.request(
    "POST",
    "/admin/inspect/customer/qa-customer",
    action({ expectedRevision: undefined }),
  );
  assert.equal(inspected.status, 200, JSON.stringify(inspected.data));
  assert.equal(inspected.data.email, users.customer.email);
  assert.ok(!JSON.stringify(inspected.data).includes("NEVER_EXPOSE_THIS_HASH"));
  assert.equal(w.db.auditLogs.rows.at(-1).action, "inspect_customer");
  w.db.auditLogs.insertOne = async () => {
    throw new Error("audit outage");
  };
  const denied = await w.request(
    "POST",
    `/admin/inspect/booking/${ids.booking}`,
    {
      reason: "Triage requires private booking instructions.",
      confirmed: true,
    },
  );
  assert.equal(denied.status, 500);
  assert.ok(!JSON.stringify(denied.data).includes(w.booking.instruction));
  const bookings = await w.request("GET", "/admin/bookings");
  assert.ok(!JSON.stringify(bookings.data).includes(users.customer.email));
  assert.ok(!JSON.stringify(bookings.data).includes(w.booking.instruction));
});
test("restricted members can read, acknowledge, cancel eligible bookings and open disputes, but cannot create new work", async (t) => {
  const w = await setup(t);
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/accounts/qa-customer/state",
        action({ state: "restricted" }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await w.request("GET", "/bookings", undefined, "customer")).status,
    200,
  );
  assert.equal(
    (await w.request("POST", "/notifications/read", { ids: [] }, "customer"))
      .status,
    200,
  );
  for (const [path, body] of [
    ["/bookings", { serviceId: ids.service, date: "2026-11-07" }],
    [
      `/bookings/${ids.booking}/messages`,
      { text: "New message", requestId: "request-message-001" },
    ],
    [
      "/technician-application",
      {
        businessName: "New business",
        statement: "I repair devices in the local area.",
        expectedRevision: 0,
      },
    ],
  ])
    assert.equal(
      (await w.request("POST", path, body, "customer")).data.code,
      "ACCOUNT_RESTRICTED",
    );
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/disputes`,
        {
          subject: "Need help with this booking",
          description: "Please help review the arrangements for this repair.",
        },
        "customer",
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/cancel`,
        { note: "Cancel while waiting for support", expectedRevision: 0 },
        "customer",
      )
    ).status,
    200,
  );
});
test("technician revocation stops provider writes and new bookings while preserving participant history", async (t) => {
  const w = await setup(t);
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/roles/qa-provider",
        action({ role: "technician", active: false }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await w.request("GET", `/bookings/${ids.booking}`, undefined, "provider"))
      .status,
    200,
  );
  assert.equal(
    (
      await w.request(
        "PATCH",
        `/all-bookings/${ids.booking}`,
        { status: "confirmed", expectedRevision: 0 },
        "provider",
      )
    ).data.code,
    "TECHNICIAN_REQUIRED",
  );
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/messages`,
        { text: "Provider update", requestId: "provider-message-0001" },
        "provider",
      )
    ).data.code,
    "TECHNICIAN_REQUIRED",
  );
  assert.equal(
    (
      await w.request(
        "POST",
        "/bookings",
        { serviceId: ids.service, date: "2026-11-07" },
        "second",
      )
    ).data.code,
    "SERVICE_UNAVAILABLE",
  );
  assert.equal(
    (await w.request("GET", `/services/${ids.service}`, undefined, null))
      .status,
    404,
  );
});
test("technician applications cannot self-promote and approval uses verified directory identity", async (t) => {
  const w = await setup(t);
  assert.equal(
    (
      await w.request(
        "POST",
        "/technician-application",
        {
          businessName: "New repair business",
          statement: "I repair laptops and inspect charging problems.",
          expectedRevision: 0,
          role: "admin",
        },
        "customer",
      )
    ).status,
    400,
  );
  const application = await w.request(
    "POST",
    "/technician-application",
    {
      businessName: "New repair business",
      statement: "I repair laptops and inspect charging problems.",
      expectedRevision: 0,
    },
    "customer",
  );
  assert.equal(application.status, 201);
  assert.equal(
    (await w.request("POST", "/services", serviceFields, "customer")).status,
    403,
  );
  const reviewed = await w.request(
    "POST",
    "/admin/applications/qa-customer/decision",
    action({ expectedRevision: 1, decision: "approve" }),
  );
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.data));
  assert.equal(
    (await w.request("GET", "/my-capabilities", undefined, "customer")).data
      .role,
    "technician",
  );
  assert.equal(
    (await w.request("POST", "/services", serviceFields, "customer")).status,
    201,
  );
  const v = await setup(t, {
    identityDirectory: {
      ...identityDirectory,
      getUser: async (uid) => ({
        ...(await identityDirectory.getUser(uid)),
        emailVerified: false,
      }),
    },
  });
  await v.request(
    "POST",
    "/technician-application",
    {
      businessName: "Unverified business",
      statement: "I repair laptops and charging systems.",
      expectedRevision: 0,
    },
    "customer",
  );
  assert.equal(
    (
      await v.request(
        "POST",
        "/admin/applications/qa-customer/decision",
        action({ expectedRevision: 1, decision: "approve" }),
      )
    ).data.code,
    "ACCOUNT_NOT_VERIFIED",
  );
  assert.equal(v.db.applications.rows[0].state, "pending");
});
test("publication restrictions cannot be undone through provider edits or account restoration", async (t) => {
  const w = await setup(t);
  await saveProfile(w);
  const id = technicianId(users.provider.email);
  const profileInspection = await w.request(
    "POST",
    `/admin/inspect/technician/${id}`,
    {
      reason: "Review self-reported profile claims before publication.",
      confirmed: true,
    },
  );
  assert.equal(profileInspection.status, 200);
  assert.equal(profileInspection.data.claimsVerified, false);
  assert.equal(
    profileInspection.data.bio,
    "Test technician publication profile.",
  );
  assert.equal(profileInspection.data.ownerEmail, undefined);
  assert.equal(w.db.auditLogs.rows.at(-1).action, "inspect_technician");
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/technicians/${id}/publication`,
        action({ state: "restricted" }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await w.request("GET", `/technicians/${id}`, undefined, null)).status,
    404,
  );
  assert.equal(
    (await w.request("GET", "/services", undefined, null)).data.some(
      (row) => row._id === ids.service,
    ),
    false,
  );
  await w.request(
    "POST",
    "/admin/accounts/qa-provider/state",
    action({ state: "restricted" }),
  );
  await w.request(
    "POST",
    "/admin/accounts/qa-provider/state",
    action({ state: "active", expectedRevision: 1 }),
  );
  assert.equal((await w.request("GET", `/technicians/${id}`)).status, 404);
  const controls = w.db.entityControls.rows.find(
    (r) => r._id === `technician:${id}`,
  );
  assert.equal(controls.state, "restricted");
  assert.equal(controls.accountRestricted, false);
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/services/${ids.otherService}/publication`,
        action({ state: "hidden" }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await w.request(
        "PUT",
        `/services/${ids.otherService}`,
        { ...serviceFields, name: "Edited but still hidden" },
        "other",
      )
    ).status,
    200,
  );
  assert.equal(
    (await w.request("GET", `/services/${ids.otherService}`)).status,
    404,
  );
});
test("disputes are participant-scoped and resolution is audited without changing the repair", async (t) => {
  const w = await setup(t);
  const body = {
    subject: "Appointment arrangements unclear",
    description:
      "Please review the arrangements and provide help with this repair.",
  };
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/disputes`,
        body,
        "other",
      )
    ).status,
    403,
  );
  const created = await w.request(
    "POST",
    `/bookings/${ids.booking}/disputes`,
    body,
    "customer",
  );
  assert.equal(created.status, 201);
  assert.equal(
    (
      await w.request(
        "POST",
        `/bookings/${ids.booking}/disputes`,
        body,
        "customer",
      )
    ).data.code,
    "DISPUTE_EXISTS",
  );
  assert.equal(
    (await w.request("GET", "/my-disputes", undefined, "other")).data.items
      .length,
    0,
  );
  const result = await w.request(
    "POST",
    `/admin/disputes/${created.data._id}/resolve`,
    action({
      state: "resolved",
      resolution:
        "Provider and customer should confirm a new arrangement through their booking conversation.",
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(w.db.bookings.rows[0].status, "pending");
  assert.equal(w.db.bookings.rows[0].repairRevision, undefined);
  assert.equal(w.db.auditLogs.rows.at(-1).action, "dispute_resolution");
  const mine = await w.request(
    "GET",
    "/my-disputes?status=resolved",
    undefined,
    "customer",
  );
  assert.equal(mine.data.items.length, 1);
  assert.ok(
    !JSON.stringify(mine.data.items[0].history).includes(users.admin.uid),
  );
});
test("category creation is unique by slug, archival preserves service references and stale edits fail", async (t) => {
  const w = await setup(t);
  const created = await w.request(
    "POST",
    "/admin/categories",
    action({ name: "Laptops", slug: "laptops", state: "active" }),
  );
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const id = categoryId("laptops");
  assert.equal(
    (await w.request("GET", "/categories", undefined, null)).data[0]._id,
    id,
  );
  assert.equal(
    (
      await w.request(
        "PUT",
        `/services/${ids.service}`,
        { ...serviceFields, categoryId: id },
        "provider",
      )
    ).status,
    200,
  );
  assert.equal(w.db.services.rows[0].categoryId, id);
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/categories/${id}`,
        action({
          name: "Laptops",
          slug: "laptops",
          state: "archived",
          expectedRevision: 1,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await w.request("GET", "/categories", undefined, null)).data.length,
    0,
  );
  assert.equal(
    (await w.request("GET", `/services/${ids.service}`)).data.categoryLabel,
    "Laptops",
  );
  assert.equal(
    (
      await w.request(
        "POST",
        "/services",
        { ...serviceFields, categoryId: id },
        "provider",
      )
    ).data.code,
    "CATEGORY_UNAVAILABLE",
  );
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/categories/${id}`,
        action({
          name: "Changed",
          slug: "laptops",
          state: "active",
          expectedRevision: 1,
        }),
      )
    ).data.code,
    "STALE_OPERATION",
  );
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/categories",
        action({ name: "Laptops", slug: "laptops", state: "active" }),
      )
    ).status,
    409,
  );
});
test("bootstrap is operator-only, verifies the exact identity and rolls back without an audit", async (t) => {
  const w = await setup(t);
  assert.equal(
    (
      await w.request(
        "POST",
        "/admin/bootstrap",
        action({ uid: users.customer.uid }),
      )
    ).status,
    404,
  );
  await assert.rejects(
    bootstrapSuperAdmin({
      db: w.db,
      directory: {
        getUser: async () => ({
          email: "bad@example.test",
          emailVerified: false,
        }),
      },
      uid: users.customer.uid,
      operator: "test-operator",
      reason: "Bootstrap isolated test role",
      active: true,
      clock: () => fixedTime,
    }),
  );
  const options = {
    db: w.db,
    directory: identityDirectory,
    uid: users.customer.uid,
    operator: "test-operator",
    reason: "Bootstrap the isolated test operator",
    active: true,
    clock: () => fixedTime,
  };
  w.db.auditLogs.insertOne = async () => {
    throw new Error("audit unavailable");
  };
  await assert.rejects(bootstrapSuperAdmin(options));
  assert.equal(
    w.db.roleGrants.rows.some((row) => row._id === users.customer.uid),
    false,
  );
});

test("review moderation and report resolution require atomic operational audit", async (t) => {
  const w = await setup(t);
  w.db.bookings.rows[0].status = "working";
  let revision = 0;
  for (const status of ["quality_check", "ready_for_collection", "completed"])
    assert.equal(
      (
        await w.request(
          "PATCH",
          `/all-bookings/${ids.booking}`,
          { status, expectedRevision: revision++ },
          "provider",
        )
      ).status,
      200,
    );
  const review = await w.request(
    "POST",
    `/bookings/${ids.booking}/review`,
    {
      rating: 4,
      feedback: "Synthetic completed repair feedback for moderation testing.",
    },
    "customer",
  );
  assert.equal(review.status, 201);
  const report = await w.request(
    "POST",
    `/reviews/${review.data._id}/report`,
    { category: "other", details: "Synthetic private moderation report." },
    "other",
  );
  assert.equal(report.status, 201);
  const auditInsert = w.db.auditLogs.insertOne.bind(w.db.auditLogs);
  w.db.auditLogs.insertOne = async () => {
    throw new Error("audit offline");
  };
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/reviews/${review.data._id}/moderate`,
        action({ action: "hide" }),
      )
    ).status,
    500,
  );
  assert.equal(w.db.reviews.rows[0].moderationState, "published");
  assert.equal(w.db.reviewReports.rows[0].state, "pending");
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/reports/${w.db.reviewReports.rows[0]._id}/resolve`,
        action({
          resolution:
            "No suppression needed after reviewing the synthetic report.",
        }),
      )
    ).status,
    500,
  );
  assert.equal(w.db.reviewReports.rows[0].state, "pending");
  w.db.auditLogs.insertOne = auditInsert;
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/reviews/${review.data._id}/moderate`,
        action({ action: "hide" }),
      )
    ).status,
    200,
  );
  assert.equal(w.db.reviews.rows[0].moderationState, "hidden");
  assert.equal(w.db.reviewReports.rows[0].state, "resolved");
  assert.equal(w.db.auditLogs.rows.at(-1).action, "review_moderation");
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/reviews/${review.data._id}/moderate`,
        action({ action: "restore" }),
      )
    ).data.code,
    "STALE_OPERATION",
  );
  assert.equal(
    (
      await w.request(
        "POST",
        `/admin/reviews/${review.data._id}/moderate`,
        action({ action: "restore", expectedRevision: 1 }),
      )
    ).status,
    200,
  );
  assert.equal(w.db.reviews.rows[0].moderationState, "published");
});

test("trusted bootstrap grants and revokes only the exact synthetic identity", async (t) => {
  const w = await setup(t);
  const options = {
    db: w.db,
    directory: identityDirectory,
    uid: users.customer.uid,
    operator: "test-operator",
    reason: "Explicit isolated bootstrap grant verification",
    clock: () => fixedTime,
  };
  await bootstrapSuperAdmin({ ...options, active: true });
  assert.equal(
    (await w.request("GET", "/admin/overview", undefined, "customer")).status,
    200,
  );
  assert.equal(w.db.auditLogs.rows.at(-1).actorRole, "bootstrap_operator");
  await bootstrapSuperAdmin({ ...options, active: false });
  assert.equal(
    (await w.request("GET", "/admin/overview", undefined, "customer")).status,
    403,
  );
  assert.equal(
    w.db.roleGrants.rows.find((r) => r._id === users.superadmin.uid).active,
    true,
  );
});
