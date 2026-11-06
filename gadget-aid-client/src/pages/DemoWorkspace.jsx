import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Dialog from "../components/ui/Dialog";
import FormField from "../components/ui/FormField";
import {
  demoSession,
  endDemo,
  initialDemoData,
  changeDemoData,
} from "../utils/demo";

const sections = [
  ["overview", "Overview"],
  ["services", "Services"],
  ["technicians", "Technicians"],
  ["accounts", "Customers"],
  ["bookings", "Bookings"],
  ["disputes", "Disputes"],
  ["team", "Admin access"],
  ["audit", "Activity log"],
];
const actions = (kind, row) => {
  if (kind === "services")
    return [
      [
        row.state === "visible" ? "hidden" : "visible",
        row.state === "visible" ? "Hide listing" : "Publish listing",
      ],
    ];
  if (kind === "technicians")
    return row.state === "approved"
      ? [["changes_requested", "Request changes"]]
      : [["approved", "Approve technician"]];
  if (kind === "accounts")
    return [
      [
        row.state === "active" ? "restricted" : "active",
        row.state === "active" ? "Restrict account" : "Restore account",
      ],
    ];
  if (kind === "disputes")
    return row.state === "open" ? [["resolved", "Resolve dispute"]] : [];
  if (kind === "team")
    return [
      [
        row.state === "active" ? "inactive" : "active",
        row.state === "active" ? "Revoke Admin" : "Grant Admin",
      ],
    ];
  return [];
};
export default function DemoWorkspace() {
  const [account] = useState(() => {
    try {
      return demoSession(window.sessionStorage);
    } catch {
      return null;
    }
  });
  const [data, setData] = useState(initialDemoData);
  const [section, setSection] = useState("overview");
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  if (!account) return <Navigate to="/login" replace />;
  const visible = sections.filter(
    ([key]) => key !== "team" || account.role === "super_admin",
  );
  const confirm = (event) => {
    event.preventDefault();
    try {
      setData(changeDemoData(data, account.role, pending, reason));
      setNotice(`${pending.label} saved in this demo only.`);
      setPending(null);
      setReason("");
      setError("");
    } catch (failure) {
      setError(failure.message);
    }
  };
  return (
    <>
      <title>{`Demo ${account.label} | GadgetAid`}</title>
      <div className="min-h-screen bg-base-100">
        <header className="border-b border-base-300">
          <div className="ga-container py-5 flex flex-wrap items-center justify-between gap-4">
            <a href="/" className="font-bold text-xl">
              GadgetAid <span className="text-primary">Demo</span>
            </a>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  endDemo(window.sessionStorage);
                } catch {
                  /* Session storage may have been disabled meanwhile. */
                }
                navigate("/login");
              }}
            >
              Exit demo
            </Button>
          </div>
        </header>
        <main className="ga-container ga-section min-w-0">
          <div className="ga-surface p-5 mb-7 border border-primary/30">
            <p className="font-semibold">
              Sample workspace · no live account access
            </p>
            <p className="ga-muted text-sm mt-2">
              You can edit synthetic records here. Changes stay in this page and
              reset on reload. Your real login, users, bookings and permissions
              are unaffected. This preview does not contact the production API.
            </p>
          </div>
          <p className="ga-eyebrow mb-3">Try platform operations</p>
          <h1 className="text-page font-bold">Demo {account.label}</h1>
          <p className="ga-muted mt-3 break-all">{account.email}</p>
          <nav
            aria-label="Demo workspace"
            className="flex flex-wrap gap-2 my-7 border-b border-base-300 pb-5"
          >
            {visible.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSection(key);
                  setNotice("");
                }}
                aria-current={section === key ? "page" : undefined}
                className={`ga-nav-link ${section === key ? "ga-nav-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {notice && (
            <p role="status" className="mb-5 text-success">
              {notice}
            </p>
          )}
          <h2 className="text-xl font-semibold mb-5">
            {visible.find(([key]) => key === section)?.[1]}
          </h2>
          {section === "overview" ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  ["Sample bookings", data.bookings.length],
                  [
                    "Visible sample listings",
                    data.services.filter((x) => x.state === "visible").length,
                  ],
                  [
                    "Approved sample technicians",
                    data.technicians.filter((x) => x.state === "approved")
                      .length,
                  ],
                  [
                    "Open sample disputes",
                    data.disputes.filter((x) => x.state === "open").length,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="ga-surface p-6">
                    <p className="ga-muted text-sm">{label}</p>
                    <p className="text-3xl font-semibold mt-3">{value}</p>
                  </div>
                ))}
              </div>
              <p className="ga-muted mt-7">
                Try publishing a service, reviewing a technician or resolving a
                dispute. Super Admin can also grant and revoke sample Admin
                access. Every change appears in the demo activity log.
              </p>
            </>
          ) : section === "audit" ? (
            <div className="space-y-4">
              {data.audit.length ? (
                data.audit.map((item) => (
                  <article
                    className="ga-surface p-5 space-y-2 break-words"
                    key={item.id}
                  >
                    <h3 className="font-semibold">{item.action}</h3>
                    <p>
                      {item.before} → {item.after}
                    </p>
                    <p>{item.reason}</p>
                    <p className="ga-muted text-sm">
                      {item.actor} · {new Date(item.at).toLocaleString()}
                    </p>
                  </article>
                ))
              ) : (
                <p>No sample changes yet. Try an action in another section.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {data[section].map((row) => (
                <article
                  key={row.id}
                  className="ga-surface p-5 flex flex-wrap items-center justify-between gap-5"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold break-words">{row.name}</h3>
                    <p className="ga-muted text-sm mt-2 break-words">
                      {row.detail}
                    </p>
                    <p className="mt-3 text-sm">
                      State: <strong>{row.state.replaceAll("_", " ")}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {actions(section, row).map(([state, label]) => (
                      <Button
                        key={state}
                        variant="outline"
                        onClick={() => {
                          setPending({
                            kind: section,
                            id: row.id,
                            state,
                            label,
                          });
                          setReason("");
                          setError("");
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
        <Dialog
          open={!!pending}
          title={pending?.label || "Confirm sample change"}
          onClose={() => setPending(null)}
        >
          <form onSubmit={confirm} className="space-y-5">
            <p>This changes sample data in your browser only.</p>
            <FormField
              label="Reason for this sample change"
              as="textarea"
              required
              minLength={10}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Confirm sample change</Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </>
  );
}
