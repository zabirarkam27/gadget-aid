const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");
const sharp = require("sharp");
const { fail, idValue, checkKeys } = require("./domain");
const MAX_BYTES = 3 * 1024 * 1024,
  OWNER_BYTES = 30 * 1024 * 1024,
  POLICY = "private-receipts-v1";
const view = (r) => ({
  _id: String(r._id),
  label: r.label,
  mediaType: "image/jpeg",
  size: r.size,
  width: r.width,
  height: r.height,
  createdAt: r.createdAt,
});
const sanitizeReceipt = async (buffer, mediaType) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES)
    fail(413, "Upload a receipt photo up to 3 MiB.", "RECEIPT_TOO_LARGE");
  const png = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (
    (mediaType !== "image/png" || !png) &&
    (mediaType !== "image/jpeg" || !jpeg)
  )
    fail(
      415,
      "Only actual JPEG and PNG receipt photos are accepted.",
      "RECEIPT_TYPE",
    );
  try {
    const image = sharp(buffer, {
      limitInputPixels: 20_000_000,
      failOn: "warning",
      sequentialRead: true,
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png"].includes(meta.format) ||
      (meta.pages || 1) !== 1 ||
      meta.width < 32 ||
      meta.height < 32 ||
      meta.width > 10000 ||
      meta.height > 10000
    )
      throw Error();
    const { data, info } = await image
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({
        width: 3000,
        height: 3000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .timeout({ seconds: 5 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX_BYTES)
      fail(413, "The normalized receipt is too large.", "RECEIPT_TOO_LARGE");
    return { data, width: info.width, height: info.height };
  } catch (e) {
    if (e.code === "RECEIPT_TOO_LARGE") throw e;
    fail(
      415,
      "This image is unsupported, damaged or exceeds the safe image dimensions.",
      "RECEIPT_INVALID_IMAGE",
    );
  }
};
const eraseDeviceReceipts = async (tx, deviceId, ownerUid) => {
  if (!tx.receipts || !tx.receiptFiles)
    fail(503, "Receipt storage is unavailable.", "RECEIPT_UNAVAILABLE");
  await tx.receiptFiles.deleteMany({ deviceId, ownerUid });
  await tx.receipts.deleteMany({ deviceId, ownerUid });
};
const createReceipts = ({ collections, clock, vault }) => {
  let inflight = 0;
  const database = async () => {
    const db = await collections();
    if (!db.receipts || !db.receiptFiles || !db.transaction)
      fail(
        503,
        "Private receipt storage is unavailable.",
        "RECEIPT_UNAVAILABLE",
      );
    return db;
  };
  const owned = async (db, req) => {
    const row = await db.devices.findOne({
      _id: idValue(req.params.id),
      ownerUid: req.user.uid,
    });
    if (!row) fail(404, "Device not found.", "NOT_FOUND");
    return row;
  };
  const gate = async (req, res, next) => {
    const db = await database();
    await owned(db, req);
    if (!vault)
      fail(
        503,
        "Encrypted receipt storage has not been configured.",
        "RECEIPT_UNAVAILABLE",
      );
    if (req.get("X-Receipt-Policy") !== POLICY)
      fail(
        400,
        "Review and accept the private receipt retention policy.",
        "RECEIPT_POLICY_REQUIRED",
      );
    if (
      !["image/jpeg", "image/png"].includes(
        req.get("Content-Type")?.split(";")[0],
      )
    )
      fail(
        415,
        "Only JPEG and PNG receipt photos are accepted.",
        "RECEIPT_TYPE",
      );
    if (inflight >= 2)
      fail(429, "Receipt processing is busy. Retry shortly.", "RECEIPT_BUSY");
    inflight++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        inflight--;
      }
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
  const list = async (req, res) => {
    const db = await database();
    await owned(db, req);
    if (Object.keys(req.query).length)
      fail(400, "Unsupported receipt filter.", "INVALID_INPUT");
    const rows = await db.receipts
      .find({
        ownerUid: req.user.uid,
        deviceId: idValue(req.params.id).toHexString(),
      })
      .sort({ _id: -1 })
      .limit(10)
      .toArray();
    res.json({
      available: !!vault,
      policy: POLICY,
      maxBytes: MAX_BYTES,
      maxPerDevice: 10,
      maxPerAccount: 50,
      maxAccountBytes: OWNER_BYTES,
      acceptedTypes: ["image/jpeg", "image/png"],
      items: rows.map(view),
    });
  };
  const upload = async (req, res) => {
    const requestId = req.get("X-Upload-Id"),
      labelRaw = req.get("X-Receipt-Label") || "Receipt photo";
    if (
      typeof requestId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        requestId,
      )
    )
      fail(400, "A unique upload reference is required.", "VALIDATION_ERROR");
    let label;
    try {
      label = decodeURIComponent(labelRaw).trim();
    } catch {
      fail(400, "Invalid receipt label.", "VALIDATION_ERROR");
    }
    if (label.length < 2 || label.length > 100 || /[\x00-\x1f\x7f]/.test(label))
      fail(400, "Use a receipt label of 2–100 characters.", "VALIDATION_ERROR");
    const normalized = await sanitizeReceipt(
        req.body,
        req.get("Content-Type").split(";")[0],
      ),
      db = await database(),
      deviceId = idValue(req.params.id).toHexString(),
      id = new ObjectId(
        createHash("sha256")
          .update(
            JSON.stringify([req.user.uid, deviceId, requestId.toLowerCase()]),
          )
          .digest("hex")
          .slice(0, 24),
      ),
      digest = createHash("sha256").update(normalized.data).digest("hex");
    const result = await db.transaction(async (tx) => {
      await owned(tx, req);
      const old = await tx.receipts.findOne({ _id: id });
      if (old) {
        if (old.contentDigest !== digest || old.label !== label)
          fail(
            409,
            "This upload reference was used for another receipt.",
            "UPLOAD_REFERENCE_CONFLICT",
          );
        return { created: false, receipt: view(old) };
      }
      const quotaId = `receipts:${req.user.uid}`,
        quota = await tx.operationMeta.findOne({ _id: quotaId });
      const now = clock(),
        recent =
          quota?.windowStart instanceof Date && now - quota.windowStart < 60000;
      if (recent && (quota.attempts || 0) >= 10)
        fail(429, "Wait before uploading more receipts.", "RECEIPT_RATE_LIMIT");
      const counter = {
        nonce: new ObjectId().toHexString(),
        windowStart: recent ? quota.windowStart : now,
        attempts: recent ? (quota.attempts || 0) + 1 : 1,
      };
      if (quota)
        await tx.operationMeta.updateOne({ _id: quotaId }, { $set: counter });
      else await tx.operationMeta.insertOne({ _id: quotaId, ...counter });
      const all = await tx.receipts
        .find(
          { ownerUid: req.user.uid },
          { projection: { _id: 1, deviceId: 1, size: 1 } },
        )
        .limit(51)
        .toArray();
      if (
        all.length >= 50 ||
        all.filter((r) => r.deviceId === deviceId).length >= 10 ||
        all.reduce((sum, r) => sum + r.size, 0) + normalized.data.length >
          OWNER_BYTES
      )
        fail(
          409,
          "Private receipt storage quota reached. Download and delete an old receipt first.",
          "RECEIPT_QUOTA",
        );
      await tx.devices.updateOne(
        { _id: idValue(deviceId), ownerUid: req.user.uid },
        { $set: { receiptGuard: new ObjectId().toHexString() } },
      );
      const row = {
        _id: id,
        ownerUid: req.user.uid,
        deviceId,
        label,
        size: normalized.data.length,
        width: normalized.width,
        height: normalized.height,
        contentDigest: digest,
        createdAt: now,
        policyVersion: POLICY,
      };
      await tx.receiptFiles.insertOne({
        _id: id,
        ownerUid: req.user.uid,
        deviceId,
        ...vault.seal(normalized.data, {
          ownerUid: req.user.uid,
          deviceId,
          id: String(id),
        }),
      });
      await tx.receipts.insertOne(row);
      return { created: true, receipt: view(row) };
    });
    res.status(result.created ? 201 : 200).json(result.receipt);
  };
  const download = async (req, res) => {
    const db = await database();
    await owned(db, req);
    const deviceId = idValue(req.params.id).toHexString(),
      row = await db.receipts.findOne({
        _id: idValue(req.params.receiptId),
        deviceId,
        ownerUid: req.user.uid,
      });
    if (!row) fail(404, "Receipt not found.", "NOT_FOUND");
    if (!vault)
      fail(
        503,
        "Private receipt storage is unavailable.",
        "RECEIPT_UNAVAILABLE",
      );
    const file = await db.receiptFiles.findOne({
      _id: row._id,
      deviceId,
      ownerUid: req.user.uid,
    });
    if (!file)
      fail(503, "Receipt content is unavailable.", "RECEIPT_UNAVAILABLE");
    const data = vault.open(file, {
      ownerUid: req.user.uid,
      deviceId,
      id: String(row._id),
    });
    if (
      data.length !== row.size ||
      createHash("sha256").update(data).digest("hex") !== row.contentDigest
    )
      fail(503, "Receipt integrity check failed.", "RECEIPT_UNAVAILABLE");
    res
      .set({
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="receipt-${row._id}.jpg"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "no-store",
        "Cross-Origin-Resource-Policy": "same-site",
      })
      .send(data);
  };
  const remove = async (req, res) => {
    checkKeys(req.body, ["confirmed"]);
    if (req.body.confirmed !== true)
      fail(
        400,
        "Confirm deletion of this exact receipt.",
        "CONFIRMATION_REQUIRED",
      );
    const db = await database();
    await db.transaction(async (tx) => {
      await owned(tx, req);
      const row = await tx.receipts.findOne({
        _id: idValue(req.params.receiptId),
        deviceId: idValue(req.params.id).toHexString(),
        ownerUid: req.user.uid,
      });
      if (!row) fail(404, "Receipt not found.", "NOT_FOUND");
      await tx.receiptFiles.deleteOne({ _id: row._id, ownerUid: req.user.uid });
      await tx.receipts.deleteOne({ _id: row._id, ownerUid: req.user.uid });
    });
    res.json({ acknowledged: true });
  };
  return { gate, list, upload, download, remove };
};
module.exports = {
  createReceipts,
  sanitizeReceipt,
  eraseDeviceReceipts,
  receiptView: view,
  MAX_BYTES,
};
