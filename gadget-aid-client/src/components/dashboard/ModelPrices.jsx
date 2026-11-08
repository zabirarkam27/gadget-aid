import { useRef } from "react";
import Button from "../Button";
import FormField from "../ui/FormField";
export default function ModelPrices({ rows, setRows, disabled, error }) {
  const nextKey = useRef(rows.length);
  const change = (key, field, value) =>
    setRows((previous) =>
      previous.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
  return (
    <fieldset
      disabled={disabled}
      className="border border-base-300 rounded-xl p-5 space-y-5 min-w-0"
    >
      <legend className="px-2 font-semibold">
        Published model prices (optional)
      </legend>
      <p className="ga-muted text-sm">
        Publish a USD price for a specific model and repair. These rates appear
        in the estimator; your general listed price and final quotation remain
        separate. Pro, Plus and other variants need their own entries. Up to 20
        rates.
      </p>
      {rows.map((row, index) => (
        <div key={row.key} className="border-b border-base-300 pb-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-4 min-w-0">
            <FormField
              label={`Model ${index + 1}`}
              required
              minLength={2}
              maxLength={80}
              value={row.model}
              onChange={(e) => change(row.key, "model", e.target.value)}
              placeholder="iPhone 13"
            />
            <FormField
              label={`Repair ${index + 1}`}
              required
              minLength={2}
              maxLength={80}
              value={row.repair}
              onChange={(e) => change(row.key, "repair", e.target.value)}
              placeholder="Screen replacement"
            />
            <FormField
              label={`Price in USD ${index + 1}`}
              type="number"
              required
              min="0"
              max="1000000"
              step="0.01"
              value={row.price}
              onChange={(e) => change(row.key, "price", e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setRows((previous) =>
                previous.filter((item) => item.key !== row.key),
              )
            }
          >
            Remove model price {index + 1}
          </Button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={rows.length >= 20 || disabled}
        onClick={() => {
          const key = nextKey.current++;
          setRows((previous) => [
            ...previous,
            { key, model: "", repair: "", price: "" },
          ]);
        }}
      >
        Add model price
      </Button>
    </fieldset>
  );
}
