import test from "node:test";
import assert from "node:assert/strict";
import {
  demoAccounts,
  startDemo,
  demoSession,
  endDemo,
  initialDemoData,
  changeDemoData,
} from "../src/utils/demo.js";
test("demo login stores only an allowlisted sample role, never a password/token", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  for (const account of demoAccounts) {
    assert.equal(
      startDemo(account.email, account.password, storage),
      account.role,
    );
    assert.equal(demoSession(storage).role, account.role);
    assert.deepEqual([...map.values()], [account.role]);
  }
  assert.throws(() => startDemo(demoAccounts[0].email, "wrong", storage));
  endDemo(storage);
  assert.equal(demoSession(storage), null);
  assert.equal(
    demoSession({
      getItem() {
        throw Error("blocked");
      },
    }),
    null,
  );
});
test("sample edits are immutable, reasoned and audited; a fresh workspace resets", () => {
  const initial = initialDemoData();
  const action = {
    kind: "services",
    id: initial.services[0].id,
    state: "hidden",
  };
  const updated = changeDemoData(
    initial,
    "admin",
    action,
    "Reviewed this sample listing",
    "2026-11-06T12:00:00Z",
  );
  assert.equal(initial.services[0].state, "visible");
  assert.equal(updated.services[0].state, "hidden");
  assert.equal(updated.audit[0].actor, "Demo Admin");
  assert.equal(updated.audit[0].reason, "Reviewed this sample listing");
  assert.equal(initialDemoData().services[0].state, "visible");
});
test("only demo Super Admin can change sample Admin access; invalid writes fail", () => {
  const data = initialDemoData();
  const action = { kind: "team", id: data.team[0].id, state: "inactive" };
  assert.throws(() =>
    changeDemoData(data, "admin", action, "Reviewed operator access"),
  );
  assert.throws(() =>
    changeDemoData(data, "customer", action, "Reviewed operator access"),
  );
  assert.equal(
    changeDemoData(data, "super_admin", action, "Reviewed operator access")
      .team[0].state,
    "inactive",
  );
  assert.throws(() => changeDemoData(data, "super_admin", action, "short"));
  assert.throws(() =>
    changeDemoData(
      data,
      "super_admin",
      { ...action, id: "unknown" },
      "Reviewed operator access",
    ),
  );
  assert.throws(() =>
    changeDemoData(
      data,
      "super_admin",
      { ...action, kind: "bookings" },
      "Reviewed operator access",
    ),
  );
});
