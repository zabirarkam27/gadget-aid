const { createHash, timingSafeEqual } = require("node:crypto");
const { ObjectId } = require("mongodb");
const {
  fail,
  checkKeys,
  idValue,
  serviceOwner,
  customerQuery,
  ownerQuery,
} = require("./domain");
const { hasWorkflow, STATUS_LABELS } = require("./workflow-model");
const hash = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24);
const customerOwner = (booking, user) =>
  booking.userEmail === user.email &&
  (!booking.userUid || booking.userUid === user.uid);
const titles = {
  booking_created: "New booking request",
  diagnosis_saved: "Diagnosis recorded",
  quotation_sent: "Quotation ready for review",
  quotation_approved: "Quotation approved",
  quotation_rejected: "Quotation rejected",
  booking_cancelled: "Booking cancelled",
  clarification_requested: "Quotation question received",
  clarification_answered: "Quotation question answered",
};
const eventTitle = (e) =>
  e.type === "status_changed"
    ? `Repair update: ${STATUS_LABELS[e.status] || "Status changed"}`
    : titles[e.type];
const recipientMatches = (row, user) =>
  row.recipientEmail === user.email &&
  (!row.recipientUid || row.recipientUid === user.uid);
const publicNotification = (row) => ({
  _id: String(row._id),
  bookingId: row.bookingId,
  title: row.title,
  serviceName: row.serviceName,
  createdAt: row.createdAt,
  readAt: row.readAt,
  kind: row.kind,
  view: row.recipientRole,
});
const createCommunication = ({
  collections,
  clock,
  sendEmail = null,
  jobSecret = "",
  appUrl = "http://localhost:5173",
}) => {
  const database = async () => {
    const db = await collections();
    if (!db.notifications || !db.threads)
      fail(
        503,
        "Communication is unavailable. Please retry.",
        "SERVICE_UNAVAILABLE",
      );
    return db;
  };
  const context = async (id, user, db) => {
    const booking = await db.bookings.findOne({ _id: idValue(id) });
    if (!booking) fail(404, "Booking not found.", "NOT_FOUND");
    let service = null;
    try {
      service = await db.services.findOne({
        _id: idValue(String(booking.serviceId)),
      });
    } catch (error) {
      if (error.status !== 400) throw error;
    }
    const customer = customerOwner(booking, user),
      provider = !!serviceOwner(service, user);
    if (!customer && !provider)
      fail(403, "You cannot access this conversation.", "FORBIDDEN");
    return {
      booking,
      service,
      customer,
      provider,
      role: customer ? "customer" : "provider",
    };
  };
  const recipient = (ctx, role) =>
    role === "customer"
      ? { uid: ctx.booking.userUid || null, email: ctx.booking.userEmail, role }
      : ctx.service
        ? {
            uid: ctx.service.providerUid || null,
            email: ctx.service.providerEmail,
            role,
          }
        : null;
  const owned = async (db, user) => {
    const services = (
      await db.services.find(ownerQuery(user)).toArray()
    ).filter((s) => serviceOwner(s, user));
    const ids = services.flatMap((s) => [s._id, String(s._id)]);
    const rows = await db.bookings
      .find({ $or: [customerQuery(user), { serviceId: { $in: ids } }] })
      .toArray();
    return rows;
  };
  const project = async (db, booking, service) => {
    const ctx = { booking, service };
    const thread = await db.threads.findOne({ _id: booking._id });
    const sources = [
      ...(hasWorkflow(booking)
        ? booking.repair.events
            .filter(
              (e) =>
                e.notify === true &&
                e.createdAt instanceof Date &&
                eventTitle(e),
            )
            .map((e) => ({
              id: e.id,
              actorRole: e.actor.role,
              actorUid: e.actor.uid,
              title: eventTitle(e),
              createdAt: e.createdAt,
              kind: "repair",
            }))
        : []),
      ...(thread?.messages || []).map((m) => ({
        id: m.id,
        actorRole: m.role,
        actorUid: m.senderUid,
        title: "New booking message",
        createdAt: m.createdAt,
        kind: "message",
      })),
    ];
    for (const source of sources) {
      const to = recipient(
        ctx,
        source.actorRole === "customer" ? "provider" : "customer",
      );
      if (!to?.email || (to.uid && to.uid === source.actorUid)) continue;
      const id = new ObjectId(
        hash(
          `${booking._id}:${source.id}:${to.role}:${to.uid || ""}:${to.email}`,
        ),
      );
      const messageRead = source.kind === "message" &&
        (thread.readThrough?.[to.role] ?? -1) >= thread.messages.findIndex(m => m.id === source.id);
      const existing = await db.notifications.findOne({ _id: id });
      if (existing) {
        // Repair a projection racing a read receipt; the thread cursor is authoritative.
        if (messageRead && !existing.readAt) await db.notifications.updateOne({_id:id,readAt:null},{$set:{readAt:clock()}});
        continue;
      }
      const record = {
        _id: id,
        bookingId: String(booking._id),
        sourceId: source.id,
        recipientUid: to.uid,
        recipientEmail: to.email,
        recipientRole: to.role,
        title: source.title,
        serviceName:
          typeof booking.serviceName === "string"
            ? booking.serviceName
            : "Repair service",
        createdAt: source.createdAt,
        readAt:
          messageRead
            ? clock()
            : null,
        kind: source.kind,
        deliveryState: "pending",
        emailRevision: 0,
        attempts: 0,
        nextAttemptAt: clock(),
        leaseUntil: null,
        firstAttemptAt: null,
      };
      try {
        await db.notifications.insertOne(record);
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
  };
  const projectOwned = async (db, user) => {
    const bookings = await owned(db, user);
    for (const booking of bookings) {
      let service = null;
      try {
        service = await db.services.findOne({
          _id: idValue(String(booking.serviceId)),
        });
      } catch (error) {
        if (error.status !== 400) throw error;
      }
      await project(db, booking, service);
    }
    return bookings;
  };
  const canReadNotification = async (db, row, user) => {
    if (!recipientMatches(row, user)) return false;
    try {
      const ctx = await context(row.bookingId, user, db);
      const to = recipient(ctx, row.recipientRole);
      return (
        !!to && to.email === user.email && (!to.uid || to.uid === user.uid)
      );
    } catch (error) {
      if ([403, 404].includes(error.status)) return false;
      throw error;
    }
  };
  const threadView = (thread, ctx, user) => {
    const cursor = thread?.readThrough?.[ctx.role] ?? -1;
    const messages = thread?.messages || [];
    return {
      messages: messages.map((m) => ({
        id: m.id,
        text: m.text,
        role: m.role,
        self: m.senderUid === user.uid,
        createdAt: m.createdAt,
      })),
      unreadCount: messages.filter(
        (m, i) => i > cursor && m.senderUid !== user.uid,
      ).length,
      lastMessageId: messages.at(-1)?.id || null,
      canSend: !!recipient(
        ctx,
        ctx.role === "customer" ? "provider" : "customer",
      ),
      limitReached: messages.length >= 200,
    };
  };
  const notifications = async (req, res) => {
    const db = await database(),
      bookings = await projectOwned(db, req.user);
    const rows = await db.notifications
      .find({ recipientEmail: req.user.email })
      .toArray();
    const visible = [];
    for (const row of rows)
      if (await canReadNotification(db, row, req.user)) visible.push(row);
    let unreadMessages = 0;
    for (const booking of bookings) {
      const ctx = await context(String(booking._id), req.user, db);
      unreadMessages += threadView(
        await db.threads.findOne({ _id: booking._id }),
        ctx,
        req.user,
      ).unreadCount;
    }
    visible.sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt) ||
        String(b._id).localeCompare(String(a._id)),
    );
    res.json({
      items: visible.slice(0, 100).map(publicNotification),
      unreadCount: visible.filter((r) => !r.readAt).length,
      unreadMessages,
    });
  };
  const markNotifications = async (req, res) => {
    checkKeys(req.body, ["ids"]);
    if (!Array.isArray(req.body.ids) || req.body.ids.length > 100)
      fail(400, "Choose up to 100 notifications.", "VALIDATION_ERROR");
    const db = await database(),
      rows = [];
    for (const id of new Set(req.body.ids)) {
      const row = await db.notifications.findOne({ _id: idValue(id) });
      if (!row || !(await canReadNotification(db, row, req.user)))
        fail(404, "Notification not found.", "NOT_FOUND");
      rows.push(row);
    }
    for (const row of rows)
      await db.notifications.updateOne(
        { _id: row._id, readAt: null },
        { $set: { readAt: clock() } },
      );
    res.json({ acknowledged: true });
  };
  const readThread = async (req, res) => {
    const db = await database(),
      ctx = await context(req.params.id, req.user, db);
    res.json(
      threadView(
        await db.threads.findOne({ _id: ctx.booking._id }),
        ctx,
        req.user,
      ),
    );
  };
  const mutateThread = async (db, ctx, operation) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const stored = await db.threads.findOne({ _id: ctx.booking._id });
      const thread = stored || {
        _id: ctx.booking._id,
        revision: 0,
        messages: [],
        readThrough: { customer: -1, provider: -1 },
      };
      const next = operation(structuredClone(thread));
      if (!next) return thread;
      if (!stored) {
        try {
          await db.threads.insertOne({
            ...next,
            _id: ctx.booking._id,
            revision: 1,
          });
          return next;
        } catch (error) {
          if (error.code !== 11000) throw error;
        }
      } else {
        const result = await db.threads.updateOne(
          { _id: ctx.booking._id, revision: stored.revision },
          {
            $set: {
              messages: next.messages,
              readThrough: next.readThrough,
              revision: stored.revision + 1,
            },
          },
        );
        if (result.matchedCount) return next;
      }
    }
    fail(
      409,
      "This conversation changed. Refresh and retry.",
      "STALE_CONVERSATION",
    );
  };
  const sendMessage = async (req, res) => {
    checkKeys(req.body, ["text", "requestId"]);
    const { text, requestId } = req.body;
    if (
      typeof text !== "string" ||
      text.trim().length < 1 ||
      text.trim().length > 2000 ||
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)
    )
      fail(
        400,
        "Use a message of 1–2,000 characters and a valid request reference.",
        "VALIDATION_ERROR",
      );
    const db = await database(),
      ctx = await context(req.params.id, req.user, db);
    if (!recipient(ctx, ctx.role === "customer" ? "provider" : "customer"))
      fail(
        409,
        "The other participant is unavailable.",
        "PARTICIPANT_UNAVAILABLE",
      );
    const id = hash(`${ctx.booking._id}:${req.user.uid}:${requestId}`);
    const thread = await mutateThread(db, ctx, (next) => {
      const prior = next.messages.find((m) => m.id === id);
      if (prior) {
        if (prior.text !== text.trim())
          fail(
            409,
            "Use a new reference for a different message.",
            "MESSAGE_REFERENCE_CONFLICT",
          );
        return null;
      }
      if (next.messages.length >= 200)
        fail(
          409,
          "This conversation reached its 200-message limit.",
          "CONVERSATION_LIMIT",
        );
      const now = clock(),
        last = next.messages.filter((m) => m.senderUid === req.user.uid).at(-1);
      if (last && now - new Date(last.createdAt) < 5000)
        fail(
          429,
          "Wait a few seconds before sending again.",
          "MESSAGE_RATE_LIMIT",
        );
      next.messages.push({
        id,
        text: text.trim(),
        role: ctx.role,
        senderUid: req.user.uid,
        createdAt: now,
      });
      return next;
    });
    res.status(201).json(threadView(thread, ctx, req.user));
  };
  const markThread = async (req, res) => {
    checkKeys(req.body, ["throughId"]);
    if (typeof req.body.throughId !== "string")
      fail(400, "Choose the last message you read.", "VALIDATION_ERROR");
    const db = await database(),
      ctx = await context(req.params.id, req.user, db);
    const thread = await mutateThread(db, ctx, (next) => {
      const index = next.messages.findIndex((m) => m.id === req.body.throughId);
      if (index < 0)
        fail(
          409,
          "Refresh the conversation before marking it read.",
          "STALE_CONVERSATION",
        );
      next.readThrough[ctx.role] = Math.max(next.readThrough[ctx.role], index);
      return next;
    });
    const seen = new Set(
      thread.messages
        .slice(0, thread.readThrough[ctx.role] + 1)
        .map((m) => m.id),
    );
    const rows = await db.notifications
      .find({
        bookingId: String(ctx.booking._id),
        recipientEmail: req.user.email,
        kind: "message",
      })
      .toArray();
    for (const row of rows)
      if (
        seen.has(row.sourceId) &&
        (await canReadNotification(db, row, req.user))
      )
        await db.notifications.updateOne(
          { _id: row._id, readAt: null },
          { $set: { readAt: clock() } },
        );
    res.json(threadView(thread, ctx, req.user));
  };
  const deliver = async (req, res) => {
    const supplied = req.headers.authorization || "",
      expected = `Bearer ${jobSecret}`;
    if (
      jobSecret.length < 32 ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      fail(401, "Unauthorized job.", "UNAUTHENTICATED");
    if (!sendEmail)
      fail(503, "Email delivery is not configured.", "EMAIL_NOT_CONFIGURED");
    const db = await database();
    const bookings = await db.bookings.find({}).toArray();
    for (const booking of bookings) {
      let service = null;
      try {
        service = await db.services.findOne({
          _id: idValue(String(booking.serviceId)),
        });
      } catch (error) {
        if (error.status !== 400) throw error;
      }
      await project(db, booking, service);
    }
    const rows = (await db.notifications.find({}).toArray())
      .filter(
        (r) =>
          ["pending", "retry", "sending"].includes(r.deliveryState) &&
          new Date(r.nextAttemptAt) <= clock() &&
          (!r.leaseUntil || new Date(r.leaseUntil) <= clock()),
      )
      .slice(0, 5);
    const counts = { accepted: 0, retry: 0, failed: 0, skipped: 0 };
    for (const row of rows) {
      if (
        !(await canReadNotification(db, row, {
          uid: row.recipientUid || "legacy-email-recipient",
          email: row.recipientEmail,
        }))
      ) {
        await db.notifications.updateOne(
          { _id: row._id, emailRevision: row.emailRevision },
          {
            $set: {
              deliveryState: "suppressed",
              emailRevision: row.emailRevision + 1,
            },
          },
        );
        counts.skipped++;
        continue;
      }
      const now = clock();
      if (
        row.attempts >= 5 ||
        (row.firstAttemptAt &&
          now - new Date(row.firstAttemptAt) > 23 * 60 * 60 * 1000)
      ) {
        await db.notifications.updateOne(
          { _id: row._id, emailRevision: row.emailRevision },
          {
            $set: {
              deliveryState: "failed",
              failureCode: "REVIEW_REQUIRED",
              emailRevision: row.emailRevision + 1,
            },
          },
        );
        counts.failed++;
        continue;
      }
      const revision = row.emailRevision + 1,
        attempts = row.attempts + 1;
      const payload = row.emailPayload || {
        to: row.recipientEmail,
        subject: `GadgetAid: ${row.title}`,
        text: `${row.title}.\n\nSign in to view this booking securely:\n${appUrl}/bookings/${row.bookingId}${row.recipientRole === "provider" ? "?view=provider" : ""}\n\nUpdates appear after refreshing your workspace.`,
      };
      const claimed = await db.notifications.updateOne(
        { _id: row._id, emailRevision: row.emailRevision },
        {
          $set: {
            deliveryState: "sending",
            emailRevision: revision,
            attempts,
            firstAttemptAt: row.firstAttemptAt || now,
            leaseUntil: new Date(now.getTime() + 120000),
            emailPayload: payload,
          },
        },
      );
      if (!claimed.matchedCount) {
        counts.skipped++;
        continue;
      }
      let update;
      try {
        const result = await sendEmail({
          ...payload,
          idempotencyKey: `gadget-aid/${row._id}`,
        });
        update = {
          deliveryState: "accepted",
          providerMessageId: result.id,
          acceptedAt: clock(),
          leaseUntil: null,
          failureCode: null,
        };
        counts.accepted++;
      } catch (error) {
        const retryable = error.retryable !== false && attempts < 5;
        update = {
          deliveryState: retryable ? "retry" : "failed",
          failureCode: retryable
            ? "TEMPORARY_DELIVERY_FAILURE"
            : "DELIVERY_REVIEW_REQUIRED",
          nextAttemptAt: new Date(
            clock().getTime() +
              [60000, 300000, 1800000, 7200000][Math.min(attempts - 1, 3)],
          ),
          leaseUntil: null,
        };
        counts[retryable ? "retry" : "failed"]++;
      }
      await db.notifications.updateOne(
        { _id: row._id, emailRevision: revision },
        { $set: { ...update, emailRevision: revision + 1 } },
      );
    }
    res.json(counts);
  };
  return {
    notifications,
    markNotifications,
    readThread,
    sendMessage,
    markThread,
    deliver,
  };
};
module.exports = { createCommunication };
