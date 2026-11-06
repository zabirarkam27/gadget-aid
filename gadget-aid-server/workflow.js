const { releaseReservation, runTransaction } = require("./technicians");
const { ObjectId } = require("mongodb");
const {
  fail,
  checkKeys,
  idValue,
  priceValue,
  validDate,
  serviceOwner,
} = require("./domain");
const {
  STATUS_LABELS,
  STATUSES,
  CUSTOMER_CANCELLABLE,
  workflowStatus,
  hasWorkflow,
  currentQuote,
  approvedQuote,
  legacyInProgress,
  providerTransitions,
  workflowSummary,
} = require("./workflow-model");
const MAX_EVENTS = 300;
const revisionOf = (booking) => {
  if (booking.repairRevision == null) return 0;
  if (
    !Number.isSafeInteger(booking.repairRevision) ||
    booking.repairRevision < 0
  )
    fail(
      409,
      "This legacy repair needs an ownership/data review before it can be changed.",
      "WORKFLOW_REVIEW_REQUIRED",
    );
  return booking.repairRevision;
};
const customerOwner = (booking, user) =>
  booking.userEmail === user.email &&
  (!booking.userUid || booking.userUid === user.uid);
const noteText = (value, required = false, max = 1000) => {
  if (value === undefined && !required) return "";
  if (
    typeof value !== "string" ||
    value.trim().length < (required ? 3 : 0) ||
    value.length > max
  )
    fail(
      400,
      `Use ${required ? "3–" : "up to "}${max} characters for the note.`,
      "VALIDATION_ERROR",
    );
  return value.trim();
};
const requiredText = (value, name, min, max) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${name} must use ${min}–${max} characters.`, "VALIDATION_ERROR");
  return value.trim();
};
const event = (
  booking,
  user,
  role,
  type,
  from,
  to,
  at,
  note = "",
  extra = {},
) => ({
  id: new ObjectId().toHexString(),
  bookingId: String(booking._id),
  type,
  previousStatus: from,
  status: to,
  actor: { uid: user.uid, role },
  createdAt: at,
  note,
  customerVisible: true,
  notify: true,
  ...extra,
});
const initialRepair = (booking, user, at, isNew = false) => ({
  workflowVersion: 2,
  repairRevision: 0,
  repair: {
    startedAt: at,
    legacyInProgress: !isNew && legacyInProgress(booking),
    diagnoses: [],
    quotations: [],
    currentQuotationId: null,
    events: [
      event(
        booking,
        user,
        isNew ? "customer" : "provider",
        isNew ? "booking_created" : "legacy_workflow_started",
        isNew ? null : workflowStatus(booking),
        workflowStatus(booking),
        at,
        isNew
          ? "Booking request submitted."
          : "Detailed tracking started for an existing booking. Earlier diagnosis and approval history is unavailable.",
      ),
    ],
  },
});
const quoteExpired = (quote, now) =>
  !!quote?.expiresAt && new Date(quote.expiresAt).getTime() <= now.getTime();
const unanswered = (quote) =>
  (quote?.clarifications || []).some((item) => !item.answer);
const publicQuote = (quote, now) => ({
  ...quote,
  expired: quoteExpired(quote, now),
});
const createWorkflow = ({ collections, clock, serializeBooking }) => {
  const context = async (req, role) => {
    const id = idValue(req.params.id),
      db = await collections(),
      booking = await db.bookings.findOne({ _id: id });
    if (!booking) fail(404, "Booking not found.", "NOT_FOUND");
    const customer = customerOwner(booking, req.user);
    let service = null;
    try {
      service = await db.services.findOne({
        _id: idValue(
          typeof booking.serviceId === "string"
            ? booking.serviceId
            : String(booking.serviceId),
        ),
      });
    } catch (error) {
      if (error.status !== 400) throw error;
    }
    const provider = !!service && !!serviceOwner(service, req.user);
    if (
      (role === "customer" && !customer) ||
      (role === "provider" && !provider) ||
      (!role && !customer && !provider)
    )
      fail(403, "You cannot access this repair.", "FORBIDDEN");
    return { db, booking, customer, provider };
  };
  const view = (booking, permissions) => {
    const now = clock(),
      quote = currentQuote(booking),
      tracked = hasWorkflow(booking),
      status = workflowStatus(booking);
    const current = quote ? publicQuote(quote, now) : null;
    return {
      ...serializeBooking(booking),
      ...workflowSummary(booking),
      repairRevision: revisionOf(booking),
      permissions,
      repair: tracked
        ? {
            ...booking.repair,
            quotations: booking.repair.quotations.map((item) =>
              publicQuote(item, now),
            ),
          }
        : {
            diagnoses: [],
            quotations: [],
            events: [],
            currentQuotationId: null,
          },
      legacyNotice: !tracked
        ? "This booking predates detailed repair tracking. No earlier diagnosis or approval is being assumed."
        : booking.repair.legacyInProgress
          ? "This repair was already in progress before approval tracking. No historical quotation approval is recorded."
          : "",
      actions: {
        transitions: permissions.provider
          ? providerTransitions(booking).map((value) => ({
              status: value,
              label: STATUS_LABELS[value],
              requiresNote:
                ["cancelled", "rejected"].includes(value) ||
                (status === "quality_check" && value === "repairing") ||
                (status === "ready_for_collection" &&
                  value === "quality_check"),
            }))
          : [],
        diagnose: permissions.provider && status === "diagnosing",
        quote:
          permissions.provider &&
          ["diagnosing", "awaiting_approval"].includes(status) &&
          !!(tracked && booking.repair.diagnoses.length) &&
          !approvedQuote(booking),
        approve:
          permissions.customer &&
          status === "awaiting_approval" &&
          quote?.status === "sent" &&
          !quoteExpired(quote, now) &&
          !unanswered(quote),
        rejectQuote:
          permissions.customer &&
          status === "awaiting_approval" &&
          quote?.status === "sent",
        clarify:
          permissions.customer &&
          status === "awaiting_approval" &&
          quote?.status === "sent" &&
          (quote.clarifications || []).length < 10,
        answer:
          permissions.provider &&
          status === "awaiting_approval" &&
          quote?.status === "sent",
        cancel: permissions.customer && CUSTOMER_CANCELLABLE.includes(status),
      },
      currentQuotation: current,
    };
  };
  const mutate = async (req, ctx, role, operation) => {
    const { booking, db } = ctx;
    const revision = revisionOf(booking);
    if (
      !Number.isSafeInteger(req.body.expectedRevision) ||
      req.body.expectedRevision !== revision
    )
      fail(
        409,
        "This repair has changed. Refresh it before trying again.",
        "STALE_WORKFLOW",
      );
    const now = clock();
    const base = hasWorkflow(booking)
      ? {
          workflowVersion: 2,
          repairRevision: revision,
          repair: structuredClone(booking.repair),
        }
      : initialRepair(booking, req.user, now);
    // The actual verified actor starts a lazy legacy upgrade; never invent a past action.
    if (!hasWorkflow(booking)) base.repair.events[0].actor.role = role;
    let next = { ...booking, ...base, status: workflowStatus(booking) };
    next = operation(next, now) || next;
    if (next.repair.events.length > MAX_EVENTS)
      fail(
        409,
        "This repair has reached its tracking limit and needs a review.",
        "WORKFLOW_LIMIT",
      );
    const filter = {
      _id: booking._id,
      repairRevision:
        booking.repairRevision === undefined
          ? { $exists: false }
          : booking.repairRevision,
      status: booking.status ?? null,
    };
    const update = {
      status: next.status,
      workflowVersion: 2,
      repairRevision: revision + 1,
      repair: next.repair,
      updatedAt: now,
    };
    const commit = async (target) => {
      const result = await target.bookings.updateOne(filter, { $set: update });
      if (!result.matchedCount)
        fail(
          409,
          "This repair has changed. Refresh it before trying again.",
          "STALE_WORKFLOW",
        );
      if (
        booking.appointment?.startsAt instanceof Date &&
        ["cancelled", "rejected"].includes(next.status)
      )
        await releaseReservation(target, booking);
    };
    if (
      booking.appointment?.startsAt instanceof Date &&
      ["cancelled", "rejected"].includes(next.status)
    )
      await runTransaction(db, commit);
    else await commit(db);
    return view(
      { ...booking, ...update },
      {
        customer: ctx.customer,
        provider: ctx.provider && req.access.canProvide,
        providerHistory: ctx.provider,
      },
    );
  };
  const changeStatus = (next, req, role, type, status, now, note, extra) => {
    next.repair.events.push(
      event(next, req.user, role, type, next.status, status, now, note, extra),
    );
    next.status = status;
  };
  const read = async (req, res) => {
    const ctx = await context(req);
    res.json(
      view(ctx.booking, {
        customer: ctx.customer,
        provider: ctx.provider && req.access.canProvide,
        providerHistory: ctx.provider,
      }),
    );
  };
  const transition = async (req, res) => {
    const ctx = await context(req, "provider");
    checkKeys(req.body, ["status", "expectedRevision", "note"]);
    const target =
      req.body.status === "working" ? "repairing" : req.body.status;
    if (!STATUSES.includes(target))
      fail(400, "Choose a valid repair stage.", "INVALID_STATUS");
    const allowed = providerTransitions(ctx.booking);
    if (!allowed.includes(target))
      fail(
        409,
        "That repair step is not available. Approval and earlier stages cannot be skipped.",
        "INVALID_TRANSITION",
      );
    const from = workflowStatus(ctx.booking);
    const required =
      ["cancelled", "rejected"].includes(target) ||
      (from === "quality_check" && target === "repairing") ||
      (from === "ready_for_collection" && target === "quality_check");
    const note = noteText(req.body.note, required);
    const result = await mutate(req, ctx, "provider", (next, now) => {
      if (target === "cancelled") {
        const quote = currentQuote(next);
        if (quote?.status === "sent") {
          quote.status = "withdrawn";
          quote.withdrawnAt = now;
        }
      }
      changeStatus(next, req, "provider", "status_changed", target, now, note);
      return next;
    });
    res.json({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      booking: result,
    });
  };
  const diagnosis = async (req, res) => {
    const ctx = await context(req, "provider");
    checkKeys(req.body, [
      "summary",
      "issue",
      "recommendedRepair",
      "expectedRevision",
    ]);
    if (workflowStatus(ctx.booking) !== "diagnosing")
      fail(
        409,
        "Start diagnosis before submitting findings.",
        "INVALID_TRANSITION",
      );
    const data = {
      summary: requiredText(req.body.summary, "Diagnosis summary", 10, 2000),
      issue: requiredText(req.body.issue, "Identified issue", 3, 1000),
      recommendedRepair: requiredText(
        req.body.recommendedRepair,
        "Recommended repair",
        3,
        2000,
      ),
    };
    const result = await mutate(req, ctx, "provider", (next, now) => {
      if (next.repair.diagnoses.length >= 20)
        fail(
          409,
          "The diagnosis history needs a review before adding more versions.",
          "WORKFLOW_LIMIT",
        );
      const diagnosis = {
        id: new ObjectId().toHexString(),
        number: next.repair.diagnoses.length + 1,
        ...data,
        createdAt: now,
        actorUid: req.user.uid,
      };
      next.repair.diagnoses.push(diagnosis);
      changeStatus(
        next,
        req,
        "provider",
        "diagnosis_saved",
        next.status,
        now,
        "Diagnosis findings recorded.",
        { diagnosisId: diagnosis.id },
      );
      return next;
    });
    res.status(201).json({ booking: result });
  };
  const quotation = async (req, res) => {
    const ctx = await context(req, "provider");
    checkKeys(req.body, [
      "parts",
      "labor",
      "estimatedCompletion",
      "expiresOn",
      "expectedRevision",
    ]);
    if (
      !["diagnosing", "awaiting_approval"].includes(
        workflowStatus(ctx.booking),
      ) ||
      approvedQuote(ctx.booking)
    )
      fail(
        409,
        "An approved quotation cannot be replaced, and new quotes require diagnosis.",
        "INVALID_TRANSITION",
      );
    if (!Array.isArray(req.body.parts) || req.body.parts.length > 20)
      fail(400, "Use up to 20 part lines.", "VALIDATION_ERROR");
    const parts = req.body.parts.map((part) => {
      checkKeys(part, ["name", "quantity", "unitPrice"]);
      const name = requiredText(part.name, "Part name", 2, 120),
        unitPrice = priceValue(part.unitPrice);
      if (
        !Number.isSafeInteger(part.quantity) ||
        part.quantity < 1 ||
        part.quantity > 100 ||
        unitPrice === null
      )
        fail(400, "Check each part's quantity and price.", "VALIDATION_ERROR");
      return {
        name,
        quantity: part.quantity,
        unitPrice,
        lineTotal: (Math.round(unitPrice * 100) * part.quantity) / 100,
      };
    });
    const labor = priceValue(req.body.labor),
      estimatedCompletion = requiredText(
        req.body.estimatedCompletion,
        "Completion estimate",
        3,
        160,
      );
    if (labor === null)
      fail(400, "Enter a valid labor amount.", "VALIDATION_ERROR");
    const cents = parts.reduce(
      (sum, part) => sum + Math.round(part.lineTotal * 100),
      Math.round(labor * 100),
    );
    if (cents > 100000000)
      fail(
        400,
        "The quotation total cannot exceed 1,000,000.",
        "VALIDATION_ERROR",
      );
    let expiresAt = null;
    if (req.body.expiresOn !== undefined && req.body.expiresOn !== "") {
      if (!validDate(req.body.expiresOn))
        fail(400, "Choose a valid quotation expiry date.", "VALIDATION_ERROR");
      expiresAt = new Date(`${req.body.expiresOn}T23:59:59.999+06:00`);
      if (expiresAt.getTime() <= clock().getTime())
        fail(
          400,
          "The quotation expiry must be in the future.",
          "VALIDATION_ERROR",
        );
    }
    const result = await mutate(req, ctx, "provider", (next, now) => {
      if (expiresAt && expiresAt.getTime() <= now.getTime())
        fail(
          400,
          "The quotation expiry must be in the future.",
          "VALIDATION_ERROR",
        );
      if (!next.repair.diagnoses.length)
        fail(
          409,
          "Record the diagnosis before sending a quotation.",
          "DIAGNOSIS_REQUIRED",
        );
      if (next.repair.quotations.length >= 20)
        fail(
          409,
          "The quotation history needs a review before adding more versions.",
          "WORKFLOW_LIMIT",
        );
      const old = currentQuote(next);
      if (old?.status === "approved")
        fail(
          409,
          "An approved quotation cannot be replaced.",
          "APPROVED_QUOTATION",
        );
      if (old?.status === "sent") {
        old.status = "superseded";
        old.supersededAt = now;
      }
      const quote = {
        id: new ObjectId().toHexString(),
        number: next.repair.quotations.length + 1,
        diagnosisId: next.repair.diagnoses.at(-1).id,
        parts,
        labor,
        total: cents / 100,
        currency: "USD",
        estimatedCompletion,
        expiresOn: req.body.expiresOn || null,
        expiresAt,
        status: "sent",
        sentAt: now,
        actorUid: req.user.uid,
        clarifications: [],
      };
      next.repair.quotations.push(quote);
      next.repair.currentQuotationId = quote.id;
      changeStatus(
        next,
        req,
        "provider",
        "quotation_sent",
        "quotation_sent",
        now,
        `Quotation version ${quote.number} sent.`,
        { quotationId: quote.id },
      );
      changeStatus(
        next,
        req,
        "provider",
        "approval_requested",
        "awaiting_approval",
        now,
        "Customer approval is required before repair starts.",
        { quotationId: quote.id },
      );
      return next;
    });
    res.status(201).json({ booking: result });
  };
  const pendingQuote = (booking, quoteId) => {
    const quote = currentQuote(booking);
    if (
      !quote ||
      quote.id !== quoteId ||
      quote.status !== "sent" ||
      workflowStatus(booking) !== "awaiting_approval"
    )
      fail(
        409,
        "This quotation is no longer awaiting a decision. Refresh the repair.",
        "STALE_QUOTATION",
      );
    return quote;
  };
  const decision = async (req, res) => {
    const ctx = await context(req, "customer");
    checkKeys(req.body, ["decision", "note", "expectedRevision"]);
    if (!["approve", "reject"].includes(req.body.decision))
      fail(400, "Choose approve or reject.", "VALIDATION_ERROR");
    const quote = pendingQuote(ctx.booking, req.params.quoteId);
    if (req.body.decision === "approve" && quoteExpired(quote, clock()))
      fail(
        410,
        "This quotation has expired. Ask your provider for an updated quotation.",
        "QUOTE_EXPIRED",
      );
    if (req.body.decision === "approve" && unanswered(quote))
      fail(
        409,
        "Wait for a response to your quotation question before approving.",
        "CLARIFICATION_PENDING",
      );
    const note = noteText(req.body.note, req.body.decision === "reject");
    const result = await mutate(req, ctx, "customer", (next, now) => {
      const active = pendingQuote(next, req.params.quoteId);
      if (req.body.decision === "approve" && quoteExpired(active, now))
        fail(
          410,
          "This quotation has expired. Ask for an updated quotation.",
          "QUOTE_EXPIRED",
        );
      active.status = req.body.decision === "approve" ? "approved" : "rejected";
      active.decisionAt = now;
      active.decisionBy = req.user.uid;
      active.decisionNote = note;
      changeStatus(
        next,
        req,
        "customer",
        req.body.decision === "approve"
          ? "quotation_approved"
          : "quotation_rejected",
        req.body.decision === "approve" ? "approved" : "diagnosing",
        now,
        note || "The customer authorized the quoted repair.",
        { quotationId: active.id },
      );
      return next;
    });
    res.json({ booking: result });
  };
  const clarification = async (req, res) => {
    const ctx = await context(req, "customer");
    checkKeys(req.body, ["question", "expectedRevision"]);
    pendingQuote(ctx.booking, req.params.quoteId);
    const question = requiredText(req.body.question, "Question", 3, 1000);
    const result = await mutate(req, ctx, "customer", (next, now) => {
      const quote = pendingQuote(next, req.params.quoteId);
      if (quote.clarifications.length >= 10)
        fail(
          409,
          "This quotation has reached its question limit.",
          "WORKFLOW_LIMIT",
        );
      const item = {
        id: new ObjectId().toHexString(),
        question,
        askedAt: now,
        askedBy: req.user.uid,
        answer: null,
      };
      quote.clarifications.push(item);
      changeStatus(
        next,
        req,
        "customer",
        "clarification_requested",
        next.status,
        now,
        question,
        { quotationId: quote.id, clarificationId: item.id },
      );
      return next;
    });
    res.status(201).json({ booking: result });
  };
  const answer = async (req, res) => {
    const ctx = await context(req, "provider");
    checkKeys(req.body, ["answer", "expectedRevision"]);
    pendingQuote(ctx.booking, req.params.quoteId);
    const text = requiredText(req.body.answer, "Answer", 3, 2000);
    const result = await mutate(req, ctx, "provider", (next, now) => {
      const quote = pendingQuote(next, req.params.quoteId),
        item = quote.clarifications.find(
          (value) => value.id === req.params.questionId,
        );
      if (!item) fail(404, "Quotation question not found.", "NOT_FOUND");
      if (item.answer)
        fail(
          409,
          "This question has already been answered.",
          "STALE_QUOTATION",
        );
      item.answer = text;
      item.answeredAt = now;
      item.answeredBy = req.user.uid;
      changeStatus(
        next,
        req,
        "provider",
        "clarification_answered",
        next.status,
        now,
        text.slice(0, 1000),
        { quotationId: quote.id, clarificationId: item.id },
      );
      return next;
    });
    res.json({ booking: result });
  };
  const cancel = async (req, res) => {
    const ctx = await context(req, "customer");
    checkKeys(req.body, ["note", "expectedRevision"]);
    if (!CUSTOMER_CANCELLABLE.includes(workflowStatus(ctx.booking)))
      fail(
        409,
        "Self-service cancellation is only available before quotation approval.",
        "INVALID_TRANSITION",
      );
    const note = noteText(req.body.note, true);
    const result = await mutate(req, ctx, "customer", (next, now) => {
      const quote = currentQuote(next);
      if (quote?.status === "sent") {
        quote.status = "withdrawn";
        quote.withdrawnAt = now;
      }
      changeStatus(
        next,
        req,
        "customer",
        "booking_cancelled",
        "cancelled",
        now,
        note,
      );
      return next;
    });
    res.json({ booking: result });
  };
  return {
    read,
    transition,
    diagnosis,
    quotation,
    decision,
    clarification,
    answer,
    cancel,
  };
};
module.exports = { createWorkflow, initialRepair };
