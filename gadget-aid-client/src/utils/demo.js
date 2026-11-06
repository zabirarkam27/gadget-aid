export const demoAccounts = [
  {
    role: "admin",
    label: "Admin",
    email: "admin@example.test",
    password: "GadgetAidDemo123!",
  },
  {
    role: "super_admin",
    label: "Super Admin",
    email: "superadmin@example.test",
    password: "GadgetAidDemo123!",
  },
];
const sessionKey = "gadgetaid:public-demo-role:v1";
export function startDemo(email, password, storage) {
  const account = demoAccounts.find(
    (a) => a.email === email && a.password === password,
  );
  if (!account) throw Error("Invalid demo credentials.");
  storage.setItem(sessionKey, account.role);
  return account.role;
}
export function demoSession(storage) {
  try {
    return (
      demoAccounts.find((a) => a.role === storage.getItem(sessionKey)) || null
    );
  } catch {
    return null;
  }
}
export function endDemo(storage) {
  storage.removeItem(sessionKey);
}
export function initialDemoData() {
  return {
    services: [
      {
        id: "sample-screen",
        name: "Sample screen repair",
        detail: "Demo Tech North · $60",
        state: "visible",
      },
      {
        id: "sample-laptop",
        name: "Sample laptop diagnostics",
        detail: "Demo Tech South · $25",
        state: "hidden",
      },
    ],
    technicians: [
      {
        id: "sample-north",
        name: "Demo Tech North",
        detail: "Phone repair · sample application",
        state: "approved",
      },
      {
        id: "sample-south",
        name: "Demo Tech South",
        detail: "Laptop repair · sample application",
        state: "pending",
      },
    ],
    accounts: [
      {
        id: "sample-customer-a",
        name: "Sample customer A",
        detail: "customer.a@example.test",
        state: "active",
      },
      {
        id: "sample-customer-b",
        name: "Sample customer B",
        detail: "customer.b@example.test",
        state: "restricted",
      },
    ],
    disputes: [
      {
        id: "sample-dispute",
        name: "Sample quotation dispute",
        detail: "Customer requests clarification of the parts charge.",
        state: "open",
      },
    ],
    team: [
      {
        id: "sample-operator-a",
        name: "Sample operator A",
        detail: "operator.a@example.test · Admin access",
        state: "active",
      },
      {
        id: "sample-operator-b",
        name: "Sample operator B",
        detail: "operator.b@example.test · Admin access",
        state: "inactive",
      },
    ],
    bookings: [
      {
        id: "sample-booking-1",
        name: "Sample screen repair",
        detail: "Sample customer A · Demo Tech North",
        state: "awaiting_approval",
      },
      {
        id: "sample-booking-2",
        name: "Sample laptop repair",
        detail: "Sample customer B · Demo Tech South",
        state: "completed",
      },
    ],
    audit: [],
  };
}
const states = {
  services: ["visible", "hidden"],
  technicians: ["approved", "changes_requested"],
  accounts: ["active", "restricted"],
  disputes: ["resolved"],
  team: ["active", "inactive"],
};
export function changeDemoData(
  data,
  role,
  action,
  reason,
  at = new Date().toISOString(),
) {
  if (
    !["admin", "super_admin"].includes(role) ||
    (action.kind === "team" && role !== "super_admin")
  )
    throw Error("This demo role cannot change Admin access.");
  if (!states[action.kind]?.includes(action.state))
    throw Error("Invalid demo action.");
  if (
    typeof reason !== "string" ||
    reason.trim().length < 10 ||
    reason.length > 300
  )
    throw Error("Enter a reason of 10–300 characters.");
  const record = data[action.kind].find((item) => item.id === action.id);
  if (!record) throw Error("Sample record not found.");
  if (record.state === action.state)
    throw Error("This sample record already has that state.");
  return {
    ...data,
    [action.kind]: data[action.kind].map((item) =>
      item.id === action.id ? { ...item, state: action.state } : item,
    ),
    audit: [
      {
        id: `${data.audit.length}:${at}`,
        actor: role === "super_admin" ? "Demo Super Admin" : "Demo Admin",
        action: `${action.kind}: ${record.name}`,
        before: record.state,
        after: action.state,
        reason: reason.trim(),
        at,
      },
      ...data.audit,
    ].slice(0, 100),
  };
}
