const { technicianId } = require("./identities");
const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");

class HttpError extends Error {
  constructor(status, message, code, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
const fail = (status, message, code, fields) => {
  throw new HttpError(status, message, code, fields);
};
const objectBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(400, "Send a valid request object.", "INVALID_INPUT");
};
const checkKeys = (body, allowed) => {
  objectBody(body);
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    fail(400, "The request contains unsupported fields.", "INVALID_INPUT");
};
const validId = (value) =>
  typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
const idValue = (value) => {
  if (!validId(value)) fail(400, "Invalid record ID.", "INVALID_ID");
  return new ObjectId(value);
};
const priceValue = (value) => {
  if (
    !["string", "number"].includes(typeof value) ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const price = Number(value);
  return Number.isFinite(price) &&
    price >= 0 &&
    price <= 1000000 &&
    Math.abs(price * 100 - Math.round(price * 100)) <= 0.00001
    ? Math.round(price * 100) / 100
    : null;
};
const photoUrl = (value) => {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password
      ? value.trim()
      : null;
  } catch {
    return null;
  }
};
const validateService = (body) => {
  const fields = {};
  for (const [field, min, max] of [
    ["name", 2, 120],
    ["area", 2, 160],
    ["description", 10, 5000],
  ]) {
    if (
      typeof body[field] !== "string" ||
      body[field].trim().length < min ||
      body[field].trim().length > max
    )
      fields[field] = `Use ${min}–${max} characters.`;
  }
  if (priceValue(body.price) === null)
    fields.price =
      "Enter an amount from 0 to 1,000,000 with up to 2 decimal places.";
  if (!photoUrl(body.image))
    fields.image = "Use a valid http or https image URL without credentials.";
  if (Object.keys(fields).length)
    fail(
      400,
      "Check the service details and try again.",
      "VALIDATION_ERROR",
      fields,
    );
  return {
    name: body.name.trim(),
    area: body.area.trim(),
    description: body.description.trim(),
    image: body.image.trim(),
    price: priceValue(body.price),
  };
};
const todayInDhaka = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
const serviceOwner = (service, user) =>
  service &&
  service.providerEmail === user.email &&
  (!service.providerUid || service.providerUid === user.uid);
const ownerQuery = (user) => ({
  providerEmail: user.email,
  $or: [{ providerUid: user.uid }, { providerUid: { $in: [null, ""] } }],
});
const customerQuery = (user) => ({
  userEmail: user.email,
  $or: [{ userUid: user.uid }, { userUid: { $in: [null, ""] } }],
});
const {
  STATUSES: statuses,
  workflowStatus: statusValue,
  workflowSummary,
} = require("./workflow-model");
const text = (value, fallback = "") =>
  typeof value === "string" ? value : fallback;
const serializeService = (service) => ({
  _id: service._id,
  categoryId:
    typeof service.categoryId === "string" ? service.categoryId : null,
  categoryLabel:
    typeof service.categoryLabel === "string"
      ? service.categoryLabel
      : "Uncategorized",
  technicianId: technicianId(
    typeof service.providerEmail === "string" ? service.providerEmail : "",
  ),
  name: text(service.name, "Repair service"),
  description: text(service.description),
  area: text(service.area),
  image: photoUrl(service.image),
  price: priceValue(service.price),
  providerName: text(service.providerName, "Service provider"),
  providerEmail: text(service.providerEmail),
  providerPhoto:
    photoUrl(service.providerPhoto) || photoUrl(service.providerImage),
  createdAt: service.createdAt,
  bookable:
    !service.deletedAt &&
    priceValue(service.price) !== null &&
    typeof service.providerEmail === "string" &&
    !!service.providerEmail &&
    typeof service.name === "string" &&
    !!service.name.trim(),
});
const serializeBooking = (booking) => ({
  ...workflowSummary(booking),
  appointment:
    booking.appointment?.startsAt instanceof Date ? booking.appointment : null,
  _id: booking._id,
  serviceId:
    booking.serviceId instanceof ObjectId
      ? String(booking.serviceId)
      : text(booking.serviceId),
  serviceName: text(booking.serviceName, "Repair service"),
  serviceImage: photoUrl(booking.serviceImage),
  providerName: text(booking.providerName, "Service provider"),
  providerEmail: text(booking.providerEmail),
  userName: text(booking.userName),
  userEmail: text(booking.userEmail),
  date: text(booking.date),
  instruction: text(booking.instruction),
  deviceType: text(booking.deviceType),
  deviceBrand: text(booking.deviceBrand),
  deviceModel: text(booking.deviceModel),
  price: priceValue(booking.price),
  status: statusValue(booking),
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
});
const bookingId = (user, serviceId, date) =>
  new ObjectId(
    createHash("sha256")
      .update(
        JSON.stringify([
          "booking-v1",
          user.uid,
          String(serviceId).toLowerCase(),
          date,
        ]),
      )
      .digest("hex")
      .slice(0, 24),
  );
module.exports = {
  HttpError,
  fail,
  checkKeys,
  idValue,
  validId,
  priceValue,
  photoUrl,
  validateService,
  todayInDhaka,
  validDate,
  serviceOwner,
  ownerQuery,
  customerQuery,
  statuses,
  serializeService,
  serializeBooking,
  bookingId,
};
