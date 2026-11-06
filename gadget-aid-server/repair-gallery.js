const { retryTransaction } = require("./transaction-retry");
const { ObjectId } = require("mongodb");
const { createHash } = require("node:crypto");
const {
  fail,
  checkKeys,
  idValue,
  serviceOwner,
  customerQuery,
} = require("./domain");
const { completionVerified } = require("./reviews");
const { visibleServices, requireRecent } = require("./access");
const { sensitiveInput, recordAudit } = require("./audit");
const { pageDocs, queryFilter } = require("./pagination");
const { listPage } = require("./listings");
const { sanitizeReceipt } = require("./receipts");
const POLICY = "public-repair-examples-v1";
const exampleId = (id) =>
  new ObjectId(
    createHash("sha256")
      .update(`repair-example:${id}`)
      .digest("hex")
      .slice(0, 24),
  );
const view = (row) => ({
  _id: String(row._id),
  title: row.title,
  description: row.description,
  providerName: row.providerName,
  publishedAt: row.publishedAt || null,
});
const privateView = (row) =>
  row
    ? {
        ...view(row),
        state: row.state,
        revision: row.revision,
        before: row.before === true,
        after: row.after === true,
        customerConsent: row.customerConsent === true,
      }
    : null;
const confirm = (body, row) => {
  if (body.confirmed !== true || !Number.isSafeInteger(body.expectedRevision))
    fail(
      400,
      "Review this exact example and confirm the action.",
      "CONFIRMATION_REQUIRED",
    );
  if (body.expectedRevision !== row.revision)
    fail(409, "This example changed. Reload it first.", "STALE_EXAMPLE");
};
const createRepairGallery = ({ collections, clock, vault }) => {
  let inflight = 0;
  const eraseMedia = async (tx, row) => {
    const files = await tx.exampleFiles
      .find({ exampleId: String(row._id) })
      .limit(3)
      .toArray();
    const quota = await tx.operationMeta.findOne({ _id: "gallery:storage" });
    if (quota)
      await tx.operationMeta.updateOne(
        { _id: "gallery:storage" },
        {
          $set: {
            bytes: Math.max(
              0,
              (quota.bytes || 0) -
                files.reduce((sum, file) => sum + (file.size || 0), 0),
            ),
          },
        },
      );
    await tx.exampleFiles.deleteMany({ exampleId: String(row._id) });
  };
  const context = async (req, db) => {
    const booking = await db.bookings.findOne({ _id: idValue(req.params.id) });
    if (!booking) fail(404, "Booking not found.", "NOT_FOUND");
    const service = await db.services.findOne({
      _id: idValue(String(booking.serviceId)),
    });
    const provider = serviceOwner(service, req.user);
    const customer = !!(await db.bookings.findOne({
      _id: booking._id,
      ...customerQuery(req.user),
    }));
    if (!provider && !customer) fail(404, "Booking not found.", "NOT_FOUND");
    return { booking, service, provider, customer };
  };
  const eligible = (ctx) =>
    ctx.service &&
    ctx.booking.createdAt instanceof Date &&
    typeof ctx.booking.userUid === "string" &&
    typeof ctx.service.providerUid === "string" &&
    ctx.booking.userUid !== ctx.service.providerUid &&
    ctx.booking.providerUid === ctx.service.providerUid &&
    completionVerified(ctx.booking, ctx.service);
  const owned = async (db, req) => {
    const row = await db.examples.findOne({
      _id: idValue(req.params.exampleId),
    });
    if (!row || ![row.providerUid, row.customerUid].includes(req.user.uid))
      fail(404, "Example not found.", "NOT_FOUND");
    return row;
  };
  const isPublic = async (db, row) => {
    if (!row || row.state !== "published" || row.customerConsent !== true)
      return false;
    const service = await db.services.findOne({
      _id: idValue(row.serviceId),
      deletedAt: null,
    });
    return !!(
      service &&
      service.providerUid === row.providerUid &&
      (await visibleServices(db, [service])).length
    );
  };
  const media = async (db, row, slot, res) => {
    if (!["before", "after"].includes(slot))
      fail(404, "Image not found.", "NOT_FOUND");
    const file = await db.exampleFiles.findOne({ _id: `${row._id}:${slot}` });
    if (!file || !vault) fail(404, "Image not available.", "NOT_FOUND");
    let buffer;
    try {
      buffer = vault.open(file, {
        ownerUid: row.providerUid,
        deviceId: `gallery:${row.bookingId}`,
        id: `${row._id}:${slot}`,
      });
    } catch {
      fail(
        503,
        "This gallery image is unavailable. Contact the storage operator.",
        "IMAGE_UNAVAILABLE",
      );
    }
    res
      .set({
        "Cache-Control": "no-store",
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        "Referrer-Policy": "no-referrer",
      })
      .send(buffer);
  };
  const inspected = async (db, req, row) => {
    requireRecent(req, clock);
    const records = await db.auditLogs
      .find({
        action: "gallery.inspect",
        target: String(row._id),
        actorUid: req.user.uid,
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    if (
      !records[0] ||
      records[0].after?.revision !== row.revision ||
      clock() - records[0].createdAt > 600000
    )
      fail(403, "Inspect this exact revision first.", "INSPECTION_REQUIRED");
  };
  return {
    publicList: async (req, res) => {
      queryFilter(req.query);
      const db = await collections();
      const page = await listPage({
        collection: db.examples,
        filter: { state: "published", customerConsent: true },
        query: req.query,
        scope: "public-gallery",
        visible: async (rows) => {
          const result = [];
          for (const row of rows) if (await isPublic(db, row)) result.push(row);
          return result;
        },
      });
      res
        .set("Cache-Control", "no-store")
        .json({ ...page, items: page.items.map(view) });
    },
    publicImage: async (req, res) => {
      const db = await collections(),
        row = await db.examples.findOne({ _id: idValue(req.params.exampleId) });
      if (!(await isPublic(db, row)))
        fail(404, "Image not found.", "NOT_FOUND");
      await media(db, row, req.params.slot, res);
    },
    bookingRead: async (req, res) => {
      const db = await collections(),
        ctx = await context(req, db),
        row = await db.examples.findOne({
          _id: exampleId(String(ctx.booking._id)),
        });
      res.json({
        item: privateView(row),
        canCreate: ctx.provider && req.access.canProvide && eligible(ctx),
        provider: ctx.provider,
        customer: ctx.customer,
        storageAvailable: !!vault,
        policyVersion: POLICY,
      });
    },
    create: async (req, res) => {
      checkKeys(req.body, ["title", "description"]);
      const title = req.body.title,
        description = req.body.description;
      if (
        typeof title !== "string" ||
        title.trim().length < 6 ||
        title.length > 100 ||
        typeof description !== "string" ||
        description.trim().length < 20 ||
        description.length > 600
      )
        fail(
          400,
          "Use a title of 6–100 and description of 20–600 characters. Exclude identifiers.",
          "VALIDATION_ERROR",
        );
      if (!vault)
        fail(
          503,
          "Gallery image storage is unavailable.",
          "STORAGE_UNAVAILABLE",
        );
      const db = await collections();
      await retryTransaction(db, async (tx) => {
        const ctx = await context(req, tx);
        if (!ctx.provider || !req.access.canProvide || !eligible(ctx))
          fail(
            403,
            "Only the approved provider of a recorded completed handover can create an example.",
            "FORBIDDEN",
          );
        const publicText = `${title} ${description}`.toLowerCase();
        if (
          [
            ctx.booking.userUid,
            ctx.booking.userEmail,
            ctx.booking.userName,
            String(ctx.booking._id),
            String(ctx.service._id),
          ]
            .filter((value) => typeof value === "string" && value.length >= 3)
            .some((value) => publicText.includes(value.toLowerCase())) ||
          /[^\s@]+@[^\s@]+\.[^\s@]+/.test(publicText) ||
          /\+?\d[\d ()-]{7,}\d/.test(publicText)
        )
          fail(
            400,
            "Remove customer names, contact details and device/record identifiers from public text.",
            "IDENTIFIERS_NOT_ALLOWED",
          );
        const guard = `gallery:${req.user.uid}`,
          old = await tx.operationMeta.findOne({ _id: guard });
        if (old)
          await tx.operationMeta.updateOne(
            { _id: guard },
            { $set: { revision: (old.revision || 0) + 1 } },
          );
        else await tx.operationMeta.insertOne({ _id: guard, revision: 1 });
        if (
          (await tx.examples.countDocuments({ providerUid: req.user.uid })) >=
          10
        )
          fail(
            409,
            "Keep up to ten examples per provider; delete an older one first.",
            "EXAMPLE_LIMIT",
          );
        const id = exampleId(String(ctx.booking._id));
        if (await tx.examples.findOne({ _id: id }))
          fail(409, "This repair already has an example.", "EXAMPLE_EXISTS");
        await tx.examples.insertOne({
          _id: id,
          bookingId: String(ctx.booking._id),
          serviceId: String(ctx.service._id),
          providerUid: req.user.uid,
          customerUid: ctx.booking.userUid,
          providerName: ctx.service.providerName,
          title: title.trim(),
          description: description.trim(),
          state: "draft",
          revision: 0,
          customerConsent: false,
          before: false,
          after: false,
          createdAt: clock(),
          updatedAt: clock(),
        });
      });
      res.status(201).json({ acknowledged: true });
    },
    gate: async (req, res, next) => {
      const row = await owned(await collections(), req);
      if (
        !vault ||
        row.providerUid !== req.user.uid ||
        !req.access.canProvide ||
        row.state !== "draft"
      )
        fail(
          403,
          "Only this draft's approved provider may upload images.",
          "FORBIDDEN",
        );
      if (
        !["before", "after"].includes(req.params.slot) ||
        !/^(0|[1-9]\d{0,8})$/.test(req.get("X-Example-Revision") || "") ||
        Number(req.get("X-Example-Revision")) !== row.revision
      )
        fail(409, "Reload this draft before uploading.", "STALE_EXAMPLE");
      if (!["image/jpeg", "image/png"].includes(req.get("Content-Type")))
        fail(415, "Choose an actual JPEG or PNG image.", "IMAGE_TYPE");
      if (
        req.get("X-Example-Policy") !== POLICY ||
        req.get("X-Image-Rights") !== "confirmed"
      )
        fail(
          400,
          "Confirm image rights and the current review/publication policy.",
          "POLICY_REQUIRED",
        );
      if (inflight >= 2)
        fail(429, "Image processing is busy. Retry shortly.", "UPLOAD_BUSY");
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
    },
    upload: async (req, res) => {
      let normalized;
      try {
        normalized = await sanitizeReceipt(req.body, req.get("Content-Type"));
      } catch (error) {
        fail(
          error.status || 415,
          "This gallery image is unsupported, damaged or too large.",
          "IMAGE_INVALID",
        );
      }
      const db = await collections();
      await retryTransaction(db, async (tx) => {
        const row = await owned(tx, req);
        if (
          row.providerUid !== req.user.uid ||
          !req.access.canProvide ||
          row.state !== "draft" ||
          row.revision !== Number(req.get("X-Example-Revision"))
        )
          fail(409, "Reload this draft before uploading.", "STALE_EXAMPLE");
        const quotaId = `gallery-upload:${req.user.uid}`,
          quota = await tx.operationMeta.findOne({ _id: quotaId }),
          minute = Math.floor(clock().getTime() / 60000),
          count = quota?.minute === minute ? quota.count : 0;
        if (count >= 10)
          fail(
            429,
            "Up to ten gallery image uploads per minute are allowed.",
            "UPLOAD_LIMIT",
          );
        if (quota)
          await tx.operationMeta.updateOne(
            { _id: quotaId },
            { $set: { minute, count: count + 1 } },
          );
        else
          await tx.operationMeta.insertOne({
            _id: quotaId,
            minute,
            count: count + 1,
          });
        const id = `${row._id}:${req.params.slot}`,
          file = await tx.exampleFiles.findOne({ _id: id });
        const fields = {
          ...vault.seal(normalized.data, {
            ownerUid: row.providerUid,
            deviceId: `gallery:${row.bookingId}`,
            id,
          }),
          size: normalized.data.length,
        };
        const ownerFiles = await tx.exampleFiles
          .find({ ownerUid: row.providerUid })
          .limit(21)
          .toArray();
        if (
          ownerFiles.reduce((sum, f) => sum + f.size, 0) +
            normalized.data.length -
            (file?.size || 0) >
          20 * 1024 * 1024
        )
          fail(
            409,
            "Gallery images are limited to 20 MiB per provider. Delete an older example first.",
            "STORAGE_LIMIT",
          );
        const global = await tx.operationMeta.findOne({
            _id: "gallery:storage",
          }),
          bytes =
            (global?.bytes || 0) + normalized.data.length - (file?.size || 0);
        if (bytes > 100 * 1024 * 1024)
          fail(
            409,
            "Gallery storage capacity has been reached. Contact the platform operator.",
            "STORAGE_LIMIT",
          );
        if (global)
          await tx.operationMeta.updateOne(
            { _id: "gallery:storage" },
            { $set: { bytes } },
          );
        else
          await tx.operationMeta.insertOne({ _id: "gallery:storage", bytes });
        if (file)
          await tx.exampleFiles.updateOne({ _id: id }, { $set: fields });
        else
          await tx.exampleFiles.insertOne({
            _id: id,
            exampleId: String(row._id),
            ownerUid: row.providerUid,
            ...fields,
          });
        await tx.examples.updateOne(
          { _id: row._id, revision: row.revision },
          {
            $set: {
              [req.params.slot]: true,
              revision: row.revision + 1,
              updatedAt: clock(),
            },
          },
        );
      });
      res.json({ acknowledged: true });
    },
    privateImage: async (req, res) => {
      const db = await collections();
      await media(db, await owned(db, req), req.params.slot, res);
    },
    submit: async (req, res) => {
      checkKeys(req.body, ["confirmed", "expectedRevision"]);
      const db = await collections();
      await retryTransaction(db, async (tx) => {
        const row = await owned(tx, req);
        confirm(req.body, row);
        if (
          row.providerUid !== req.user.uid ||
          !req.access.canProvide ||
          row.state !== "draft" ||
          !row.before ||
          !row.after
        )
          fail(
            409,
            "Both images and a provider review are required for this draft.",
            "INVALID_STATE",
          );
        await tx.examples.updateOne(
          { _id: row._id, revision: row.revision },
          {
            $set: {
              state: "awaiting_customer",
              revision: row.revision + 1,
              updatedAt: clock(),
            },
          },
        );
      });
      res.json({ acknowledged: true });
    },
    consent: async (req, res) => {
      checkKeys(req.body, [
        "confirmed",
        "expectedRevision",
        "grant",
        "policyVersion",
      ]);
      const db = await collections();
      await retryTransaction(db, async (tx) => {
        const row = await owned(tx, req);
        confirm(req.body, row);
        if (
          row.customerUid !== req.user.uid ||
          row.state !== "awaiting_customer" ||
          typeof req.body.grant !== "boolean" ||
          (req.body.grant && req.body.policyVersion !== POLICY)
        )
          fail(
            403,
            "Only the customer can consent to this exact public example.",
            "FORBIDDEN",
          );
        await tx.examples.updateOne(
          { _id: row._id, revision: row.revision },
          {
            $set: {
              state: req.body.grant ? "pending_moderation" : "withdrawn",
              customerConsent: req.body.grant,
              consentAt: clock(),
              consentPolicy: POLICY,
              revision: row.revision + 1,
              updatedAt: clock(),
              ...(!req.body.grant ? { before: false, after: false } : {}),
            },
          },
        );
        if (!req.body.grant) await eraseMedia(tx, row);
      });
      res.json({ acknowledged: true });
    },
    withdraw: async (req, res) => {
      checkKeys(req.body, ["confirmed", "expectedRevision"]);
      const db = await collections();
      await retryTransaction(db, async (tx) => {
        const row = await owned(tx, req);
        confirm(req.body, row);
        await eraseMedia(tx, row);
        await tx.examples.deleteOne({ _id: row._id, revision: row.revision });
      });
      res.json({ acknowledged: true });
    },
    queue: async (req, res) => {
      const db = await collections(),
        filter = queryFilter(req.query, {
          states: [
            "draft",
            "awaiting_customer",
            "pending_moderation",
            "published",
            "rejected",
            "withdrawn",
          ],
        });
      const page = await pageDocs(db.examples, filter, req.query, {
        scope: "gallery-admin",
      });
      res.json({
        ...page,
        items: page.items.map((row) => ({
          _id: String(row._id),
          state: row.state,
          revision: row.revision,
          providerName: row.providerName,
        })),
      });
    },
    inspect: async (req, res) => {
      sensitiveInput(req, clock);
      const db = await collections();
      let row;
      await retryTransaction(db, async (tx) => {
        row = await tx.examples.findOne({ _id: idValue(req.params.exampleId) });
        if (!row) fail(404, "Example not found.", "NOT_FOUND");
        confirm(req.body, row);
        await recordAudit(tx, req, clock, {
          action: "gallery.inspect",
          target: String(row._id),
          after: { revision: row.revision },
        });
      });
      res.json({ item: privateView(row) });
    },
    adminImage: async (req, res) => {
      const db = await collections(),
        row = await db.examples.findOne({ _id: idValue(req.params.exampleId) });
      if (!row) fail(404, "Example not found.", "NOT_FOUND");
      await inspected(db, req, row);
      await media(db, row, req.params.slot, res);
    },
    moderate: async (req, res) => {
      sensitiveInput(req, clock, ["publish"]);
      if (typeof req.body.publish !== "boolean")
        fail(400, "Choose a moderation decision.", "VALIDATION_ERROR");
      const db = await collections();
      await retryTransaction(db, async (tx) => {
        const row = await tx.examples.findOne({
          _id: idValue(req.params.exampleId),
        });
        if (!row) fail(404, "Example not found.", "NOT_FOUND");
        confirm(req.body, row);
        await inspected(tx, req, row);
        if (
          req.body.publish &&
          (row.state !== "pending_moderation" ||
            !row.customerConsent ||
            !row.before ||
            !row.after)
        )
          fail(
            409,
            "Fresh customer consent and both reviewed images are required.",
            "INVALID_STATE",
          );
        if (
          req.body.publish &&
          !(
            (await tx.exampleFiles.findOne({ _id: `${row._id}:before` })) &&
            (await tx.exampleFiles.findOne({ _id: `${row._id}:after` }))
          )
        )
          fail(409, "Both images must be present.", "INVALID_STATE");
        if (req.body.publish) {
          if (!vault)
            fail(503, "Gallery storage is unavailable.", "STORAGE_UNAVAILABLE");
          for (const slot of ["before", "after"]) {
            const file = await tx.exampleFiles.findOne({
              _id: `${row._id}:${slot}`,
            });
            vault.open(file, {
              ownerUid: row.providerUid,
              deviceId: `gallery:${row.bookingId}`,
              id: `${row._id}:${slot}`,
            });
          }
        }
        const state = req.body.publish ? "published" : "rejected";
        await tx.examples.updateOne(
          { _id: row._id, revision: row.revision },
          {
            $set: {
              state,
              revision: row.revision + 1,
              publishedAt: req.body.publish ? clock() : null,
              updatedAt: clock(),
            },
          },
        );
        await recordAudit(tx, req, clock, {
          action: req.body.publish ? "gallery.publish" : "gallery.hide",
          target: String(row._id),
          before: { state: row.state },
          after: { state },
        });
      });
      res.json({ acknowledged: true });
    },
  };
};
module.exports = { createRepairGallery, POLICY };
