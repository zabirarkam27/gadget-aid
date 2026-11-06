import test from "node:test";
import assert from "node:assert/strict";
import {
  createSecurityActions,
  passwordProblem,
} from "../src/utils/accountSecurity.js";
const setup = () => {
  let user = {
    uid: "test-user",
    email: "demo@example.test",
    emailVerified: true,
    providerData: [{ providerId: "password" }],
  };
  const calls = [];
  const adapter = {
    getUser: () => user,
    validatePassword: async () => {
      calls.push("policy");
      return true;
    },
    reauthenticatePassword: async () => {
      calls.push("reauth-password");
    },
    reauthenticateGoogle: async () => {
      calls.push("reauth-google");
    },
    updatePassword: async () => {
      calls.push("update");
    },
    linkPassword: async () => {
      calls.push("link-password");
    },
    linkGoogle: async () => {
      calls.push("link-google");
    },
    reload: async () => {
      calls.push("reload");
    },
    signOut: async () => {
      calls.push("sign-out");
    },
  };
  return {
    adapter,
    calls,
    setUser: (value) => {
      user = value;
    },
    user,
    actions: createSecurityActions(adapter),
  };
};
const change = {
  currentPassword: "OldPassword123!",
  newPassword: "NewPassword456!",
  confirmation: "NewPassword456!",
};
test("password changes require policy, confirmation and reauthentication before mutation, then sign out", async () => {
  const w = setup();
  await w.actions.changePassword(change);
  assert.deepEqual(w.calls, [
    "policy",
    "reauth-password",
    "update",
    "sign-out",
  ]);
  for (const value of [
    "Short1!",
    "longwithoutuppercase1!",
    "LongWithoutNumbers!",
    "LongWithoutSymbols123",
    "x".repeat(129),
  ])
    assert.ok(passwordProblem(value));
  for (const invalid of [
    { ...change, confirmation: "does not match" },
    {
      ...change,
      newPassword: change.currentPassword,
      confirmation: change.currentPassword,
    },
    { ...change, newPassword: "short", confirmation: "short" },
  ]) {
    const v = setup();
    await assert.rejects(v.actions.changePassword(invalid));
    assert.deepEqual(v.calls, []);
  }
});
test("failed reauthentication and project password policy prevent changes and sign-out", async () => {
  const w = setup();
  w.adapter.reauthenticatePassword = async () => {
    throw Error("wrong current password");
  };
  await assert.rejects(w.actions.changePassword(change));
  assert.deepEqual(w.calls, ["policy"]);
  const v = setup();
  v.adapter.validatePassword = async () => false;
  await assert.rejects(v.actions.changePassword(change));
  assert.deepEqual(v.calls, []);
});
test("Google-only password setup uses reauthentication and linking on the same verified UID", async () => {
  const w = setup();
  w.user.providerData = [{ providerId: "google.com" }];
  await w.actions.changePassword({ ...change, currentPassword: "" });
  assert.deepEqual(w.calls, [
    "policy",
    "reauth-google",
    "link-password",
    "sign-out",
  ]);
  const v = setup();
  v.user.providerData = [{ providerId: "google.com" }];
  v.user.emailVerified = false;
  await assert.rejects(
    v.actions.changePassword({ ...change, currentPassword: "" }),
  );
  assert.deepEqual(v.calls, ["policy", "reauth-google"]);
});
test("an identity switch during reauthentication cannot update or link credentials", async () => {
  const w = setup();
  w.adapter.reauthenticatePassword = async () =>
    w.setUser({ uid: "different-user" });
  await assert.rejects(w.actions.changePassword(change));
  assert.deepEqual(w.calls, ["policy"]);
  const v = setup();
  v.adapter.reauthenticatePassword = async () => v.setUser(null);
  await assert.rejects(
    v.actions.linkGoogle({ currentPassword: change.currentPassword }),
  );
  assert.deepEqual(v.calls, []);
});
test("Google linking reauthenticates without creating another identity; failures do not report success", async () => {
  const w = setup();
  await w.actions.linkGoogle({ currentPassword: change.currentPassword });
  assert.deepEqual(w.calls, ["reauth-password", "link-google", "reload"]);
  const v = setup();
  v.adapter.linkGoogle = async () => {
    throw Object.assign(Error("already linked elsewhere"), {
      code: "auth/credential-already-in-use",
    });
  };
  await assert.rejects(
    v.actions.linkGoogle({ currentPassword: change.currentPassword }),
  );
  assert.deepEqual(v.calls, ["reauth-password"]);
});
test("a saved password is not reported as failed if local sign-out fails", async () => {
  const w = setup();
  w.adapter.signOut = async () => {
    throw Error("sign-out failed");
  };
  assert.deepEqual(await w.actions.changePassword(change), {
    changed: true,
    signedOut: false,
  });
  assert.ok(w.calls.includes("update"));
});
