const { createHash } = require("node:crypto");
const { fail, idValue } = require("./domain");

const literal = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const input = (query, keys) => {
  for (const [key, value] of Object.entries(query))
    if (!keys.includes(key) || typeof value !== "string")
      fail(400, "Unsupported list filter.", "VALIDATION_ERROR");
  if (query.limit && !/^([1-9]|[1-9]\d|100)$/.test(query.limit))
    fail(400, "Page size must be 1–100.", "VALIDATION_ERROR");
  if ((query.q || "").length > 80 || (query.area || "").length > 120)
    fail(400, "The search is too long.", "VALIDATION_ERROR");
};
const search = (q, fields) => q?.trim()
  ? { $or: fields.map((field) => ({ [field]: new RegExp(literal(q.trim()), "i") })) }
  : {};

// Scan bounded batches so moderation/role checks happen before results leave
// the server, without materializing the catalogue or a booking collection.
const listPage = async ({ collection, filter, query, scope, visible = async (rows) => rows, price = false, prefix = [] }) => {
  const limit = Number(query.limit || 12);
  const sort = query.sort || "newest";
  if (!["newest", "low", "high"].includes(sort) || (!price && sort !== "newest"))
    fail(400, "Choose a valid sort order.", "VALIDATION_ERROR");
  const signature = createHash("sha256").update(JSON.stringify([scope, filter, sort, query.maxPrice || ""], (_, value) => value instanceof RegExp ? String(value) : value)).digest("hex").slice(0, 24);
  const direction = sort === "low" ? 1 : -1;
  const key = sort === "newest" ? "listDate" : "listPrice";
  let after = null;
  if (query.cursor) {
    try {
      if (!/^[\w-]{1,700}$/.test(query.cursor)) throw Error();
      const cursor = JSON.parse(Buffer.from(query.cursor, "base64url"));
      if (cursor.scope !== signature || typeof cursor.value !== "number" || !Number.isFinite(cursor.value) || ![0, 1].includes(cursor.missing)) throw Error();
      after = { id: idValue(cursor.id), value: cursor.value, missing: cursor.missing };
    } catch { fail(400, "This page cursor is invalid. Reset the filters.", "INVALID_CURSOR"); }
  }
  const cursorFor = (row) => Buffer.from(JSON.stringify({ scope: signature, id: String(row._id), value: row[key], missing: row.listMissing })).toString("base64url");
  const items = [];
  let lastScanned = null, exhausted = false;
  for (let scanned = 0; scanned < 1000 && items.length <= limit;) {
    const boundary = after ? { $or: [
      { listMissing: { $gt: after.missing } },
      { listMissing: after.missing, [key]: { [direction === 1 ? "$gt" : "$lt"]: after.value } },
      { listMissing: after.missing, [key]: after.value, _id: { $lt: after.id } },
    ] } : {};
    const batchSize = Math.min(100, limit + 1 - items.length);
    const rows = await collection.aggregate([
      ...prefix,
      { $match: filter },
      { $set: {
        listDate: { $convert: { input: { $convert: { input: { $ifNull: ["$createdAt", "$_id"] }, to: "date", onError: null, onNull: null } }, to: "long", onError: 0, onNull: 0 } },
        listPrice: { $convert: { input: "$price", to: "double", onError: null, onNull: null } },
      } },
      { $set: { listPrice: { $cond: [{ $and: [
        { $in: [{ $type: "$price" }, ["string", "int", "long", "double"]] },
        { $gte: ["$listPrice", 0] }, { $lte: ["$listPrice", 1000000] },
        { $lte: [{ $abs: { $subtract: [{ $multiply: ["$listPrice", 100] }, { $round: [{ $multiply: ["$listPrice", 100] }, 0] }] } }, 0.00001] },
      ] }, { $round: ["$listPrice", 2] }, null] } } },
      ...(query.maxPrice ? [{ $match: { listPrice: { $ne: null, $gte: 0, $lte: Number(query.maxPrice) } } }] : []),
      { $set: { listMissing: sort === "newest" ? 0 : { $cond: [{ $eq: ["$listPrice", null] }, 1, 0] }, listPrice: { $ifNull: ["$listPrice", 0] } } },
      { $match: boundary },
      { $sort: { listMissing: 1, [key]: direction, _id: -1 } },
      { $limit: batchSize },
    ], { maxTimeMS: 5000 }).toArray();
    if (!rows.length) { exhausted = true; break; }
    scanned += rows.length;
    items.push(...await visible(rows));
    lastScanned = rows.at(-1);
    after = { id: lastScanned._id, value: lastScanned[key], missing: lastScanned.listMissing };
    if (rows.length < batchSize) { exhausted = true; break; }
  }
  const more = items.length > limit;
  return { items: items.slice(0, limit), limit, nextCursor: more ? cursorFor(items[limit - 1]) : !exhausted && lastScanned ? cursorFor(lastScanned) : null };
};
const catalogueFilter = (query) => {
  input(query, ["paged", "limit", "cursor", "q", "area", "category", "sort", "maxPrice"]);
  if (query.maxPrice !== undefined && (!/^\d+(\.\d{1,2})?$/.test(query.maxPrice) || !Number.isFinite(Number(query.maxPrice))))
    fail(400, "Choose a valid maximum price.", "VALIDATION_ERROR");
  return { deletedAt: null, ...search(query.q, ["name", "description", "categoryLabel"]),
    ...(query.area ? { area: new RegExp(`^${literal(query.area.trim())}$`, "i") } : {}),
    ...(query.category ? { categoryId: String(idValue(query.category)) } : {}),
  };
};
module.exports = { listPage, catalogueFilter, input, search };
