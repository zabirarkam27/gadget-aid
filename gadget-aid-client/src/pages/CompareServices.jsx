import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ToolLayout from "../components/ToolLayout";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
import { API_URL } from "../utils/api";
import { readJson } from "../utils/readJson";
import useServices from "../hooks/useServices";
export default function CompareServices() {
  const [params, setParams] = useSearchParams(),
    [query, setQuery] = useState(""),
    [comparison, setComparison] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const ids = params.get("ids") || "",
    selected = ids ? ids.split(",") : [];
  const catalogue = useServices(
    new URLSearchParams({ limit: "6", q: query }).toString(),
  );
  const toggle = (id) =>
    setParams({
      ids: (selected.includes(id)
        ? selected.filter((value) => value !== id)
        : selected.length < 3
          ? [...selected, id]
          : selected
      ).join(","),
    });
  useEffect(() => {
    const c = new AbortController();
    setComparison(null);
    setError("");
    if (ids)
      fetch(`${API_URL}/tools/compare?ids=${encodeURIComponent(ids)}`, {
        signal: c.signal,
      })
        .then(readJson)
        .then((value) => {
          if (
            !Array.isArray(value.items) ||
            !Array.isArray(value.unavailableIds)
          )
            throw Error();
          if (!c.signal.aborted) setComparison(value);
        })
        .catch(() => {
          if (!c.signal.aborted)
            setError(
              "Comparison could not be loaded. Choose up to three valid services or retry.",
            );
        });
    return () => c.abort();
  }, [ids, attempt]);
  return (
    <ToolLayout
      title="Compare services"
      description="Compare up to three real listings using the same fields. Providers must confirm device compatibility, repair scope, final price and warranty."
    >
      <div className="ga-surface p-5 space-y-4">
        <FormField
          label="Find a service to compare"
          type="search"
          maxLength={80}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="ga-muted text-sm">
          {selected.length}/3 selected. Search the full catalogue; this chooser
          displays up to six matches.
        </p>
        {catalogue.loading ? (
          <p role="status">Loading service choices…</p>
        ) : catalogue.error ? (
          <p role="alert">
            {catalogue.error}{" "}
            <Button onClick={catalogue.retry}>Retry choices</Button>
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {catalogue.data.map((s) => (
              <li
                key={s._id}
                className="flex flex-wrap items-center justify-between gap-3 border border-base-300 rounded-xl p-3"
              >
                <span className="min-w-0 break-words">
                  {s.name} · {s.providerName}
                </span>
                <Button
                  variant={selected.includes(s._id) ? "primary" : "outline"}
                  size="sm"
                  onClick={() => toggle(s._id)}
                  disabled={!selected.includes(s._id) && selected.length >= 3}
                >
                  {selected.includes(s._id) ? "Remove" : "Compare"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!catalogue.loading && !catalogue.error && !catalogue.data.length && (
          <p>No matching service choices.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-5 text-error">
          {error}{" "}
          <Button onClick={() => setAttempt((n) => n + 1)}>
            Retry comparison
          </Button>
          <Button onClick={() => setParams({})}>Clear selection</Button>
        </p>
      )}
      {ids && !comparison && !error && (
        <p role="status" className="mt-5">
          Loading comparison…
        </p>
      )}
      {comparison && (
        <section className="mt-7 space-y-5">
          <p>{comparison.pricingNote}</p>
          {comparison.unavailableIds.length > 0 && (
            <p role="status">
              {comparison.unavailableIds.length} selected listings are
              unavailable and have been omitted.
            </p>
          )}
          <div className="grid md:grid-cols-3 gap-5">
            {comparison.items.map((s) => (
              <article key={s._id} className="ga-surface p-5 min-w-0">
                <h2 className="text-xl font-semibold break-words">{s.name}</h2>
                <dl className="mt-5 space-y-4">
                  {[
                    ["Provider", s.providerName],
                    ["Category", s.categoryLabel],
                    ["Area", s.area || "Confirm with provider"],
                    [
                      "Listed price",
                      s.price === null ? "Ask provider" : `$${s.price}`,
                    ],
                    ["Description", s.description || "Not supplied"],
                    ["Warranty", "Confirm repair-specific terms"],
                    ["Availability", "Check times on service details"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="ga-muted text-sm">{label}</dt>
                      <dd className="mt-1 break-words whitespace-pre-wrap">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2 mt-5">
                  <Button to={`/services/${s._id}`}>
                    View and request repair
                  </Button>
                  <Button onClick={() => toggle(s._id)} variant="ghost">
                    Remove
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {!ids && (
        <p className="mt-7">Select a service above to start comparing.</p>
      )}
    </ToolLayout>
  );
}
