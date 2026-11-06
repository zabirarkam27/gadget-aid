const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");
const {
  fail,
  checkKeys,
  idValue,
  ownerQuery,
  serviceOwner,
  serializeBooking,
  serializeService,
} = require("./domain");
const { technicianId } = require("./identities");
const {
  accessFor,
  validGrant,
  requireRecent,
  touchProvider,
  providerFlag,
} = require("./access");
const { sensitiveInput, atomicAction, recordAudit } = require("./audit");
const { pageDocs, queryFilter } = require("./pagination");
const { moderateReview } = require("./reviews");
const uidValue = (value) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 128 ||
    /[\x00-\x1f]/.test(value)
  )
    fail(400, "Invalid account reference.", "INVALID_INPUT");
  return value;
};
const revision = (row) => row?.revision || 0;
const sameRevision = (row, expected) => {
  if (revision(row) !== expected)
    fail(
      409,
      "This record changed. Reload before confirming.",
      "STALE_OPERATION",
    );
};
const safeIdentity = (u) => ({
  uid: u.uid,
  displayName: typeof u.displayName === "string" ? u.displayName : "",
  email: typeof u.email === "string" ? u.email : null,
  emailVerified: u.emailVerified === true,
  disabled: u.disabled === true,
  createdAt: u.metadata?.creationTime || null,
  lastSignInAt: u.metadata?.lastSignInTime || null,
});
const maskEmail = (email) =>
  email ? `${email.slice(0, 1)}•••@${email.split("@").at(-1)}` : "Not provided";
