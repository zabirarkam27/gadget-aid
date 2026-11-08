const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createHash } = require('node:crypto');
const { ObjectId } = require('mongodb');
const { createFixture, fixedTime, verifyIdToken, users } = require('./fixtures.cjs');
const { createApp } = require('../app');
const { catalogueFields } = require('../catalogue-fields');
const { listPage } = require('../listings');
const { reviewPage } = require('../reviews');
const { technicianId } = require('../identities');
const { initialRepair } = require('../workflow');
const { visiblePage } = require('../visible-page');
const id = n => new ObjectId(n.toString(16).padStart(24, '0'));

test('technician service pages scope ownership, omit hidden listings and isolate cursors', async t => {
  const f = createFixture(), tid = technicianId(users.provider.email);
  f.db.services.rows = Array.from({ length: 36 }, (_, i) => ({ ...f.service, _id: id(i + 1) }));
  f.db.services.rows.push({ ...f.db.services.rows[0], _id: id(100), providerEmail: users.other.email });
  f.db.entityControls.rows.push({ _id: `service:${id(35)}`, state: 'hidden' });
  const server = createApp({ getCollections: async () => f.db, verifyIdToken }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => { server.closeAllConnections(); server.close(); });
  const get = async suffix => { const r = await fetch(`http://127.0.0.1:${server.address().port}/technicians/${tid}${suffix}`); return { status: r.status, body: await r.json() }; };
  const first = await get('');
  assert.equal(first.status, 200); assert.equal(first.body.services.length, 12); assert.ok(first.body.servicesNextCursor);
  assert.ok(!JSON.stringify(first.body).includes(users.provider.email));
  assert.ok(!first.body.services.some(row => [String(id(100)), String(id(35))].includes(row._id)));
  const second = await get(`?servicesCursor=${first.body.servicesNextCursor}`);
  assert.equal(second.status, 200); assert.equal(second.body.services.length, 12);
  assert.equal(new Set([...first.body.services, ...second.body.services].map(row => row._id)).size, 24);
  assert.equal((await get(`?reviewsCursor=${first.body.servicesNextCursor}`)).status, 400);
  for (const query of ['limit=101', 'servicesCursor=bad', 'reviewsCursor=bad', 'unexpected=1']) assert.equal((await get(`?${query}`)).status, 400);
});

test('indexed catalogue preserves legacy price/date pagination and synchronizes new writes', async t => {
  const f = createFixture(), collection = f.db.services;
  collection.rows = [9.5, '9.50', null, 'invalid', true, '1.234', 90, 0].map((price, i) => ({ ...f.service, _id: id(i + 1), price, createdAt: i === 6 ? undefined : new Date(+fixedTime + i * 1000) }));
  for (const sort of ['newest', 'low', 'high']) {
    const all = async () => { const rows = []; let cursor; do {
      const page = await listPage({ collection, filter: { deletedAt: null }, query: { limit: '2', sort, cursor }, scope: 'scale', price: true });
      rows.push(...page.items.map(row => String(row._id))); cursor = page.nextCursor;
    } while (cursor); return rows; };
    const legacy = await all();
    collection.rows.forEach(row => Object.assign(row, catalogueFields(row)));
    collection.catalogueIndexed = true;
    assert.deepEqual(await all(), legacy);
    collection.catalogueIndexed = false;
  }
  collection.catalogueIndexed = true;
  assert.deepEqual((await listPage({ collection, filter: { deletedAt: null }, query: { sort: 'low', maxPrice: '10' }, scope: 'scale', price: true })).items.map(row => row.cataloguePrice), [0, 9.5, 9.5]);
  const server = createApp({ getCollections: async () => f.db, verifyIdToken, clock: () => fixedTime }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => { server.closeAllConnections(); server.close(); });
  const r = await fetch(`http://127.0.0.1:${server.address().port}/services`, { method: 'POST', headers: { Authorization: 'Bearer provider', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Scalable screen repair', area: 'Dhaka', description: 'A complete repair service description.', image: 'https://example.test/screen.png', price: '12.50' }) });
  assert.equal(r.status, 201);
  const row = collection.rows.at(-1);
  assert.equal(row.cataloguePrice, 12.5);
  assert.equal(row.catalogueDate, +fixedTime);
  assert.equal(row.technicianId, technicianId(users.provider.email));
});

test('review validation batches canonical lookups, caps output and paginates date ties without exposing private fields', async () => {
  const { db, service, booking } = createFixture({ seedBooking: true });
  const tid = technicianId(service.providerEmail);
  const workflow = initialRepair({ ...booking, status: 'working' }, users.provider, fixedTime);
  workflow.repair.events.push({ type: 'status_changed', status: 'completed', actor: { role: 'provider', uid: service.providerUid }, createdAt: fixedTime });
  db.bookings.rows = []; db.reviews.rows = [];
  for (let i = 1; i <= 135; i++) {
    const b = { ...booking, _id: id(i), status: 'completed', ...workflow };
    db.bookings.rows.push(b);
    db.reviews.rows.push({ _id: new ObjectId(createHash('sha256').update(`review-v1:${b._id}`).digest('hex').slice(0,24)), bookingId: String(b._id), technicianId: tid, providerUid: service.providerUid, customerUid: booking.userUid, customerEmail: booking.userEmail, moderationState: 'published', reviewVersion: 1, createdAt: fixedTime, rating: 4, feedback: 'A verified repair review with enough text.' });
  }
  let bookingQueries = 0, serviceQueries = 0;
  const bf = db.bookings.find.bind(db.bookings), sf = db.services.find.bind(db.services);
  db.bookings.findOne = db.services.findOne = () => { throw Error('N+1 query'); };
  db.bookings.find = (...args) => { bookingQueries++; return bf(...args); };
  db.services.find = (...args) => { serviceQueries++; return sf(...args); };
  const first = await reviewPage(db, tid);
  assert.equal(first.items.length, 12); assert.ok(first.nextCursor);
  assert.equal(bookingQueries, 1); assert.equal(serviceQueries, 1);
  const second = await reviewPage(db, tid, { cursor: first.nextCursor });
  assert.equal(new Set([...first.items,...second.items].map(row => String(row._id))).size, 24);
  await assert.rejects(reviewPage(db, technicianId(users.other.email), { cursor: first.nextCursor }), /cursor/);
  const sample = await reviewPage(db, tid, {}, 100);
  assert.equal(sample.items.length, 100); assert.ok(sample.nextCursor);
  db.reviews.rows[0].customerUid = 'forged-customer';
  let cursor, count = 0;
  do { const page = await reviewPage(db, tid, { cursor }); count += page.items.length; cursor = page.nextCursor; } while(cursor);
  assert.equal(count, 134);
});

test('visibility scanning is capped and resumes after a fully hidden batch', async () => {
  const { db, service } = createFixture();
  db.services.rows = Array.from({length: 1100}, (_, i) => ({ ...service, _id: id(i + 1) }));
  let inspected = 0;
  const page = await visiblePage({ collection: db.services, filter: {}, scope: 'hidden', validate: async rows => { inspected += rows.length; return []; } });
  assert.equal(inspected, 1000); assert.equal(page.items.length, 0); assert.ok(page.nextCursor);
  const rest = await visiblePage({ collection: db.services, filter: {}, query: { cursor: page.nextCursor }, scope: 'hidden', validate: async rows => rows });
  assert.equal(rest.items.length, 12);
});
