import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccessContext } from "../provider/AccessContext";
import { AuthContext } from "../provider/AuthContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import FormField from "../components/ui/FormField";
import Dialog from "../components/ui/Dialog";
import Button from "../components/Button";
const resources = {
  customers: {
    label: "Accounts",
    columns: ["displayName", "emailMasked", "state", "role", "createdAt"],
  },
  applications: {
    label: "Technician applications",
    columns: ["businessName", "state", "createdAt"],
    states: ["pending", "approved", "changes_requested"],
    search: true,
  },
  technicians: {
    label: "Profile publication",
    columns: ["businessName", "area", "state"],
    search: true,
  },
  services: {
    label: "Listings",
    columns: ["name", "area", "visibility", "removed"],
    search: true,
  },
  bookings: {
    label: "Bookings",
    columns: ["serviceName", "status", "date"],
    states: [
      "pending",
      "confirmed",
      "device_received",
      "diagnosing",
      "quotation_sent",
      "awaiting_approval",
      "approved",
      "repairing",
      "quality_check",
      "ready_for_collection",
      "completed",
      "cancelled",
      "rejected",
      "working",
    ],
    search: true,
  },
  disputes: {
    label: "Disputes",
    columns: ["subject", "state", "createdAt"],
    states: ["open", "in_review", "resolved"],
    search: true,
  },
  reviews: {
    label: "Reviews",
    columns: ["serviceName", "rating", "state", "createdAt"],
    states: ["published", "hidden"],
  },
  reports: {
    label: "Review reports",
    columns: ["category", "state", "reviewId", "createdAt"],
    states: ["pending", "resolved"],
  },
  categories: {
    label: "Categories",
    columns: ["name", "slug", "state"],
    states: ["active", "archived"],
    search: true,
  },
  roles: { label: "Role access", columns: ["role", "active", "revision"] },
  audit: {
    label: "Audit log",
    columns: [
      "action",
      "target",
      "actorRole",
      "actorUid",
      "reason",
      "createdAt",
    ],
    search: true,
  },
  email: {
    label: "Email attempts",
    columns: [
      "bookingId",
      "deliveryState",
      "attempts",
      "failureCode",
      "createdAt",
    ],
    states: ["pending", "retry", "sending", "accepted", "failed", "suppressed"],
  },
};
const human = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
const labelRole = (value) =>
  ({
    super_admin: "Super Admin",
    admin: "Admin",
    technician: "Technician",
    public_visitor: "Customer access",
  })[value] || human(value);
const valueLabel = (key, value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : key === "role" || key === "actorRole"
        ? labelRole(value)
        : key.endsWith("At")
          ? new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Dhaka",
            }).format(new Date(value))
          : [
                "state",
                "status",
                "visibility",
                "deliveryState",
                "action",
              ].includes(key)
            ? human(value)
            : String(value);