const putRecord = async (collection, id, old, value) => {
  if (old) {
    const result = await collection.updateOne(
      { _id: id, revision: old.revision },
      { $set: value },
    );
    if (!result.matchedCount)
      fail(
        409,
        "This record changed. Reload before confirming.",
        "STALE_OPERATION",
      );
  } else {
    try {
      await collection.insertOne({ _id: id, ...value });
    } catch (error) {
      if (error.code === 11000)
        fail(
          409,
          "This record was just created. Reload it.",
          "STALE_OPERATION",
        );
      throw error;
    }
  }
};
const createOperations = ({
  collections,
  clock,
  verifyIdToken,
  identityDirectory,
}) => {
  const database = async () => {
    const db = await collections();
    for (const name of [
      "roleGrants",
      "accountControls",
      "entityControls",
      "auditLogs",
      "applications",
      "disputes",
      "categories",
    ])
      if (!db[name])
        fail(503, "Operations are unavailable.", "SERVICE_UNAVAILABLE");
    return db;
  };
  const identity = async (uid) => {
    if (!identityDirectory)
      fail(
        503,
        "Account directory is unavailable.",
        "ADMIN_DIRECTORY_UNAVAILABLE",
      );
    try {
      return safeIdentity(await identityDirectory.getUser(uid));
    } catch (error) {
      if (error.code === "auth/user-not-found")
        fail(404, "Account not found.", "NOT_FOUND");
      fail(
        503,
        "Account directory is unavailable.",
        "ADMIN_DIRECTORY_UNAVAILABLE",
      );
    }
  };
  const guard = async (req, res, next) => {
    if (!req.access?.admin)
      fail(403, "Administrator access is required.", "ADMIN_REQUIRED");
    let decoded;
    try {
      decoded = await verifyIdToken(req.rawToken, true);
    } catch {
      fail(401, "Sign in again to use administration.", "UNAUTHENTICATED");
    }
    if (
      (decoded.uid || decoded.sub) !== req.user.uid ||
      decoded.email?.trim() !== req.user.email ||
      decoded.email_verified !== true
    )
      fail(
        403,
        "A verified administrator account is required.",
        "ADMIN_REQUIRED",
      );
    req.user.authTime = decoded.auth_time;
    req.access = await accessFor(await database(), req.user);
    if (!req.access.admin)
      fail(403, "Administrator access was revoked.", "ADMIN_REQUIRED");
    next();
  };
  const capabilities = async (req, res) => {
    const db = await database(),
      application = await db.applications.findOne({ _id: req.user.uid }),
      control = await db.entityControls.findOne({
        _id: `technician:${technicianId(req.user.email)}`,
      });
    res.json({
      ...req.access,
      hasProviderHistory:
        (await db.services.countDocuments(ownerQuery(req.user))) > 0,
      emailVerified: req.user.emailVerified,
      application: application
        ? {
            state: application.state,
            businessName: application.businessName,
            note: application.publicNote || "",
            revision: application.revision,
          }
        : null,
      publication: control
        ? { state: control.state, note: control.publicNote || "" }
        : null,
    });
  };
  const apply = async (req, res) => {
    checkKeys(req.body, ["businessName", "statement", "expectedRevision"]);
    if (req.access.canProvide)
      fail(
        409,
        "Technician access is already available.",
        "APPLICATION_EXISTS",
      );
    if (
      typeof req.body.businessName !== "string" ||
      req.body.businessName.trim().length < 2 ||
      req.body.businessName.length > 120 ||
      typeof req.body.statement !== "string" ||
      req.body.statement.trim().length < 20 ||
      req.body.statement.length > 2000 ||
      !Number.isSafeInteger(req.body.expectedRevision) ||
      req.body.expectedRevision < 0
    )
      fail(
        400,
        "Provide a business name and 20–2,000 characters about your repair work.",
        "VALIDATION_ERROR",
      );
    const db = await database(),
      old = await db.applications.findOne({ _id: req.user.uid });
    sameRevision(old, req.body.expectedRevision);
    if (old?.state === "pending")
      fail(
        409,
        "Your application is already pending review.",
        "APPLICATION_EXISTS",
      );
    const value = {
      uid: req.user.uid,
      email: req.user.email,
      businessName: req.body.businessName.trim(),
      statement: req.body.statement.trim(),
      state: "pending",
      publicNote: "",
      revision: revision(old) + 1,
      createdAt: old?.createdAt || clock(),
      updatedAt: clock(),
    };
    await putRecord(db.applications, req.user.uid, old, value);
    res.status(201).json({ state: "pending", revision: value.revision });
  };
  const overview = async (req, res) => {
    const db = await database();
    const counts = {};
    for (const [label, name, filter] of [
      ["bookings", "bookings", {}],
      [
        "completedBookings",
        "bookings",
        {
          $or: [
            { status: "completed" },
            { status: null, serviceStatus: "completed" },
          ],
        },
      ],
      ["storedServices", "services", { deletedAt: null }],
      ["technicianProfiles", "technicians", {}],
      ["pendingApplications", "applications", { state: "pending" }],
      ["pendingReports", "reviewReports", { state: "pending" }],
      ["openDisputes", "disputes", { state: { $in: ["open", "in_review"] } }],
      ["restrictedAccounts", "accountControls", { state: "restricted" }],
      ["emailAccepted", "notifications", { deliveryState: "accepted" }],
      ["emailNeedsReview", "notifications", { deliveryState: "failed" }],
    ])
      counts[label] = await db[name].countDocuments(filter);
    res.json(counts);
  };
  const list = (kind) => async (req, res) => {
    const db = await database();
    let filter,
      collection = kind,
      options = { scope: kind };
    if (kind === "bookings") {
      filter = queryFilter(req.query, {
        states: [
          "pending",
          "confirmed",
          "device_received",
          "diagnosing",
          "quotation_sent",
          "awaiting_approval",
          "approved",
          "repairing",
          "quality_check",
          "ready_for_collection",
          "completed",
          "cancelled",
          "rejected",
          "working",
        ],
        fields: ["serviceName"],
      });
      if (filter.state) {
        filter.status = filter.state;
        delete filter.state;
      }
      options.projection = {
        _id: 1,
        serviceName: 1,
        status: 1,
        date: 1,
        createdAt: 1,
        repairRevision: 1,
        appointment: 1,
      };
    }
    if (kind === "services")
      filter = queryFilter(req.query, { fields: ["name", "area"] });
    if (kind === "applications") {
      filter = queryFilter(req.query, {
        states: ["pending", "approved", "changes_requested"],
        fields: ["businessName"],
      });
      options.uid = true;
    }
    if (kind === "reviews") {
      filter = queryFilter(req.query, { states: ["published", "hidden"] });
      if (filter.state) {
        filter.moderationState = filter.state;
        delete filter.state;
      }
    }
    if (kind === "roleGrants") {
      filter = queryFilter(req.query);
      options.uid = true;
    }
    if (kind === "technicians")
      filter = queryFilter(req.query, { fields: ["businessName", "area"] });
    if (kind === "reviewReports")
      filter = queryFilter(req.query, { states: ["pending", "resolved"] });
    if (kind === "disputes")
      filter = queryFilter(req.query, {
        states: ["open", "in_review", "resolved"],
        fields: ["subject"],
      });
    if (kind === "categories")
      filter = queryFilter(req.query, {
        states: ["active", "archived"],
        fields: ["name", "slug"],
      });
    if (kind === "auditLogs")
      filter = queryFilter(req.query, {
        fields: ["action", "target", "actorUid"],
      });
    if (kind === "notifications") {
      filter = queryFilter(req.query, {
        states: [
          "pending",
          "retry",
          "sending",
          "accepted",
          "failed",
          "suppressed",
        ],
      });
      if (filter.state) {
        filter.deliveryState = filter.state;
        delete filter.state;
      }
      options.projection = {
        _id: 1,
        bookingId: 1,
        deliveryState: 1,
        attempts: 1,
        failureCode: 1,
        createdAt: 1,
      };
    }
    const page = await pageDocs(db[collection], filter, req.query, options);
    const rows = [];
    for (const row of page.items) {
      if (kind === "services") {
        const control = await db.entityControls.findOne({
          _id: `service:${row._id}`,
        });
        rows.push({
          _id: String(row._id),
          name: typeof row.name === "string" ? row.name : "Service",
          area: typeof row.area === "string" ? row.area : "",
          removed: !!row.deletedAt,
          visibility: control?.state || "visible",
          revision: revision(control),
        });
      } else if (kind === "technicians") {
        const control = await db.entityControls.findOne({
          _id: `technician:${row._id}`,
        });
        rows.push({
          _id: String(row._id),
          businessName: row.businessName,
          area: row.area,
          state: control?.state || "unreviewed",
          revision: revision(control),
          claimsVerified: false,
        });
      } else if (kind === "reviews")
        rows.push({
          _id: String(row._id),
          rating: row.rating,
          serviceName: row.serviceName,
          state: row.moderationState,
          revision: revision(row),
          createdAt: row.createdAt,
        });
      else if (kind === "roleGrants")
        rows.push({
          _id: row._id,
          role: row.role,
          active: row.active,
          revision: row.revision,
        });
      else if (kind === "applications")
        rows.push({
          _id: row._id,
          businessName: row.businessName,
          state: row.state,
          revision: row.revision,
          createdAt: row.createdAt,
        });
      else if (kind === "reviewReports")
        rows.push({
          _id: String(row._id),
          reviewId: row.reviewId,
          category: row.category,
          state: row.state,
          revision: revision(row),
          createdAt: row.createdAt,
        });
      else if (kind === "disputes")
        rows.push({
          _id: String(row._id),
          bookingId: row.bookingId,
          subject: row.subject,
          state: row.state,
          revision: row.revision,
          createdAt: row.createdAt,
        });
      else if (kind === "auditLogs")
        rows.push({
          _id: String(row._id),
          action: row.action,
          target: row.target,
          actorUid: row.actorUid,
          actorRole: row.actorRole,
          reason: row.reason,
          before: row.before,
          after: row.after,
          createdAt: row.createdAt,
        });
      else rows.push({ ...row, _id: String(row._id) });
    }
    res.json({ ...page, items: rows });
  };
  const customers = async (req, res) => {
    if (Object.keys(req.query).some((k) => !["cursor", "limit"].includes(k)))
      fail(400, "Unsupported account filter.", "INVALID_INPUT");
    const limit = req.query.limit === undefined ? 25 : Number(req.query.limit);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (req.query.cursor !== undefined &&
        (typeof req.query.cursor !== "string" ||
          req.query.cursor.length > 2048))
    )
      fail(400, "Invalid directory page.", "VALIDATION_ERROR");
    if (!identityDirectory)
      fail(
        503,
        "Account directory is unavailable.",
        "ADMIN_DIRECTORY_UNAVAILABLE",
      );
    const db = await database();
    let result;
    try {
      result = await identityDirectory.listUsers(limit, req.query.cursor);
    } catch (error) {
      if (error.code === "auth/invalid-page-token")
        fail(400, "Invalid directory page cursor.", "INVALID_CURSOR");
      fail(
        503,
        "Account directory could not be loaded.",
        "ADMIN_DIRECTORY_UNAVAILABLE",
      );
    }
    const items = [];
    for (const value of result.users) {
      const user = safeIdentity(value),
        control = await db.accountControls.findOne({ _id: user.uid }),
        grant = await db.roleGrants.findOne({ _id: user.uid });
      items.push({
        _id: user.uid,
        displayName: user.displayName,
        emailMasked: maskEmail(user.email),
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        state: control?.state || "active",
        revision: revision(control),
        role: validGrant(grant) && grant.active ? grant.role : "public_visitor",
      });
    }
    res.json({ items, nextCursor: result.pageToken || null, limit });
  };
  const inspect = (kind) => async (req, res) => {
    sensitiveInput(req, clock, [], false);
    const db = await database();
    let result;
    if (kind === "technician") {
      const row = await db.technicians.findOne({ _id: idValue(req.params.id) });
      if (!row) fail(404, "Technician profile not found.", "NOT_FOUND");
      result = {
        _id: String(row._id),
        businessName: row.businessName,
        bio: row.bio,
        photo: row.photo,
        area: row.area,
        yearsExperience: row.yearsExperience,
        skills: row.skills,
        categories: row.categories,
        certifications: row.certifications,
        claimsVerified: false,
      };
    }
    if (kind === "service") {
      const row = await db.services.findOne({ _id: idValue(req.params.id) });
      if (!row) fail(404, "Service not found.", "NOT_FOUND");
      result = serializeService(row);
    }
    if (kind === "customer") result = await identity(uidValue(req.params.id));
    if (kind === "booking") {
      const booking = await db.bookings.findOne({
        _id: idValue(req.params.id),
      });
      if (!booking) fail(404, "Booking not found.", "NOT_FOUND");
      const thread = await db.threads.findOne({ _id: booking._id });
      result = {
        ...serializeBooking(booking),
        repair: booking.repair || null,
        messages: (thread?.messages || []).map((m) => ({
          role: m.role,
          text: m.text,
          createdAt: m.createdAt,
        })),
      };
    }
    if (kind === "dispute") {
      const row = await db.disputes.findOne({ _id: idValue(req.params.id) });
      if (!row) fail(404, "Dispute not found.", "NOT_FOUND");
      result = {
        _id: String(row._id),
        bookingId: row.bookingId,
        subject: row.subject,
        description: row.description,
        state: row.state,
        resolution: row.resolution,
        revision: row.revision,
        history: row.history,
      };
    }
    if (kind === "report") {
      const row = await db.reviewReports.findOne({
        _id: idValue(req.params.id),
      });
      if (!row) fail(404, "Report not found.", "NOT_FOUND");
      const review = await db.reviews.findOne({ _id: idValue(row.reviewId) });
      result = {
        _id: String(row._id),
        reviewId: row.reviewId,
        category: row.category,
        details: row.details,
        state: row.state,
        revision: revision(row),
        review: review
          ? {
              _id: String(review._id),
              rating: review.rating,
              feedback: review.feedback,
              state: review.moderationState,
              revision: review.revision,
            }
          : null,
      };
    }
    if (kind === "application") {
      const row = await db.applications.findOne({
        _id: uidValue(req.params.id),
      });
      if (!row) fail(404, "Application not found.", "NOT_FOUND");
      result = {
        _id: row._id,
        businessName: row.businessName,
        statement: row.statement,
        state: row.state,
        revision: row.revision,
      };
    }
    if (kind === "review") {
      const row = await db.reviews.findOne({ _id: idValue(req.params.id) });
      if (!row) fail(404, "Review not found.", "NOT_FOUND");
      result = {
        _id: String(row._id),
        rating: row.rating,
        feedback: row.feedback,
        response: row.response
          ? { text: row.response.text, createdAt: row.response.createdAt }
          : null,
        state: row.moderationState,
        revision: row.revision,
      };
    }
    await db.transaction(async (tx) =>
      recordAudit(tx, req, clock, {
        action: `inspect_${kind}`,
        target: `${kind}:${req.params.id}`,
      }),
    );
    res.json(result);
  };
  const account = async (req, res) => {
    sensitiveInput(req, clock, ["state"]);
    if (!["active", "restricted"].includes(req.body.state))
      fail(400, "Choose active or restricted.", "VALIDATION_ERROR");
    const target = await identity(uidValue(req.params.id)),
      db = await database();
    const result = await atomicAction(db, req, clock, async (tx) => {
      const grant = await tx.roleGrants.findOne({ _id: target.uid });
      if (
        validGrant(grant) &&
        grant.active &&
        ["admin", "super_admin"].includes(grant.role)
      )
        fail(
          403,
          "Use role access controls for privileged accounts.",
          "FORBIDDEN",
        );
      const old = await tx.accountControls.findOne({ _id: target.uid });
      sameRevision(old, req.body.expectedRevision);
      const value = {
        state: req.body.state,
        revision: revision(old) + 1,
        updatedAt: clock(),
      };
      await putRecord(tx.accountControls, target.uid, old, value);
      await touchProvider(tx, target, new ObjectId().toHexString());
      await providerFlag(
        tx,
        target,
        "accountRestricted",
        value.state === "restricted",
      );
      return {
        action: "account_state",
        target: `account:${target.uid}`,
        before: { state: old?.state || "active" },
        after: { state: value.state },
        result: { acknowledged: true, revision: value.revision },
      };
    });
    res.json(result);
  };
  const setRole = async (tx, req, target, role, active) => {
    const old = await tx.roleGrants.findOne({ _id: target.uid });
    if (
      old?.role === "super_admin" ||
      (role === "admin" && !req.access.superAdmin) ||
      (old?.role === "admin" && !req.access.superAdmin)
    )
      fail(
        403,
        "Only Super Admin can manage Admin access. Super Admin grants are operator-only.",
        "FORBIDDEN",
      );
    if (active && (!target.emailVerified || target.disabled || !target.email))
      fail(
        409,
        "The target account must be enabled with a verified email.",
        "ACCOUNT_NOT_VERIFIED",
      );
    if (
      active &&
      (await tx.accountControls.findOne({ _id: target.uid }))?.state ===
        "restricted"
    )
      fail(
        409,
        "Restore the account before granting a role.",
        "ACCOUNT_RESTRICTED",
      );
    if (!active && (!old || old.role !== role))
      fail(409, "This role is not assigned to the target.", "STALE_OPERATION");
    const value = {
      email: active ? target.email : old.email,
      role,
      active,
      grantVersion: 1,
      createdAt: old?.createdAt || clock(),
      updatedAt: clock(),
      revision: revision(old) + 1,
    };
    await putRecord(tx.roleGrants, target.uid, old, value);
    await touchProvider(tx, target, new ObjectId().toHexString());
    await providerFlag(tx, target, "roleRevoked", !active);
    return { old, value };
  };
  const roles = async (req, res) => {
    sensitiveInput(req, clock, ["role", "active"]);
    if (
      !["admin", "technician"].includes(req.body.role) ||
      typeof req.body.active !== "boolean"
    )
      fail(
        400,
        "Choose Admin or Technician and an active state.",
        "VALIDATION_ERROR",
      );
    const db = await database(),
      uid = uidValue(req.params.id),
      existing = await db.roleGrants.findOne({ _id: uid });
    const target = req.body.active
      ? await identity(uid)
      : { uid, email: existing?.email, emailVerified: false, disabled: true };
    const result = await atomicAction(db, req, clock, async (tx) => {
      const old = await tx.roleGrants.findOne({ _id: target.uid });
      sameRevision(old, req.body.expectedRevision);
      if (
        req.body.active &&
        req.body.role === "technician" &&
        (await tx.applications.findOne({ _id: target.uid }))?.state !==
          "approved"
      )
        fail(
          409,
          "Review and approve the technician application first.",
          "APPLICATION_REQUIRED",
        );
      const changed = await setRole(
        tx,
        req,
        target,
        req.body.role,
        req.body.active,
      );
      return {
        action: "role_access",
        target: `account:${target.uid}`,
        before: changed.old
          ? { role: changed.old.role, active: changed.old.active }
          : null,
        after: { role: changed.value.role, active: changed.value.active },
        result: { acknowledged: true, revision: changed.value.revision },
      };
    });
    res.json(result);
  };
  const application = async (req, res) => {
    sensitiveInput(req, clock, ["decision"]);
    if (!["approve", "changes_requested"].includes(req.body.decision))
      fail(400, "Choose an application decision.", "VALIDATION_ERROR");
    const target = await identity(uidValue(req.params.id)),
      db = await database();
    const result = await atomicAction(db, req, clock, async (tx) => {
      const old = await tx.applications.findOne({ _id: target.uid });
      if (!old) fail(404, "Application not found.", "NOT_FOUND");
      sameRevision(old, req.body.expectedRevision);
      if (old.state !== "pending")
        fail(409, "This application is no longer pending.", "STALE_OPERATION");
      if (req.body.decision === "approve")
        await setRole(tx, req, target, "technician", true);
      const state =
        req.body.decision === "approve" ? "approved" : "changes_requested";
      await tx.applications.updateOne(
        { _id: target.uid, revision: old.revision },
        {
          $set: {
            state,
            publicNote: req.body.reason.trim(),
            revision: old.revision + 1,
            updatedAt: clock(),
          },
        },
      );
      return {
        action: "technician_application",
        target: `account:${target.uid}`,
        before: { state: old.state },
        after: { state },
        result: { acknowledged: true, state },
      };
    });
    res.json(result);
  };
  const publication = (kind) => async (req, res) => {
    sensitiveInput(req, clock, ["state"]);
    const states =
      kind === "service"
        ? ["visible", "hidden"]
        : ["approved", "changes_requested", "restricted"];
    if (!states.includes(req.body.state))
      fail(400, "Choose a valid publication state.", "VALIDATION_ERROR");
    const id = idValue(req.params.id),
      db = await database();
    const result = await atomicAction(db, req, clock, async (tx) => {
      const row = await tx[
        kind === "service" ? "services" : "technicians"
      ].findOne({ _id: id });
      if (!row) fail(404, "Record not found.", "NOT_FOUND");
      const key = `${kind}:${id}`,
        old = await tx.entityControls.findOne({ _id: key });
      sameRevision(old, req.body.expectedRevision);
      await putRecord(tx.entityControls, key, old, {
        state: req.body.state,
        publicNote: req.body.reason.trim(),
        revision: revision(old) + 1,
        updatedAt: clock(),
      });
      if (kind === "service")
        await tx.services.updateOne(
          { _id: id },
          { $set: { operationsGuard: new ObjectId().toHexString() } },
        );
      else
        await touchProvider(
          tx,
          { uid: row.ownerUid, email: row.ownerEmail },
          new ObjectId().toHexString(),
        );
      return {
        action: `${kind}_publication`,
        target: key,
        before: {
          state: old?.state || (kind === "service" ? "visible" : "unreviewed"),
        },
        after: { state: req.body.state },
      };
    });
    res.json(result);
  };
  const review = async (req, res) => {
    sensitiveInput(req, clock, ["action"]);
    if (!["hide", "restore"].includes(req.body.action))
      fail(400, "Choose hide or restore.", "VALIDATION_ERROR");
    const db = await database();
    const result = await atomicAction(db, req, clock, async (tx) => {
      const row = await tx.reviews.findOne({ _id: idValue(req.params.id) });
      if (!row) fail(404, "Review not found.", "NOT_FOUND");
      sameRevision(row, req.body.expectedRevision);
      const result = await moderateReview(
        { ...tx, transaction: (work) => work(tx) },
        {
          reviewId: req.params.id,
          action: req.body.action,
          reason: req.body.reason,
          actor: req.user.uid,
        },
        clock(),
      );
      return {
        action: "review_moderation",
        target: `review:${req.params.id}`,
        before: { state: row.moderationState },
        after: { state: result.moderationState },
        result,
      };
    });
    res.json(result);
  };
  const report = async (req, res) => {
    sensitiveInput(req, clock, ["resolution"]);
    if (
      typeof req.body.resolution !== "string" ||
      req.body.resolution.trim().length < 10 ||
      req.body.resolution.length > 1000
    )
      fail(
        400,
        "Record a 10–1,000 character report resolution.",
        "VALIDATION_ERROR",
      );
    const db = await database();
    res.json(
      await atomicAction(db, req, clock, async (tx) => {
        const row = await tx.reviewReports.findOne({
          _id: idValue(req.params.id),
        });
        if (!row) fail(404, "Report not found.", "NOT_FOUND");
        sameRevision(row, req.body.expectedRevision);
        if (row.state !== "pending")
          fail(409, "This report is already resolved.", "STALE_OPERATION");
        await tx.reviewReports.updateOne(
          { _id: row._id, state: "pending" },
          {
            $set: {
              state: "resolved",
              revision: revision(row) + 1,
              resolution: req.body.resolution.trim(),
              resolvedAt: clock(),
              operator: req.user.uid,
            },
          },
        );
        return {
          action: "report_resolution",
          target: `report:${row._id}`,
          before: { state: "pending" },
          after: { state: "resolved" },
        };
      }),
    );
  };
  const dispute = async (req, res) => {
    sensitiveInput(req, clock, ["state", "resolution"]);
    if (
      !["in_review", "resolved"].includes(req.body.state) ||
      typeof req.body.resolution !== "string" ||
      req.body.resolution.length > 2000 ||
      (req.body.state === "resolved" && req.body.resolution.trim().length < 10)
    )
      fail(
        400,
        "Choose a dispute state and provide a resolution for the reporter.",
        "VALIDATION_ERROR",
      );
    const db = await database();
    res.json(
      await atomicAction(db, req, clock, async (tx) => {
        const row = await tx.disputes.findOne({ _id: idValue(req.params.id) });
        if (!row) fail(404, "Dispute not found.", "NOT_FOUND");
        sameRevision(row, req.body.expectedRevision);
        if (row.state === "resolved" || row.history.length >= 50)
          fail(
            409,
            "This dispute is closed or needs separate review.",
            "STALE_OPERATION",
          );
        await tx.disputes.updateOne(
          { _id: row._id, revision: row.revision },
          {
            $set: {
              state: req.body.state,
              resolution: req.body.resolution.trim(),
              revision: row.revision + 1,
              updatedAt: clock(),
              history: [
                ...row.history,
                {
                  state: req.body.state,
                  actorRole: req.access.role,
                  actorUid: req.user.uid,
                  note: req.body.resolution.trim(),
                  createdAt: clock(),
                },
              ],
            },
          },
        );
        return {
          action: "dispute_resolution",
          target: `dispute:${row._id}`,
          before: { state: row.state },
          after: { state: req.body.state },
        };
      }),
    );
  };
  const category = async (req, res) => {
    sensitiveInput(req, clock, ["name", "slug", "state"]);
    if (
      typeof req.body.name !== "string" ||
      req.body.name.trim().length < 2 ||
      req.body.name.length > 80 ||
      typeof req.body.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.body.slug) ||
      req.body.slug.length > 60 ||
      !["active", "archived"].includes(req.body.state)
    )
      fail(400, "Check category name, slug and state.", "VALIDATION_ERROR");
    const computedId = createHash("sha256")
        .update(`category-v1:${req.body.slug}`)
        .digest("hex")
        .slice(0, 24),
      id = idValue(req.params.id || computedId),
      db = await database();
    if (String(id) !== computedId)
      fail(
        400,
        "Category references are derived from their immutable slug.",
        "INVALID_INPUT",
      );
    try {
      await db.operationMeta.insertOne({ _id: "categories", guard: "initial" });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    res.json(
      await atomicAction(db, req, clock, async (tx) => {
        await tx.operationMeta.updateOne(
          { _id: "categories" },
          { $set: { guard: new ObjectId().toHexString() } },
        );
        const row = await tx.categories.findOne({ _id: id });
        sameRevision(row, req.body.expectedRevision);
        if (row && row.slug !== req.body.slug)
          fail(409, "Category slugs cannot be changed.", "VALIDATION_ERROR");
        if (
          req.body.state === "active" &&
          row?.state !== "active" &&
          (await tx.categories.countDocuments({ state: "active" })) >= 200
        )
          fail(409, "The active category directory is full.", "CATEGORY_LIMIT");
        const slug = await tx.categories.findOne({ slug: req.body.slug });
        if (slug && String(slug._id) !== String(id))
          fail(409, "This category slug already exists.", "CATEGORY_EXISTS");
        await putRecord(tx.categories, id, row, {
          name: req.body.name.trim(),
          slug: req.body.slug,
          state: req.body.state,
          revision: revision(row) + 1,
          createdAt: row?.createdAt || clock(),
          updatedAt: clock(),
        });
        return {
          action: "category_state",
          target: `category:${id}`,
          before: row ? { name: row.name, state: row.state } : null,
          after: { name: req.body.name.trim(), state: req.body.state },
        };
      }),
    );
  };
  const roleTarget = async (req, res) => {
    const user = await identity(uidValue(req.params.id)),
      db = await database(),
      grant = await db.roleGrants.findOne({ _id: user.uid });
    res.json({
      _id: user.uid,
      displayName: user.displayName,
      emailMasked: maskEmail(user.email),
      emailVerified: user.emailVerified,
      disabled: user.disabled,
      role: grant?.role || "public_visitor",
      active: grant?.active || false,
      revision: revision(grant),
    });
  };
  return {
    roleTarget,
    guard,
    capabilities,
    apply,
    overview,
    list,
    customers,
    inspect,
    account,
    roles,
    application,
    publication,
    review,
    report,
    dispute,
    category,
  };
};
module.exports = { createOperations, safeIdentity, uidValue };
