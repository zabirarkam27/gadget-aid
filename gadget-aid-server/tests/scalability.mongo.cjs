// Local-only query-plan verification. Never loads dotenv or production credentials.
const test = require("node:test"), assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");
const { createDatabase } = require("../database");
const { maintainCatalogue } = require("../catalogue-maintenance");
const { listPage } = require("../listings");
const { createFixture, fixedTime } = require("./fixtures.cjs");
const { reviewPage } = require("../reviews");

test("real MongoDB uses catalogue/technician/review indexes and repeatable maintenance", { timeout: 60000 }, async t => {
  const client = new MongoClient("mongodb://127.0.0.1:27028/?replicaSet=rs0&directConnection=true", { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  assert.equal((await client.db("admin").command({ hello: 1 })).setName, "rs0");
  const name = `gadgetaid_scale_qa_${randomUUID().replaceAll("-", "")}`;
  t.after(async () => { await client.db(name).dropDatabase(); await client.close(); });
  const db = createDatabase(client, name), fixture = createFixture({ seedBooking: true });
  await db.services.insertMany(Array.from({ length: 5000 }, (_, i) => ({ ...fixture.service, _id: new ObjectId(i.toString(16).padStart(24, "0")), price: i % 3 ? String(i % 200) : i % 200, createdAt: new Date(+fixedTime + i * 1000) })));
  assert.equal((await maintainCatalogue(db, { activate: true })).updated, 5000);
  assert.equal((await maintainCatalogue(db, { activate: true })).updated, 5000);
  const raw = await db.services.findOne({});
  assert.equal(raw.technicianId.length, 24);
  for (const sort of ["newest", "low", "high"]) {
    let pipeline;
    const aggregate = db.services.aggregate.bind(db.services);
    db.services.aggregate = (stages, opts) => { pipeline = stages; return aggregate(stages, opts); };
    const query = { limit: "12", sort }, filter = { deletedAt: null };
    const page = await listPage({ collection: db.services, filter, query, scope: "scale-mongo", price: true });
    assert.equal(page.items.length, 12); assert.ok(page.nextCursor);
    assert.ok(!pipeline.some(stage => stage.$set));
    const plan = await aggregate(pipeline).explain("executionStats");
    const text = JSON.stringify(plan.queryPlanner?.winningPlan || plan.stages?.find(stage => stage.$cursor)?.$cursor.queryPlanner.winningPlan);
    assert.ok(text.includes("IXSCAN")); assert.ok(!text.includes('"stage":"SORT"'));
    const stats = plan.executionStats || plan.stages?.find(stage => stage.$cursor)?.$cursor.executionStats;
    assert.ok(stats.totalDocsExamined <= 20, `${sort}: ${stats.totalDocsExamined} documents examined`);
    const next = await listPage({ collection: db.services, filter, query: { ...query, cursor: page.nextCursor }, scope: "scale-mongo", price: true });
    assert.equal(new Set([...page.items, ...next.items].map(row => String(row._id))).size, 24);
    const nextPlan = await aggregate(pipeline).explain("executionStats");
    assert.ok(!JSON.stringify(nextPlan.queryPlanner?.winningPlan || nextPlan.stages?.find(stage => stage.$cursor)?.$cursor.queryPlanner.winningPlan).includes('"stage":"SORT"'));
    db.services.aggregate = aggregate;
    console.log(`scale proof: ${sort}, 5000 listings, ${stats.totalDocsExamined} documents examined for 13 candidates`);
  }
  const technicianPlan = await db.services.find({ deletedAt: null, technicianId: raw.technicianId }).sort({ _id: -1 }).limit(13).explain("executionStats");
  assert.ok(JSON.stringify(technicianPlan.queryPlanner.winningPlan).includes("technician_services_v1"));
  assert.ok(technicianPlan.executionStats.totalDocsExamined <= 13);
  await db.reviews.insertMany(Array.from({ length: 2500 }, (_, i) => ({ technicianId: raw.technicianId, moderationState: "published", reviewVersion: 1, createdAt: new Date(+fixedTime + i), rating: 5, bookingId: new ObjectId().toString() })));
  const reviewPlan = await db.reviews.find({ technicianId: raw.technicianId, moderationState: "published", reviewVersion: 1, createdAt: { $type: "date" } }).sort({ createdAt: -1, _id: -1 }).limit(13).explain("executionStats");
  assert.ok(JSON.stringify(reviewPlan.queryPlanner.winningPlan).includes("technician_reviews_v1"));
  assert.ok(!JSON.stringify(reviewPlan.queryPlanner.winningPlan).includes('"stage":"SORT"'));
  assert.ok(reviewPlan.executionStats.totalDocsExamined <= 13);
  const reviews = await reviewPage(db, raw.technicianId);
  assert.equal(reviews.items.length, 0); assert.ok(reviews.nextCursor);
});
