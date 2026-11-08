const { createHash } = require("node:crypto");
const { fail, idValue } = require("./domain");
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const queryFilter = (query, { states = [], fields = [], extra = [] } = {}) => {
  const allowed = [
    "limit",
    "cursor",
    ...(states.length ? ["status"] : []),
    ...(fields.length ? ["q"] : []),
    ...extra,
  ];
  for (const key of Object.keys(query))
    if (!allowed.includes(key))
      fail(400, "Unsupported table filter.", "INVALID_INPUT");
  const filter = {};
  if (query.status !== undefined) {
    if (typeof query.status !== "string" || !states.includes(query.status))
      fail(400, "Choose a valid status filter.", "VALIDATION_ERROR");
    filter.state = query.status;
  }
  if (query.q !== undefined) {
    if (typeof query.q !== "string" || query.q.trim().length > 80)
      fail(400, "Use up to 80 search characters.", "VALIDATION_ERROR");
    if (query.q.trim())
      filter.$or = fields.map((field) => ({
        [field]: new RegExp(escape(query.q.trim()), "i"),
      }));
  }
  return filter;
};
const pageDocs = async (
  collection,
  filter,
  query,
  { scope, uid = false, projection } = {},
) => {
  if (
    query.limit !== undefined &&
    (typeof query.limit !== "string" ||
      !/^([1-9]|[1-9]\d|100)$/.test(query.limit))
  )
    fail(400, "Page size must be 1–100.", "VALIDATION_ERROR");
  const limit = query.limit ? Number(query.limit) : 25;
  const signature = createHash("sha256")
    .update(
      scope +
        JSON.stringify(filter, (key, value) =>
          value instanceof RegExp ? String(value) : value,
        ),
    )
    .digest("hex")
    .slice(0, 16);
  let selector = filter;
  if (query.cursor !== undefined) {
    let cursor;
    try {
      if (
        typeof query.cursor !== "string" ||
        !/^[a-zA-Z0-9_-]{1,400}$/.test(query.cursor)
      )
        throw new Error();
      cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
      if (
        cursor.scope !== signature ||
        typeof cursor.id !== "string" ||
        cursor.id.length > 128
      )
        throw new Error();
      const value = uid ? cursor.id : idValue(cursor.id);
      selector = { $and: [filter, { _id: { $lt: value } }] };
    } catch {
      fail(
        400,
        "This page cursor is invalid. Reset the filters.",
        "INVALID_CURSOR",
      );
    }
  }
  const rows = await collection
    .find(selector, { ...(projection ? { projection } : {}), maxTimeMS: 5000 })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  const more = rows.length > limit,
    items = rows.slice(0, limit);
  return {
    items,
    nextCursor: more
      ? Buffer.from(
          JSON.stringify({ id: String(items.at(-1)._id), scope: signature }),
        ).toString("base64url")
      : null,
    limit,
  };
};
module.exports = { pageDocs, queryFilter };
