const { assertBookable, visibleServices } = require("./access");
const { technicianId } = require("./identities");
const { ObjectId } = require("mongodb");
const {
  fail,
  checkKeys,
  idValue,
  photoUrl,
  validDate,
  todayInDhaka,
  serviceOwner,
} = require("./domain");
const defaultAvailability = () => ({
  configured: false,
  mode: "requests",
  weekly: Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: true,
    start: "09:00",
    end: "17:00",
  })),
  exceptions: [],
  timeZone: "Asia/Dhaka",
  slotMinutes: 60,
});
const text = (value, min, max, label) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `Check ${label}.`, "VALIDATION_ERROR");
  return value.trim();
};
const list = (value, max, length, label) => {
  if (!Array.isArray(value) || value.length > max)
    fail(400, `Check ${label}.`, "VALIDATION_ERROR");
  const result = value.map((v) => text(v, 2, length, label));
  if (new Set(result).size !== result.length)
    fail(400, `Remove duplicate ${label}.`, "VALIDATION_ERROR");
  return result;
};
const timeMinutes = (value) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):00$/.test(value)
    ? Number(value.slice(0, 2)) * 60
    : value === "24:00"
      ? 1440
      : null;
const windowValue = (row) => {
  checkKeys(row, ["day", "date", "closed", "start", "end"]);
  if (typeof row.closed !== "boolean")
    fail(400, "Choose open or closed hours.", "VALIDATION_ERROR");
  const start = timeMinutes(row.start),
    end = timeMinutes(row.end);
  if (start === null || end === null || start >= end || start === 1440)
    fail(
      400,
      "Use whole-hour opening and closing times, with closing after opening.",
      "VALIDATION_ERROR",
    );
  return { closed: row.closed, start: row.start, end: row.end };
};
const validateAvailability = (value) => {
  checkKeys(value, ["configured", "mode", "weekly", "exceptions"]);
  if (
    typeof value.configured !== "boolean" ||
    !["requests", "appointments"].includes(value.mode) ||
    !Array.isArray(value.weekly) ||
    value.weekly.length !== 7 ||
    !Array.isArray(value.exceptions) ||
    value.exceptions.length > 60
  )
    fail(
      400,
      "Check the weekly schedule and up to 60 date exceptions.",
      "VALIDATION_ERROR",
    );
  const weekly = value.weekly.map((row) => {
    if (!Number.isInteger(row.day) || row.day < 0 || row.day > 6)
      fail(400, "Choose a valid weekday.", "VALIDATION_ERROR");
    return { day: row.day, ...windowValue(row) };
  });
  if (new Set(weekly.map((r) => r.day)).size !== 7)
    fail(400, "Include each weekday once.", "VALIDATION_ERROR");
  const exceptions = value.exceptions.map((row) => {
    if (!validDate(row.date))
      fail(400, "Use valid exception dates.", "VALIDATION_ERROR");
    return { date: row.date, ...windowValue(row) };
  });
  if (new Set(exceptions.map((r) => r.date)).size !== exceptions.length)
    fail(400, "Use each exception date once.", "VALIDATION_ERROR");
  return {
    configured: value.configured,
    mode: value.mode,
    weekly: weekly.sort((a, b) => a.day - b.day),
    exceptions: exceptions.sort((a, b) => a.date.localeCompare(b.date)),
    timeZone: "Asia/Dhaka",
    slotMinutes: 60,
  };
};
const windowFor = (availability, date) =>
  availability.exceptions.find((row) => row.date === date) ||
  availability.weekly.find(
    (row) => row.day === new Date(`${date}T12:00:00+06:00`).getUTCDay(),
  );
// Bangladesh's local weekday is the same as this noon UTC date's weekday.
const startFor = (date, time) => new Date(`${date}T${time}:00+06:00`);
const within = (availability, date, time) => {
  const row = windowFor(availability, date),
    minute = timeMinutes(time);
  return (
    !!row &&
    !row.closed &&
    minute !== null &&
    minute >= timeMinutes(row.start) &&
    minute + 60 <= timeMinutes(row.end)
  );
};
const profileMatches = (profile, service) =>
  profile &&
  profile.ownerEmail === service.providerEmail &&
  (!service.providerUid || profile.ownerUid === service.providerUid);
