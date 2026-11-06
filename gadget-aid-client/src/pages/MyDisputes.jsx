import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../provider/AuthContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
const MyDisputes = () => {
  const { user } = useContext(AuthContext);
  const [state, setState] = useState({
      items: [],
      loading: true,
      error: "",
      nextCursor: null,
    }),
    [status, setStatus] = useState(""),
    [cursor, setCursor] = useState(null),
    [history, setHistory] = useState([]),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      limit: "25",
      ...(status ? { status } : {}),
      ...(cursor ? { cursor } : {}),
    });
    setState({ items: [], loading: true, error: "", nextCursor: null });
    authFetch(`${API_URL}/my-disputes?${query}`, { signal: controller.signal })
      .then(readJson)
      .then((value) => {
        if (!controller.signal.aborted)
          setState({ ...value, loading: false, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            items: [],
            loading: false,
            error: error.message,
            nextCursor: null,
          });
      });
    return () => controller.abort();
  }, [user.uid, status, cursor, attempt]);
  return (
    <DashboardLayout
      title="My support requests"
      description="Private disputes you opened for your bookings. Resolution does not automatically change repair status or issue payments."
      action={
        <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
          Refresh support requests
        </Button>
      }
    >
      <div className="max-w-xs mb-6">
        <FormField
          label="Support request status"
          as="select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor(null);
            setHistory([]);
          }}
        >
          <option value="">All statuses</option>
          {["open", "in_review", "resolved"].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </FormField>
      </div>
      {state.loading ? (
        <p role="status">Loading support requests…</p>
      ) : state.error ? (
        <p role="alert" className="text-error">
          {state.error}
        </p>
      ) : state.items.length ? (
        <div className="space-y-4">
          {state.items.map((row) => (
            <article className="ga-surface p-6 space-y-3" key={row._id}>
              <h2 className="text-lg font-semibold break-words">
                {row.subject}
              </h2>
              <span className="badge badge-outline">
                {row.state.replaceAll("_", " ")}
              </span>
              <p className="whitespace-pre-wrap break-words">
                {row.description}
              </p>
              {row.resolution && (
                <p className="border-l-2 border-primary pl-4 whitespace-pre-wrap break-words">
                  Resolution: {row.resolution}
                </p>
              )}
              <Button to={`/bookings/${row.bookingId}`} variant="outline">
                Open booking support history
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <p className="ga-muted">No support requests on this page.</p>
      )}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          disabled={!history.length || state.loading}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory(history.slice(0, -1));
          }}
        >
          Previous page
        </Button>
        <Button
          variant="outline"
          disabled={!state.nextCursor || state.loading}
          onClick={() => {
            setHistory([...history, cursor]);
            setCursor(state.nextCursor);
          }}
        >
          Next page
        </Button>
      </div>
    </DashboardLayout>
  );
};
export default MyDisputes;
