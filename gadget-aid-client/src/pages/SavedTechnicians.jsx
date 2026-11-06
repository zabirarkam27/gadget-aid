import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../provider/AuthContext";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import Button from "../components/Button";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
export default function SavedTechnicians() {
  const { user } = useContext(AuthContext);
  return <Saved key={user?.uid || "guest"} />;
}
function Saved() {
  const [page, setPage] = useState(null),
    [cursor, setCursor] = useState(""),
    [history, setHistory] = useState([]),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setPage(null);
    setError("");
    authFetch(
      `${API_URL}/saved-technicians?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal: c.signal },
    )
      .then(readJson)
      .then((value) => {
        if (!Array.isArray(value.items)) throw Error();
        if (!c.signal.aborted) setPage(value);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError("Saved technicians could not be loaded.");
      });
    return () => c.abort();
  }, [cursor, attempt]);
  const remove = async (id) => {
    if (busy) return;
    setBusy(id);
    setError("");
    try {
      await authFetch(`${API_URL}/saved-technicians/${id}`, {
        method: "DELETE",
      }).then(readJson);
      setAttempt((n) => n + 1);
    } catch (f) {
      setError(f.message || "Could not remove the bookmark.");
    } finally {
      setBusy("");
    }
  };
  return (
    <DashboardLayout
      title="Saved technicians"
      description="Your private bookmarks. A saved provider is not a recommendation or a guarantee of availability."
      action={<Button to="/services">Find a service</Button>}
    >
      {error && (
        <p role="alert">
          {error}{" "}
          <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </p>
      )}
      {!page && !error && <p role="status">Loading saved technicians…</p>}
      {page && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {page.items.map((row) => (
              <article key={row._id} className="ga-surface p-5 min-w-0">
                <h2 className="text-xl font-semibold break-words">
                  {row.name}
                </h2>
                <p className="ga-muted text-sm mt-3">
                  {row.available
                    ? "Open the profile to confirm services and hours."
                    : "The anchored listing is no longer publicly available. You can remove this bookmark."}
                </p>
                <div className="flex flex-wrap gap-3 mt-5">
                  {row.available && (
                    <Button
                      to={`/technicians/${row.technicianId}`}
                      variant="outline"
                    >
                      View profile
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    loading={busy === row._id}
                    disabled={!!busy}
                    onClick={() => remove(row._id)}
                  >
                    Remove bookmark
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {!page.items.length && (
            <p>
              No saved technicians on this page. Save one from a public profile.
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-6">
            <Button
              variant="outline"
              disabled={!history.length}
              onClick={() => {
                setCursor(history.at(-1));
                setHistory((values) => values.slice(0, -1));
              }}
            >
              Previous page
            </Button>
            <Button
              variant="outline"
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
    </DashboardLayout>
  );
}