const PrivateDetail = ({ detail, onClose, onAction }) => {
  const data = detail.data;
  const fields = [
    "_id",
    "uid",
    "displayName",
    "email",
    "emailVerified",
    "disabled",
    "serviceName",
    "status",
    "date",
    "instruction",
    "name",
    "area",
    "price",
    "description",
    "image",
    "businessName",
    "statement",
    "category",
    "details",
    "subject",
    "state",
    "resolution",
    "rating",
    "feedback",
    "bio",
    "photo",
    "yearsExperience",
    "skills",
    "categories",
    "certifications",
    "claimsVerified",
  ];
  return (
    <section
      className="ga-surface p-5 sm:p-7 space-y-5 min-w-0"
      aria-label="Audited private inspection"
    >
      <div className="flex gap-3 justify-between flex-wrap">
        <h2 className="text-xl font-semibold">
          Audited inspection · {human(detail.kind)}
        </h2>
        <Button variant="outline" onClick={onClose}>
          Close private details
        </Button>
      </div>
      <dl className="grid sm:grid-cols-2 gap-5">
        {fields
          .filter((key) => data[key] !== undefined && data[key] !== null)
          .map((key) => (
            <div className="min-w-0" key={key}>
              <dt className="text-xs ga-muted mb-1">{human(key)}</dt>
              <dd className="whitespace-pre-wrap break-words">
                {valueLabel(key, data[key])}
              </dd>
            </div>
          ))}
      </dl>
      {data.messages && (
        <div className="space-y-3">
          <h3 className="font-semibold">Booking conversation</h3>
          {data.messages.length ? (
            data.messages.map((m, i) => (
              <p
                className="border-l-2 border-primary pl-3 whitespace-pre-wrap break-words"
                key={i}
              >
                <strong>{human(m.role)}: </strong>
                {m.text}
              </p>
            ))
          ) : (
            <p className="ga-muted">No conversation messages.</p>
          )}
        </div>
      )}
      {data.repair?.events && (
        <details>
          <summary className="cursor-pointer font-semibold">
            Repair audit timeline
          </summary>
          <ol className="mt-4 space-y-3">
            {data.repair.events.map((event) => (
              <li
                key={event.id}
                className="text-sm border-l border-primary pl-3"
              >
                <strong>{human(event.type)}</strong> · {human(event.actor.role)}
                <p className="whitespace-pre-wrap break-words">{event.note}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
      {data.response?.text && (
        <p className="border-l-2 border-primary pl-3">
          Provider response: {data.response.text}
        </p>
      )}
      {data.review && (
        <div className="space-y-3 border-t border-base-300 pt-4">
          <h3 className="font-semibold">
            Reported review · {data.review.rating} / 5
          </h3>
          <p className="whitespace-pre-wrap break-words">
            {data.review.feedback}
          </p>
          <Button
            variant="outline"
            onClick={() =>
              onAction({
                title:
                  data.review.state === "published"
                    ? "Hide reported review"
                    : "Restore reported review",
                target: data.review._id,
                path: `/admin/reviews/${data.review._id}/moderate`,
                revision: data.review.revision,
                fields: {
                  action:
                    data.review.state === "published" ? "hide" : "restore",
                },
              })
            }
          >
            Moderate reported review
          </Button>
        </div>
      )}
    </section>
  );
};
const AdminWorkspace = () => {
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") || "overview",
    access = useContext(AccessContext);
  return (
    <DashboardLayout
      title="Platform operations"
      eyebrow={labelRole(access.role)}
      description="Review platform activity and act on exact records. Sensitive changes require a reason and confirmation."
    >
      <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)] gap-6 items-start">
        <nav
          aria-label="Operations sections"
          className="ga-surface p-3 flex flex-wrap lg:flex-col gap-1"
        >
          <button
            className={`ga-nav-link text-left ${tab === "overview" ? "ga-nav-active" : ""}`}
            onClick={() => setSearch({ tab: "overview" })}
          >
            Overview
          </button>
          {Object.entries(resources).map(([key, value]) => (
            <button
              key={key}
              className={`ga-nav-link text-left ${tab === key ? "ga-nav-active" : ""}`}
              onClick={() => setSearch({ tab: key })}
            >
              {value.label}
            </button>
          ))}
        </nav>
        {tab === "overview" ? (
          <Overview />
        ) : resources[tab] ? (
          <Resource key={tab} tab={tab} config={resources[tab]} />
        ) : (
          <p>Choose an operations section.</p>
        )}
      </div>
    </DashboardLayout>
  );
};
const Overview = () => {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const access = useContext(AccessContext);
  const refreshAccess = access.refresh;
  useEffect(() => {
    const controller = new AbortController();
    authFetch(`${API_URL}/admin/overview`, { signal: controller.signal })
      .then(readJson)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          if (error.code === "ADMIN_REQUIRED") refreshAccess();
        }
      });
    return () => controller.abort();
  }, [attempt, refreshAccess]);
  return (
    <div className="space-y-5 min-w-0">
      <div className="flex justify-between gap-4 items-center">
        <h2 className="text-xl font-semibold">Overview</h2>
        <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
          Refresh overview
        </Button>
      </div>
      <p className="ga-muted text-sm">
        Counts come from stored platform records. Email accepted means the
        provider accepted a delivery attempt. No payment or collected-revenue
        metric is tracked.
      </p>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {data ? (
        <dl className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="ga-surface p-5">
              <dt className="ga-muted text-sm capitalize">{human(key)}</dt>
              <dd className="font-bold text-3xl mt-2 ga-numeric">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role="status">Loading platform counts…</p>
      )}
    </div>
  );
};
const Resource = ({ tab, config }) => {
  const access = useContext(AccessContext),
    refreshAccess = access.refresh,
    auth = useContext(AuthContext),
    navigate = useNavigate();
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [cursor, setCursor] = useState(null),
    [next, setNext] = useState(null),
    [history, setHistory] = useState([]),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState(""),
    [status, setStatus] = useState(""),
    [limit, setLimit] = useState("25"),
    [attempt, setAttempt] = useState(0),
    [action, setAction] = useState(null),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [saving, setSaving] = useState(false),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState(""),
    [detail, setDetail] = useState(null),
    [uid, setUid] = useState(""),
    [lookup, setLookup] = useState(null),
    [reauth, setReauth] = useState(false);
  const lock = useRef(false),
    alive = useRef(true),
    sequence = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController(),
      version = ++sequence.current;
    const params = new URLSearchParams({
      limit,
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      ...(cursor ? { cursor } : {}),
    });
    setLoading(true);
    setError("");
    setRows([]);
    authFetch(`${API_URL}/admin/${tab}?${params}`, {
      signal: controller.signal,
    })
      .then(readJson)
      .then((value) => {
        if (!Array.isArray(value.items))
          throw new Error("Invalid operations page response");
        if (!controller.signal.aborted && sequence.current === version) {
          setRows(value.items);
          setNext(value.nextCursor);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setDetail(null);
          if (error.code === "ADMIN_REQUIRED") refreshAccess();
          if (error.code === "ADMIN_REAUTH_REQUIRED") setReauth(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence.current === version)
          setLoading(false);
      });
    return () => controller.abort();
  }, [tab, cursor, query, status, limit, attempt, refreshAccess]);
  const reset = () => {
    setCursor(null);
    setHistory([]);
  };
  const open = (value) => {
    setAction(value);
    setReason("");
    setConfirmed(false);
    setFailure("");
  };
  const inspect = (kind, row) =>
    open({
      title: `Inspect ${kind}`,
      target:
        row.name ||
        row.businessName ||
        row.subject ||
        row.displayName ||
        row._id,
      path: `/admin/inspect/${kind}/${encodeURIComponent(row._id)}`,
      inspect: kind,
      fields: {},
    });
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current || !confirmed) return;
    lock.current = true;
    setSaving(true);
    setFailure("");
    try {
      const value = await authFetch(`${API_URL}${action.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...action.fields,
          reason,
          confirmed,
          ...(!action.inspect
            ? { expectedRevision: action.revision || 0 }
            : {}),
        }),
      }).then(readJson);
      if (alive.current) {
        if (action.inspect) setDetail({ kind: action.inspect, data: value });
        else {
          setDetail(null);
          setNotice(`${action.title} completed.`);
          setAttempt((v) => v + 1);
          if (tab === "roles") setLookup(null);
        }
        setAction(null);
        refreshAccess();
      }
    } catch (error) {
      if (alive.current) {
        setFailure(error.message);
        if (error.code === "ADMIN_REQUIRED") {
          setRows([]);
          setDetail(null);
          refreshAccess();
        }
        if (error.code === "ADMIN_REAUTH_REQUIRED") setReauth(true);
      }
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const edit = (key, value) => {
    setAction((previous) => ({
      ...previous,
      fields: { ...previous.fields, [key]: value },
    }));
    setConfirmed(false);
  };
  const lookupUser = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const value = await authFetch(
        `${API_URL}/admin/role-target/${encodeURIComponent(uid.trim())}`,
      ).then(readJson);
      if (alive.current) setLookup(value);
    } catch (error) {
      if (alive.current) setError(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const roleAction = (row, role, active) =>
    open({
      title: `${active ? "Grant" : "Revoke"} ${labelRole(role)} access`,
      target: row.displayName ? `${row.displayName} · ${row._id}` : row._id,
      path: `/admin/roles/${encodeURIComponent(row._id)}`,
      revision: row.revision,
      fields: { role, active },
    });
  const categoryAction = (row) =>
    open({
      title: row ? "Edit category" : "Create category",
      target: row?.name || "New category",
      path: row ? `/admin/categories/${row._id}` : "/admin/categories",
      revision: row?.revision || 0,
      editor: "category",
      existing: !!row,
      fields: {
        name: row?.name || "",
        slug: row?.slug || "",
        state: row?.state || "active",
      },
    });
  const buttons = (row) => {
    const actionButton = (title, path, fields = {}, extra = {}) => (
      <Button
        key={title}
        variant="outline"
        disabled={saving}
        onClick={() =>
          open({
            title,
            target:
              row.name ||
              row.businessName ||
              row.subject ||
              row.displayName ||
              row._id,
            path,
            revision: row.revision || 0,
            fields,
            ...extra,
          })
        }
      >
        {title}
      </Button>
    );
    if (tab === "customers")
      return (
        <>
          <Button variant="ghost" onClick={() => inspect("customer", row)}>
            Inspect private account
          </Button>
          {!["admin", "super_admin"].includes(row.role) &&
            actionButton(
              row.state === "restricted"
                ? "Restore customer access"
                : "Restrict customer access",
              `/admin/accounts/${encodeURIComponent(row._id)}/state`,
              { state: row.state === "restricted" ? "active" : "restricted" },
            )}
        </>
      );
    if (tab === "bookings")
      return (
        <Button variant="outline" onClick={() => inspect("booking", row)}>
          Inspect private booking
        </Button>
      );
    if (tab === "services")
      return (
        <>
          <Button variant="ghost" onClick={() => inspect("service", row)}>
            Inspect listing
          </Button>
          {actionButton(
            row.visibility === "hidden"
              ? "Make listing visible"
              : "Hide listing",
            `/admin/services/${row._id}/publication`,
            { state: row.visibility === "hidden" ? "visible" : "hidden" },
            { sharedReason: true },
          )}
        </>
      );
    if (tab === "technicians")
      return (
        <>
          <Button variant="ghost" onClick={() => inspect("technician", row)}>
            Inspect profile claims
          </Button>
          {["approved", "changes_requested", "restricted"]
            .filter((state) => state !== row.state)
            .map((state) =>
              actionButton(
                state === "approved"
                  ? "Approve publication"
                  : state === "restricted"
                    ? "Restrict publication"
                    : "Request profile changes",
                `/admin/technicians/${row._id}/publication`,
                { state },
                { sharedReason: true },
              ),
            )}
        </>
      );
    if (tab === "applications")
      return (
        <>
          <Button variant="ghost" onClick={() => inspect("application", row)}>
            Inspect application
          </Button>
          {row.state === "pending" && (
            <>
              {actionButton(
                "Approve Technician access",
                `/admin/applications/${encodeURIComponent(row._id)}/decision`,
                { decision: "approve" },
                { sharedReason: true },
              )}
              {actionButton(
                "Request application changes",
                `/admin/applications/${encodeURIComponent(row._id)}/decision`,
                { decision: "changes_requested" },
                { sharedReason: true },
              )}
            </>
          )}
        </>
      );
    if (tab === "reviews")
      return (
        <>
          <Button variant="ghost" onClick={() => inspect("review", row)}>
            Inspect review
          </Button>
          {actionButton(
            row.state === "published" ? "Hide review" : "Restore review",
            `/admin/reviews/${row._id}/moderate`,
            { action: row.state === "published" ? "hide" : "restore" },
          )}
        </>
      );
    if (tab === "reports")
      return (
        <>
          <Button variant="ghost" onClick={() => inspect("report", row)}>
            Inspect private report
          </Button>
          {row.state === "pending" &&
            actionButton(
              "Resolve report",
              `/admin/reports/${row._id}/resolve`,
              { resolution: "" },
              { editor: "report" },
            )}
        </>
      );
    if (tab === "disputes")
      return (
        <>
          <Button variant="ghost" onClick={() => inspect("dispute", row)}>
            Inspect private dispute
          </Button>
          {row.state !== "resolved" &&
            actionButton(
              "Update dispute",
              `/admin/disputes/${row._id}/resolve`,
              { state: "in_review", resolution: "" },
              { editor: "dispute" },
            )}
        </>
      );
    if (tab === "categories")
      return (
        <Button variant="outline" onClick={() => categoryAction(row)}>
          Edit category
        </Button>
      );
    if (tab === "roles")
      return row.role !== "super_admin" &&
        (row.role !== "admin" || access.superAdmin) ? (
        <Button
          variant="outline"
          onClick={() => roleAction(row, row.role, !row.active)}
        >
          {row.active ? "Revoke" : "Restore"} {labelRole(row.role)}
        </Button>
      ) : (
        <span className="text-xs ga-muted">
          {row.role === "super_admin"
            ? "Operator-managed bootstrap"
            : "Super Admin-managed access"}
        </span>
      );
    return null;
  };
  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h2 className="text-xl font-semibold">{config.label}</h2>
        <Button
          variant="outline"
          onClick={() => {
            setDetail(null);
            setAttempt((v) => v + 1);
          }}
          disabled={saving || loading}
        >
          Refresh table
        </Button>
      </div>
      {tab === "roles" && (
        <div className="ga-surface p-5 space-y-4">
          <p className="text-sm ga-muted">
            Only Super Admin can manage Admin access. Technician approval starts
            with an application. Super Admin bootstrap is operator-only.
          </p>
          <form
            onSubmit={lookupUser}
            className="flex flex-wrap gap-3 items-end"
          >
            <div className="flex-1 min-w-0">
              <FormField
                label="Exact account UID"
                required
                maxLength={128}
                value={uid}
                onChange={(e) => {
                  setUid(e.target.value);
                  setLookup(null);
                }}
              />
            </div>
            <Button type="submit" loading={saving}>
              Look up role target
            </Button>
          </form>
          {lookup && (
            <div className="space-y-3">
              <p className="break-words">
                {lookup.displayName} · {lookup.emailMasked} ·{" "}
                {labelRole(lookup.role)} · UID: {lookup._id}
              </p>
              {lookup.role === "super_admin" ? (
                <p className="ga-muted">
                  Super Admin access cannot be changed in the browser.
                </p>
              ) : (
                <div className="flex gap-3 flex-wrap">
                  {access.superAdmin && lookup.role !== "admin" && (
                    <Button onClick={() => roleAction(lookup, "admin", true)}>
                      Grant Admin access
                    </Button>
                  )}
                  {lookup.role === "admin" && access.superAdmin && (
                    <>
                      <Button
                        onClick={() =>
                          roleAction(lookup, "admin", !lookup.active)
                        }
                      >
                        {lookup.active ? "Revoke" : "Restore"} Admin access
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => roleAction(lookup, "technician", true)}
                      >
                        Assign Technician access instead
                      </Button>
                    </>
                  )}
                  {lookup.role === "technician" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        roleAction(lookup, "technician", !lookup.active)
                      }
                    >
                      {lookup.active ? "Revoke" : "Restore"} Technician access
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {tab === "categories" && (
        <Button onClick={() => categoryAction(null)}>Create category</Button>
      )}
      {tab === "email" && (
        <p className="text-sm ga-muted">
          Provider acceptance is not confirmed inbox delivery. This view does
          not resend failed email or expose recipients.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset();
          setQuery(draft.trim());
        }}
        className="flex flex-wrap gap-4 items-end"
      >
        {config.search && (
          <div className="flex-1 min-w-0">
            <FormField
              label={`Search ${config.label.toLowerCase()}`}
              type="search"
              maxLength={80}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
        )}
        {config.states && (
          <div className="min-w-40">
            <FormField
              label="Record status"
              as="select"
              value={status}
              onChange={(e) => {
                reset();
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              {config.states.map((value) => (
                <option key={value} value={value}>
                  {human(value)}
                </option>
              ))}
            </FormField>
          </div>
        )}
        <div>
          <FormField
            label="Rows per page"
            as="select"
            value={limit}
            onChange={(e) => {
              reset();
              setLimit(e.target.value);
            }}
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </FormField>
        </div>
        {config.search && (
          <Button type="submit" variant="outline">
            Apply search
          </Button>
        )}
      </form>
      {reauth && (
        <div className="ga-surface p-5 space-y-3">
          <p className="text-warning">
            This action requires a sign-in within the last 10 minutes.
          </p>
          <Button
            onClick={async () => {
              await auth.logOut();
              navigate("/login", {
                state: { from: { pathname: "/admin", search: `?tab=${tab}` } },
              });
            }}
          >
            Sign out and sign in again
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-success">
          {notice}
        </p>
      )}
      {detail && (
        <PrivateDetail
          detail={detail}
          onClose={() => setDetail(null)}
          onAction={open}
        />
      )}
      <div className="ga-surface overflow-x-auto">
        <table className="table table-sm">
          <caption className="sr-only">
            {config.label}, current authorized page only
          </caption>
          <thead>
            <tr>
              <th>Reference</th>
              {config.columns.map((column) => (
                <th key={column} className="capitalize">
                  {human(column)}
                </th>
              ))}
              {!["audit", "email"].includes(tab) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={config.columns.length + 2}>
                  <span role="status">Loading records…</span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row._id}>
                  <td className="font-mono text-xs break-all max-w-40 whitespace-normal">
                    {row._id}
                  </td>
                  {config.columns.map((column) => (
                    <td
                      className="max-w-64 whitespace-normal break-words align-top"
                      key={column}
                    >
                      {valueLabel(column, row[column])}
                    </td>
                  ))}
                  {!["audit", "email"].includes(tab) && (
                    <td>
                      <div className="flex flex-wrap gap-2 min-w-44">
                        {buttons(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={config.columns.length + 2}>
                  No matching records on this page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant="outline"
          disabled={!history.length || loading || saving}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory(history.slice(0, -1));
            setDetail(null);
          }}
        >
          Previous page
        </Button>
        <Button
          variant="outline"
          disabled={!next || loading || saving}
          onClick={() => {
            setHistory([...history, cursor]);
            setCursor(next);
            setDetail(null);
          }}
        >
          Next page
        </Button>
        <span className="text-sm ga-muted">
          {rows.length} records on this page · Bangladesh times
        </span>
      </div>
      <Dialog
        open={!!action}
        onClose={() => {
          if (!saving) setAction(null);
        }}
        title={action?.title || "Confirm operation"}
      >
        {action && (
          <form onSubmit={submit}>
            <fieldset disabled={saving} className="space-y-4">
              <p className="text-sm break-words">
                Target: <strong>{action.target}</strong>
              </p>
              {action.inspect && (
                <p className="ga-muted text-sm">
                  Private details are returned only after your access reason is
                  recorded.
                </p>
              )}
              {action.editor === "category" && (
                <>
                  <FormField
                    label="Category name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={action.fields.name}
                    onChange={(e) => edit("name", e.target.value)}
                  />
                  <FormField
                    label="Immutable category slug"
                    required
                    maxLength={60}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    readOnly={action.existing}
                    value={action.fields.slug}
                    onChange={(e) => edit("slug", e.target.value)}
                    helper="Lowercase letters/numbers separated by hyphens."
                  />
                  <FormField
                    label="Category state"
                    as="select"
                    value={action.fields.state}
                    onChange={(e) => edit("state", e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </FormField>
                </>
              )}
              {action.editor === "dispute" && (
                <FormField
                  label="Dispute state"
                  as="select"
                  value={action.fields.state}
                  onChange={(e) => edit("state", e.target.value)}
                >
                  <option value="in_review">In review</option>
                  <option value="resolved">Resolved</option>
                </FormField>
              )}
              {["report", "dispute"].includes(action.editor) && (
                <FormField
                  label={
                    action.editor === "dispute"
                      ? "Resolution visible to the reporter"
                      : "Report resolution"
                  }
                  as="textarea"
                  required={
                    action.editor === "report" ||
                    action.fields.state === "resolved"
                  }
                  minLength={10}
                  maxLength={action.editor === "report" ? 1000 : 2000}
                  value={action.fields.resolution}
                  onChange={(e) => edit("resolution", e.target.value)}
                />
              )}
              <FormField
                label={
                  action.sharedReason
                    ? "Reason shared with the applicant/provider and audit"
                    : "Reason recorded in audit"
                }
                as="textarea"
                required
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setConfirmed(false);
                }}
              />
              <label className="flex gap-3 items-start">
                <input
                  type="checkbox"
                  className="checkbox shrink-0 mt-1"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I reviewed the exact target and confirm: {action.title}.
                </span>
              </label>
              {failure && (
                <p role="alert" className="text-error">
                  {failure}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={saving} disabled={!confirmed}>
                  {action.inspect
                    ? "Confirm audited inspection"
                    : "Confirm action"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setAction(null)}
                >
                  Cancel
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </Dialog>
    </div>
  );
};
export default AdminWorkspace;
