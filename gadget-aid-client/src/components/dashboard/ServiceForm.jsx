import { API_URL } from "../../utils/api";
import { readJson } from "../../utils/readJson";
import { useEffect, useState } from "react";
import FormField from "../ui/FormField";
import Button from "../Button";
import { serviceErrors, serviceInput } from "../../utils/serviceValidation";
import ModelPrices from "./ModelPrices";
const ServiceForm = ({
  initial = {},
  onSubmit,
  submitting,
  error,
  submitLabel = "Save service",
  onCancel,
}) => {
  const [modelPrices, setModelPrices] = useState(() => (Array.isArray(initial.modelPrices) ? initial.modelPrices : []).map((row, key) => ({ key, model: row.model, repair: row.repair, price: row.price })));
  const [categories, setCategories] = useState([]),
    [categoryError, setCategoryError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/categories`, { signal: controller.signal })
      .then(readJson)
      .then((value) => {
        if (!Array.isArray(value)) throw new Error();
        if (!controller.signal.aborted) setCategories(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCategoryError(
            "Category options could not be loaded. Your existing choice is preserved.",
          );
      });
    return () => controller.abort();
  }, []);
  const [errors, setErrors] = useState({});
  const submit = (event) => {
    event.preventDefault();
    const values = {
      ...serviceInput(event.currentTarget),
      modelPrices: modelPrices.map(({ model, repair, price }) => ({ model, repair, price })),
      categoryId: String(
        new FormData(event.currentTarget).get("categoryId") || "",
      ),
    };
    const next = serviceErrors(values);
    setErrors(next);
    if (!Object.keys(next).length)
      onSubmit({ ...values, price: Number(values.price) });
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <FormField
        label="Service name"
        name="name"
        required
        minLength={2}
        maxLength={120}
        defaultValue={initial.name || ""}
        error={errors.name}
        disabled={submitting}
        placeholder="e.g. Laptop motherboard repair"
      />
      <div className="grid sm:grid-cols-2 gap-5">
        <FormField
          label="Listed price ($)"
          name="price"
          type="number"
          required
          min="0"
          max="1000000"
          step="0.01"
          defaultValue={initial.price ?? ""}
          error={errors.price}
          disabled={submitting}
        />
        <FormField
          label="Service area"
          name="area"
          required
          minLength={2}
          maxLength={160}
          defaultValue={initial.area || ""}
          error={errors.area}
          disabled={submitting}
          placeholder="Neighbourhood, city"
        />
      </div>
      <FormField
        label="Service category"
        name="categoryId"
        as="select"
        defaultValue={initial.categoryId || ""}
        disabled={submitting}
        helper={
          categoryError ||
          "Choose an active platform category, or leave this service uncategorized."
        }
      >
        <option value="">Uncategorized</option>
        {initial.categoryId &&
          !categories.some((c) => c._id === initial.categoryId) && (
            <option value={initial.categoryId}>
              {initial.categoryLabel || "Current category"} (existing)
            </option>
          )}
        {categories.map((category) => (
          <option key={category._id} value={category._id}>
            {category.name}
          </option>
        ))}
      </FormField>
      <FormField
        label="Service image URL"
        name="image"
        type="url"
        required
        maxLength={2048}
        defaultValue={initial.image || ""}
        error={errors.image}
        disabled={submitting}
        helper="Use an image you have permission to publish. Images are linked, not uploaded."
      />
      <FormField
        label="Service description"
        name="description"
        as="textarea"
        rows={6}
        required
        minLength={10}
        maxLength={5000}
        defaultValue={initial.description || ""}
        error={errors.description}
        disabled={submitting}
        helper="Explain the repair, coverage and any conditions clearly. Only promise terms you can fulfil."
      />
      <ModelPrices rows={modelPrices} setRows={setModelPrices} disabled={submitting} error={errors.modelPrices} />
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};
export default ServiceForm;
