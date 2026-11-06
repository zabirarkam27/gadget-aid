const { ObjectId } = require("mongodb");
const { fail, checkKeys } = require("./domain");
const { requireRecent } = require("./access");
const sensitiveInput = (req, clock, fields = [], revision = true) => {
  checkKeys(req.body, [
    "reason",
    "confirmed",
    ...(revision ? ["expectedRevision"] : []),
    ...fields,
  ]);
  requireRecent(req, clock);
  if (
    req.body.confirmed !== true ||
    typeof req.body.reason !== "string" ||
    req.body.reason.trim().length < 10 ||
    req.body.reason.trim().length > 1000
  )
    fail(
      400,
      "Confirm the exact action and provide a specific reason of 10–1,000 characters.",
      "CONFIRMATION_REQUIRED",
    );
  if (
    revision &&
    (!Number.isSafeInteger(req.body.expectedRevision) ||
      req.body.expectedRevision < 0)
  )
    fail(400, "Refresh the target before changing it.", "VALIDATION_ERROR");
  return req.body.reason.trim();
};
const recordAudit = async (
  tx,
  req,
  clock,
  { action, target, before = null, after = null },
) => {
  if (!tx.auditLogs)
    fail(503, "Audit storage is unavailable.", "SERVICE_UNAVAILABLE");
  await tx.auditLogs.insertOne({
    _id: new ObjectId(),
    action,
    target,
    actorUid: req.user.uid,
    actorRole: req.access.role,
    reason: req.body.reason.trim(),
    before,
    after,
    createdAt: clock(),
  });
};
const atomicAction = async (db, req, clock, work) => {
  if (!db.transaction)
    fail(
      503,
      "Operations require a transaction-capable database.",
      "SERVICE_UNAVAILABLE",
    );
  return db.transaction(async (tx) => {
    const result = await work(tx);
    await recordAudit(tx, req, clock, result);
    return result.result || { acknowledged: true };
  });
};
module.exports = { sensitiveInput, recordAudit, atomicAction };
