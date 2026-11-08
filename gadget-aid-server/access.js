const { fail, ownerQuery } = require("./domain");
const { technicianId } = require("./identities");
const ROLES = ["super_admin", "admin", "technician"];
const validGrant = (row) =>
  row?.grantVersion === 1 &&
  row.createdAt instanceof Date &&
  ROLES.includes(row.role) &&
  typeof row.active === "boolean";
const accessFor = async (db, user) => {
  if (!db.roleGrants || !db.accountControls)
    fail(503, "Account access is unavailable.", "SERVICE_UNAVAILABLE");
  const grant = await db.roleGrants.findOne({ _id: user.uid }),
    control = await db.accountControls.findOne({ _id: user.uid });
  const role =
    validGrant(grant) &&
    grant.active &&
    grant.email === user.email &&
    user.emailVerified
      ? grant.role
      : "public_visitor";
  return {
    role,
    admin: ["admin", "super_admin"].includes(role),
    superAdmin: role === "super_admin",
    canProvide: ROLES.includes(role),
    restricted: control?.state === "restricted",
    controlRevision: control?.revision || 0,
  };
};
const requireProvider = (req, res, next) => {
  if (!req.access?.canProvide)
    fail(
      403,
      "Technician approval is required for provider actions.",
      "TECHNICIAN_REQUIRED",
    );
  next();
};
const requireRecent = (req, clock) => {
  const age = Math.floor(clock().getTime() / 1000) - req.user.authTime;
  if (!Number.isSafeInteger(req.user.authTime) || age < -30 || age > 600)
    fail(
      403,
      "Sign in again before this sensitive action.",
      "ADMIN_REAUTH_REQUIRED",
    );
};
const isAvailable = (service, grants, accounts, controls) => {
  if (
    service.deletedAt ||
    controls.get(`service:${service._id}`)?.state === "hidden" ||
    controls.get(`technician:${technicianId(service.providerEmail || "")}`)
      ?.state === "restricted" ||
    controls.get(`technician:${technicianId(service.providerEmail || "")}`)
      ?.accountRestricted ||
    controls.get(`technician:${technicianId(service.providerEmail || "")}`)
      ?.roleRevoked
  )
    return false;
  if (service.providerUid) {
    const grant = grants.get(service.providerUid);
    if (
      accounts.get(service.providerUid)?.state === "restricted" ||
      (grant &&
        (!validGrant(grant) ||
          !grant.active ||
          grant.email !== service.providerEmail))
    )
      return false;
  }
  return true;
};
const visibleServices = async (db, services) => {
  if (!db.entityControls || !db.accountControls || !db.roleGrants)
    fail(503, "Service availability is unavailable.", "SERVICE_UNAVAILABLE");
  const uids = [...new Set(services.map((s) => s.providerUid).filter(Boolean))],
    keys = services.flatMap((s) => [
      `service:${s._id}`,
      `technician:${technicianId(s.providerEmail || "")}`,
    ]);
  const [grants, accounts, controls] = await Promise.all([
    db.roleGrants.find({ _id: { $in: uids } }).toArray(),
    db.accountControls.find({ _id: { $in: uids } }).toArray(),
    db.entityControls.find({ _id: { $in: keys } }).toArray(),
  ]);
  const grantMap = new Map(grants.map((v) => [v._id, v])),
    accountMap = new Map(accounts.map((v) => [v._id, v])),
    controlMap = new Map(controls.map((v) => [v._id, v]));
  return services.filter(s => isAvailable(s, grantMap, accountMap, controlMap));
};
const assertBookable = async (db, service) => {
  const grants = new Map(),
    accounts = new Map(),
    controls = new Map();
  if (service.providerUid) {
    const grant = await db.roleGrants.findOne({ _id: service.providerUid }),
      account = await db.accountControls.findOne({ _id: service.providerUid });
    if (grant) grants.set(service.providerUid, grant);
    if (account) accounts.set(service.providerUid, account);
  }
  for (const key of [
    `service:${service._id}`,
    `technician:${technicianId(service.providerEmail || "")}`,
  ]) {
    const value = await db.entityControls.findOne({ _id: key });
    if (value) controls.set(key, value);
  }
  if (!isAvailable(service, grants, accounts, controls))
    fail(
      409,
      "This provider or listing is not accepting bookings.",
      "SERVICE_UNAVAILABLE",
    );
};
const touchProvider = async (tx, identity, nonce) => {
  if (identity.email)
    await tx.services.updateMany(
      ownerQuery({ uid: identity.uid, email: identity.email }),
      { $set: { operationsGuard: nonce } },
    );
};
const providerFlag = async (tx, identity, key, value) => {
  if (!identity.email) return;
  const id = `technician:${technicianId(identity.email)}`,
    old = await tx.entityControls.findOne({ _id: id });
  if (old)
    await tx.entityControls.updateOne(
      { _id: id },
      { $set: { [key]: value, revision: (old.revision || 0) + 1 } },
    );
  else
    await tx.entityControls.insertOne({
      _id: id,
      state: "unreviewed",
      [key]: value,
      revision: 1,
    });
};
module.exports = {
  providerFlag,
  ROLES,
  validGrant,
  accessFor,
  requireProvider,
  requireRecent,
  visibleServices,
  assertBookable,
  touchProvider,
};
