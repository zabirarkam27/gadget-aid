const { ObjectId } = require("mongodb");
const { fail } = require("./domain");
const { touchProvider, providerFlag } = require("./access");
const { recordAudit } = require("./audit");
const bootstrapSuperAdmin = async ({
  db,
  directory,
  uid,
  operator,
  reason,
  active,
  clock = () => new Date(),
}) => {
  if (
    typeof uid !== "string" ||
    !uid ||
    uid.length > 128 ||
    typeof operator !== "string" ||
    operator.trim().length < 3 ||
    operator.length > 120 ||
    typeof reason !== "string" ||
    reason.trim().length < 10 ||
    reason.length > 1000 ||
    typeof active !== "boolean"
  )
    fail(
      400,
      "Explicit target UID, operator, decision and specific reason are required.",
      "VALIDATION_ERROR",
    );
  let user;
  if (active) {
    user = await directory.getUser(uid);
    if (!user.email || !user.emailVerified || user.disabled)
      fail(
        409,
        "Bootstrap requires an enabled account with a verified email.",
        "ACCOUNT_NOT_VERIFIED",
      );
  }
  return db.transaction(async (tx) => {
    const old = await tx.roleGrants.findOne({ _id: uid });
    if (!active && old?.role !== "super_admin")
      fail(404, "This UID has no Super Admin grant.", "NOT_FOUND");
    const identity = { uid, email: active ? user.email : old.email };
    const value = {
      email: identity.email,
      role: "super_admin",
      active,
      grantVersion: 1,
      createdAt: old?.createdAt || clock(),
      updatedAt: clock(),
      revision: (old?.revision || 0) + 1,
    };
    if (old) {
      const result = await tx.roleGrants.updateOne(
        { _id: uid, revision: old.revision },
        { $set: value },
      );
      if (!result.matchedCount)
        fail(
          409,
          "The grant changed. Inspect it before retrying.",
          "STALE_OPERATION",
        );
    } else await tx.roleGrants.insertOne({ _id: uid, ...value });
    await touchProvider(tx, identity, new ObjectId().toHexString());
    await providerFlag(tx, identity, "roleRevoked", !active);
    await recordAudit(
      tx,
      {
        user: { uid: operator.trim() },
        access: { role: "bootstrap_operator" },
        body: { reason },
      },
      clock,
      {
        action: "super_admin_bootstrap",
        target: `account:${uid}`,
        before: old ? { role: old.role, active: old.active } : null,
        after: { role: "super_admin", active },
      },
    );
    return { uid, role: "super_admin", active };
  });
};
module.exports = { bootstrapSuperAdmin };
