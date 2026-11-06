import { useEffect, useRef, useState } from "react";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../utils/api";
import { readJson } from "../../utils/readJson";
import Button from "../Button";
import FormField from "../ui/FormField";
const call = (path, options = {}) =>
  authFetch(`${API_URL}${path}`, options).then(readJson);
export default function BookingPassport({ bookingId, status }) {
  const [data, setData] = useState(null),
    [devices, setDevices] = useState([]),
    [cursor, setCursor] = useState(null),
    [selected, setSelected] = useState(""),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState(""),
    [confirmed, setConfirmed] = useState(false);
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
    setData(null);
    call(`/bookings/${bookingId}/passport`, { signal: c.signal })
      .then(async (value) => {
        let page = null;
        if (value.customer)
          page = await call("/devices?limit=100", { signal: c.signal });
        if (!c.signal.aborted) {
          setData(value);
          setSelected(value.device?._id || "");
          setDevices(page?.items || []);
          setCursor(page?.nextCursor || null);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [bookingId, status, attempt]);
  const send = async (path, body, method = "POST") => {
    if (lock.current) return false;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      await call(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (alive.current) {
        setNotice(
          "Record saved. Refresh to see the latest provider terms and claim state.",
        );
        setConfirmed(false);
        setAttempt((v) => v + 1);
      }
      return true;
    } catch (e) {
      if (alive.current) setError(e.message);
      return false;
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const warranty = data?.warranty;
  const submit = async (event, kind) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (kind === "issue")
      await send(`/bookings/${bookingId}/warranty`, {
        durationDays: Number(form.get("durationDays")),
        coverage: form.get("coverage"),
        exclusions: form.get("exclusions"),
        confirmed,
        expectedRevision: data.repairRevision,
      });
    else if (kind === "claim")
      await send(`/bookings/${bookingId}/warranty/claims`, {
        description: form.get("description"),
        expectedRevision: warranty.revision,
      });
    else
      await send(`/bookings/${bookingId}/warranty/decision`, {
        state: form.get("state"),
        note: form.get("note"),
        confirmed,
        expectedRevision: warranty.revision,
      });
  };
  const states =
    {
      submitted: ["in_review"],
      in_review: ["approved", "rejected"],
      approved: ["fulfilled"],
    }[warranty?.claim?.state] || [];
  return (
    <section className="ga-surface p-5 sm:p-7 space-y-5 min-w-0">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h2 className="text-xl font-semibold">Gadget Passport & warranty</h2>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => setAttempt((v) => v + 1)}
        >
          Refresh passport
        </Button>
      </div>
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
      {!data && !error && (
        <p role="status">Loading private warranty records…</p>
      )}
      {data && (
        <>
          {data.customer && (
            <div className="space-y-3">
              <p className="ga-muted">
                Link one of your private devices to keep this repair in its
                passport. The provider never receives the serial number or your
                other device history.
              </p>
              <FormField
                label="Device for this repair"
                as="select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={saving}
              >
                <option value="">No device linked</option>
                {data.device &&
                  !devices.some((d) => d._id === data.device._id) && (
                    <option value={data.device._id}>{data.device.label}</option>
                  )}
                {devices.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.label} · {d.type}
                  </option>
                ))}
              </FormField>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={saving || selected === (data.device?._id || "")}
                  onClick={() =>
                    send(
                      `/bookings/${bookingId}/device`,
                      {
                        deviceId: selected || null,
                        expectedDeviceId: data.device?._id || null,
                      },
                      "PUT",
                    )
                  }
                >
                  Save device link
                </Button>
                <Button
                  to={data.device ? `/devices/${data.device._id}` : "/devices"}
                  variant="outline"
                >
                  {data.device ? "Open private passport" : "Manage my devices"}
                </Button>
                {cursor && (
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        const page = await call(
                          `/devices?limit=100&cursor=${encodeURIComponent(cursor)}`,
                        );
                        if (alive.current) {
                          setDevices([...devices, ...page.items]);
                          setCursor(page.nextCursor);
                        }
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Load more devices
                  </Button>
                )}
              </div>
            </div>
          )}
          {warranty ? (
            <div className="space-y-4">
              <h3 className="font-semibold">
                Terms supplied by {warranty.providerName}
              </h3>
              <p>
                {warranty.startDate} to {warranty.endDate} (inclusive) ·{" "}
                {warranty.periodState.replaceAll("_", " ")}
              </p>
              <p className="whitespace-pre-wrap break-words">
                <strong>Coverage: </strong>
                {warranty.coverage}
              </p>
              <p className="whitespace-pre-wrap break-words">
                <strong>Exclusions: </strong>
                {warranty.exclusions || "None specified by the provider."}
              </p>
              <p className="text-sm ga-muted">
                Being within these dates does not approve a claim. Coverage
                depends on these repair-specific terms and the provider's
                recorded decision.
              </p>
              {warranty.claim ? (
                <div className="border-t border-base-300 pt-4 space-y-4">
                  <h3 className="font-semibold">
                    Warranty claim · {warranty.claim.state.replaceAll("_", " ")}
                  </h3>
                  <p className="whitespace-pre-wrap break-words">
                    {warranty.claim.description}
                  </p>
                  <ol className="space-y-3">
                    {warranty.claim.history.map((h, i) => (
                      <li className="border-l-2 border-primary pl-3" key={i}>
                        <strong>{h.state.replaceAll("_", " ")}</strong> ·{" "}
                        {h.actorRole}
                        <p className="whitespace-pre-wrap break-words">
                          {h.note}
                        </p>
                      </li>
                    ))}
                  </ol>
                  {data.canManageClaim && states.length > 0 && (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => submit(e, "decision")}
                    >
                      <fieldset disabled={saving} className="space-y-4">
                        <FormField
                          label="Claim decision"
                          name="state"
                          as="select"
                          required
                          defaultValue=""
                        >
                          <option value="">Choose a claim decision</option>
                          {states.map((s) => (
                            <option key={s} value={s}>
                              {s.replaceAll("_", " ")}
                            </option>
                          ))}
                        </FormField>
                        <FormField
                          label="Decision reason shared with customer"
                          name="note"
                          as="textarea"
                          required
                          minLength={10}
                          maxLength={2000}
                        />
                        <label className="flex gap-3">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                          />
                          <span>
                            I confirm this claim decision for this exact
                            booking.
                          </span>
                        </label>
                        <Button type="submit" disabled={!confirmed}>
                          Record claim decision
                        </Button>
                      </fieldset>
                    </form>
                  )}
                </div>
              ) : data.customer && warranty.periodState === "within_dates" ? (
                <form
                  className="space-y-4"
                  onSubmit={(e) => submit(e, "claim")}
                >
                  <fieldset disabled={saving} className="space-y-4">
                    <FormField
                      label="Describe your warranty claim"
                      name="description"
                      as="textarea"
                      required
                      minLength={20}
                      maxLength={4000}
                      helper="One claim thread per repair warranty. Describe the issue without adding passwords or identity documents."
                    />
                    <Button type="submit">Submit claim for review</Button>
                  </fieldset>
                </form>
              ) : (
                <p className="ga-muted">
                  {warranty.periodState === "expired"
                    ? "The stated warranty dates have expired. Booking support remains available."
                    : "No claim has been submitted."}
                </p>
              )}
            </div>
          ) : (
            <p className="ga-muted">
              No provider-issued warranty recorded. A completed repair alone
              does not promise warranty coverage.
            </p>
          )}
          {data.canIssue && (
            <details className="border-t border-base-300 pt-4">
              <summary className="cursor-pointer font-semibold">
                Issue repair warranty terms
              </summary>
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => submit(e, "issue")}
              >
                <fieldset disabled={saving} className="space-y-4">
                  <p className="ga-muted">
                    These permanent terms apply only to this completed repair.
                    Dates start on its recorded handover day. Only issue
                    coverage you will honor; this is not a platform warranty.
                  </p>
                  <FormField
                    label="Warranty duration in days"
                    type="number"
                    name="durationDays"
                    min={1}
                    max={730}
                    required
                  />
                  <FormField
                    label="Repair-specific coverage"
                    as="textarea"
                    name="coverage"
                    minLength={20}
                    maxLength={2000}
                    required
                  />
                  <FormField
                    label="Exclusions (optional)"
                    as="textarea"
                    name="exclusions"
                    maxLength={2000}
                  />
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    <span>
                      I reviewed these permanent terms for this exact completed
                      repair and confirm issuance.
                    </span>
                  </label>
                  <Button type="submit" disabled={!confirmed}>
                    Publish provider warranty
                  </Button>
                </fieldset>
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}
