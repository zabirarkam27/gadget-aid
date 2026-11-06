import { useState } from "react";
import ToolLayout from "../components/ToolLayout";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
import { compareRepairCosts } from "../utils/repairComparison";
export default function RepairCalculator() {
  const [form, setForm] = useState({
      repairCost: "",
      replacementCost: "",
      repairMonths: "",
      replacementMonths: "",
    }),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setResult(null);
    setError("");
  };
  return (
    <ToolLayout
      title="Repair vs replace"
      description="Compare your own cost and expected-use assumptions. This calculator does not predict device life, safety, resale value or guaranteed savings."
    >
      <form
        className="ga-surface p-5 sm:p-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setResult(compareRepairCosts(form));
            setError("");
          } catch (failure) {
            setError(failure.message);
          }
        }}
      >
        <p className="ga-muted text-sm">
          Use the same currency for every cost. Include parts, labor, tax and
          other costs yourself. Expected months are your assumptions, not
          GadgetAid forecasts.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          {[
            ["repairCost", "Total estimated repair cost"],
            ["replacementCost", "Total replacement cost"],
            ["repairMonths", "Expected use after repair (months)"],
            ["replacementMonths", "Expected use of replacement (months)"],
          ].map(([key, label]) => (
            <FormField
              key={key}
              label={label}
              type="number"
              min={key.endsWith("Months") ? 1 : 0}
              max={key.endsWith("Months") ? 120 : 1000000}
              step={key.endsWith("Months") ? 1 : 0.01}
              required
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
            />
          ))}
        </div>
        <Button type="submit">Compare my assumptions</Button>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
      </form>
      {result && (
        <div className="ga-surface p-5 sm:p-8 mt-6" aria-live="polite">
          <h2 className="text-xl font-semibold">Under these assumptions</h2>
          <dl className="grid sm:grid-cols-3 gap-5 my-5">
            {[
              ["Replacement cost minus repair cost", result.upfrontDifference],
              ["Repair cost per expected month", result.repairPerMonth],
              [
                "Replacement cost per expected month",
                result.replacementPerMonth,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="ga-muted text-sm">{label}</dt>
                <dd className="ga-numeric text-2xl mt-2">{value.toFixed(2)}</dd>
              </div>
            ))}
          </dl>
          <p>
            A positive upfront difference means the repair costs less today.
            Monthly amounts divide cost by the months you entered. Neither
            comparison is a recommendation or a guarantee. Safety, reliability,
            data recovery, warranty and environmental impact need separate
            consideration.
          </p>
        </div>
      )}
    </ToolLayout>
  );
}
