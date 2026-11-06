const { ObjectId } = require("mongodb");
const fixedTime = new Date("2026-11-05T10:00:00Z");
const users = {
  customer: {
    uid: "qa-customer",
    email: "customer@example.test",
    name: "Demo Customer",
  },
  provider: {
    uid: "qa-provider",
    email: "provider@example.test",
    name: "Demo Repairs",
  },
  other: {
    uid: "qa-other",
    email: "other@example.test",
    name: "Other Provider",
  },
  admin: { uid: "qa-admin", email: "admin@example.test", name: "Demo Admin" },
  superadmin: {
    uid: "qa-superadmin",
    email: "superadmin@example.test",
    name: "Demo Super Admin",
  },
  second: {
    uid: "qa-second",
    email: "second@example.test",
    name: "Second Customer",
  },
};
const ids = {
  service: "111111111111111111111111",
  otherService: "222222222222222222222222",
  booking: "333333333333333333333333",
};
const clone = (value) =>
  value instanceof ObjectId
    ? new ObjectId(value.toHexString())
    : value instanceof Date
      ? new Date(value)
      : Array.isArray(value)
        ? value.map(clone)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, clone(v)]),
            )
          : value;
const equal = (a, b) =>
  a instanceof ObjectId && b instanceof ObjectId
    ? a.equals(b)
    : a instanceof Date && b instanceof Date
      ? a.getTime() === b.getTime()
      : a === b;
const matches = (row, query) =>
  Object.entries(query).every(([key, value]) => {
    if (key === "$or") return value.some((part) => matches(row, part));
    if (key === "$and") return value.every((part) => matches(row, part));
    if (value === null) return row[key] == null;
    if (value instanceof RegExp)
      return typeof row[key] === "string" && value.test(row[key]);
    if (
      value &&
      typeof value === "object" &&
      !(value instanceof ObjectId) &&
      !(value instanceof Date)
    ) {
      if ("$lt" in value)
        return (
          row[key] != null &&
          (row[key] instanceof ObjectId ? String(row[key]) : row[key]) <
            (value.$lt instanceof ObjectId ? String(value.$lt) : value.$lt)
        );
      if ("$exists" in value) return Object.hasOwn(row, key) === value.$exists;
      if ("$in" in value)
        return value.$in.some((item) =>
          item === null ? row[key] == null : equal(row[key], item),
        );
      throw new Error(`Unsupported test query operator: ${key}`);
    }
    return equal(row[key], value);
  });
