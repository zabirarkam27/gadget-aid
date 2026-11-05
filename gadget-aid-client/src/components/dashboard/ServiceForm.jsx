import { useState } from "react";
import FormField from "../ui/FormField";
import Button from "../Button";
import { serviceErrors, serviceInput } from "../../utils/serviceValidation";
const ServiceForm = ({ initial = {}, onSubmit, submitting, error, submitLabel = "Save service", onCancel }) => {
  const [errors,setErrors] = useState({});
  const submit = event => {
    event.preventDefault();
    const values = serviceInput(event.currentTarget);
    const next = serviceErrors(values); setErrors(next);
    if (!Object.keys(next).length) onSubmit({...values,price:Number(values.price)});
  };
  return <form onSubmit={submit} className="space-y-5">
    <FormField label="Service name" name="name" required minLength={2} maxLength={120} defaultValue={initial.name || ""} error={errors.name} disabled={submitting} placeholder="e.g. Laptop motherboard repair" />
    <div className="grid sm:grid-cols-2 gap-5"><FormField label="Listed price ($)" name="price" type="number" required min="0" max="1000000" step="0.01" defaultValue={initial.price ?? ""} error={errors.price} disabled={submitting} /><FormField label="Service area" name="area" required minLength={2} maxLength={160} defaultValue={initial.area || ""} error={errors.area} disabled={submitting} placeholder="Neighbourhood, city" /></div>
    <FormField label="Service image URL" name="image" type="url" required maxLength={2048} defaultValue={initial.image || ""} error={errors.image} disabled={submitting} helper="Use an image you have permission to publish. Images are linked, not uploaded." />
    <FormField label="Service description" name="description" as="textarea" rows={6} required minLength={10} maxLength={5000} defaultValue={initial.description || ""} error={errors.description} disabled={submitting} helper="Explain the repair, coverage and any conditions clearly. Only promise terms you can fulfil." />
    {error && <p role="alert" className="text-error text-sm">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" loading={submitting}>{submitting ? "Saving…" : submitLabel}</Button>{onCancel && <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>}</div>
  </form>;
};
export default ServiceForm;
