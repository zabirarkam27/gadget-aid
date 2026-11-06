import { useEffect, useRef, useState } from "react";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import CollectionState from "../components/dashboard/CollectionState";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const lines = (value) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
const hours = Array.from(
  { length: 25 },
  (_, i) => `${String(i).padStart(2, "0")}:00`,
);
const Window = ({ row, update, label }) => (
  <div className="border border-base-300 rounded-xl p-4 space-y-3">
    <label className="flex gap-3 items-center">
      <input
        type="checkbox"
        className="checkbox"
        checked={!row.closed}
        onChange={(e) => update({ ...row, closed: !e.target.checked })}
      />
      {label} open
    </label>
    {!row.closed && (
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={`${label} opens`}
          as="select"
          value={row.start}
          onChange={(e) => update({ ...row, start: e.target.value })}
        >
          {hours.slice(0, 24).map((h) => (
            <option key={h}>{h}</option>
          ))}
        </FormField>
        <FormField
          label={`${label} closes`}
          as="select"
          value={row.end}
          onChange={(e) => update({ ...row, end: e.target.value })}
        >
          {hours.slice(1).map((h) => (
            <option key={h}>{h}</option>
          ))}
        </FormField>
      </div>
    )}
  </div>
);
const TechnicianSettings = () => {
  const [form, setForm] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [failure, setFailure] = useState(""),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [attempt, setAttempt] = useState(0);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    authFetch(`${API_URL}/my-technician`, { signal: controller.signal })
      .then(readJson)
      .then((value) => {
        if (!controller.signal.aborted) {
          setForm({
            ...value,
            skills: value.skills.join("\n"),
            categories: value.categories.join("\n"),
            certifications: value.certifications.join("\n"),
            photo: value.photo || "",
            yearsExperience: value.yearsExperience ?? "",
          });
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const field = (key, value) => {
    setSaved(false);
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  const availability = (value) => field("availability", value);
  const save = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFailure("");
    setSaved(false);
    try {
      const a = form.availability;
      const value = await authFetch(`${API_URL}/my-technician`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          photo: form.photo,
          bio: form.bio,
          skills: lines(form.skills),
          categories: lines(form.categories),
          area: form.area,
          yearsExperience:
            form.yearsExperience === "" ? null : Number(form.yearsExperience),
          certifications: lines(form.certifications),
          availability: {
            configured: a.configured,
            mode: a.mode,
            weekly: a.weekly,
            exceptions: a.exceptions,
          },
          expectedRevision: form.revision,
        }),
      }).then(readJson);
      if (alive.current) {
        setForm({
          ...value,
          skills: value.skills.join("\n"),
          categories: value.categories.join("\n"),
          certifications: value.certifications.join("\n"),
          photo: value.photo || "",
          yearsExperience: value.yearsExperience ?? "",
        });
        setSaved(true);
      }
    } catch (error) {
      if (alive.current) setFailure(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <DashboardLayout
      title="Technician profile"
      eyebrow="Provider workspace"
      description="Introduce your repair work and choose when customers can request or reserve appointments."
      action={
        <Button
          variant="outline"
          onClick={() => setAttempt((v) => v + 1)}
          disabled={saving || loading}
        >
          Reload saved profile
        </Button>
      }
    >
      <CollectionState
        loading={loading}
        error={error}
        retry={() => setAttempt((v) => v + 1)}
      >
        {form && (
          <form onSubmit={save}>
            <fieldset disabled={saving} className="space-y-6">
              <div className="ga-surface p-5 sm:p-7 space-y-5">
                <div className="flex flex-wrap gap-4 justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    About your repair business
                  </h2>
                  <Button to={`/technicians/${form._id}`} variant="ghost">
                    View public profile
                  </Button>
                </div>
                <p className="ga-muted text-sm">
                  Experience, skills and certifications are self-reported. They
                  do not create platform verification.
                </p>
                <div className="grid sm:grid-cols-2 gap-5">
                  <FormField
                    label="Business or display name"
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.businessName}
                    onChange={(e) => field("businessName", e.target.value)}
                  />
                  <FormField
                    label="Service area"
                    maxLength={160}
                    value={form.area}
                    onChange={(e) => field("area", e.target.value)}
                  />
                  <FormField
                    label="Photo or logo URL"
                    type="url"
                    value={form.photo}
                    onChange={(e) => field("photo", e.target.value)}
                  />
                  <FormField
                    label="Years of experience (self-reported)"
                    type="number"
                    min={0}
                    max={80}
                    step={1}
                    value={form.yearsExperience}
                    onChange={(e) => field("yearsExperience", e.target.value)}
                  />
                </div>
                <FormField
                  label="Short bio"
                  as="textarea"
                  maxLength={2000}
                  value={form.bio}
                  onChange={(e) => field("bio", e.target.value)}
                />
                <div className="grid sm:grid-cols-3 gap-5">
                  <FormField
                    label="Skills (one per line)"
                    as="textarea"
                    value={form.skills}
                    onChange={(e) => field("skills", e.target.value)}
                    helper="Up to 20 skills."
                  />
                  <FormField
                    label="Device categories (one per line)"
                    as="textarea"
                    value={form.categories}
                    onChange={(e) => field("categories", e.target.value)}
                    helper="Up to 12 categories."
                  />
                  <FormField
                    label="Certifications (self-reported, one per line)"
                    as="textarea"
                    value={form.certifications}
                    onChange={(e) => field("certifications", e.target.value)}
                    helper="Up to 10 claims. No platform verification is implied."
                  />
                </div>
              </div>
              <div className="ga-surface p-5 sm:p-7 space-y-5">
                <h2 className="text-xl font-semibold">
                  Availability · Bangladesh time
                </h2>
                <label className="flex gap-3 items-center">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.availability.configured}
                    onChange={(e) =>
                      availability({
                        ...form.availability,
                        configured: e.target.checked,
                      })
                    }
                  />
                  Use my weekly schedule
                </label>
                <p className="text-sm ga-muted">
                  Without a schedule, dates are requests for confirmation.
                  Scheduled dates are offered up to 90 days ahead. Existing
                  appointments cannot be closed by editing hours.
                </p>
                {form.availability.configured && (
                  <>
                    <FormField
                      label="Booking arrangement"
                      as="select"
                      value={form.availability.mode}
                      onChange={(e) =>
                        availability({
                          ...form.availability,
                          mode: e.target.value,
                        })
                      }
                    >
                      <option value="requests">
                        Date requests during open days
                      </option>
                      <option value="appointments">
                        Reserve one-hour appointments
                      </option>
                    </FormField>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {form.availability.weekly.map((row, index) => (
                        <Window
                          key={row.day}
                          row={row}
                          label={days[row.day]}
                          update={(value) =>
                            availability({
                              ...form.availability,
                              weekly: form.availability.weekly.map((old, i) =>
                                i === index ? value : old,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                    <h3 className="font-semibold">
                      Date exceptions and holidays
                    </h3>
                    <p className="ga-muted text-sm">
                      An exception replaces the weekly hours for that date.
                      Leave it closed for a holiday.
                    </p>
                    {form.availability.exceptions.map((row, index) => (
                      <div
                        key={index}
                        className="border border-base-300 rounded-xl p-4 space-y-4"
                      >
                        <FormField
                          label={`Exception ${index + 1} date`}
                          type="date"
                          required
                          value={row.date}
                          onChange={(e) =>
                            availability({
                              ...form.availability,
                              exceptions: form.availability.exceptions.map(
                                (old, i) =>
                                  i === index
                                    ? { ...old, date: e.target.value }
                                    : old,
                              ),
                            })
                          }
                        />
                        <Window
                          row={row}
                          label={`Exception ${index + 1}`}
                          update={(value) =>
                            availability({
                              ...form.availability,
                              exceptions: form.availability.exceptions.map(
                                (old, i) => (i === index ? value : old),
                              ),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            availability({
                              ...form.availability,
                              exceptions: form.availability.exceptions.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          Remove exception {index + 1}
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={form.availability.exceptions.length >= 60}
                      onClick={() =>
                        availability({
                          ...form.availability,
                          exceptions: [
                            ...form.availability.exceptions,
                            {
                              date: "",
                              closed: true,
                              start: "09:00",
                              end: "17:00",
                            },
                          ],
                        })
                      }
                    >
                      Add date exception
                    </Button>
                  </>
                )}
              </div>
              {failure && (
                <p role="alert" className="text-error">
                  {failure} Use Reload saved profile if the calendar changed.
                </p>
              )}
              {saved && (
                <p role="status" className="text-success">
                  Profile and availability saved.
                </p>
              )}
              <Button type="submit" loading={saving}>
                Save profile and availability
              </Button>
            </fieldset>
          </form>
        )}
      </CollectionState>
    </DashboardLayout>
  );
};
export default TechnicianSettings;
