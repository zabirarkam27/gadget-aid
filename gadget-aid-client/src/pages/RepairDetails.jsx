import BookingConversation from "../components/dashboard/BookingConversation";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import { dateLabel, priceLabel, repairStatuses } from "../utils/workspace";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import CollectionState from "../components/dashboard/CollectionState";
import StatusBadge from "../components/ui/StatusBadge";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
const stamp = (value) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Dhaka",
      }).format(new Date(value))
    : "";
const Panel = ({ title, children }) => (
  <section className="ga-surface p-5 sm:p-7 space-y-5 min-w-0">
    <h2 className="text-xl font-semibold">{title}</h2>
    {children}
  </section>
);
const RepairDetails = () => {
  const { id } = useParams();
  return <RepairWorkspace key={id} id={id} />;
};
const RepairWorkspace = ({ id }) => {
  const [search] = useSearchParams();
  const [booking, setBooking] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saveError, setSaveError] = useState(""),
    [saving, setSaving] = useState(false),
    [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);
  const lock = useRef(false),
    alive = useRef(true);
  const [target, setTarget] = useState(""),
    [note, setNote] = useState(""),
    [accepted, setAccepted] = useState(false);
  const [diagnosis, setDiagnosis] = useState({
    summary: "",
    issue: "",
    recommendedRepair: "",
  });
  const [parts, setParts] = useState([]),
    [labor, setLabor] = useState(""),
    [estimate, setEstimate] = useState(""),
    [expiry, setExpiry] = useState("");
  const [question, setQuestion] = useState(""),
    [answers, setAnswers] = useState({});
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    authFetch(`${API_URL}/bookings/${id}`, { signal: controller.signal })
      .then(readJson)
      .then((value) => {
        if (!controller.signal.aborted) {
          setBooking(value);
          setTarget("");
          setAccepted(false);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, refresh]);
  const send = async (path, body, method = "POST") => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setSaveError("");
    setSuccess("");
    try {
      const result = await authFetch(`${API_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          expectedRevision: booking.repairRevision,
        }),
      }).then(readJson);
      if (alive.current) {
        setBooking(result.booking);
        setTarget("");
        setNote("");
        setAccepted(false);
        setQuestion("");
        setSuccess(
          "Repair updated. Both participants can see this after refreshing.",
        );
      }
    } catch (failure) {
      if (alive.current) setSaveError(failure.message);
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const base = `/bookings/${id}`,
    a = booking?.actions || {},
    quote = booking?.currentQuotation;
  const provider =
    booking?.permissions.provider &&
    (search.get("view") === "provider" || !booking?.permissions.customer);
  const transition = a.transitions?.find((item) => item.status === target);
  const total =
    parts.reduce(
      (sum, p) =>
        sum +
        Math.round(Number(p.unitPrice || 0) * 100) * Number(p.quantity || 0),
      Math.round(Number(labor || 0) * 100),
    ) / 100;
  const setPart = (index, key, value) =>
    setParts((previous) =>
      previous.map((part, i) =>
        i === index ? { ...part, [key]: value } : part,
      ),
    );
  return (
    <DashboardLayout
      title="Repair details"
      eyebrow={provider ? "Provider workspace" : "Customer workspace"}
      description="Diagnosis, quotation decisions and repair progress. Times are shown in Bangladesh time."
      action={
        <div className="flex gap-3">
          <Button
            to={provider ? "/service-to-do" : "/booked-services"}
            variant="ghost"
          >
            Back to workspace
          </Button>
          <Button
            variant="outline"
            onClick={() => setRefresh((v) => v + 1)}
            disabled={loading || saving}
          >
            Refresh repair
          </Button>
        </div>
      }
    >
      <CollectionState
        loading={loading}
        error={error}
        retry={() => setRefresh((v) => v + 1)}
      >
        {booking && (
          <div className="space-y-6">
            <Panel title={booking.serviceName}>
              <div className="flex flex-wrap gap-4 items-center">
                <StatusBadge status={booking.status} />
                <span className="ga-muted text-sm">
                  Preferred date: {dateLabel(booking.date)}
                </span>
              </div>
              <p className="text-sm ga-muted break-all">Reference: {id}</p>
              <p className="break-words">
                {provider
                  ? `Customer: ${booking.userName || booking.userEmail}`
                  : `Provider: ${booking.providerName}`}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {booking.instruction || "No additional instructions."}
              </p>
              <p className="text-sm ga-muted">
                Listed service price: {priceLabel(booking.price)}. Repair
                authorization uses the quotation below.
              </p>
              {booking.legacyNotice && (
                <p className="text-sm border-l-4 border-warning pl-4">
                  {booking.legacyNotice}
                </p>
              )}
            </Panel>
            {saveError && (
              <div role="alert" className="ga-surface p-5 text-error">
                {saveError}{" "}
                <button
                  className="underline ml-2"
                  disabled={saving}
                  onClick={() => setRefresh((v) => v + 1)}
                >
                  Refresh latest details
                </button>
              </div>
            )}
            {success && (
              <p role="status" className="text-success">
                {success}
              </p>
            )}
            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
                {quote && (
                  <Panel title={`Quotation ${quote.number} · ${quote.status}`}>
                    <Quote quote={quote} />
                    {quote.clarifications.map((item) => (
                      <div
                        key={item.id}
                        className="border-t border-base-300 pt-4 space-y-3"
                      >
                        <p className="font-semibold break-words">
                          Question: {item.question}
                        </p>
                        <p className="ga-muted text-xs">
                          {stamp(item.askedAt)}
                        </p>
                        {item.answer ? (
                          <p className="whitespace-pre-wrap break-words">
                            Provider: {item.answer}
                          </p>
                        ) : (
                          <p className="ga-muted">
                            Awaiting provider response. Approval is paused.
                          </p>
                        )}
                        {provider && a.answer && !item.answer && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              send(
                                `${base}/quotations/${quote.id}/questions/${item.id}/answer`,
                                { answer: answers[item.id] || "" },
                              );
                            }}
                          >
                            <fieldset disabled={saving} className="space-y-3">
                              <FormField
                                label="Answer quotation question"
                                as="textarea"
                                required
                                minLength={3}
                                maxLength={2000}
                                value={answers[item.id] || ""}
                                onChange={(e) =>
                                  setAnswers({
                                    ...answers,
                                    [item.id]: e.target.value,
                                  })
                                }
                              />
                              <Button type="submit" loading={saving}>
                                Send answer
                              </Button>
                            </fieldset>
                          </form>
                        )}
                      </div>
                    ))}
                    {!provider && (a.approve || a.rejectQuote) && (
                      <div className="space-y-4 border-t border-base-300 pt-5">
                        <FormField
                          label="Decision note (required to reject)"
                          as="textarea"
                          maxLength={1000}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <label className="flex gap-3 items-start">
                          <input
                            type="checkbox"
                            className="checkbox mt-1 shrink-0"
                            checked={accepted}
                            disabled={saving || !a.approve}
                            onChange={(e) => setAccepted(e.target.checked)}
                          />
                          <span>
                            I reviewed quotation {quote.number} and authorize
                            this repair for {priceLabel(quote.total)}.
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            disabled={!a.approve || !accepted || saving}
                            loading={saving}
                            onClick={() =>
                              send(`${base}/quotations/${quote.id}/decision`, {
                                decision: "approve",
                                note,
                              })
                            }
                          >
                            Approve repair
                          </Button>
                          <Button
                            variant="outline"
                            disabled={
                              !a.rejectQuote || note.trim().length < 3 || saving
                            }
                            onClick={() =>
                              send(`${base}/quotations/${quote.id}/decision`, {
                                decision: "reject",
                                note,
                              })
                            }
                          >
                            Reject quotation
                          </Button>
                        </div>
                        {quote.expired && (
                          <p className="text-error text-sm">
                            This quotation expired. The provider must send a new
                            version before approval.
                          </p>
                        )}
                      </div>
                    )}
                    {!provider && a.clarify && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          send(`${base}/quotations/${quote.id}/questions`, {
                            question,
                          });
                        }}
                      >
                        <fieldset disabled={saving} className="space-y-3">
                          <FormField
                            label="Ask about this quotation"
                            as="textarea"
                            required
                            minLength={3}
                            maxLength={1000}
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            loading={saving}
                          >
                            Request clarification
                          </Button>
                        </fieldset>
                      </form>
                    )}
                  </Panel>
                )}
                {provider && a.transitions?.length > 0 && (
                  <Panel title="Next repair step">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        send(
                          `/all-bookings/${id}`,
                          { status: target, note },
                          "PATCH",
                        );
                      }}
                    >
                      <fieldset disabled={saving} className="space-y-4">
                        <FormField
                          label="Next stage"
                          as="select"
                          required
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          <option value="">Choose a step</option>
                          {a.transitions.map((item) => (
                            <option key={item.status} value={item.status}>
                              {item.label}
                            </option>
                          ))}
                        </FormField>
                        <FormField
                          label={
                            transition?.requiresNote
                              ? "Reason for this change"
                              : "Progress note (optional)"
                          }
                          as="textarea"
                          required={transition?.requiresNote}
                          minLength={transition?.requiresNote ? 3 : undefined}
                          maxLength={1000}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <p className="text-sm ga-muted">
                          Notes and status changes are visible to the customer.
                        </p>
                        <Button
                          type="submit"
                          disabled={!target}
                          loading={saving}
                        >
                          Confirm stage change
                        </Button>
                      </fieldset>
                    </form>
                  </Panel>
                )}
                {provider && a.diagnose && (
                  <Panel title="Record diagnosis">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        send(`${base}/diagnoses`, diagnosis);
                      }}
                    >
                      <fieldset disabled={saving} className="space-y-4">
                        {[
                          ["summary", "Diagnosis summary", 10, 2000],
                          ["issue", "Identified issue", 3, 1000],
                          ["recommendedRepair", "Recommended repair", 3, 2000],
                        ].map(([key, label, min, max]) => (
                          <FormField
                            key={key}
                            label={label}
                            as="textarea"
                            required
                            minLength={min}
                            maxLength={max}
                            value={diagnosis[key]}
                            onChange={(e) =>
                              setDiagnosis({
                                ...diagnosis,
                                [key]: e.target.value,
                              })
                            }
                          />
                        ))}
                        <Button type="submit" loading={saving}>
                          Save diagnosis version
                        </Button>
                      </fieldset>
                    </form>
                  </Panel>
                )}
                {provider && a.quote && (
                  <Panel title="Send a quotation">
                    <p className="text-sm ga-muted">
                      Each send creates a permanent version. Approval locks the
                      quotation. All amounts are USD.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        send(`${base}/quotations`, {
                          parts: parts.map((p) => ({
                            ...p,
                            quantity: Number(p.quantity),
                            unitPrice: Number(p.unitPrice),
                          })),
                          labor: Number(labor),
                          estimatedCompletion: estimate,
                          expiresOn: expiry,
                        });
                      }}
                    >
                      <fieldset disabled={saving} className="space-y-4">
                        {parts.map((part, index) => (
                          <div
                            key={index}
                            className="border border-base-300 rounded-xl p-4 space-y-3"
                          >
                            <FormField
                              label={`Part ${index + 1} name`}
                              required
                              minLength={2}
                              maxLength={120}
                              value={part.name}
                              onChange={(e) =>
                                setPart(index, "name", e.target.value)
                              }
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                label="Quantity"
                                type="number"
                                required
                                min={1}
                                max={100}
                                step={1}
                                value={part.quantity}
                                onChange={(e) =>
                                  setPart(index, "quantity", e.target.value)
                                }
                              />
                              <FormField
                                label="Unit price (USD)"
                                type="number"
                                required
                                min={0}
                                max={1000000}
                                step="0.01"
                                value={part.unitPrice}
                                onChange={(e) =>
                                  setPart(index, "unitPrice", e.target.value)
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                setParts(parts.filter((_, i) => i !== index))
                              }
                            >
                              Remove part {index + 1}
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={parts.length >= 20}
                          onClick={() =>
                            setParts([
                              ...parts,
                              { name: "", quantity: 1, unitPrice: "" },
                            ])
                          }
                        >
                          Add part
                        </Button>
                        <FormField
                          label="Labor (USD)"
                          type="number"
                          required
                          min={0}
                          max={1000000}
                          step="0.01"
                          value={labor}
                          onChange={(e) => setLabor(e.target.value)}
                        />
                        <FormField
                          label="Estimated completion after approval"
                          required
                          minLength={3}
                          maxLength={160}
                          placeholder="2–3 business days after approval"
                          value={estimate}
                          onChange={(e) => setEstimate(e.target.value)}
                        />
                        <FormField
                          label="Quotation expiry (optional, Bangladesh date)"
                          type="date"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                        />
                        <p className="font-semibold">
                          Quotation total: {priceLabel(total)}
                        </p>
                        <Button type="submit" loading={saving}>
                          Send quotation for approval
                        </Button>
                      </fieldset>
                    </form>
                  </Panel>
                )}
                {!provider && a.cancel && (
                  <Panel title="Cancel booking">
                    <p className="text-sm ga-muted">
                      Cancellation is available before quotation approval. Your
                      reason is shared with the provider.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        send(`${base}/cancel`, { note });
                      }}
                    >
                      <fieldset disabled={saving} className="space-y-4">
                        <FormField
                          label="Cancellation reason"
                          as="textarea"
                          required
                          minLength={3}
                          maxLength={1000}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          loading={saving}
                        >
                          Confirm cancellation
                        </Button>
                      </fieldset>
                    </form>
                  </Panel>
                )}
              </div>
              <div className="space-y-6">
                <BookingConversation bookingId={id} />
                <Panel title="Repair timeline">
                  {!booking.repair.events.length ? (
                    <p className="ga-muted">
                      Detailed tracking has not started for this older booking.
                    </p>
                  ) : (
                    <ol className="space-y-5">
                      {booking.repair.events
                        .slice()
                        .reverse()
                        .map((event) => (
                          <li
                            key={event.id}
                            className="border-l-2 border-primary pl-4 space-y-1"
                          >
                            <p className="font-semibold">
                              {event.type.replaceAll("_", " ")}
                            </p>
                            <p className="text-sm ga-muted">
                              {stamp(event.createdAt)} · {event.actor.role}
                            </p>
                            <p className="text-sm">
                              {repairStatuses[event.previousStatus] ||
                                "New request"}{" "}
                              → {repairStatuses[event.status] || event.status}
                            </p>
                            {event.note && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {event.note}
                              </p>
                            )}
                          </li>
                        ))}
                    </ol>
                  )}
                </Panel>
                <Panel title="Diagnosis history">
                  {!booking.repair.diagnoses.length ? (
                    <p className="ga-muted">No diagnosis recorded yet.</p>
                  ) : (
                    booking.repair.diagnoses
                      .slice()
                      .reverse()
                      .map((item) => (
                        <details
                          key={item.id}
                          className="border-t border-base-300 pt-4"
                          open={item === booking.repair.diagnoses.at(-1)}
                        >
                          <summary className="cursor-pointer font-semibold">
                            Diagnosis {item.number} · {stamp(item.createdAt)}
                          </summary>
                          <dl className="mt-4 space-y-3">
                            {[
                              ["Summary", item.summary],
                              ["Issue", item.issue],
                              ["Recommended repair", item.recommendedRepair],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt className="ga-muted text-sm">{label}</dt>
                                <dd className="whitespace-pre-wrap break-words">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ))
                  )}
                </Panel>
                {booking.repair.quotations.length > 1 && (
                  <Panel title="Earlier quotation versions">
                    {booking.repair.quotations
                      .filter((item) => item.id !== quote?.id)
                      .slice()
                      .reverse()
                      .map((item) => (
                        <details key={item.id}>
                          <summary className="cursor-pointer font-semibold">
                            Quotation {item.number} · {item.status} ·{" "}
                            {priceLabel(item.total)}
                          </summary>
                          <div className="mt-4">
                            <Quote quote={item} />
                          </div>
                        </details>
                      ))}
                  </Panel>
                )}
              </div>
            </div>
          </div>
        )}
      </CollectionState>
    </DashboardLayout>
  );
};
const Quote = ({ quote }) => (
  <div className="space-y-4">
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <caption className="sr-only">
          Quotation {quote.number} costs in USD
        </caption>
        <thead>
          <tr>
            <th>Part</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {quote.parts.map((part, index) => (
            <tr key={index}>
              <td className="whitespace-normal break-words">{part.name}</td>
              <td>{part.quantity}</td>
              <td>{priceLabel(part.unitPrice)}</td>
              <td>{priceLabel(part.lineTotal)}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={3}>Labor</th>
            <td>{priceLabel(quote.labor)}</td>
          </tr>
          <tr className="font-bold">
            <th colSpan={3}>Total (USD)</th>
            <td>{priceLabel(quote.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p className="break-words">
      Estimated completion: {quote.estimatedCompletion}
    </p>
    <p className="text-sm ga-muted">
      Sent {stamp(quote.sentAt)} ·{" "}
      {quote.expiresOn
        ? `Expires ${dateLabel(quote.expiresOn)} at the end of the Bangladesh day.`
        : "No expiry set."}
    </p>
    {quote.decisionAt && (
      <p className="text-sm">
        Customer {quote.status} on {stamp(quote.decisionAt)}
        {quote.decisionNote ? `: ${quote.decisionNote}` : ""}
      </p>
    )}
  </div>
);
export default RepairDetails;
