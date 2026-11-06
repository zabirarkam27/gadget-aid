import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_URL } from "../../utils/api";
import { authFetch } from "../../utils/authFetch";
import { readJson } from "../../utils/readJson";
import { NotificationsContext } from "../../provider/NotificationsContext";
import FormField from "../ui/FormField";
import Button from "../Button";
const BookingConversation = ({ bookingId }) => {
  const notifications = useContext(NotificationsContext);
  const [thread, setThread] = useState(null),
    [draft, setDraft] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const active = useRef(false),
    lock = useRef(false),
    sequence = useRef(0),
    requestId = useRef(null),
    controller = useRef(null);
  const path = `${API_URL}/bookings/${bookingId}/messages`;
  const load = useCallback(() => {
    if (lock.current) return;
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal,
      version = ++sequence.current;
    setLoading(true);
    authFetch(path, { signal })
      .then(readJson)
      .then((value) => {
        if (active.current && !signal.aborted && sequence.current === version) {
          setThread(value);
          setError("");
        }
      })
      .catch((failure) => {
        if (active.current && !signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (active.current && sequence.current === version) setLoading(false);
      });
  }, [path]);
  useEffect(() => {
    active.current = true;
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    return () => {
      active.current = false;
      controller.current?.abort();
      clearInterval(timer);
    };
  }, [load]);
  const mutate = async (suffix, body) => {
    if (lock.current) return;
    lock.current = true;
    controller.current?.abort();
    ++sequence.current;
    setLoading(false);
    setSaving(true);
    setError("");
    try {
      const value = await authFetch(path + suffix, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(readJson);
      if (active.current) {
        setThread(value);
        if (!suffix) {
          setDraft("");
          requestId.current = null;
        }
        notifications?.refresh();
      }
    } catch (failure) {
      if (active.current) setError(failure.message);
    } finally {
      lock.current = false;
      if (active.current) setSaving(false);
    }
  };
  return (
    <section
      className="ga-surface p-5 sm:p-7 space-y-5 min-w-0"
      aria-labelledby="conversation-title"
    >
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <h2 id="conversation-title" className="text-xl font-semibold">
          Booking conversation
        </h2>
        <Button variant="ghost" onClick={load} disabled={loading || saving}>
          Refresh messages
        </Button>
      </div>
      <p className="text-sm ga-muted">
        Private to this booking's customer and provider. Checks for updates
        every 30 seconds while visible. Messages do not approve quotations or
        change repair stages.
      </p>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {loading && !thread && <p role="status">Loading messages…</p>}
      {thread && (
        <>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <p role="status" className="text-sm">
              {thread.unreadCount} unread message
              {thread.unreadCount === 1 ? "" : "s"}
            </p>
            <Button
              variant="outline"
              disabled={!thread.unreadCount || saving}
              onClick={() =>
                mutate("/read", { throughId: thread.lastMessageId })
              }
            >
              Mark displayed messages read
            </Button>
          </div>
          <ol
            className="space-y-3 max-h-96 overflow-y-auto pr-1"
            aria-label="Booking messages"
          >
            {thread.messages.map((message) => (
              <li
                key={message.id}
                className={`rounded-xl p-4 ${message.self ? "bg-primary/10 border border-primary/20" : "bg-base-200"}`}
              >
                <p className="text-xs ga-muted mb-2">
                  {message.self
                    ? "You"
                    : message.role === "provider"
                      ? "Provider"
                      : "Customer"}{" "}
                  ·{" "}
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Dhaka",
                  }).format(new Date(message.createdAt))}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {message.text}
                </p>
              </li>
            ))}
          </ol>
          {!thread.messages.length && (
            <p className="ga-muted">
              No messages yet. Share a useful update or ask about this repair.
            </p>
          )}
          {thread.canSend && !thread.limitReached ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                requestId.current ||= crypto.randomUUID();
                mutate("", { text: draft, requestId: requestId.current });
              }}
            >
              <fieldset disabled={saving} className="space-y-3">
                <FormField
                  label="Message about this booking"
                  as="textarea"
                  required
                  maxLength={2000}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    requestId.current = null;
                  }}
                  helper="Up to 2,000 characters. Messages are saved and cannot be edited."
                />
                <Button type="submit" disabled={!draft.trim()} loading={saving}>
                  Send message
                </Button>
              </fieldset>
            </form>
          ) : (
            <p className="ga-muted text-sm">
              {thread.limitReached
                ? "This conversation reached its 200-message limit. Existing messages remain available."
                : thread.sendRestriction ||
                  "The other participant is unavailable. Existing messages remain available."}
            </p>
          )}
        </>
      )}
    </section>
  );
};
export default BookingConversation;
