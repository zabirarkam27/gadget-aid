const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");
const { fail, checkKeys, idValue, serviceOwner } = require("./domain");
const { pageDocs, queryFilter } = require("./pagination");
const createDisputes = ({ collections, clock }) => {
  const context = async (req) => {
    const db = await collections(),
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
    const customer =
        booking.userEmail === req.user.email &&
        (!booking.userUid || booking.userUid === req.user.uid),
      provider = serviceOwner(service, req.user);
    if (!customer && !provider)
      fail(403, "You cannot open a dispute for this booking.", "FORBIDDEN");
    return { db, booking, role: customer ? "customer" : "provider" };
  };
  const view = (row) => ({
    _id: String(row._id),
    bookingId: row.bookingId,
    subject: row.subject,
    description: row.description,
    state: row.state,
    resolution: row.resolution,
    revision: row.revision,
    createdAt: row.createdAt,
    history: row.history.map((event) => ({
      state: event.state,
      actorRole: event.actorRole,
      note: event.note,
      createdAt: event.createdAt,
    })),
  });
  const create = async (req, res) => {
    checkKeys(req.body, ["subject", "description"]);
    if (
      typeof req.body.subject !== "string" ||
      req.body.subject.trim().length < 5 ||
      req.body.subject.length > 160 ||
      typeof req.body.description !== "string" ||
      req.body.description.trim().length < 20 ||
      req.body.description.length > 4000
    )
      fail(
        400,
        "Use a 5–160 character subject and 20–4,000 character description.",
        "VALIDATION_ERROR",
      );
    const { db, booking, role } = await context(req);
    const row = {
      _id: new ObjectId(
        createHash("sha256")
          .update(`dispute-v1:${booking._id}:${req.user.uid}`)
          .digest("hex")
          .slice(0, 24),
      ),
      bookingId: String(booking._id),
      reporterUid: req.user.uid,
      subject: req.body.subject.trim(),
      description: req.body.description.trim(),
      state: "open",
      resolution: "",
      revision: 0,
      createdAt: clock(),
      updatedAt: clock(),
      history: [
        {
          state: "open",
          actorRole: role,
          actorUid: req.user.uid,
          note: "Dispute submitted.",
          createdAt: clock(),
        },
      ],
    };
    try {
      await db.disputes.insertOne(row);
    } catch (error) {
      if (error.code === 11000)
        fail(
          409,
          "You already have a dispute for this booking. Follow its status here.",
          "DISPUTE_EXISTS",
        );
      throw error;
    }
    res.status(201).json(view(row));
  };
  const bookingList = async (req, res) => {
    const { db, booking } = await context(req);
    res.json(
      (
        await db.disputes
          .find({ bookingId: String(booking._id), reporterUid: req.user.uid })
          .toArray()
      ).map(view),
    );
  };
  const mine = async (req, res) => {
    const db = await collections();
    const filter = queryFilter(req.query, {
      states: ["open", "in_review", "resolved"],
    });
    filter.reporterUid = req.user.uid;
    const page = await pageDocs(db.disputes, filter, req.query, {
      scope: `my-disputes:${req.user.uid}`,
    });
    res.json({ ...page, items: page.items.map(view) });
  };
  return { create, bookingList, mine };
};
module.exports = { createDisputes };
