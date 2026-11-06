// Local-only test: never loads dotenv or index.js; fixed disposable replica set.
const test = require("node:test"),
  assert = require("node:assert/strict");
const { once } = require("node:events"),
  { randomUUID, randomBytes } = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb"),
  sharp = require("sharp");
const { createDatabase } = require("../database"),
  { createApp } = require("../app"),
  { initialRepair } = require("../workflow"),
  { createReceiptVault } = require("../receipt-vault");
const {
  createFixture,
  verifyIdToken,
  identityDirectory,
  users,
  fixedTime,
  ids,
} = require("./fixtures.cjs");
const { POLICY: IMAGE_POLICY } = require("../repair-gallery");
test(
  "real MongoDB Phase 12 gallery and wallet transactions enforce publication privacy, byte accounting and one points spend",
  { timeout: 60000 },
  async (t) => {
    const client = new MongoClient(
      "mongodb://127.0.0.1:27028/?replicaSet=rs0&directConnection=true",
      { serverSelectionTimeoutMS: 10000 },
    );
    await client.connect();
    assert.equal(
      (await client.db("admin").command({ hello: 1 })).setName,
      "rs0",
    );
    const name = `gadgetaid_phase12_qa_${randomUUID().replaceAll("-", "")}`;
    t.after(async () => {
      await client.db(name).dropDatabase();
      await client.close();
    });
    const db = createDatabase(client, name),
      fixture = createFixture({ seedBooking: true, seedAdminRoles: true });
    await db.services.insertOne(fixture.service);
    for (const role of fixture.db.roleGrants.rows)
      await db.roleGrants.insertOne(role);
    let failMode = "",
      now = new Date(fixedTime);
    const app = createApp({
      getCollections: async () => ({
        ...db,
        transaction: (work) =>
          db.transaction((tx) =>
            work({
              ...tx,
              auditLogs:
                failMode === "audit"
                  ? {
                      ...tx.auditLogs,
                      insertOne: async () => {
                        throw Error("Synthetic audit outage");
                      },
                    }
                  : tx.auditLogs,
              loyaltySpends:
                failMode === "ledger"
                  ? {
                      ...tx.loyaltySpends,
                      insertOne: async () => {
                        throw Error("Synthetic ledger outage");
                      },
                    }
                  : tx.loyaltySpends,
              exampleFiles:
                failMode === "erase"
                  ? {
                      ...tx.exampleFiles,
                      deleteMany: async () => {
                        throw Error("Synthetic erasure outage");
                      },
                    }
                  : tx.exampleFiles,
            }),
          ),
      }),
      verifyIdToken: async (token) => ({
        ...(await verifyIdToken(token)),
        auth_time: Math.floor(+now / 1000),
      }),
      identityDirectory,
      clock: () => new Date(now),
      receiptVault: createReceiptVault({
        activeKeyId: "qa",
        keys: { qa: randomBytes(32).toString("base64") },
      }),
    });
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });
    const req = async (
      method,
      path,
      body,
      token = "customer",
      headers = {},
    ) => {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": Buffer.isBuffer(body)
              ? "image/png"
              : "application/json",
            ...headers,
          },
          body:
            body === undefined
              ? undefined
              : Buffer.isBuffer(body)
                ? body
                : JSON.stringify(body),
        },
      );
      return {
        status: response.status,
        data: response.headers.get("content-type")?.startsWith("image/")
          ? Buffer.from(await response.arrayBuffer())
          : await response.json(),
      };
    };
    const wallets = await Promise.all(
      Array.from({ length: 3 }, () => req("GET", "/loyalty?limit=20")),
    );
    assert.ok(wallets.every((r) => r.status === 200));
    assert.equal(new Set(wallets.map((r) => r.data.referralCode)).size, 1);
    const saved = await Promise.all(
      Array.from({ length: 4 }, () =>
        req("POST", "/saved-technicians", { serviceId: ids.service }),
      ),
    );
    assert.ok(saved.every((r) => r.status === 200));
    assert.equal(
      await db.savedTechnicians.countDocuments({
        ownerUid: users.customer.uid,
      }),
      1,
    );
    const completed = { ...fixture.booking };
    Object.assign(
      completed,
      initialRepair(completed, users.provider, new Date(now), true),
    );
    completed.status = "completed";
    completed.repair.events.push({
      type: "status_changed",
      status: "completed",
      actor: { uid: users.provider.uid, role: "provider" },
      createdAt: new Date(now),
    });
    await db.bookings.insertOne(completed);
    assert.equal(
      (
        await req(
          "POST",
          `/bookings/${ids.booking}/example`,
          {
            title: "Synthetic repaired connector",
            description:
              "Synthetic before and after images with no personal identifiers.",
          },
          "provider",
        )
      ).status,
      201,
    );
    let example = (await req("GET", `/bookings/${ids.booking}/example`)).data
      .item;
    const png = await sharp({
      create: { width: 80, height: 80, channels: 3, background: "#44aa88" },
    })
      .png()
      .toBuffer();
    for (const slot of ["before", "after"]) {
      const uploaded = await req(
        "POST",
        `/examples/${example._id}/images/${slot}`,
        png,
        "provider",
        {
          "X-Example-Revision": String(example.revision),
          "X-Example-Policy": IMAGE_POLICY,
          "X-Image-Rights": "confirmed",
        },
      );
      assert.equal(uploaded.status, 200);
      example = (await req("GET", `/bookings/${ids.booking}/example`)).data
        .item;
    }
    assert.equal(
      await db.exampleFiles.countDocuments({ exampleId: example._id }),
      2,
    );
    const storedBytes = (
      await db.exampleFiles.find({ exampleId: example._id }).toArray()
    ).reduce((sum, file) => sum + file.size, 0);
    assert.equal(
      (await db.operationMeta.findOne({ _id: "gallery:storage" })).bytes,
      storedBytes,
    );
    assert.equal(
      (await req("GET", `/repair-gallery/${example._id}/images/before`)).status,
      404,
    );
    await req(
      "POST",
      `/examples/${example._id}/submit`,
      { expectedRevision: example.revision, confirmed: true },
      "provider",
    );
    example = (await req("GET", `/bookings/${ids.booking}/example`)).data.item;
    await req("POST", `/examples/${example._id}/consent`, {
      expectedRevision: example.revision,
      confirmed: true,
      grant: true,
      policyVersion: IMAGE_POLICY,
    });
    example = (await req("GET", `/bookings/${ids.booking}/example`)).data.item;
    const input = {
      expectedRevision: example.revision,
      confirmed: true,
      reason: "Checked both synthetic images and text for identifiers.",
    };
    await req("POST", `/admin/gallery/${example._id}/inspect`, input, "admin");
    failMode = "audit";
    assert.equal(
      (
        await req(
          "POST",
          `/admin/gallery/${example._id}/moderate`,
          { ...input, publish: true },
          "admin",
        )
      ).status,
      500,
    );
    assert.equal(
      (await db.examples.findOne({ _id: new ObjectId(example._id) })).state,
      "pending_moderation",
    );
    failMode = "";
    assert.equal(
      (
        await req(
          "POST",
          `/admin/gallery/${example._id}/moderate`,
          { ...input, publish: true },
          "admin",
        )
      ).status,
      200,
    );
    assert.equal(
      (await req("GET", "/repair-gallery?limit=6")).data.items.length,
      1,
    );
    assert.equal(
      (await req("GET", `/repair-gallery/${example._id}/images/before`)).status,
      200,
    );
    example = (await req("GET", `/bookings/${ids.booking}/example`)).data.item;
    failMode = "erase";
    assert.equal(
      (
        await req("POST", `/examples/${example._id}/withdraw`, {
          expectedRevision: example.revision,
          confirmed: true,
        })
      ).status,
      500,
    );
    assert.equal(
      await db.exampleFiles.countDocuments({ exampleId: example._id }),
      2,
    );
    assert.equal(
      (await db.operationMeta.findOne({ _id: "gallery:storage" })).bytes,
      storedBytes,
    );
    failMode = "";
    assert.equal(
      (
        await req("POST", `/examples/${example._id}/withdraw`, {
          expectedRevision: example.revision,
          confirmed: true,
        })
      ).status,
      200,
    );
    assert.equal(
      await db.exampleFiles.countDocuments({ exampleId: example._id }),
      0,
    );
    assert.equal(
      (await db.operationMeta.findOne({ _id: "gallery:storage" })).bytes,
      0,
    );
    assert.equal(
      (await req("GET", `/repair-gallery/${example._id}/images/before`)).status,
      404,
    );
    // Two real source repairs compete for the same 100 promotional points.
    for (const id of ["666666666666666666666666", "777777777777777777777777"]) {
      const row = { ...fixture.booking, _id: new ObjectId(id) };
      Object.assign(
        row,
        initialRepair(row, users.provider, new Date(now), true),
      );
      row.status = "diagnosing";
      row.repair.diagnoses.push({
        id: new ObjectId().toHexString(),
        summary: "Synthetic diagnosis",
        issue: "A hardware issue",
        recommendedRepair: "Replace damaged part",
        createdAt: new Date(now),
      });
      await db.bookings.insertOne(row);
    }
    for (const [points, days] of [
      [60, 1],
      [40, 365],
    ])
      await db.loyaltyCredits.insertOne({
        _id: new ObjectId(),
        ownerUid: users.customer.uid,
        type: "repair",
        points,
        remainingPoints: points,
        issuedAt: new Date(+now - 10 * 86400000),
        availableAt: new Date(+now - 3 * 86400000),
        expiresAt: new Date(+now + days * 86400000),
        policy: "discount-points-v1",
      });
    const offers = [];
    for (const id of ["666666666666666666666666", "777777777777777777777777"]) {
      const offered = await req(
        "POST",
        `/bookings/${id}/quotations`,
        {
          parts: [],
          labor: 200,
          estimatedCompletion: "Two days",
          loyaltyDiscount: true,
          expectedRevision: 0,
        },
        "provider",
      );
      assert.equal(offered.status, 201);
      offers.push(offered.data.booking);
    }
    const approve = (b) =>
      req(
        "POST",
        `/bookings/${b._id}/quotations/${b.currentQuotation.id}/decision`,
        {
          decision: "approve",
          redeemPoints: true,
          expectedRevision: b.repairRevision,
        },
      );
    failMode = "ledger";
    assert.equal((await approve(offers[0])).status, 500);
    assert.equal(
      (await db.bookings.findOne({ _id: new ObjectId(offers[0]._id) })).status,
      "awaiting_approval",
    );
    assert.equal(
      (
        await db.loyaltyCredits.find({ ownerUid: users.customer.uid }).toArray()
      ).reduce((sum, c) => sum + c.remainingPoints, 0),
      100,
    );
    failMode = "";
    const attempts = await Promise.all(offers.map(approve));
    assert.equal(attempts.filter((r) => r.status === 200).length, 1);
    assert.equal(attempts.filter((r) => r.status === 409).length, 1);
    assert.equal(
      await db.loyaltySpends.countDocuments({ ownerUid: users.customer.uid }),
      1,
    );
    const winner = attempts.find((r) => r.status === 200).data.booking;
    now = new Date(+now + 2 * 86400000);
    const cancelled = await req(
      "PATCH",
      `/all-bookings/${winner._id}`,
      {
        status: "cancelled",
        note: "Synthetic customer/provider cancellation",
        expectedRevision: winner.repairRevision,
      },
      "provider",
    );
    assert.equal(cancelled.status, 200);
    assert.equal(
      (await db.loyaltySpends.findOne({ bookingId: winner._id }))
        .restoredPoints,
      40,
    );
    assert.equal(
      (
        await db.loyaltyCredits.find({ ownerUid: users.customer.uid }).toArray()
      ).reduce((sum, c) => sum + c.remainingPoints, 0),
      40,
    );
    const otherId=offers.find(row=>row._id!==winner._id)._id;
    let other=(await req("GET",`/bookings/${otherId}`,undefined,"provider")).data;
    const replacement=await req("POST",`/bookings/${otherId}/quotations`,{parts:[],labor:100,estimatedCompletion:"Two days",loyaltyDiscount:false,expectedRevision:other.repairRevision},"provider");
    assert.equal(replacement.status,201);other=replacement.data.booking;
    const normalApproval=await req("POST",`/bookings/${otherId}/quotations/${other.currentQuotation.id}/decision`,{decision:"approve",expectedRevision:other.repairRevision});assert.equal(normalApproval.status,200);other=normalApproval.data.booking;
    for(const status of["repairing","quality_check","ready_for_collection","completed"]){const changed=await req("PATCH",`/all-bookings/${otherId}`,{status,expectedRevision:other.repairRevision},"provider");assert.equal(changed.status,200);other=changed.data.booking;}
    assert.equal((await db.bookings.findOne({_id:new ObjectId(otherId)})).loyaltyPolicyVersion,"discount-points-v1");
    const wallet=await req("GET","/loyalty?limit=20");assert.equal(wallet.status,200);assert.equal(wallet.data.pendingPoints,20);assert.equal(wallet.data.availablePoints,40);
    t.diagnostic(
      "Gallery audit/erasure failures rolled back publication, encrypted files and byte counters; public access required consent and moderation. Concurrent wallet/bookmark creation stayed idempotent. Ledger failure rolled back quote approval; two competing approvals spent one balance, and cancellation restored only unexpired points.",
    );
  },
);
