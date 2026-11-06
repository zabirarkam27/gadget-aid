import { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AuthContext } from "../provider/AuthContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import Button from "../components/Button";
import SaveTechnician from "../components/SaveTechnician";
import Avatar from "../components/ui/Avatar";
import Dialog from "../components/ui/Dialog";
import FormField from "../components/ui/FormField";
import EmptyState from "../components/ui/EmptyState";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const TechnicianProfile = () => {
  const { id } = useParams();
  return <Profile key={id} id={id} />;
};
const Profile = ({ id }) => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [selfId, setSelfId] = useState(""),
    [report, setReport] = useState(null),
    [category, setCategory] = useState("abuse"),
    [details, setDetails] = useState(""),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState(""),
    [saving, setSaving] = useState(false),
    [responses, setResponses] = useState({});
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
    fetch(`${API_URL}/technicians/${id}`, { signal: controller.signal })
      .then(readJson)
      .then((value) => {
        if (!controller.signal.aborted) {
          setProfile(value);
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
  }, [id, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    setSelfId("");
    if (user)
      authFetch(`${API_URL}/my-technician`, { signal: controller.signal })
        .then(readJson)
        .then((value) => {
          if (!controller.signal.aborted) setSelfId(value._id);
        })
        .catch(() => {});
    return () => controller.abort();
  }, [user]);
  const mutate = async (path, body) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFailure("");
    try {
      await authFetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(readJson);
      if (alive.current) {
        setNotice(
          report
            ? "Report received. Reporting does not automatically hide a review."
            : "Provider response saved.",
        );
        setReport(null);
        setDetails("");
        setAttempt((v) => v + 1);
      }
    } catch (error) {
      if (alive.current) setFailure(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <div className="ga-container ga-section">
      <Helmet>
        <title>
          {profile?.businessName || "Technician profile"} | GadgetAid
        </title>
      </Helmet>
      <Button to="/services" variant="ghost">
        Back to services
      </Button>
      {loading && !profile ? (
        <p role="status" className="mt-6">
          Loading technician profile…
        </p>
      ) : error ? (
        <EmptyState
          title="Could not load technician"
          description={error}
          action={
            <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
          }
        />
      ) : (
        profile && (
          <div className="space-y-7 mt-6">
            <section className="ga-surface p-6 sm:p-8">
              <div className="flex flex-wrap gap-5 items-center">
                <Avatar
                  src={profile.photo}
                  name={profile.businessName}
                  className="w-20 h-20"
                />
                <div className="min-w-0">
                  <p className="ga-eyebrow mb-2">Technician profile</p>
                  <h1 className="text-page font-bold break-words">
                    {profile.businessName}
                  </h1>
                  <p className="ga-muted mt-2">
                    {profile.area || "Ask about service coverage"}
                  </p>
                </div>
              </div>
              {profile.publicationStatus === "approved" && (
                <p className="mt-5 text-sm ga-muted">
                  Profile publication reviewed by the platform. Skills,
                  experience and certifications remain self-reported.
                </p>
              )}
              <p className="mt-6 whitespace-pre-wrap break-words">
                {profile.bio || "This provider has not added a bio yet."}
              </p>
              <div className="flex flex-wrap gap-5 mt-6">
                <SaveTechnician serviceId={profile.services?.[0]?._id}/>
                <p className="font-semibold">
                  {profile.reviewCount
                    ? `${profile.averageRating} / 5 · ${profile.reviewCount} verified completed-booking review${profile.reviewCount === 1 ? "" : "s"}`
                    : "No completed-booking reviews yet"}
                </p>
                {selfId === id && (
                  <Button to="/my-technician" variant="outline">
                    Edit your profile
                  </Button>
                )}
              </div>
            </section>
            <div className="grid lg:grid-cols-2 gap-7 items-start">
              <section className="ga-surface p-6 space-y-5">
                <h2 className="text-xl font-semibold">Skills and experience</h2>
                <p className="text-sm ga-muted">
                  All skills, experience and certification claims are
                  self-reported and not platform-verified.
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <span
                      className="badge badge-outline max-w-full h-auto whitespace-normal break-all py-1"
                      key={skill}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                <p>
                  Device categories:{" "}
                  {profile.categories.length
                    ? profile.categories.join(", ")
                    : "Not specified"}
                </p>
                <p>
                  Self-reported experience:{" "}
                  {profile.yearsExperience === null
                    ? "Not specified"
                    : `${profile.yearsExperience} years`}
                </p>
                <h3 className="font-semibold">
                  Certification claims · unverified
                </h3>
                {profile.certifications.length ? (
                  <ul className="list-disc pl-5 space-y-2">
                    {profile.certifications.map((value) => (
                      <li className="break-words" key={value}>
                        {value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ga-muted">No certification claims provided.</p>
                )}
              </section>
              <section className="ga-surface p-6 space-y-4">
                <h2 className="text-xl font-semibold">
                  Availability · Bangladesh time
                </h2>
                {profile.availability.configured ? (
                  <>
                    <p className="ga-muted text-sm">
                      {profile.availability.mode === "appointments"
                        ? "One-hour appointments. Choose a service and date to see unreserved times."
                        : "Date requests on open days. The provider confirms arrangements."}{" "}
                      Book up to 90 days ahead.
                    </p>
                    <dl className="space-y-2">
                      {profile.availability.weekly.map((row) => (
                        <div
                          className="flex justify-between gap-4"
                          key={row.day}
                        >
                          <dt>{days[row.day]}</dt>
                          <dd>
                            {row.closed ? "Closed" : `${row.start}–${row.end}`}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {profile.availability.exceptions.length > 0 && (
                      <details>
                        <summary className="cursor-pointer font-semibold">
                          Date exceptions and holidays
                        </summary>
                        <ul className="space-y-2 mt-3">
                          {profile.availability.exceptions.map((row) => (
                            <li key={row.date}>
                              {row.date}:{" "}
                              {row.closed
                                ? "Closed"
                                : `${row.start}–${row.end}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="ga-muted">
                    Appointment hours have not been set. Booking dates are
                    requests requiring provider confirmation.
                  </p>
                )}
              </section>
            </div>
            <section className="ga-surface p-6 space-y-5">
              <h2 className="text-xl font-semibold">Services offered</h2>
              {profile.services.length ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {profile.services.map((service) => (
                    <div
                      key={service._id}
                      className="border border-base-300 rounded-xl p-5 space-y-3"
                    >
                      <h3 className="font-semibold break-words">
                        {service.name}
                      </h3>
                      <p className="text-sm ga-muted">{service.area}</p>
                      <Button to={`/services/${service._id}`} variant="outline">
                        View service and availability
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ga-muted">No active services listed.</p>
              )}
            </section>
            <section className="space-y-5">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <h2 className="text-section font-semibold">
                  Completed repair reviews
                </h2>
                <Button
                  variant="outline"
                  onClick={() => setAttempt((v) => v + 1)}
                  disabled={loading}
                >
                  Refresh reviews
                </Button>
              </div>
              <p className="text-sm ga-muted">
                One review per eligible booking. Provider responses are
                identified separately. Reporting sends a private moderation
                request and does not remove ratings automatically.
              </p>
              {notice && (
                <p role="status" className="text-success">
                  {notice}
                </p>
              )}
              {failure && !report && (
                <p role="alert" className="text-error">
                  {failure}
                </p>
              )}
              {profile.reviews.length ? (
                profile.reviews.map((review) => (
                  <article
                    key={review._id}
                    className="ga-surface p-6 space-y-4"
                  >
                    <div className="flex flex-wrap gap-3 justify-between">
                      <h3 className="font-semibold">
                        {review.rating} / 5 · {review.reviewerLabel}
                      </h3>
                      <p className="text-xs ga-muted">
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeZone: "Asia/Dhaka",
                        }).format(new Date(review.createdAt))}
                      </p>
                    </div>
                    <p className="text-sm ga-muted">{review.serviceName}</p>
                    <p className="whitespace-pre-wrap break-words">
                      {review.feedback}
                    </p>
                    {review.response ? (
                      <div className="border-l-2 border-primary pl-4">
                        <p className="font-semibold mb-2">Provider response</p>
                        <p className="whitespace-pre-wrap break-words">
                          {review.response.text}
                        </p>
                      </div>
                    ) : (
                      selfId === id && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            mutate(`/reviews/${review._id}/response`, {
                              text: responses[review._id] || "",
                            });
                          }}
                        >
                          <fieldset disabled={saving} className="space-y-3">
                            <FormField
                              label="Response to this review"
                              as="textarea"
                              required
                              minLength={3}
                              maxLength={2000}
                              value={responses[review._id] || ""}
                              onChange={(e) =>
                                setResponses({
                                  ...responses,
                                  [review._id]: e.target.value,
                                })
                              }
                              helper="One permanent provider response is allowed."
                            />
                            <Button type="submit" loading={saving}>
                              Post provider response
                            </Button>
                          </fieldset>
                        </form>
                      )
                    )}
                    {user ? (
                      <Button
                        variant="ghost"
                        disabled={saving}
                        onClick={() => {
                          setFailure("");
                          setReport(review);
                        }}
                      >
                        Report review
                      </Button>
                    ) : (
                      <Button to="/login" variant="ghost">
                        Log in to report a review
                      </Button>
                    )}
                  </article>
                ))
              ) : (
                <p className="ga-muted">
                  No eligible completed repairs have been reviewed yet.
                </p>
              )}
            </section>
          </div>
        )
      )}
      <Dialog
        open={!!report}
        onClose={() => {
          if (!saving) setReport(null);
        }}
        title="Report this review"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate(`/reviews/${report._id}/report`, { category, details });
          }}
        >
          <fieldset disabled={saving} className="space-y-4">
            <p className="text-sm ga-muted">
              Your report details are private to authorized moderation
              operators.
            </p>
            <FormField
              label="Report reason"
              as="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["abuse", "privacy", "spam", "authenticity", "other"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </FormField>
            <FormField
              label="Report details"
              as="textarea"
              required
              minLength={10}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {failure && (
              <p role="alert" className="text-error">
                {failure}
              </p>
            )}
            <Button type="submit" loading={saving}>
              Submit private report
            </Button>
          </fieldset>
        </form>
      </Dialog>
    </div>
  );
};
export default TechnicianProfile;
