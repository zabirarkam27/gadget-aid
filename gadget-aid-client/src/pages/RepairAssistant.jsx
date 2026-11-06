import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../provider/AuthContext";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import FormField from "../components/ui/FormField";
import ServiceCard from "../components/ServiceCard";
import Button from "../components/Button";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";

export default function RepairAssistant() {
  const { user } = useContext(AuthContext);
  // A changed identity unmounts all draft text and responses.
  return <AssistantForm key={user?.uid || "guest"} />;
}
function AssistantForm() {
  const [config, setConfig] = useState(null), [configError, setConfigError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState({ category: "Laptop", brand: "", model: "", symptoms: "", onset: "", danger: false });
  const [useAi, setUseAi] = useState(false), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [result, setResult] = useState(null);
  const request = useRef(null), lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    authFetch(`${API_URL}/repair-assistant/config`, { signal: controller.signal }).then(readJson).then(value => {
      if (typeof value.aiAvailable !== "boolean" || typeof value.policyVersion !== "string" || !Array.isArray(value.categories) || value.categories.some(item => typeof item !== "string")) throw Error("Invalid settings");
      if (!controller.signal.aborted) { setConfig(value); setConfigError(""); }
    }).catch(() => { if (!controller.signal.aborted) setConfigError("Assistant settings could not be loaded."); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [attempt]);
  const update = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setResult(null); setConsent(false); if (key === "danger" && value) setUseAi(false); };
  const submit = async event => {
    event.preventDefault();
    if (lock.current || (useAi && !consent)) return;
    lock.current = true; setBusy(true); setError(""); setResult(null);
    const controller = new AbortController(); request.current = controller;
    try {
      const value = await authFetch(`${API_URL}/repair-assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ ...form, useAi, ...(useAi && consent ? { consentVersion: config.policyVersion } : {}) }) }).then(readJson);
      if (!["ai", "guided", "safety"].includes(value.mode) || !["issueCategories", "questions", "steps"].every(key => Array.isArray(value[key]) && value[key].every(item => typeof item === "string")) || !Array.isArray(value.services) || value.services.some(item => !item?._id)) throw Error("The assistant returned an invalid response. Try again or browse services.");
      if (!controller.signal.aborted) setResult(value);
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message || "Suggestions could not be loaded. Your description is still here; retry or browse services."); }
    finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  };
  return <DashboardLayout title="Repair assistant" description="Describe a problem, explore possible issue categories and find relevant services. You can always book without this assistant." action={<Button to="/services" variant="outline">Browse services directly ↗</Button>}>
    <div className="ga-surface border border-warning p-5 mb-6" role="note"><h2 className="font-semibold">Safety comes first</h2><p className="mt-2 text-sm">For a swollen battery, smoke, burning smell, sparks, overheating or liquid damage: stop using and charging. Do not open the device or touch its battery. Seek qualified help; if there is smoke or fire, move away and contact local emergency services rather than waiting for a booking.</p></div>
    {configError ? <div role="alert" className="mb-5">{configError} <Button onClick={() => setAttempt(n => n + 1)}>Retry settings</Button></div> : !config ? <p role="status">Loading assistant settings…</p> : <form onSubmit={submit} className="ga-surface p-5 sm:p-8 space-y-5">
      <fieldset disabled={busy} className="space-y-5 min-w-0">
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Device category" as="select" value={form.category} onChange={e => update("category", e.target.value)}>{config.categories.map(value => <option key={value}>{value}</option>)}</FormField>
          <FormField label="Brand (optional)" maxLength={80} value={form.brand} onChange={e => update("brand", e.target.value)} />
          <FormField label="Model (optional)" maxLength={80} value={form.model} onChange={e => update("model", e.target.value)} />
          <FormField label="When did it start? (optional)" maxLength={80} value={form.onset} onChange={e => update("onset", e.target.value)} placeholder="For example, yesterday after an update" />
        </div>
        <FormField label="What is happening?" as="textarea" rows={4} minLength={10} maxLength={1000} required value={form.symptoms} onChange={e => update("symptoms", e.target.value)} helper="10–1,000 characters. Do not enter passwords, serial numbers, email addresses or personal records." />
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="checkbox checkbox-sm shrink-0" checked={form.danger} onChange={e => update("danger", e.target.checked)} /><span>The device is hot, swollen, wet, smoking, sparking or smells unusual.</span></label>
        <p className="ga-muted text-sm">Guided mode processes your description on GadgetAid's server and does not send it to an AI provider. No assistant history, uploaded images, passport, receipts or account details are attached.</p>
        {config.aiAvailable ? <>
          <label className="flex gap-3 text-sm"><input type="checkbox" className="checkbox checkbox-sm shrink-0" checked={useAi} onChange={e => { setUseAi(e.target.checked); setConsent(false); setResult(null); }} /><span>Use AI-assisted issue classification</span></label>
          {useAi && <div className="rounded-xl border border-base-300 p-4 text-sm space-y-3"><p>Your entered category, brand, model, symptoms and onset will be sent through Vercel AI Gateway to its configured model provider. They may process or retain requests under their policies; zero retention is not guaranteed. GadgetAid does not save the description or response as assistant history. Hazard-flagged requests skip AI.</p><label className="flex gap-3"><input type="checkbox" className="checkbox checkbox-sm shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I agree to send this description for preliminary AI suggestions.</span></label></div>}
        </> : <p className="ga-muted text-sm">AI is not configured. Guided suggestions and service discovery are available.</p>}
        <Button type="submit" loading={busy} disabled={useAi && !consent}>{useAi ? "Get preliminary AI suggestions" : "Get guided suggestions"}</Button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="text-error mt-5">{error}</p>}
    {result && <section className="mt-8 space-y-6" aria-label="Assistant suggestions" aria-live="polite">
      <div className="ga-surface p-5 sm:p-8"><h2 className="text-xl font-semibold">{result.urgent ? "Stop use and seek qualified help" : result.mode === "ai" ? "AI-assisted preliminary suggestions" : "Rules-based preliminary suggestions"}</h2><p className="ga-muted mt-3">{result.disclaimer}</p>{["failed", "unavailable"].includes(result.aiState) && <p className="mt-3 text-warning">AI was unavailable. These are guided suggestions instead.</p>}
        <h3 className="font-semibold mt-5">Possible issue categories</h3><ul className="list-disc pl-5 mt-2">{result.issueCategories.map(value => <li key={value}>{value}</li>)}</ul>
        <h3 className="font-semibold mt-5">{result.urgent ? "Safety guidance" : "Safe first steps"}</h3><ul className="list-disc pl-5 mt-2 space-y-2">{result.steps.map(value => <li key={value}>{value}</li>)}</ul>
        {!!result.questions.length && <><h3 className="font-semibold mt-5">Helpful details to clarify</h3><ul className="list-disc pl-5 mt-2 space-y-2">{result.questions.map(value => <li key={value}>{value}</li>)}</ul><p className="ga-muted text-sm mt-3">You can add answers to your description and request suggestions again, or discuss them with your technician.</p></>}
      </div>
      <h2 className="text-xl font-semibold">Related service listings</h2><p className="ga-muted">These are real listings related to the issue. Confirm device compatibility, scope, price and availability with the provider.</p>
      {result.servicesUnavailable ? <p role="alert">Service suggestions are temporarily unavailable. Browse the catalogue or try again later.</p> : !result.services.length ? <p>No matching listings found. You can still browse all services.</p> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{result.services.map(service => <ServiceCard key={service._id} service={service} />)}</div>}
      <Button to="/services" variant="outline">Continue to the catalogue ↗</Button>
    </section>}
  </DashboardLayout>;
}
