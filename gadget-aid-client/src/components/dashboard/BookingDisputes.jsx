import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../utils/api";
import { authFetch } from "../../utils/authFetch";
import { readJson } from "../../utils/readJson";
import Button from "../Button";
import FormField from "../ui/FormField";
const BookingDisputes = ({ bookingId }) => {
  const [items, setItems] = useState(null),
    [subject, setSubject] = useState(""),
    [description, setDescription] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [attempt, setAttempt] = useState(0);
  const lock = useRef(false),
    alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    authFetch(`${API_URL}/bookings/${bookingId}/disputes`, {
      signal: controller.signal,
    })
      .then(readJson)
      .then((value) => {
        if (!controller.signal.aborted) {
          setItems(value);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [bookingId, attempt]);
  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const value = await authFetch(
        `${API_URL}/bookings/${bookingId}/disputes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, description }),
        },
      ).then(readJson);
      if (alive.current) {
        setItems([value]);
        setSubject("");
        setDescription("");
      }
    } catch (error) {
      if (alive.current) {
        setError(error.message);
        if (error.code === "DISPUTE_EXISTS") setAttempt((v) => v + 1);
      }
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <section className="ga-surface p-5 sm:p-7 space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h2 className="text-xl font-semibold">Booking support</h2>
        <Button
          variant="ghost"
          disabled={saving}
          onClick={() => setAttempt((v) => v + 1)}
        >
          Refresh support status
        </Button>
      </div>
      <p className="ga-muted text-sm">
        Raise a private dispute for platform review. A support resolution does
        not automatically change your repair or issue a payment.
      </p>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {items === null ? (
        <p role="status">Loading support requests…</p>
      ) : items.length ? (
        items.map((item) => (
          <div
            key={item._id}
            className="space-y-3 border-t border-base-300 pt-4"
          >
            <h3 className="font-semibold break-words">{item.subject}</h3>
            <p className="badge badge-outline">
              {item.state.replaceAll("_", " ")}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {item.description}
            </p>
            {item.resolution && (
              <div className="border-l-2 border-primary pl-4">
                <p className="font-semibold">Platform resolution</p>
                <p className="whitespace-pre-wrap break-words">
                  {item.resolution}
                </p>
              </div>
            )}
            <ol className="space-y-2 text-xs ga-muted">
              {item.history.map((event, i) => (
                <li key={i}>
                  {event.state.replaceAll("_", " ")} ·{" "}
                  {event.actorRole.replaceAll("_", " ")} ·{" "}
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Dhaka",
                  }).format(new Date(event.createdAt))}
                </li>
              ))}
            </ol>
          </div>
        ))
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={saving} className="space-y-4">
            <FormField
              label="Dispute subject"
              required
              minLength={5}
              maxLength={160}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <FormField
              label="What should the platform review?"
              as="textarea"
              required
              minLength={20}
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" loading={saving}>
              Open private dispute
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  );
};
export default BookingDisputes;