const runTransaction = (db, work) => {
  if (typeof db.transaction !== "function")
    fail(
      503,
      "Scheduling needs a transaction-capable database. Please retry later.",
      "SERVICE_UNAVAILABLE",
    );
  return db.transaction(work);
};
const reserveBooking = async (db, record, service, time, clock) =>
  runTransaction(db, async (tx) => {
    const now = clock();
    if (await tx.bookings.findOne({ _id: record._id }))
      throw Object.assign(new Error("Duplicate booking."), { code: 11000 });
    if (record.date < todayInDhaka(now))
      fail(
        400,
        "Choose today or a future date in Bangladesh time.",
        "VALIDATION_ERROR",
      );
    const fresh = await tx.services.findOne({
      _id: service._id,
      deletedAt: null,
    });
    if (!fresh) fail(404, "Service is no longer available.", "NOT_FOUND");
    if (
      fresh.providerEmail !== service.providerEmail ||
      fresh.providerUid !== service.providerUid
    )
      fail(
        409,
        "The service changed. Reload before booking.",
        "INVALID_SERVICE_SNAPSHOT",
      );
    if (
      ["name", "price", "image", "providerName", "area"].some(
        (key) => fresh[key] !== service[key],
      )
    )
      fail(
        409,
        "This service changed. Reload before booking.",
        "INVALID_SERVICE_SNAPSHOT",
      );
    await assertBookable(tx, fresh);
    const key = technicianId(fresh.providerEmail),
      profile = await tx.technicians.findOne({ _id: new ObjectId(key) });
    if (profile && !profileMatches(profile, fresh))
      fail(
        409,
        "The provider profile requires an ownership review.",
        "SERVICE_UNAVAILABLE",
      );
    const availability = profileMatches(profile, fresh)
      ? profile.availability
      : defaultAvailability();
    if (availability.configured) {
      const horizon = new Date(`${todayInDhaka(now)}T00:00:00+06:00`);
      horizon.setUTCDate(horizon.getUTCDate() + 90);
      if (record.date > todayInDhaka(horizon))
        fail(
          400,
          "Bookings are available up to 90 days ahead.",
          "VALIDATION_ERROR",
        );
      const window = windowFor(availability, record.date);
      if (!window || window.closed)
        fail(409, "The provider is closed on this date.", "PROVIDER_CLOSED");
    }
    if (availability.configured && availability.mode === "appointments") {
      if (!within(availability, record.date, time) || time === "24:00")
        fail(409, "Choose an available appointment time.", "SLOT_REQUIRED");
      const startsAt = startFor(record.date, time),
        endsAt = new Date(startsAt.getTime() + 3600000);
      if (startsAt <= now)
        fail(409, "This appointment time has passed.", "SLOT_UNAVAILABLE");
      const reservations = (profile.reservations || []).filter(
        (row) => new Date(row.endsAt) > now,
      );
      if (
        reservations.some(
          (row) => row.date === record.date && row.time === time,
        )
      )
        fail(
          409,
          "This time was just reserved. Choose another slot.",
          "SLOT_UNAVAILABLE",
        );
      if (reservations.length >= 500)
        fail(
          409,
          "This provider's appointment calendar is full.",
          "CALENDAR_LIMIT",
        );
      record.appointment = {
        technicianId: key,
        date: record.date,
        time,
        timeZone: "Asia/Dhaka",
        startsAt,
        endsAt,
        durationMinutes: 60,
      };
      reservations.push({
        bookingId: String(record._id),
        date: record.date,
        time,
        startsAt,
        endsAt,
      });
      const result = await tx.technicians.updateOne(
        { _id: profile._id, revision: profile.revision },
        { $set: { reservations, revision: profile.revision + 1 } },
      );
      if (!result.matchedCount)
        fail(
          409,
          "Availability changed. Refresh the appointment times.",
          "STALE_PROFILE",
        );
    } else {
      if (time !== undefined && time !== "")
        fail(
          400,
          "This provider accepts date requests rather than reserved times.",
          "INVALID_INPUT",
        );
      delete record.appointment;
    }
    // Touch the canonical listing so removal cannot race a committed reservation.
    const guard = await tx.services.updateOne(
      { _id: service._id, deletedAt: null },
      { $set: { lastBookedAt: now, lastBookingId: String(record._id) } },
    );
    if (!guard.matchedCount)
      fail(
        409,
        "This service changed. Reload before booking.",
        "SERVICE_UNAVAILABLE",
      );
    await tx.bookings.insertOne(record);
  });
