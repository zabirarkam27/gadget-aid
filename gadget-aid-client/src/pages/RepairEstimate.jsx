import { useEffect, useRef, useState } from "react";
import ToolLayout from "../components/ToolLayout";
import FormField from "../components/ui/FormField";
import ServiceCard from "../components/ServiceCard";
import Button from "../components/Button";
import { API_URL } from "../utils/api";
import { readJson } from "../utils/readJson";
export default function RepairEstimate() {
  const [categories, setCategories] = useState([]),
    [categoryError, setCategoryError] = useState(false),
    [categoryAttempt, setCategoryAttempt] = useState(0),
    [form, setForm] = useState({ category: "", model: "", symptom: "" }),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef(null),
    lock = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    fetch(`${API_URL}/categories`, { signal: c.signal })
      .then(readJson)
      .then((rows) => {
        if (!Array.isArray(rows)) throw Error();
        if (!c.signal.aborted) {
          setCategories(rows);
          setCategoryError(false);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setCategoryError(true);
      });
    return () => {
      c.abort();
    };
  }, [categoryAttempt]);
  useEffect(() => () => request.current?.abort(), []);
  const change = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setResult(null);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    const c = new AbortController();
    request.current = c;
    try {
      const value = await fetch(`${API_URL}/tools/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: c.signal,
      }).then(readJson);
      if (!Array.isArray(value.items) || !Number.isInteger(value.sampleSize))
        throw Error("Invalid estimate response");
      if (!c.signal.aborted) setResult(value);
    } catch (f) {
      if (!c.signal.aborted)
        setError(f.message || "The estimate is unavailable. Try again.");
    } finally {
      lock.current = false;
      if (!c.signal.aborted) setBusy(false);
    }
  };
  return (
    <ToolLayout
      title="Listed-price estimate"
      description="Explore current provider-listed prices related to a repair keyword. These are non-binding starting points, not an estimate of your final repair bill."
    >
      <form onSubmit={submit} className="ga-surface p-5 sm:p-8 space-y-5">
        <fieldset disabled={busy} className="grid sm:grid-cols-3 gap-5 min-w-0">
          <FormField
            label="Service category"
            as="select"
            value={form.category}
            onChange={(e) => change("category", e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Device/model (optional)"
            maxLength={80}
            value={form.model}
            onChange={(e) => change("model", e.target.value)}
            helper="Context only; the catalogue has no model-specific price table."
          />
          <FormField
            label="Repair keyword"
            required
            minLength={2}
            maxLength={80}
            value={form.symptom}
            onChange={(e) => change("symptom", e.target.value)}
            placeholder="For example, screen or diagnostic"
          />
        </fieldset>
        <p className="ga-muted text-sm">
          Do not enter serial numbers, passwords or personal information. This
          uses GadgetAid catalogue records, not external AI.
        </p>
        <Button type="submit" loading={busy}>
          Find listed-price range
        </Button>
        {categoryError && (
          <p role="alert">
            Category choices could not be loaded.{" "}
            <Button
              variant="ghost"
              onClick={() => setCategoryAttempt((n) => n + 1)}
            >
              Retry categories
            </Button>
          </p>
        )}
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
      </form>
      {result && (
        <section className="mt-7 space-y-5" aria-live="polite">
          <h2 className="text-xl font-semibold">
            {result.sampleSize
              ? `$${result.min.toFixed(2)}–$${result.max.toFixed(2)} in matching listings`
              : "No matching priced listings"}
          </h2>
          <p className="ga-muted">
            {result.sampleSize} priced records in this bounded sample
            {result.hasMore ? "; more matching records exist" : ""}. The $
            symbol follows the existing catalogue display; confirm currency with
            the provider.
          </p>
          <p>{result.basis}</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {result.items.map((s) => (
              <ServiceCard key={s._id} service={s} />
            ))}
          </div>
          <Button to="/services" variant="outline">
            Browse all services
          </Button>
        </section>
      )}
    </ToolLayout>
  );
}
