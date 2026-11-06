const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { ObjectId } = require("mongodb");
const { createApp } = require("../app");
const { createFixture, verifyIdToken, users, ids, fixedTime } = require("./fixtures.cjs");
async function setup(t) {
  const fixture = createFixture({ seedBooking: true });
  const server = createApp({ getCollections: async () => fixture.db, verifyIdToken, clock: () => new Date(fixedTime) }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = async (path, token = "customer", body) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() };
  };
  return { ...fixture, request };
}
test("catalogue filters the whole dataset and price cursors handle numeric legacy strings, ties and unavailable listings", async t => {
  const { db, service, request } = await setup(t);
  db.services.rows = [100, "9.50", 9.5, null, "invalid", 1].map((price, i) => ({ ...service, _id: new ObjectId((i + 1).toString(16).padStart(24, "0")), price, categoryId: ids.service, area: "Dhaka", createdAt: fixedTime }));
  db.entityControls.rows.push({ _id: `service:${db.services.rows[5]._id}`, state: "hidden" });
  const path = `/services?paged=1&limit=2&category=${ids.service}&area=dhaka&sort=low`;
  const first = await request(path);
  assert.equal(first.status, 200);
  assert.deepEqual(first.data.items.map(s => s.price), [9.5, 9.5]);
  assert.ok(first.data.nextCursor);
  const second = await request(`${path}&cursor=${first.data.nextCursor}`);
  assert.deepEqual(second.data.items.map(s => s.price), [100, null]);
  const third = await request(`${path}&cursor=${second.data.nextCursor}`);
  assert.equal(third.data.items.length, 1);
  assert.equal(third.data.nextCursor, null);
  assert.equal(new Set([...first.data.items, ...second.data.items, ...third.data.items].map(s => s._id)).size, 5);
  assert.equal((await request(`${path}&maxPrice=10&cursor=${first.data.nextCursor}`)).status, 400);
  assert.equal((await request(`${path}&maxPrice=0`)).data.items.length, 0);
  assert.deepEqual((await request(`${path}&maxPrice=10`)).data.items.map(s => s.price), [9.5, 9.5]);
});
test("newest ordering uses creation timestamps and literal search is not a regex", async t => {
  const { db, service, request } = await setup(t);
  db.services.rows = [0, 1, 2].map(i => ({ ...service, _id: new ObjectId((i + 1).toString().repeat(24)), name: i === 1 ? "Screen [repair]" : "Repair", createdAt: new Date(+fixedTime + i * 1000) }));
  assert.equal((await request("/services?paged=1&limit=1&sort=newest")).data.items[0]._id, String(db.services.rows[2]._id));
  assert.equal((await request("/services?paged=1&q=%5Brepair%5D")).data.items.length, 1);
  for (const tail of ["limit=101", "sort=evil", "category=bad", "maxPrice=-1", "q[$ne]=x", "cursor=bad"]) assert.equal((await request(`/services?paged=1&${tail}`)).status, 400);
});
test("unavailable fractional and boolean legacy prices stay last and are excluded from price limits", async t => {
  const { db, service, request } = await setup(t);
  db.services.rows = [true, "1.234", "Infinity", " ", 1.25].map((price, i) => ({ ...service, _id: new ObjectId((i + 1).toString(16).padStart(24, "0")), price }));
  const limited = await request("/services?paged=1&sort=low&maxPrice=2");
  assert.deepEqual(limited.data.items.map(s => s.price), [1.25]);
  const all = await request("/services?paged=1&sort=low");
  assert.equal(all.data.items[0].price, 1.25);
  assert.ok(all.data.items.slice(1).every(s => s.price === null));
});
test("private pagination preserves ownership, legacy status filtering and whole-workspace summaries", async t => {
  const { db, booking, request } = await setup(t);
  db.bookings.rows = Array.from({ length: 24 }, (_, i) => ({ ...booking, _id: new ObjectId((i + 1).toString(16).padStart(24, "0")), status: i === 23 ? "working" : "pending" }));
  const first = await request("/bookings?paged=1&limit=5");
  assert.equal(first.data.items.length, 5);
  assert.deepEqual(first.data.summary.map(c => c.value), [23, 1, 0]);
  const next = await request(`/bookings?paged=1&limit=5&cursor=${first.data.nextCursor}`);
  assert.equal(next.data.items.length, 5);
  assert.equal(new Set([...first.data.items, ...next.data.items].map(b => b._id)).size, 10);
  assert.equal((await request(`/bookings?paged=1&cursor=${first.data.nextCursor}`, "second")).status, 400);
  assert.equal((await request("/bookings?paged=1", "second")).data.items.length, 0);
  assert.equal((await request("/bookings?paged=1&status=repairing")).data.items.length, 1);
  assert.equal((await request("/all-bookings?paged=1&status=pending", "provider")).data.items.length, 12);
  assert.equal((await request("/all-bookings?paged=1", "other")).data.items.length, 0);
  assert.equal((await request("/my-services?paged=1", "customer")).data.items.length, 0);
  // A forged provider snapshot never grants access to another canonical service.
  db.bookings.rows.push({ ...booking, _id: new ObjectId(), serviceId: ids.otherService, providerEmail: users.provider.email });
  assert.equal((await request("/all-bookings?paged=1&limit=100", "provider")).data.items.length, 24);
});
test("structured booking device fields are validated, retained and visible only to participants", async t => {
  const { request } = await setup(t);
  const body = { serviceId: ids.service, date: "2026-11-07", instruction: "Screen does not turn on.", deviceType: "Laptop", deviceBrand: " Demo ", deviceModel: "Model X" };
  for (const invalid of [{ ...body, deviceModel: " " }, { ...body, deviceBrand: {} }, { ...body, deviceType: "a".repeat(81) }, { ...body, instruction: "short" }]) assert.equal((await request("/bookings", "customer", invalid)).status, 400);
  const created = await request("/bookings", "customer", body);
  assert.equal(created.status, 201);
  const own = await request(`/bookings/${created.data.bookingId}`);
  assert.equal(own.data.deviceBrand, "Demo");
  assert.equal((await request(`/bookings/${created.data.bookingId}`, "second")).status, 403);
});