const releaseReservation = async (db, booking) => {
  if (!booking.appointment) return;
  const profile = await db.technicians.findOne({
    _id: idValue(booking.appointment.technicianId),
  });
  if (!profile) return;
  const result = await db.technicians.updateOne(
    { _id: profile._id, revision: profile.revision },
    {
      $set: {
        reservations: (profile.reservations || []).filter(
          (row) => row.bookingId !== String(booking._id),
        ),
        revision: profile.revision + 1,
      },
    },
  );
  if (!result.matchedCount)
    fail(
      409,
      "The calendar changed. Refresh before cancelling.",
      "STALE_PROFILE",
    );
};
const publicProfile = (profile) => ({
  _id: String(profile._id),
  businessName: profile.businessName,
  photo: profile.photo,
  bio: profile.bio,
  skills: profile.skills,
  categories: profile.categories,
  area: profile.area,
  yearsExperience: profile.yearsExperience,
  certifications: profile.certifications,
  claimsVerified: false,
  availability: profile.availability,
});
const createTechnicians = ({ collections, clock }) => {
  const database = async () => {
    const db = await collections();
    if (!db.technicians || !db.reviews)
      fail(503, "Technician profiles are unavailable.", "SERVICE_UNAVAILABLE");
    return db;
  };
  const fallback = (id, user) => ({
    _id: new ObjectId(id),
    ownerUid: user.uid || null,
    ownerEmail: user.email,
    businessName:
      typeof user.name === "string" && user.name.trim()
        ? user.name
        : "Service provider",
    photo: photoUrl(user.photo),
    bio: "",
    skills: [],
    categories: [],
    area: "",
    yearsExperience: null,
    certifications: [],
    availability: defaultAvailability(),
    reservations: [],
    revision: 0,
  });
  const self = async (req, res) => {
    const db = await database(),
      id = technicianId(req.user.email),
      profile = await db.technicians.findOne({ _id: new ObjectId(id) });
    if (
      profile &&
      (profile.ownerUid !== req.user.uid ||
        profile.ownerEmail !== req.user.email)
    )
      fail(403, "This profile requires an ownership review.", "FORBIDDEN");
    const value = profile || fallback(id, req.user);
    res.json({
      ...publicProfile(value),
      revision: value.revision,
      exists: !!profile,
    });
  };
  const save = async (req, res) => {
    checkKeys(req.body, [
      "businessName",
      "photo",
      "bio",
      "skills",
      "categories",
      "area",
      "yearsExperience",
      "certifications",
      "availability",
      "expectedRevision",
    ]);
    const b = req.body;
    const fields = {
      businessName: text(b.businessName, 2, 120, "business name"),
      photo: b.photo === "" ? null : photoUrl(b.photo),
      bio: text(b.bio, 0, 2000, "bio"),
      skills: list(b.skills, 20, 80, "skills"),
      categories: list(b.categories, 12, 80, "categories"),
      area: text(b.area, 0, 160, "service area"),
      yearsExperience: b.yearsExperience,
      certifications: list(b.certifications, 10, 160, "certifications"),
      availability: validateAvailability(b.availability),
    };
    if (
      (b.photo !== "" && b.photo !== null && !fields.photo) ||
      (b.yearsExperience !== null &&
        (!Number.isInteger(b.yearsExperience) ||
          b.yearsExperience < 0 ||
          b.yearsExperience > 80))
    )
      fail(
        400,
        "Check the photo URL and experience in years.",
        "VALIDATION_ERROR",
      );
    if (!Number.isSafeInteger(b.expectedRevision) || b.expectedRevision < 0)
      fail(400, "Refresh the profile before saving.", "VALIDATION_ERROR");
    const db = await database(),
      id = new ObjectId(technicianId(req.user.email));
    const result = await runTransaction(db, async (tx) => {
      const old = await tx.technicians.findOne({ _id: id });
      if (
        old &&
        (old.ownerUid !== req.user.uid || old.ownerEmail !== req.user.email)
      )
        fail(403, "You cannot change this profile.", "FORBIDDEN");
      if ((old?.revision || 0) !== b.expectedRevision)
        fail(
          409,
          "This profile or calendar changed. Reload before saving.",
          "STALE_PROFILE",
        );
      const now = clock(),
        reservations = (old?.reservations || []).filter(
          (row) => new Date(row.endsAt) > now,
        );
      if (
        reservations.some(
          (row) =>
            !fields.availability.configured ||
            fields.availability.mode !== "appointments" ||
            !within(fields.availability, row.date, row.time),
        )
      )
        fail(
          409,
          "This change conflicts with an existing appointment. Keep its hours open or cancel the booking first.",
          "AVAILABILITY_CONFLICT",
        );
      const value = {
        ...(old || fallback(String(id), req.user)),
        ...fields,
        reservations,
        revision: b.expectedRevision + 1,
        profileVersion: 1,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      };
      if (old) {
        const { _id: unchangedId, ...update } = value;
        const updated = await tx.technicians.updateOne(
          { _id: unchangedId, revision: old.revision },
          { $set: update },
        );
        if (!updated.matchedCount)
          fail(
            409,
            "The profile changed. Refresh before saving.",
            "STALE_PROFILE",
          );
      } else {
        try {
          await tx.technicians.insertOne(value);
        } catch (error) {
          if (error.code === 11000)
            fail(
              409,
              "This profile was just created. Reload it.",
              "STALE_PROFILE",
            );
          throw error;
        }
      }
      return value;
    });
    res.json({
      ...publicProfile(result),
      revision: result.revision,
      exists: true,
    });
  };
  const read = async (req, res) => {
    const id = idValue(req.params.id),
      db = await database();
    let profile = await db.technicians.findOne({ _id: id });
    require("./listings").input(req.query, ["limit", "servicesCursor", "reviewsCursor"]);
    const { visiblePage } = require("./visible-page");
    // technicianId is server-derived and backfilled by the catalogue maintenance command.
    // Canonical identity/role checks still run after the indexed lookup.
    const servicePage = await visiblePage({ collection: db.services,
      filter: { deletedAt: null, technicianId: String(id) },
      query: { limit: req.query.limit, cursor: req.query.servicesCursor }, scope: `technician-services:${id}`,
      validate: async rows => (await visibleServices(db, rows)).filter(service =>
        technicianId(service.providerEmail || "") === String(id) && (!profile || serviceOwner(service, { email: profile.ownerEmail, uid: profile.ownerUid }))),
    });
    let offered = servicePage.items;
    if (!profile) {
      if (!offered.length) fail(404, "Technician not found.", "NOT_FOUND");
      const first = offered[0];
      profile = fallback(String(id), {
        email: first.providerEmail,
        uid: first.providerUid,
        name: first.providerName,
        photo: first.providerPhoto || first.providerImage,
      });
    }
    const publication = await db.entityControls.findOne({
      _id: `technician:${id}`,
    });
    if (
      publication?.state === "restricted" ||
      publication?.accountRestricted ||
      publication?.roleRevoked
    )
      fail(404, "Technician not found.", "NOT_FOUND");
    if (profile.ownerUid) {
      const grant = await db.roleGrants.findOne({ _id: profile.ownerUid }),
        account = await db.accountControls.findOne({ _id: profile.ownerUid });
      if (account?.state === "restricted" || (grant && !grant.active))
        fail(404, "Technician not found.", "NOT_FOUND");
    }
    offered = offered.filter((service) =>
      serviceOwner(service, {
        email: profile.ownerEmail,
        uid: profile.ownerUid,
      }),
    );
    const { reviewPage, publicReview } = require("./reviews");
    const reviewSample = await reviewPage(db, String(id), {}, 100);
    const firstReviews = await reviewPage(db, String(id), { limit: req.query.limit, cursor: req.query.reviewsCursor });
    const reviews = reviewSample.items;
    const sum = reviews.reduce((n, r) => n + r.rating, 0);
    res.json({
      ...publicProfile(profile),
      publicationStatus: publication?.state || "unreviewed",
      services: offered.map((service) => {
        const value = require("./domain").serializeService(service);
        return {
          _id: value._id,
          name: value.name,
          area: value.area,
          price: value.price,
          image: value.image,
          technicianId: value.technicianId,
          bookable: value.bookable,
        };
      }),
      servicesNextCursor: servicePage.nextCursor,
      reviews: firstReviews.items.map(publicReview),
      reviewsNextCursor: firstReviews.nextCursor,
      ratingSampleSize: reviews.length,
      ratingHasMore: !!reviewSample.nextCursor,
      ratingBasis: "Up to 100 most recent verified reviews; not a lifetime total.",
      reviewCount: reviews.length,
      averageRating: reviews.length
        ? Number((sum / reviews.length).toFixed(2))
        : null,
    });
  };
  const availability = async (req, res) => {
    const id = idValue(req.params.id),
      date = req.query.date,
      db = await database();
    if (!validDate(date) || date < todayInDhaka(clock()))
      fail(
        400,
        "Choose today or a future date in Bangladesh time.",
        "VALIDATION_ERROR",
      );
    const service = await db.services.findOne({ _id: id, deletedAt: null });
    if (!service) fail(404, "Service not found.", "NOT_FOUND");
    await assertBookable(db, service);
    const profile = await db.technicians.findOne({
      _id: new ObjectId(technicianId(service.providerEmail)),
    });
    if (profile && !profileMatches(profile, service))
      fail(
        409,
        "The provider profile requires an ownership review.",
        "SERVICE_UNAVAILABLE",
      );
    const value = profileMatches(profile, service)
      ? profile.availability
      : defaultAvailability();
    const horizon = new Date(`${todayInDhaka(clock())}T00:00:00+06:00`);
    horizon.setUTCDate(horizon.getUTCDate() + 90);
    if (value.configured && date > todayInDhaka(horizon))
      fail(400, "Choose a date within 90 days.", "VALIDATION_ERROR");
    const window = value.configured ? windowFor(value, date) : null;
    const slots = [];
    if (
      value.configured &&
      value.mode === "appointments" &&
      window &&
      !window.closed
    ) {
      for (
        let minute = timeMinutes(window.start);
        minute + 60 <= timeMinutes(window.end);
        minute += 60
      ) {
        const time = `${String(minute / 60).padStart(2, "0")}:00`;
        if (
          startFor(date, time) > clock() &&
          !(profile.reservations || []).some(
            (row) => row.date === date && row.time === time,
          )
        )
          slots.push(time);
      }
    }
    res.json({
      configured: value.configured,
      mode: value.configured ? value.mode : "requests",
      timeZone: "Asia/Dhaka",
      slotMinutes: 60,
      date,
      open: !value.configured || (!!window && !window.closed),
      slots,
    });
  };
  return { self, save, read, availability };
};
module.exports = {
  technicianId,
  defaultAvailability,
  validateAvailability,
  within,
  reserveBooking,
  releaseReservation,
  runTransaction,
  createTechnicians,
};
