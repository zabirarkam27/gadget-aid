const identities = {
  customer: {
    uid: "qa-customer",
    email: "customer@example.test",
    displayName: "Demo Customer",
    photoURL: null,
  },
  provider: {
    uid: "qa-provider",
    email: "provider@example.test",
    displayName: "Demo Repairs",
    photoURL: null,
  },
  admin: {
    uid: "qa-admin",
    email: "admin@example.test",
    displayName: "Demo Admin",
    photoURL: null,
  },
  superadmin: {
    uid: "qa-superadmin",
    email: "superadmin@example.test",
    displayName: "Demo Super Admin",
    photoURL: null,
  },
  other: {
    uid: "qa-other",
    email: "other@example.test",
    displayName: "Other Provider",
    photoURL: null,
  },
};
let active = "customer";
let offline = false;
export const setFixtureIdentity = (value) => {
  active = value;
};
export const getFixtureUser = () =>
  identities[active]
    ? { ...identities[active], getIdToken: async () => active }
    : null;
export const setFixtureOffline = (value) => {
  offline = value;
};
export const fixtureFetch = (url, options) => {
  if (offline) throw new TypeError("Simulated offline connection");
  return fetch(url, options);
};
