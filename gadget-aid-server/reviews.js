const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");
const { fail, checkKeys, idValue, serviceOwner } = require("./domain");
const { hasWorkflow, workflowStatus } = require("./workflow-model");
const { technicianId, runTransaction } = require("./technicians");
const hash = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24);
const customerOwner = (booking, user) =>
  booking.userEmail === user.email &&
  (!booking.userUid || booking.userUid === user.uid);
const completionVerified = (booking, service) =>
  hasWorkflow(booking) &&
  workflowStatus(booking) === "completed" &&
  booking.repair.events.some(
    (e) =>
      e.status === "completed" &&
      e.type === "status_changed" &&
      e.actor?.role === "provider" &&
      e.createdAt instanceof Date &&
      (!service.providerUid || e.actor.uid === service.providerUid),
  );
const publicReview = (row) => ({
  _id: String(row._id),
  rating: row.rating,
  feedback: row.feedback,
  reviewerLabel: "Verified completed booking",
  serviceName: row.serviceName,
  createdAt: row.createdAt,
  response: row.response
    ? { text: row.response.text, createdAt: row.response.createdAt }
    : null,
});
const visibleReviews = async (db, id) => {
  const rows = await db.reviews
      .find({ technicianId: id, moderationState: "published" })
      .toArray(),
    valid = [];
  for (const row of rows) {
    if (
      row.reviewVersion !== 1 ||
      !(row.createdAt instanceof Date) ||
      String(row._id) !== hash(`review-v1:${row.bookingId}`) ||
      !Number.isInteger(row.rating) ||
      row.rating < 1 ||
      row.rating > 5
    )
      continue;
    const booking = await db.bookings.findOne({ _id: idValue(row.bookingId) });
    if (!booking) continue;
    let service;
    try {
      service = await db.services.findOne({
        _id: idValue(String(booking.serviceId)),
      });
    } catch {
      continue;
    }
    if (
      !service ||
      technicianId(service.providerEmail) !== id ||
      row.providerUid !== (service.providerUid || null) ||
      !completionVerified(booking, service) ||
      row.customerEmail !== booking.userEmail ||
      (booking.userUid && row.customerUid !== booking.userUid) ||
      row.customerEmail === service.providerEmail
    )
      continue;
    valid.push(row);
  }
  return valid.sort(
    (a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt) ||
      String(b._id).localeCompare(String(a._id)),
  );
};
const moderateReview = async (
  db,
  { reviewId, action, reason, actor },
  now = new Date(),
) => {
  if (
    !["hide", "restore"].includes(action) ||
    typeof reason !== "string" ||
    reason.trim().length < 10 ||
    reason.length > 1000 ||
    typeof actor !== "string" ||
    actor.trim().length < 3 ||
    actor.length > 120
  )
    fail(
      400,
      "An operator, action and specific moderation reason are required.",
      "VALIDATION_ERROR",
    );
  return runTransaction(db, async (tx) => {
    const row = await tx.reviews.findOne({ _id: idValue(reviewId) });
    if (!row) fail(404, "Review not found.", "NOT_FOUND");
    const history = row.moderationHistory || [];
    if (history.length >= 50)
      fail(
        409,
        "Moderation history requires a separate review.",
        "MODERATION_LIMIT",
      );
    const state = action === "hide" ? "hidden" : "published";
    const result = await tx.reviews.updateOne(
      { _id: row._id, revision: row.revision },
      {
        $set: {
          moderationState: state,
          revision: row.revision + 1,
          moderationHistory: [
            ...history,
            {
              action,
              reason: reason.trim(),
              actor: actor.trim(),
              createdAt: now,
            },
          ],
        },
      },
    );
    if (!result.matchedCount)
      fail(409, "Review changed. Retry after inspecting it.", "STALE_REVIEW");
    const reports = await tx.reviewReports
      .find({ reviewId: String(row._id), state: "pending" })
      .toArray();
    for (const report of reports)
      await tx.reviewReports.updateOne(
        { _id: report._id, state: "pending" },
        {
          $set: {
            state: "resolved",
            resolution: action,
            resolutionReason: reason.trim(),
            resolvedAt: now,
            operator: actor.trim(),
          },
        },
      );
    return { reviewId: String(row._id), moderationState: state };
  });
};
const createReviews = ({ collections, clock }) => {
  const database = async () => {
    const db = await collections();
    if (!db.reviews || !db.reviewReports)
      fail(503, "Reviews are unavailable.", "SERVICE_UNAVAILABLE");
    return db;
  };
  const context = async (req) => {
    const db = await database(),
      booking = await db.bookings.findOne({ _id: idValue(req.params.id) });
    if (!booking) fail(404, "Booking not found.", "NOT_FOUND");
    let service = null;
    try {
      service = await db.services.findOne({
        _id: idValue(String(booking.serviceId)),
      });
    } catch (error) {
      if (error.status !== 400) throw error;
    }
    const customer = customerOwner(booking, req.user),
      provider = !!serviceOwner(service, req.user);
    if (!customer && !provider)
      fail(403, "You cannot access this booking review.", "FORBIDDEN");
    return { db, booking, service, customer, provider };
  };
  const eligibility = (ctx) =>
    ctx.customer &&
    ctx.service &&
    ctx.booking.userEmail !== ctx.service.providerEmail &&
    completionVerified(ctx.booking, ctx.service);
  const own = async (req, res) => {
    const ctx = await context(req),
      review = await ctx.db.reviews.findOne({
        _id: new ObjectId(hash(`review-v1:${ctx.booking._id}`)),
      });
    res.json({
      eligible: !!eligibility(ctx) && !review,
      reason: review
        ? "A review was already submitted for this booking."
        : eligibility(ctx)
          ? ""
          : "Reviews require a verified completed handover by another provider.",
      review: review
        ? { ...publicReview(review), moderationState: review.moderationState }
        : null,
      technicianId: ctx.service
        ? technicianId(ctx.service.providerEmail)
        : null,
    });
  };
  const create = async (req, res) => {
    checkKeys(req.body, ["rating", "feedback"]);
    const { rating, feedback } = req.body;
    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      typeof feedback !== "string" ||
      feedback.trim().length < 20 ||
      feedback.trim().length > 2000
    )
      fail(
        400,
        "Choose 1–5 stars and write 20–2,000 characters.",
        "VALIDATION_ERROR",
      );
    const ctx = await context(req);
    if (!eligibility(ctx))
      fail(
        403,
        "Only the customer of a verified completed repair can review it.",
        "REVIEW_NOT_ELIGIBLE",
      );
    const record = {
      _id: new ObjectId(hash(`review-v1:${ctx.booking._id}`)),
      reviewVersion: 1,
      bookingId: String(ctx.booking._id),
      technicianId: technicianId(ctx.service.providerEmail),
      providerUid: ctx.service.providerUid || null,
      customerUid: req.user.uid,
      customerEmail: req.user.email,
      serviceName:
        typeof ctx.booking.serviceName === "string"
          ? ctx.booking.serviceName
          : "Repair service",
      rating,
      feedback: feedback.trim(),
      response: null,
      createdAt: clock(),
      moderationState: "published",
      moderationHistory: [],
      revision: 0,
    };
    try {
      await ctx.db.reviews.insertOne(record);
    } catch (error) {
      if (error.code === 11000)
        fail(409, "This booking already has a review.", "REVIEW_EXISTS");
      throw error;
    }
    res.status(201).json(publicReview(record));
  };
  const list = async (req, res) => {
    const id = String(idValue(req.params.id)),
      db = await database(),
      reviews = await visibleReviews(db, id);
    res.json(reviews.map(publicReview));
  };
  const response = async (req, res) => {
    checkKeys(req.body, ["text"]);
    if (
      typeof req.body.text !== "string" ||
      req.body.text.trim().length < 3 ||
      req.body.text.length > 2000
    )
      fail(400, "Use 3–2,000 characters for the response.", "VALIDATION_ERROR");
    const db = await database(),
      row = await db.reviews.findOne({ _id: idValue(req.params.id) });
    if (!row) fail(404, "Review not found.", "NOT_FOUND");
    const booking = await db.bookings.findOne({ _id: idValue(row.bookingId) }),
      service = booking
        ? await db.services.findOne({ _id: idValue(String(booking.serviceId)) })
        : null;
    if (!serviceOwner(service, req.user))
      fail(403, "You cannot respond to this review.", "FORBIDDEN");
    if (row.moderationState !== "published")
      fail(409, "This review is under moderation.", "REVIEW_UNAVAILABLE");
    if (row.response)
      fail(
        409,
        "This review already has a provider response.",
        "RESPONSE_EXISTS",
      );
    const value = {
      text: req.body.text.trim(),
      createdAt: clock(),
      actorUid: req.user.uid,
    };
    const result = await db.reviews.updateOne(
      { _id: row._id, response: null, revision: row.revision },
      { $set: { response: value, revision: row.revision + 1 } },
    );
    if (!result.matchedCount)
      fail(
        409,
        "This review changed. Refresh before responding.",
        "STALE_REVIEW",
      );
    res.json(publicReview({ ...row, response: value }));
  };
  const report = async (req, res) => {
    checkKeys(req.body, ["category", "details"]);
    if (
      !["abuse", "privacy", "spam", "authenticity", "other"].includes(
        req.body.category,
      ) ||
      typeof req.body.details !== "string" ||
      req.body.details.trim().length < 10 ||
      req.body.details.trim().length > 1000
    )
      fail(
        400,
        "Choose a report reason and provide 10–1,000 characters.",
        "VALIDATION_ERROR",
      );
    const db = await database(),
      row = await db.reviews.findOne({ _id: idValue(req.params.id) });
    if (!row || row.moderationState !== "published")
      fail(404, "Published review not found.", "NOT_FOUND");
    const record = {
      _id: new ObjectId(hash(`review-report-v1:${row._id}:${req.user.uid}`)),
      reviewId: String(row._id),
      reporterUid: req.user.uid,
      category: req.body.category,
      details: req.body.details.trim(),
      state: "pending",
      createdAt: clock(),
    };
    try {
      await db.reviewReports.insertOne(record);
    } catch (error) {
      if (error.code === 11000)
        return res.json({ acknowledged: true, state: "already_reported" });
      throw error;
    }
    res.status(201).json({ acknowledged: true, state: "pending" });
  };
  return { own, create, list, response, report };
};
module.exports = {
  publicReview,
  createReviews,
  visibleReviews,
  completionVerified,
  moderateReview,
};
