import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../utils/api";
import { authFetch } from "../../utils/authFetch";
import { readJson } from "../../utils/readJson";
import Button from "../Button";
import FormField from "../ui/FormField";
const BookingReview = ({ bookingId, status }) => {
  const [state, setState] = useState(null),
    [error, setError] = useState(""),
    [rating, setRating] = useState(""),
    [feedback, setFeedback] = useState(""),
    [saving, setSaving] = useState(false),
    [retry, setRetry] = useState(0);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    authFetch(`${API_URL}/bookings/${bookingId}/review`, {
      signal: controller.signal,
    })
      .then(readJson)
      .then((value) => {
        if (!controller.signal.aborted) {
          setState(value);
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
  }, [bookingId, status, retry]);
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const review = await authFetch(
        `${API_URL}/bookings/${bookingId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: Number(rating), feedback }),
        },
      ).then(readJson);
      if (alive.current)
        setState((previous) => ({
          ...previous,
          eligible: false,
          review: { ...review, moderationState: "published" },
        }));
    } catch (error) {
      if (alive.current) setError(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <section className="ga-surface p-5 sm:p-7 space-y-4">
      <h2 className="text-xl font-semibold">Completed repair review</h2>
      {error && (
        <p role="alert" className="text-error">
          {error}{" "}
          <button className="underline" onClick={() => setRetry((v) => v + 1)}>
            Refresh review
          </button>
        </p>
      )}
      {!state && !error && (
        <p className="ga-muted">Checking review eligibility…</p>
      )}
      {state?.review ? (
        <>
          <p className="font-semibold">
            {state.review.rating} / 5 · Verified completed booking
          </p>
          <p className="whitespace-pre-wrap break-words">
            {state.review.feedback}
          </p>
          <p className="text-sm ga-muted">
            {state.review.moderationState === "hidden"
              ? "This review is hidden following moderation."
              : "One review per booking. Submitted reviews cannot be edited."}
          </p>
          {state.review.response && (
            <p className="break-words">
              Provider response: {state.review.response.text}
            </p>
          )}
        </>
      ) : state?.eligible ? (
        <form onSubmit={submit}>
          <fieldset disabled={saving} className="space-y-4">
            <p className="ga-muted text-sm">
              Rate your completed repair. Your account email and booking
              reference are not published.
            </p>
            <FormField
              label="Repair rating"
              as="select"
              required
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">Choose stars</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n === 1 ? "" : "s"}
                </option>
              ))}
            </FormField>
            <FormField
              label="Your repair feedback"
              as="textarea"
              required
              minLength={20}
              maxLength={2000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <Button type="submit" loading={saving}>
              Submit review
            </Button>
          </fieldset>
        </form>
      ) : (
        state && <p className="ga-muted text-sm">{state.reason}</p>
      )}
      {state?.technicianId && (
        <Button to={`/technicians/${state.technicianId}`} variant="ghost">
          View technician profile and reviews
        </Button>
      )}
    </section>
  );
};
export default BookingReview;
