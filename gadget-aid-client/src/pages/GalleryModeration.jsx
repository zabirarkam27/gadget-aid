import { useEffect, useRef, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
import ExamplePhotos from "../components/gallery/ExamplePhotos";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
export default function GalleryModeration() {
  const [page, setPage] = useState(null),
    [cursor, setCursor] = useState(""),
    [history, setHistory] = useState([]),
    [attempt, setAttempt] = useState(0),
    [item, setItem] = useState(null),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setPage(null);
    setError("");
    authFetch(
      `${API_URL}/admin/gallery?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal: c.signal },
    )
      .then(readJson)
      .then((value) => {
        if (!c.signal.aborted) setPage(value);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError("Moderation queue could not be loaded.");
      });
    return () => c.abort();
  }, [cursor, attempt]);
  const action = async (row, kind, publish) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await authFetch(
        `${API_URL}/admin/gallery/${row._id}/${kind}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedRevision: row.revision,
            reason,
            confirmed,
            ...(kind === "moderate" ? { publish } : {}),
          }),
        },
      ).then(readJson);
      if (alive.current) {
        setItem(kind === "inspect" ? value.item : null);
        setConfirmed(false);
        setNotice(
          kind === "inspect"
            ? "Inspection recorded. Review every image and public text before a decision."
            : "Moderation decision recorded.",
        );
        setAttempt((n) => n + 1);
      }
    } catch (f) {
      if (alive.current)
        setError(
          f.message || "Action failed. Refresh and sign in again if required.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <DashboardLayout
      title="Repair gallery moderation"
      description="Sensitive inspections and publication decisions require recent sign-in, a reason and confirmation. Check both photos/text for identifiers, consent and inappropriate content."
      action={
        <Button to="/admin" variant="outline">
          Platform operations
        </Button>
      }
    >
      <div className="ga-surface p-5 space-y-4 mb-6">
        <FormField
          label="Inspection or moderation reason"
          as="textarea"
          minLength={10}
          maxLength={1000}
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setConfirmed(false);
          }}
        />
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm shrink-0"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            I reviewed the exact target and confirm this inspection or decision.
            For publication I checked both images, public text, customer consent
            and absence of identifiers.
          </span>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-error mb-4">
          {error}{" "}
          <Button onClick={() => setAttempt((n) => n + 1)}>Retry queue</Button>
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4">
          {notice}
        </p>
      )}
      {!page && !error && <p role="status">Loading gallery queue…</p>}
      {page && (
        <>
          <ul className="space-y-3">
            {page.items.map((row) => (
              <li
                key={row._id}
                className="ga-surface p-4 flex flex-wrap justify-between items-center gap-3 min-w-0"
              >
                <p className="break-all">
                  {row._id} · {row.providerName} ·{" "}
                  {row.state.replaceAll("_", " ")}
                </p>
                <Button
                  disabled={!confirmed || reason.trim().length < 10 || busy}
                  onClick={() => action(row, "inspect")}
                >
                  Inspect exact example
                </Button>
              </li>
            ))}
          </ul>
          {!page.items.length && <p>No examples on this page.</p>}
          <div className="flex flex-wrap gap-3 mt-5">
            <Button
              disabled={!history.length}
              onClick={() => {
                setCursor(history.at(-1));
                setHistory((values) => values.slice(0, -1));
              }}
            >
              Previous page
            </Button>
            <Button
              disabled={!page.nextCursor}
              onClick={() => {
                setHistory((values) => [...values, cursor]);
                setCursor(page.nextCursor);
              }}
            >
              Next page
            </Button>
          </div>
        </>
      )}
      {item && (
        <section className="ga-surface p-5 space-y-5 mt-7">
          <h2 className="text-xl font-semibold break-words">{item.title}</h2>
          <p className="whitespace-pre-wrap break-words">{item.description}</p>
          <p>
            State: {item.state.replaceAll("_", " ")} · customer consent:{" "}
            {item.customerConsent ? "granted" : "not granted"}
          </p>
          <ExamplePhotos item={item} privateAccess admin />
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={
                !confirmed ||
                reason.trim().length < 10 ||
                busy ||
                item.state !== "pending_moderation" ||
                !item.customerConsent
              }
              onClick={() => action(item, "moderate", true)}
            >
              Approve public example
            </Button>
            <Button
              variant="outline"
              disabled={!confirmed || reason.trim().length < 10 || busy}
              onClick={() => action(item, "moderate", false)}
            >
              Reject or hide example
            </Button>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
