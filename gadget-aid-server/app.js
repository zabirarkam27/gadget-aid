const { serviceCategory } = require("./categories");
const { createDiscoveryTools } = require("./discovery-tools");
const { createRepairGallery } = require("./repair-gallery");
const { createLoyalty } = require("./loyalty");
const { createRepairAssistant } = require("./repair-assistant");
const { listPage, catalogueFilter, input: listInput, search: listSearch } = require("./listings");
const { createPassports } = require("./passports");
const { createReceipts, MAX_BYTES } = require("./receipts");
const { accessFor, requireProvider, visibleServices } = require("./access");
const { createOperations } = require("./operations");
const { createDisputes } = require("./disputes");
const { createTechnicians, reserveBooking } = require("./technicians");
const { createReviews } = require("./reviews");
const { createCommunication } = require("./communication");
const { createWorkflow, initialRepair } = require("./workflow");
const express = require("express");
const cors = require("cors");
const { requestLimiter } = require("./request-limits");
const {
  HttpError,
  fail,
  checkKeys,
  idValue,
  priceValue,
  photoUrl,
  validateService,
  todayInDhaka,
  validDate,
  serviceOwner,
  ownerQuery,
  customerQuery,
  serializeService,
  serializeBooking,
  bookingId,
} = require("./domain");

