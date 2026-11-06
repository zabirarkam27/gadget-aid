const identities = {
  customer: {
    uid: "qa-customer",
    emailVerified: true,
    providerData: [{ providerId: "password" }],
    email: "customer@example.test",
    displayName: "Demo Customer",
    photoURL: null,
  },
  provider: {
    uid: "qa-provider",
    emailVerified: true,
    providerData: [{ providerId: "password" }],
    email: "provider@example.test",
    displayName: "Demo Repairs",
    photoURL: null,
  },
  admin: {
    uid: "qa-admin",
    emailVerified: true,
    providerData: [{ providerId: "password" }],
    email: "admin@example.test",
    displayName: "Demo Admin",
    photoURL: null,
  },
  superadmin: {
    uid: "qa-superadmin",
    emailVerified: true,
    providerData: [{ providerId: "password" }],
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
const sessionKey = "gadgetaid.qa.session";
const savedSession = sessionStorage.getItem(sessionKey);
let active =
  savedSession !== null &&
  (savedSession === "" || Object.hasOwn(identities, savedSession))
    ? savedSession
    : "customer";
let offline = false;
export const setFixtureIdentity = (value) => {
  active = value;
  sessionStorage.setItem(sessionKey, value);
};
export const getFixtureUser = () => {
  const key = active;
  return identities[key]
    ? { ...identities[key], getIdToken: async () => key }
    : null;
};
// Public, synthetic QA credentials. This module is outside the production entry.
export const fixtureLogin = (email, password) => {
  const key = {
    "admin@example.test": "admin",
    "superadmin@example.test": "superadmin",
  }[String(email).trim().toLowerCase()];
  if (!key || password !== "GadgetAidDemo123!")
    throw new Error("Invalid demo credentials");
  setFixtureIdentity(key);
  return { user: getFixtureUser() };
};
export const setFixtureOffline = (value) => {
  offline = value;
};
export const fixtureFetch = (url, options) => {
  if (offline) throw new TypeError("Simulated offline connection");
  return fetch(url, options);
};
