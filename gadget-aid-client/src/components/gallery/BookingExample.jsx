import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../provider/AuthContext";
import { API_URL } from "../../utils/api";
import { authFetch } from "../../utils/authFetch";
import { readJson } from "../../utils/readJson";
import ExamplePhotos from "./ExamplePhotos";
import Button from "../Button";
import FormField from "../ui/FormField";
export default function BookingExample({ bookingId }) {
  const { user } = useContext(AuthContext);
  return (
    <ExamplePanel key={`${user?.uid}:${bookingId}`} bookingId={bookingId} />
  );
}
function ExamplePanel({ bookingId }) {
  const [context, setContext] = useState(null),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [rights, setRights] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [file, setFile] = useState(null),
    [slot, setSlot] = useState("before");
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
    setError("");
    authFetch(`${API_URL}/bookings/${bookingId}/example`, { signal: c.signal })
      .then(readJson)
      .then((value) => {
        if (!c.signal.aborted) setContext(value);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError("The repair example could not be loaded.");
      });
    return () => c.abort();
  }, [bookingId, attempt]);
  const act = async (path, body, options = {}) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authFetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        ...options,
      }).then(readJson);
      if (alive.current) {
        setNotice("Saved. Refreshing the current example.");
        setConfirmed(false);
        setRights(false);
        setFile(null);
        setAttempt((n) => n + 1);
      }
    } catch (f) {
      if (alive.current)
        setError(
          f.message || "The action did not complete. Refresh before retrying.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const item = context?.item,
    base = item ? `/examples/${item._id}` : "",
    revision = item ? { expectedRevision: item.revision, confirmed } : {};
  return (
    <section className="ga-surface p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Public repair example</h2>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Refresh example
        </Button>
      </div>
      <p className="ga-muted text-sm">
        Optional. The provider supplies a private draft; the customer reviews
        both photos and text before consenting to public use; an admin then
        moderates it. Do not include faces, names, receipts, addresses, serial
        numbers, account screens or other identifiers. Moderation and consent do
        not verify repair quality.
      </p>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!context && !error && <p role="status">Loading example…</p>}
      {context &&
        !item &&
        (context.canCreate ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(`/bookings/${bookingId}/example`, { title, description });
            }}
          >
            <FormField
              label="Public example title"
              required
              minLength={6}
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
            <FormField
              label="Public example description"
              as="textarea"
              required
              minLength={20}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
            <Button
              type="submit"
              loading={busy}
              disabled={!context.storageAvailable}
            >
              Create private draft
            </Button>
            {!context.storageAvailable && (
              <p>Secure image storage is unavailable.</p>
            )}
          </form>
        ) : (
          <p>
            No example is proposed. New examples require an approved provider
            and a recorded completed handover.
          </p>
        ))}
      {item && (
        <>
          <h3 className="font-semibold break-words">{item.title}</h3>
          <p className="whitespace-pre-wrap break-words">{item.description}</p>
          <p className="ga-muted text-sm">
            State: {item.state.replaceAll("_", " ")} · revision {item.revision}
          </p>
          <ExamplePhotos item={item} privateAccess />
          {context.provider && item.state === "draft" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!file || !rights) return;
                if (
                  file.size > 3 * 1024 * 1024 ||
                  !["image/jpeg", "image/png"].includes(file.type)
                ) {
                  setError("Choose a JPEG/PNG image up to 3 MiB.");
                  return;
                }
                act(`${base}/images/${slot}`, null, {
                  headers: {
                    "Content-Type": file.type,
                    "X-Example-Revision": String(item.revision),
                    "X-Example-Policy": context.policyVersion,
                    "X-Image-Rights": "confirmed",
                  },
                  body: file,
                });
              }}
            >
              <FormField
                label="Image stage"
                as="select"
                value={slot}
                onChange={(e) => {
                  setSlot(e.target.value);
                  setRights(false);
                }}
              >
                <option value="before">Before</option>
                <option value="after">After</option>
              </FormField>
              <label className="block text-sm space-y-2">
                <span>JPEG/PNG example image, up to 3 MiB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={busy}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setRights(false);
                  }}
                  className="block w-full min-w-0"
                />
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="checkbox checkbox-sm shrink-0"
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                />
                <span>
                  I have permission to supply this image for private review. It
                  contains no customer or device identifiers. It will not become
                  public before separate customer consent and admin approval.
                </span>
              </label>
              <Button type="submit" disabled={!file || !rights} loading={busy}>
                Upload private example image
              </Button>
              <p className="ga-muted text-sm">
                Images are re-encoded as JPEG and metadata is removed. This does
                not remove visible identifiers; crop those out before uploading.
                Original files/names are not retained. Drafts stay private until
                consent and moderation.
              </p>
            </form>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm shrink-0"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              {context.customer && item.state === "awaiting_customer"
                ? "I reviewed the exact text and both photos. Selecting Consent grants public display; Decline refuses it. I understand viewers may copy public images, removal cannot erase outside copies or infrastructure backups, and I can withdraw later. I checked for identifiers."
                : "I reviewed this exact example and confirm the selected action. Deleting removes both images and the proposal from primary storage and immediately prevents new public access."}
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            {context.provider && item.state === "draft" && (
              <Button
                disabled={!confirmed || !item.before || !item.after || busy}
                onClick={() => act(`${base}/submit`, revision)}
              >
                Send for customer review
              </Button>
            )}
            {context.customer && item.state === "awaiting_customer" && (
              <>
                <Button
                  disabled={!confirmed || busy}
                  onClick={() =>
                    act(`${base}/consent`, {
                      ...revision,
                      grant: true,
                      policyVersion: context.policyVersion,
                    })
                  }
                >
                  Consent to public review
                </Button>
                <Button
                  variant="outline"
                  disabled={!confirmed || busy}
                  onClick={() =>
                    act(`${base}/consent`, { ...revision, grant: false })
                  }
                >
                  Decline public use
                </Button>
              </>
            )}
            <Button
              variant="outline"
              disabled={!confirmed || busy}
              onClick={() => act(`${base}/withdraw`, revision)}
            >
              Withdraw and delete example
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
