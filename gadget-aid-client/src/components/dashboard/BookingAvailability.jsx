import { useEffect, useState } from "react";
import { API_URL } from "../../utils/api";
import { readJson } from "../../utils/readJson";
import FormField from "../ui/FormField";
import Button from "../Button";
const BookingAvailability = ({
  serviceId,
  date,
  time,
  setTime,
  onAvailability,
  attempt = 0,
}) => {
  const [state, setState] = useState({ loading: false, data: null, error: "" }),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setTime("");
    if (!date) {
      setState({ loading: false, data: null, error: "" });
      onAvailability(null);
      return () => controller.abort();
    }
    setState({ loading: true, data: null, error: "" });
    onAvailability({ loading: true, date });
    fetch(
      `${API_URL}/services/${serviceId}/availability?date=${encodeURIComponent(date)}`,
      { signal: controller.signal },
    )
      .then(readJson)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, data, error: "" });
          onAvailability(data);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, data: null, error: failure.message });
          onAvailability({ error: failure.message, date });
        }
      });
    return () => controller.abort();
  }, [serviceId, date, attempt, retry, setTime, onAvailability]);
  return (
    <div className="space-y-3">
      {state.loading && (
        <p role="status" className="ga-muted text-sm">
          Checking provider availability…
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-error text-sm">
          {state.error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry availability
          </button>
        </p>
      )}
      {state.data && (
        <>
          {!state.data.open ? (
            <p role="status" className="text-warning">
              The provider is closed on this date. Choose another date.
            </p>
          ) : state.data.mode === "appointments" ? (
            <>
              <FormField
                label="Appointment time (Bangladesh, one hour)"
                as="select"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              >
                <option value="">Choose an available time</option>
                {state.data.slots.map((value) => (
                  <option key={value} value={value}>
                    {value}–
                    {String(Number(value.slice(0, 2)) + 1).padStart(2, "0")}:00
                  </option>
                ))}
              </FormField>
              {!state.data.slots.length && (
                <p role="status" className="text-warning">
                  No appointment times remain on this date. Choose another date.
                </p>
              )}
              <p className="ga-muted text-sm">
                Your time is reserved when the booking request succeeds. Times
                may be taken before you submit.
              </p>
            </>
          ) : (
            <p className="ga-muted text-sm">
              {state.data.configured
                ? "The provider is open for date requests."
                : "This provider has not set appointment hours."}{" "}
              This date requires confirmation and does not reserve a time.
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRetry((v) => v + 1)}
          >
            Refresh available times
          </Button>
        </>
      )}
    </div>
  );
};
export default BookingAvailability;