class MemoryCollection {
  constructor(rows = []) {
    this.rows = clone(rows);
  }
  find(query = {}, options = {}) {
    let sort = null,
      limit = Infinity;
    const cursor = {
      sort: (value) => {
        sort = value;
        return cursor;
      },
      limit: (value) => {
        limit = value;
        return cursor;
      },
      toArray: async () => {
        let rows = clone(this.rows.filter((row) => matches(row, query)));
        if (sort)
          rows.sort((a, b) => {
            for (const [key, direction] of Object.entries(sort)) {
              const av = a[key] instanceof ObjectId ? String(a[key]) : a[key],
                bv = b[key] instanceof ObjectId ? String(b[key]) : b[key];
              if (av < bv) return -direction;
              if (av > bv) return direction;
            }
            return 0;
          });
        rows = rows.slice(0, limit);
        if (options.projection) {
          const keys = Object.keys(options.projection).filter(
            (k) => options.projection[k],
          );
          if (options.projection._id !== 0 && !keys.includes("_id"))
            keys.push("_id");
          rows = rows.map((row) =>
            Object.fromEntries(
              keys.filter((k) => Object.hasOwn(row, k)).map((k) => [k, row[k]]),
            ),
          );
        }
        return rows;
      },
    };
    return cursor;
  }
  async countDocuments(query = {}) {
    return this.rows.filter((row) => matches(row, query)).length;
  }
  async updateMany(query, update) {
    let count = 0;
    for (const row of this.rows)
      if (matches(row, query)) {
        Object.assign(row, clone(update.$set));
        count++;
      }
    return { matchedCount: count, modifiedCount: count };
  }
  async findOne(query) {
    return clone(this.rows.find((row) => matches(row, query)) || null);
  }
  async insertOne(record) {
    const row = clone(record);
    row._id ||= new ObjectId();
    if (this.rows.some((existing) => equal(existing._id, row._id)))
      throw Object.assign(new Error("duplicate key"), { code: 11000 });
    this.rows.push(row);
    return { acknowledged: true, insertedId: row._id };
  }
  async updateOne(query, update) {
    const row = this.rows.find((row) => matches(row, query));
    if (!row) return { matchedCount: 0, modifiedCount: 0 };
    const before = JSON.stringify(row);
    Object.assign(row, clone(update.$set));
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: before === JSON.stringify(row) ? 0 : 1,
    };
  }
  async deleteOne(query) {
    const index = this.rows.findIndex((row) => matches(row, query));
    if (index < 0) return { deletedCount: 0 };
    this.rows.splice(index, 1);
    return { deletedCount: 1 };
  }
}
const serviceFields = {
  name: "Laptop diagnostic repair",
  price: 85,
  area: "Dhaka",
  description: "Diagnosis and repair for a laptop that will not start.",
  image: "http://127.0.0.1:5176/banner.png",
};
const createFixture = ({
  seedBooking = false,
  seedInProgress = false,
  seedAdminRoles = false,
} = {}) => {
  const service = {
    _id: new ObjectId(ids.service),
    ...serviceFields,
    providerUid: users.provider.uid,
    providerEmail: users.provider.email,
    providerName: users.provider.name,
    providerPhoto: null,
    createdAt: fixedTime,
    updatedAt: fixedTime,
  };
  const otherService = {
    ...service,
    _id: new ObjectId(ids.otherService),
    name: "Phone display repair",
    providerUid: users.other.uid,
    providerEmail: users.other.email,
    providerName: users.other.name,
  };
  const booking = {
    _id: new ObjectId(ids.booking),
    serviceId: ids.service,
    serviceName: service.name,
    serviceImage: service.image,
    providerUid: users.provider.uid,
    providerEmail: users.provider.email,
    providerName: users.provider.name,
    userUid: users.customer.uid,
    userEmail: users.customer.email,
    userName: users.customer.name,
    date: "2026-11-06",
    instruction:
      "The laptop does not start. Please check the power connection.",
    price: 85,
    status: "pending",
    createdAt: fixedTime,
  };
  const db = {
    devices: new MemoryCollection(),
    warranties: new MemoryCollection(),
    roleGrants: new MemoryCollection(),
    accountControls: new MemoryCollection(),
    entityControls: new MemoryCollection(),
    auditLogs: new MemoryCollection(),
    applications: new MemoryCollection(),
    disputes: new MemoryCollection(),
    categories: new MemoryCollection(),
    operationMeta: new MemoryCollection(),
    technicians: new MemoryCollection(),
    reviews: new MemoryCollection(),
    reviewReports: new MemoryCollection(),
    notifications: new MemoryCollection(),
    threads: new MemoryCollection(),
    services: new MemoryCollection([service, otherService]),
    bookings: new MemoryCollection(seedBooking ? [booking] : []),
  };
  for (const [key, role] of [
    ["provider", "technician"],
    ["other", "technician"],
    ...(seedAdminRoles
      ? [
          ["admin", "admin"],
          ["superadmin", "super_admin"],
        ]
      : []),
  ])
    db.roleGrants.rows.push({
      _id: users[key].uid,
      email: users[key].email,
      role,
      active: true,
      grantVersion: 1,
      createdAt: fixedTime,
      revision: 0,
    });
  if (seedInProgress)
    db.bookings.rows.push({
      ...clone(booking),
      _id: new ObjectId("555555555555555555555555"),
      date: "2026-11-04",
      status: "working",
      instruction:
        "Demo repair already in progress; verify quality and hand over before reviewing.",
    });
  let transactionTail = Promise.resolve();
  db.transaction = async (work) => {
    const before = transactionTail;
    let release;
    transactionTail = new Promise((resolve) => {
      release = resolve;
    });
    await before;
    const backups = Object.fromEntries(
      Object.entries(db)
        .filter(([, value]) => value instanceof MemoryCollection)
        .map(([key, value]) => [key, clone(value.rows)]),
    );
    try {
      return await work(db);
    } catch (error) {
      for (const [key, rows] of Object.entries(backups)) db[key].rows = rows;
      throw error;
    } finally {
      release();
    }
  };
  return { db, service, otherService, booking };
};
const verifyIdToken = async (token) => {
  if (!users[token]) throw new Error("invalid test token");
  return {
    ...users[token],
    email_verified: true,
    auth_time: Math.floor(fixedTime.getTime() / 1000),
  };
};
const identityDirectory = {
  getUser: async (uid) => {
    const user = Object.values(users).find((u) => u.uid === uid);
    if (!user)
      throw Object.assign(new Error("missing fixture identity"), {
        code: "auth/user-not-found",
      });
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.name,
      emailVerified: true,
      disabled: false,
      metadata: {
        creationTime: fixedTime.toISOString(),
        lastSignInTime: fixedTime.toISOString(),
      },
      passwordHash: "NEVER_EXPOSE_THIS_HASH",
    };
  },
  listUsers: async (limit, cursor) => {
    const offset = cursor ? Number(cursor) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw new Error("bad cursor");
    const values = await Promise.all(
      Object.values(users)
        .slice(offset, offset + limit)
        .map((u) => identityDirectory.getUser(u.uid)),
    );
    return {
      users: values,
      pageToken:
        offset + limit < Object.keys(users).length
          ? String(offset + limit)
          : undefined,
    };
  },
};
module.exports = {
  identityDirectory,
  MemoryCollection,
  createFixture,
  users,
  ids,
  fixedTime,
  serviceFields,
  verifyIdToken,
};