const createApp = ({
  getCollections,
  verifyIdToken,
  origins = ["http://localhost:5173"],
  clock = () => new Date(),
  logger = { error() {} },
  sendEmail = null,
  jobSecret = "",
  appUrl = "http://localhost:5173",
  identityDirectory = null,
  receiptVault = null,
  repairClassifier = null,
  vercel = false,
}) => {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: origins }));
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    next();
  });
  app.use(requestLimiter({ clock, vercel }));
  app.use(express.json({ limit: "64kb" }));
  const collections = async () => {
    try {
      const db = await getCollections();
      if (!db?.services || !db?.bookings) throw new Error();
      return db;
    } catch {
      throw new HttpError(
        503,
        "The database is unavailable. Please try again.",
        "SERVICE_UNAVAILABLE",
      );
    }
  };
  const authenticated = async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
    if (!match)
      return res
        .status(401)
        .json({ message: "Log in to continue.", code: "UNAUTHENTICATED" });
    try {
      const decoded = await verifyIdToken(match[1], true);
      const uid = decoded?.uid || decoded?.sub;
      if (
        typeof uid !== "string" ||
        !uid ||
        typeof decoded.email !== "string" ||
        !decoded.email.trim()
      )
        throw new Error();
      req.rawToken = match[1];
      req.user = {
        uid,
        emailVerified: decoded.email_verified === true,
        authTime: decoded.auth_time,
        email: decoded.email.trim(),
        name:
          typeof decoded.name === "string"
            ? decoded.name.trim().slice(0, 120)
            : "",
        photo: photoUrl(decoded.picture),
      };
    } catch {
      return res.status(401).json({
        message: "Your session has expired. Log in again.",
        code: "UNAUTHENTICATED",
      });
    }
    try {
      req.access = await accessFor(await collections(), req.user);
      req.user.canProvide = req.access.canProvide;
      req.user.restricted = req.access.restricted;
      const allowed =
        (req.method === "POST" && /^\/examples\/[a-f0-9]{24}\/withdraw$/.test(req.path)) ||
        (req.method === "DELETE" && /^\/saved-technicians\/[a-f0-9]{24}$/.test(req.path)) ||
        req.method === "GET" ||
        req.method === "HEAD" ||
        req.path === "/notifications/read" ||
        (req.method === "DELETE" &&
          /^\/devices\/[a-f0-9]{24}$/.test(req.path)) ||
        (req.method === "DELETE" &&
          /^\/devices\/[a-f0-9]{24}\/receipts\/[a-f0-9]{24}$/.test(req.path)) ||
        /^\/bookings\/[a-f0-9]{24}\/warranty\/claims$/.test(req.path) ||
        /^\/bookings\/[a-f0-9]{24}\/(cancel|disputes|messages\/read)$/.test(
          req.path,
        );
      if (req.access.restricted && !allowed)
        fail(
          403,
          "This account is restricted. Existing records and dispute support remain available.",
          "ACCOUNT_RESTRICTED",
        );
      next();
    } catch (error) {
      next(error);
    }
  };
  app.get("/", (req, res) => res.send("Gadget aid server is running"));
  const discovery = createDiscoveryTools({ collections, clock });
  const loyalty=createLoyalty({collections,clock});
  app.get("/loyalty",authenticated,loyalty.wallet);
  app.get("/loyalty/redemptions",authenticated,loyalty.redemptions);
  app.post("/loyalty/referral",authenticated,loyalty.claim);
  const gallery = createRepairGallery({collections,clock,vault:receiptVault});
  app.get("/repair-gallery",gallery.publicList);
  app.get("/repair-gallery/:exampleId/images/:slot",gallery.publicImage);
  app.get("/bookings/:id/example",authenticated,gallery.bookingRead);
  app.post("/bookings/:id/example",authenticated,requireProvider,gallery.create);
  app.post("/examples/:exampleId/images/:slot",authenticated,gallery.gate,express.raw({type:["image/jpeg","image/png"],limit:MAX_BYTES}),gallery.upload);
  app.get("/examples/:exampleId/images/:slot",authenticated,gallery.privateImage);
  app.post("/examples/:exampleId/submit",authenticated,requireProvider,gallery.submit);
  app.post("/examples/:exampleId/consent",authenticated,gallery.consent);
  app.post("/examples/:exampleId/withdraw",authenticated,gallery.withdraw);
  app.get("/tools/compare", discovery.compare);
  app.post("/tools/estimate", discovery.estimate);
  app.get("/saved-technicians", authenticated, discovery.saved);
  app.post("/saved-technicians", authenticated, discovery.save);
  app.delete("/saved-technicians/:id", authenticated, discovery.remove);
  const repairAssistant = createRepairAssistant({ collections, clock, classify: repairClassifier });
  app.get("/repair-assistant/config", authenticated, repairAssistant.configuration);
  app.post("/repair-assistant", authenticated, repairAssistant.suggest);
  app.get("/health", async (req, res) => {
    await collections();
    res.json({ status: "ready" });
  });

  app.get("/services", async (req, res) => {
    const db = await collections();
    if (req.query.paged === "1") {
      const page = await listPage({ collection: db.services, filter: catalogueFilter(req.query), query: req.query, scope: "catalogue", price: true, visible: (rows) => visibleServices(db, rows) });
      return res.json({ ...page, items: page.items.map(serializeService) });
    }
    res.json(
      (
        await visibleServices(
          db,
          await db.services.find({ deletedAt: null }).limit(100).toArray(),
        )
      ).map(serializeService),
    );
  });
  app.get("/services/:id", async (req, res) => {
    const id = idValue(req.params.id),
      db = await collections();
    const service = await db.services.findOne({ _id: id, deletedAt: null });
    if (!service || !(await visibleServices(db, [service])).length)
      fail(404, "Service not found.", "NOT_FOUND");
    res.json(serializeService(service));
  });
  app.get("/my-services", authenticated, async (req, res) => {
    const db = await collections();
    if (req.query.paged === "1") {
      listInput(req.query, ["paged", "limit", "cursor", "q", "area"]);
      const filter = { $and: [ownerQuery(req.user), { deletedAt: null }, listSearch(req.query.q, ["name"]), ...(req.query.area ? [listSearch(req.query.area, ["area"])] : [])] };
      const page = await listPage({ collection: db.services, filter, query: req.query, scope: `services:${req.user.uid}` });
      const controls = new Map((await db.entityControls.find({ _id: { $in: page.items.map(s => `service:${s._id}`) } }).toArray()).map(row => [row._id, row]));
      return res.json({ ...page, items: page.items.map(service => ({ ...serializeService(service), publication: { state: controls.get(`service:${service._id}`)?.state || "visible", note: controls.get(`service:${service._id}`)?.publicNote || "" } })) });
    }
    const owned = (
      await db.services
        .find({ ...ownerQuery(req.user), deletedAt: null })
        .sort({ _id: -1 }).limit(100)
        .toArray()
    ).filter((service) => serviceOwner(service, req.user));
    const controls = new Map(
      (
        await db.entityControls
          .find({ _id: { $in: owned.map((s) => `service:${s._id}`) } })
          .toArray()
      ).map((row) => [row._id, row]),
    );
    res.json(
      owned.map((service) => ({
        ...serializeService(service),
        publication: {
          state: controls.get(`service:${service._id}`)?.state || "visible",
          note: controls.get(`service:${service._id}`)?.publicNote || "",
        },
      })),
    );
  });
  app.post("/services", authenticated, requireProvider, async (req, res) => {
    // Old clients may still send display snapshots; they are never authoritative.
    checkKeys(req.body, [
      "name",
      "price",
      "area",
      "description",
      "image",
      "providerEmail",
      "providerName",
      "providerImage",
      "providerPhoto",
      "createdAt",
      "categoryId",
    ]);
    if (
      req.body.providerEmail !== undefined &&
      req.body.providerEmail !== req.user.email
    )
      fail(403, "You can only list your own services.", "FORBIDDEN");
    const db = await collections(),
      { services } = db,
      fields = {
        ...validateService(req.body),
        ...(await serviceCategory(db, req.body.categoryId)),
      };
    const record = {
      ...fields,
      providerUid: req.user.uid,
      providerEmail: req.user.email,
      providerName: req.user.name || "Service provider",
      providerPhoto: req.user.photo,
      createdAt: clock(),
    };
    const result = await services.insertOne(record);
    res.status(201).json({ acknowledged: true, insertedId: result.insertedId });
  });
  app.put("/services/:id", authenticated, requireProvider, async (req, res) => {
    const id = idValue(req.params.id);
    checkKeys(req.body, [
      "name",
      "price",
      "area",
      "description",
      "image",
      "categoryId",
    ]);
    const { services } = await collections(),
      service = await services.findOne({ _id: id, deletedAt: null });
    if (!service) fail(404, "Service not found.", "NOT_FOUND");
    if (!serviceOwner(service, req.user))
      fail(403, "You cannot change this service.", "FORBIDDEN");
    const fields = {
      ...validateService(req.body),
      ...(await serviceCategory(
        await collections(),
        req.body.categoryId,
        service,
      )),
    };
    const result = await services.updateOne(
      { _id: id, deletedAt: null },
      { $set: { ...fields, updatedAt: clock() } },
    );
    res.json({
      acknowledged: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  });
  app.delete(
    "/services/:id",
    authenticated,
    requireProvider,
    async (req, res) => {
      const id = idValue(req.params.id),
        { services } = await collections(),
        service = await services.findOne({ _id: id, deletedAt: null });
      if (!service) fail(404, "Service not found.", "NOT_FOUND");
      if (!serviceOwner(service, req.user))
        fail(403, "You cannot remove this service.", "FORBIDDEN");
      // Retain the ownership reference for existing bookings; never migrate old records.
      const result = await services.updateOne(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: clock(), updatedAt: clock() } },
      );
      res.json({ acknowledged: true, deletedCount: result.modifiedCount });
    },
  );

  app.post("/bookings", authenticated, async (req, res) => {
    checkKeys(req.body, [
      "serviceId",
      "date",
      "instruction",
      "serviceName",
      "serviceImage",
      "providerEmail",
      "providerName",
      "price",
      "status",
      "userName",
      "userEmail",
      "time",
      "deviceType",
      "deviceBrand",
      "deviceModel",
    ]);
    const deviceDetails = {};
    for (const field of ["deviceType", "deviceBrand", "deviceModel"]) {
      const value = req.body[field];
      if (value !== undefined && (typeof value !== "string" || !value.trim() || value.trim().length > 80))
        fail(400, "Device details must be 1–80 characters.", "VALIDATION_ERROR", { [field]: "Use 1–80 characters." });
      if (value !== undefined) deviceDetails[field] = value.trim();
    }
    if (Object.keys(deviceDetails).length && (Object.keys(deviceDetails).length !== 3 || typeof req.body.instruction !== "string" || req.body.instruction.trim().length < 10))
      fail(400, "Add device type, brand, model and at least 10 characters describing the problem.", "VALIDATION_ERROR");
    const id = idValue(req.body.serviceId);
    if (!validDate(req.body.date) || req.body.date < todayInDhaka(clock()))
      fail(
        400,
        "Choose today or a future date in Bangladesh time.",
        "VALIDATION_ERROR",
        { date: "Choose today or a future date." },
      );
    if (
      req.body.instruction !== undefined &&
      (typeof req.body.instruction !== "string" ||
        req.body.instruction.length > 2000)
    )
      fail(
        400,
        "Keep repair instructions within 2,000 characters.",
        "VALIDATION_ERROR",
        { instruction: "Use up to 2,000 characters." },
      );
    const { services, bookings } = await collections(),
      service = await services.findOne({ _id: id, deletedAt: null });
    if (!service) fail(404, "Service not found.", "NOT_FOUND");
    const canonical = serializeService(service);
    if (!canonical.bookable)
      fail(
        409,
        "This service is not accepting new bookings.",
        "SERVICE_UNAVAILABLE",
      );
    for (const field of [
      "serviceName",
      "serviceImage",
      "providerEmail",
      "providerName",
    ]) {
      const expected = {
        serviceName: canonical.name,
        serviceImage: canonical.image,
        providerEmail: canonical.providerEmail,
        providerName: canonical.providerName,
      }[field];
      if (req.body[field] !== undefined && req.body[field] !== expected)
        fail(
          400,
          "The service details have changed or are invalid. Reload the service and try again.",
          "INVALID_SERVICE_SNAPSHOT",
        );
    }
    if (
      req.body.price !== undefined &&
      (priceValue(req.body.price) === null ||
        priceValue(req.body.price) !== canonical.price)
    )
      fail(
        400,
        "The listed price has changed or is invalid. Reload the service and try again.",
        "INVALID_SERVICE_SNAPSHOT",
      );
    if (req.body.status !== undefined && req.body.status !== "pending")
      fail(400, "New bookings must start as pending.", "INVALID_STATUS");
    if (
      req.body.userEmail !== undefined &&
      req.body.userEmail !== req.user.email
    )
      fail(403, "You can only book for your own account.", "FORBIDDEN");
    const serviceId = String(id),
      date = req.body.date;
    const existing = await bookings.findOne({
      $and: [
        customerQuery(req.user),
        { serviceId: { $in: [serviceId, id] }, date },
      ],
    });
    if (existing)
      return res.status(409).json({
        message:
          "You already have a booking for this service and date. Check My bookings.",
        code: "DUPLICATE_BOOKING",
        bookingId: existing._id,
      });
    const record = {
      _id: bookingId(req.user, serviceId, date),
      serviceId,
      serviceName: canonical.name,
      serviceImage: canonical.image,
      providerUid:
        typeof service.providerUid === "string" ? service.providerUid : null,
      providerEmail: canonical.providerEmail,
      providerName: canonical.providerName,
      userUid: req.user.uid,
      userEmail: req.user.email,
      userName: req.user.name,
      date,
      instruction: (req.body.instruction || "").trim(),
      ...deviceDetails,
      price: canonical.price,
      status: "pending",
      createdAt: clock(),
      updatedAt: clock(),
    };
    Object.assign(record, initialRepair(record, req.user, clock(), true));
    try {
      if (!(await collections()).technicians)
        fail(503, "Scheduling is unavailable.", "SERVICE_UNAVAILABLE");
      await reserveBooking(
        await collections(),
        record,
        service,
        req.body.time,
        clock,
      );
      res.status(201).json({
        acknowledged: true,
        insertedId: record._id,
        bookingId: record._id,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const duplicate = await bookings.findOne({
        _id: record._id,
        ...customerQuery(req.user),
      });
      if (!duplicate) throw error;
      res.status(409).json({
        message:
          "You already have a booking for this service and date. Check My bookings.",
        code: "DUPLICATE_BOOKING",
        bookingId: duplicate._id,
      });
    }
  });
  app.get("/bookings", authenticated, async (req, res) => {
    const { bookings } = await collections();
    if (req.query.paged === "1") return bookingPage(req, res, bookings, customerQuery(req.user), ["serviceName", "providerName"]);
    res.json(
      (await bookings.find(customerQuery(req.user)).sort({ _id: -1 }).limit(100).toArray()).map(
        serializeBooking,
      ),
    );
  });
  async function bookingPage(req, res, bookings, ownership, fields) {
    listInput(req.query, ["paged", "limit", "cursor", "q", "status"]);
    const { STATUSES } = require("./workflow-model");
    if (req.query.status && ![...STATUSES, "unknown"].includes(req.query.status)) fail(400, "Choose a valid repair status.", "VALIDATION_ERROR");
    const prefix = [{ $match: ownership },
      { $set: { listRawStatus: { $cond: [{ $in: [{ $ifNull: ["$status", ""] }, [""]] }, { $ifNull: ["$serviceStatus", "pending"] }, "$status"] } } },
      { $set: { listStatus: { $cond: [{ $eq: ["$listRawStatus", "working"] }, "repairing", { $toLower: { $convert: { input: "$listRawStatus", to: "string", onError: "unknown", onNull: "pending" } } }] } } },
    ];
    const filter = { ...listSearch(req.query.q, fields), ...(req.query.status ? { listStatus: req.query.status } : {}) };
    const page = await listPage({ collection: bookings, filter, query: req.query, prefix, scope: `bookings:${req.path}:${req.user.uid}` });
    const groups = await bookings.aggregate([...prefix, { $group: { _id: "$listStatus", count: { $sum: 1 } } }], { maxTimeMS: 5000 }).toArray();
    const count = (states) => groups.filter(g => states.includes(g._id)).reduce((sum, g) => sum + g.count, 0);
    res.json({ ...page, items: page.items.map(serializeBooking), summary: [
      { label: "Open requests", value: count(["pending", "confirmed", "device_received", "diagnosing", "quotation_sent", "awaiting_approval", "approved"]) },
      { label: "In progress", value: count(["repairing", "quality_check", "ready_for_collection"]) },
      { label: "Completed", value: count(["completed"]) },
    ] });
  }
  app.get("/all-bookings", authenticated, async (req, res) => {
    const { services, bookings } = await collections();
    const owned = (await services.find(ownerQuery(req.user), { projection: { _id: 1, providerUid: 1, providerEmail: 1 } }).toArray()).filter(
      (service) => serviceOwner(service, req.user),
    );
    const ids = owned.flatMap((service) => [service._id, String(service._id)]);
    if (req.query.paged === "1") return bookingPage(req, res, bookings, { serviceId: { $in: ids } }, ["serviceName", "userEmail", "userName"]);
    res.json(
      (await bookings.find({ serviceId: { $in: ids } }).sort({ _id: -1 }).limit(100).toArray()).map(
        serializeBooking,
      ),
    );
  });
  const workflow = createWorkflow({ collections, clock, serializeBooking });
  app.get("/bookings/:id", authenticated, workflow.read);
  app.patch(
    "/all-bookings/:id",
    authenticated,
    requireProvider,
    workflow.transition,
  );
  app.post(
    "/bookings/:id/diagnoses",
    authenticated,
    requireProvider,
    workflow.diagnosis,
  );
  app.post(
    "/bookings/:id/quotations",
    authenticated,
    requireProvider,
    workflow.quotation,
  );
  app.post(
    "/bookings/:id/quotations/:quoteId/decision",
    authenticated,
    workflow.decision,
  );
  app.post(
    "/bookings/:id/quotations/:quoteId/questions",
    authenticated,
    workflow.clarification,
  );
  app.post(
    "/bookings/:id/quotations/:quoteId/questions/:questionId/answer",
    authenticated,
    requireProvider,
    workflow.answer,
  );
  app.post("/bookings/:id/cancel", authenticated, workflow.cancel);
  const communication = createCommunication({
    collections,
    clock,
    sendEmail,
    jobSecret,
    appUrl,
  });
  app.get("/notifications", authenticated, communication.notifications);
  app.post(
    "/notifications/read",
    authenticated,
    communication.markNotifications,
  );
  app.get("/bookings/:id/messages", authenticated, communication.readThread);
  app.post("/bookings/:id/messages", authenticated, communication.sendMessage);
  app.post(
    "/bookings/:id/messages/read",
    authenticated,
    communication.markThread,
  );
  app.get("/internal/jobs/email", communication.deliver);
  const technicians = createTechnicians({ collections, clock });
  app.get("/my-technician", authenticated, technicians.self);
  app.put("/my-technician", authenticated, requireProvider, technicians.save);
  app.get("/technicians/:id", technicians.read);
  app.get("/services/:id/availability", technicians.availability);
  const reviews = createReviews({ collections, clock });
  app.get("/technicians/:id/reviews", reviews.list);
  app.get("/bookings/:id/review", authenticated, reviews.own);
  app.post("/bookings/:id/review", authenticated, reviews.create);
  app.post(
    "/reviews/:id/response",
    authenticated,
    requireProvider,
    reviews.response,
  );
  app.post("/reviews/:id/report", authenticated, reviews.report);
  const operations = createOperations({
    collections,
    clock,
    verifyIdToken,
    identityDirectory,
  });
  app.get("/my-capabilities", authenticated, operations.capabilities);
  app.use("/devices", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const passports = createPassports({ collections, clock });
  const receipts = createReceipts({ collections, clock, vault: receiptVault });
  app.get("/devices/:id/receipts", authenticated, receipts.list);
  app.post(
    "/devices/:id/receipts",
    authenticated,
    receipts.gate,
    express.raw({ type: ["image/jpeg", "image/png"], limit: MAX_BYTES }),
    receipts.upload,
  );
  app.get(
    "/devices/:id/receipts/:receiptId/content",
    authenticated,
    receipts.download,
  );
  app.delete(
    "/devices/:id/receipts/:receiptId",
    authenticated,
    receipts.remove,
  );
  app.get("/devices", authenticated, passports.list);
  app.post("/devices", authenticated, passports.create);
  app.get("/devices/:id", authenticated, passports.read);
  app.put("/devices/:id", authenticated, passports.update);
  app.delete("/devices/:id", authenticated, passports.remove);
  app.get("/devices/:id/history", authenticated, passports.history);
  app.get("/devices/:id/export", authenticated, passports.exportData);
  app.get("/bookings/:id/passport", authenticated, passports.bookingRead);
  app.put("/bookings/:id/device", authenticated, passports.link);
  app.post(
    "/bookings/:id/warranty",
    authenticated,
    requireProvider,
    passports.issue,
  );
  app.post("/bookings/:id/warranty/claims", authenticated, passports.claim);
  app.post(
    "/bookings/:id/warranty/decision",
    authenticated,
    requireProvider,
    passports.decide,
  );
  app.post("/technician-application", authenticated, operations.apply);
  app.use("/admin", authenticated, operations.guard);
  app.get("/admin/gallery",gallery.queue);
  app.post("/admin/gallery/:exampleId/inspect",gallery.inspect);
  app.get("/admin/gallery/:exampleId/images/:slot",gallery.adminImage);
  app.post("/admin/gallery/:exampleId/moderate",gallery.moderate);
  app.get("/admin/overview", operations.overview);
  app.get("/admin/customers", operations.customers);
  for (const [route, kind] of [
    ["bookings", "bookings"],
    ["services", "services"],
    ["technicians", "technicians"],
    ["applications", "applications"],
    ["roles", "roleGrants"],
    ["reviews", "reviews"],
    ["reports", "reviewReports"],
    ["disputes", "disputes"],
    ["categories", "categories"],
    ["audit", "auditLogs"],
    ["email", "notifications"],
  ])
    app.get(`/admin/${route}`, operations.list(kind));
  for (const kind of [
    "customer",
    "booking",
    "dispute",
    "review",
    "report",
    "application",
    "service",
    "technician",
  ])
    app.post(`/admin/inspect/${kind}/:id`, operations.inspect(kind));
  app.post("/admin/accounts/:id/state", operations.account);
  app.get("/admin/role-target/:id", operations.roleTarget);
  app.post("/admin/roles/:id", operations.roles);
  app.post("/admin/applications/:id/decision", operations.application);
  app.post(
    "/admin/services/:id/publication",
    operations.publication("service"),
  );
  app.post(
    "/admin/technicians/:id/publication",
    operations.publication("technician"),
  );
  app.post("/admin/reviews/:id/moderate", operations.review);
  app.post("/admin/reports/:id/resolve", operations.report);
  app.post("/admin/disputes/:id/resolve", operations.dispute);
  app.post("/admin/categories", operations.category);
  app.post("/admin/categories/:id", operations.category);
  const disputes = createDisputes({ collections, clock });
  app.post("/bookings/:id/disputes", authenticated, disputes.create);
  app.get("/bookings/:id/disputes", authenticated, disputes.bookingList);
  app.get("/my-disputes", authenticated, disputes.mine);
  app.get("/categories", async (req, res) => {
    if (Object.keys(req.query).length)
      fail(400, "Unsupported category filter.", "INVALID_INPUT");
    const db = await collections();
    res.json(
      (
        await db.categories
          .find({ state: "active" })
          .sort({ name: 1, _id: 1 })
          .limit(200)
          .toArray()
      ).map((row) => ({
        _id: String(row._id),
        name: row.name,
        slug: row.slug,
      })),
    );
  });
  app.use((req, res) =>
    res.status(404).json({ message: "Endpoint not found.", code: "NOT_FOUND" }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.parse.failed")
      return res
        .status(400)
        .json({ message: "Send valid JSON.", code: "INVALID_JSON" });
    if (error.type === "entity.too.large")
      return res.status(413).json({
        message: "The request is too large.",
        code: "REQUEST_TOO_LARGE",
      });
    if (error instanceof HttpError)
      return res.status(error.status).json({
        message: error.message,
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      });
    logger.error("Request failed.");
    res.status(500).json({
      message: "The request could not be completed. Please try again.",
      code: "INTERNAL_ERROR",
    });
  });
  return app;
};
module.exports = { createApp };
