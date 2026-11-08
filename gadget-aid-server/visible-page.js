const { createHash } = require("node:crypto");
const { fail, idValue } = require("./domain");

// Bound database reads even when most candidates fail canonical visibility checks.
const visiblePage = async ({ collection, filter, query = {}, scope, validate, limit: defaultLimit = 12, dated = false, projection }) => {
  if (query.limit !== undefined && (typeof query.limit !== "string" || !/^([1-9]|[1-9]\d|100)$/.test(query.limit)))
    fail(400, "Page size must be 1–100.", "VALIDATION_ERROR");
  const limit = Number(query.limit || defaultLimit);
  const signature = createHash("sha256").update(JSON.stringify([scope, filter, dated])).digest("hex").slice(0, 24);
  let after;
  if (query.cursor !== undefined) {
    try {
      if (typeof query.cursor !== "string" || !/^[\w-]{1,600}$/.test(query.cursor)) throw Error();
      const value = JSON.parse(Buffer.from(query.cursor, "base64url"));
      if (value.scope !== signature) throw Error();
      after = { _id: idValue(value.id) };
      if (dated) {
        after.createdAt = new Date(value.date);
        if (typeof value.date !== "string" || !Number.isFinite(+after.createdAt)) throw Error();
      }
    } catch { fail(400, "This page cursor is invalid. Reset the list.", "INVALID_CURSOR"); }
  }
  const encode = row => Buffer.from(JSON.stringify({ scope: signature, id: String(row._id), ...(dated ? { date: row.createdAt.toISOString() } : {}) })).toString("base64url");
  const items = [];
  let scanned = 0, exhausted = false, last;
  while (scanned < 1000 && items.length <= limit) {
    const boundary = !after ? {} : dated ? { $or: [
      { createdAt: { $lt: after.createdAt } },
      { createdAt: after.createdAt, _id: { $lt: after._id } },
    ] } : { _id: { $lt: after._id } };
    const size = Math.min(100, limit + 1 - items.length, 1000 - scanned);
    const rows = await collection.find({ $and: [filter, boundary] }, { ...(projection ? { projection } : {}), maxTimeMS: 5000 })
      .sort(dated ? { createdAt: -1, _id: -1 } : { _id: -1 }).limit(size).toArray();
    if (!rows.length) { exhausted = true; break; }
    scanned += rows.length;
    items.push(...await validate(rows));
    last = rows.at(-1);
    after = last;
    if (rows.length < size) { exhausted = true; break; }
  }
  return { items: items.slice(0, limit), limit, nextCursor: items.length > limit ? encode(items[limit - 1]) : !exhausted && last ? encode(last) : null };
};
module.exports = { visiblePage };
