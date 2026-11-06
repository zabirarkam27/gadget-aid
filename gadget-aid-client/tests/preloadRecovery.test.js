import test from "node:test";
import assert from "node:assert/strict";
import { recoverPreload } from "../src/utils/preloadRecovery.js";
function fixture() {
  let value = null;
  const state = { reloads: 0, prevented: 0 };
  return { state, event: { preventDefault() { state.prevented++; } }, options: { storage: { getItem: () => value, setItem: (_key, next) => { value = next; } }, reload: () => { state.reloads++; }, now: 100000, online: true } };
}
test("a stale dynamic import reloads once and suppresses its obsolete error", () => {
  const f = fixture();
  assert.equal(recoverPreload(f.event, f.options), true);
  assert.deepEqual(f.state, { reloads: 1, prevented: 1 });
});
test("a repeated failure cannot create a reload loop; later releases can recover", () => {
  const f = fixture();
  recoverPreload(f.event, f.options);
  assert.equal(recoverPreload(f.event, { ...f.options, now: 100001 }), false);
  assert.equal(f.state.reloads, 1);
  assert.equal(recoverPreload(f.event, { ...f.options, now: 160001 }), true);
});
test("offline and storage-blocked browsers retain manual recovery without reload", () => {
  const f = fixture();
  assert.equal(recoverPreload(f.event, { ...f.options, online: false }), false);
  assert.equal(recoverPreload(f.event, { ...f.options, storage: { getItem() { throw Error("blocked"); } } }), false);
  assert.deepEqual(f.state, { reloads: 0, prevented: 0 });
});
