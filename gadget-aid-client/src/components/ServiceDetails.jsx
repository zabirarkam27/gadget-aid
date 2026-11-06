import { AccessContext } from "../provider/AccessContext";
import BookingAvailability from "./dashboard/BookingAvailability";
import { useContext, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiMapPin,
  FiCalendar,
  FiArrowUpRight,
} from "react-icons/fi";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { AuthContext } from "../provider/AuthContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import { bookingToday, bookingDateError } from "../utils/bookingValidation";
import Button from "./Button";
import Avatar from "./ui/Avatar";
import ServiceImage from "./ui/ServiceImage";
import Skeleton from "./ui/Skeleton";
import EmptyState from "./ui/EmptyState";
import Dialog from "./ui/Dialog";
import FormField from "./ui/FormField";

const ServiceDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const access = useContext(AccessContext);
  const navigate = useNavigate();
  const [state, setState] = useState({
    service: null,
    loading: true,
    error: "",
    missing: false,
  });
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [availability, setAvailability] = useState(null);
  const [slotAttempt, setSlotAttempt] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const bookingLock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setState({ service: null, loading: true, error: "", missing: false });
    fetch(`${API_URL}/services/${id}`, { signal: controller.signal })
      .then(readJson)
      .then((service) => {
        if (!service || typeof service !== "object" || !service._id)
          throw new Error("Invalid service response");
        if (!controller.signal.aborted)
          setState({ service, loading: false, error: "", missing: false });
      })
      .catch((error) => {
        if (error.name !== "AbortError" && !controller.signal.aborted)
          setState({
            service: null,
            loading: false,
            error: "The service could not be loaded. Please try again.",
            missing: error.status === 404 || error.status === 400,
          });
      });
    return () => controller.abort();
  }, [id, attempt]);

  const handleBooking = async (event) => {
    event.preventDefault();
    if (bookingLock.current) return;
    const dateError = bookingDateError(date);
    if (dateError) {
      setBookingError(dateError);
      return;
    }
    if (
      !availability ||
      availability.date !== date ||
      availability.loading ||
      availability.error ||
      !availability.open ||
      (availability.mode === "appointments" &&
        !availability.slots.includes(time))
    ) {
      setBookingError(
        "Check availability and choose an available time before submitting.",
      );
      return;
    }
    const service = state.service;
    if ([deviceType, deviceBrand, deviceModel].some(value => !value.trim() || value.trim().length > 80) || instruction.trim().length < 10) {
      setBookingError("Add device type, brand, model and a problem description of at least 10 characters.");
      return;
    }
    bookingLock.current = true;
    setSubmitting(true);
    setBookingError("");
    try {
      const result = await authFetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service._id,
          date,
          instruction: instruction.trim(),
          deviceType: deviceType.trim(),
          deviceBrand: deviceBrand.trim(),
          deviceModel: deviceModel.trim(),
          ...(time ? { time } : {}),
        }),
      }).then(readJson);
      if (!result.insertedId) throw new Error("Booking was not confirmed");
      toast.success("Booking request sent. You can follow it in My bookings.");
      setOpen(false);
      navigate("/booked-services");
    } catch (failure) {
      if (
        [
          "SLOT_UNAVAILABLE",
          "SLOT_REQUIRED",
          "PROVIDER_CLOSED",
          "STALE_PROFILE",
        ].includes(failure.code)
      )
        setSlotAttempt((v) => v + 1);
      setBookingError(
        failure.message ||
          "Your booking could not be confirmed. Check My bookings before trying again.",
      );
    } finally {
      bookingLock.current = false;
      setSubmitting(false);
    }
  };
  const { service, loading, error, missing } = state;
  return (
    <>
      <Helmet>
        <title>{`${service?.name || "Service details"} | GadgetAid`}</title>
      </Helmet>
      <div className="ga-container ga-section">
        <Link
          to="/services"
          className="ga-text-link ga-muted inline-flex items-center gap-2 text-sm mb-8"
        >
          <FiArrowLeft aria-hidden="true" />
          Back to services
        </Link>
        {loading ? (
          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8">
            <Skeleton className="h-96 w-full" label="Loading service details" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : error ? (
          <div role="alert">
            <EmptyState
              title={
                missing
                  ? "This service is unavailable"
                  : "Could not load this service"
              }
              description={
                missing
                  ? "The link may be incorrect, or the provider may have removed the service."
                  : error
              }
              action={
                <Button onClick={() => setAttempt((value) => value + 1)}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="ga-eyebrow mb-4">Repair service</p>
              <h1 className="text-page font-bold max-w-3xl">{service.name}</h1>
              <p className="ga-muted flex items-center gap-2 mt-4">
                <FiMapPin aria-hidden="true" />
                {service.area || "Ask the provider about coverage"}
              </p>
            </div>
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start">
              <div className="min-w-0">
                <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-base-300">
                  <ServiceImage src={service.image} alt={service.name} eager />
                </div>
                <div className="ga-surface p-6 sm:p-8 mt-6">
                  <h2 className="text-section font-semibold mb-4">
                    About this repair
                  </h2>
                  <p className="ga-muted whitespace-pre-line break-words">
                    {service.description ||
                      "Contact the provider for service information."}
                  </p>
                </div>
              </div>
              <aside className="ga-surface p-6 sm:p-8 lg:sticky lg:top-28">
                <p className="ga-muted text-sm">Listed service price</p>
                <p className="ga-numeric text-4xl font-bold mt-2 mb-7">
                  {service.price == null ? "Ask provider" : `$${service.price}`}
                </p>
                <div className="flex items-center gap-3 py-5 border-y border-base-300">
                  <Avatar
                    src={service.providerPhoto || service.providerImage}
                    name={service.providerName || "Service provider"}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0">
                    <p className="ga-muted text-xs mb-1">Offered by</p>
                    <p className="font-semibold break-words">
                      {service.providerName || "Service provider"}
                    </p>
                  </div>
                </div>
                <Button
                  to={`/technicians/${service.technicianId}`}
                  variant="ghost"
                  className="w-full mt-4"
                >
                  View technician profile and reviews
                </Button>
                <Button
                  disabled={service.bookable === false || access.restricted}
                  className="w-full mt-6"
                  onClick={() => {
                    setBookingError("");
                    setOpen(true);
                  }}
                >
                  Request a booking <FiArrowUpRight aria-hidden="true" />
                </Button>
                {service.bookable === false && (
                  <p role="status" className="text-warning text-sm mt-4">
                    This listing is not accepting new requests. Browse another
                    service.
                  </p>
                )}
                <p className="ga-muted text-sm mt-4">
                  Choose a date to check provider hours and available
                  appointment times.
                </p>
                <div className="mt-7 border-t border-base-300 pt-5 space-y-4 text-sm ga-muted">
                  <p className="flex gap-2">
                    <FiCalendar className="shrink-0 mt-1" aria-hidden="true" />
                    Appointment times are reserved only after a successful
                    request. Date-only requests require provider confirmation.
                  </p>
                  <p>
                    Confirm repair scope, extra charges and any warranty terms
                    with the provider before work begins.
                  </p>
                  <p>No online payment is collected by this booking form.</p>
                </div>
              </aside>
            </div>
            <Dialog
              open={open}
              onClose={() => {
                if (!submitting) setOpen(false);
              }}
              title="Request this repair"
            >
              <form onSubmit={handleBooking} className="space-y-5">
                <div className="rounded-xl bg-base-200 p-4">
                  <p className="font-semibold">{service.name}</p>
                  <p className="ga-muted text-sm mt-1">
                    {service.providerName} ·{" "}
                    <span className="ga-numeric">${service.price}</span>
                  </p>
                </div>
                <FormField
                  label="Your email"
                  type="email"
                  value={user?.email || ""}
                  readOnly
                />
                <FormField
                  label="Preferred date"
                  type="date"
                  value={date}
                  min={bookingToday()}
                  required
                  onChange={(event) => setDate(event.target.value)}
                  helper="Dates and appointment times use Bangladesh time."
                  disabled={submitting}
                />
                <BookingAvailability
                  serviceId={service._id}
                  date={date}
                  time={time}
                  setTime={setTime}
                  onAvailability={setAvailability}
                  attempt={slotAttempt}
                />
                <FormField
                  label="Repair instructions"
                  as="textarea"
                  rows={4}
                  maxLength={2000}
                  minLength={10}
                  required
                  placeholder="Describe the device, issue and any useful instructions."
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  disabled={submitting}
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField label="Device type" as="select" required value={deviceType} onChange={e => setDeviceType(e.target.value)} disabled={submitting}>
                    <option value="">Choose a device</option>
                    {["Smartphone", "Laptop", "Desktop", "Tablet", "Smartwatch", "Gaming console", "Other"].map(type => <option key={type}>{type}</option>)}
                  </FormField>
                  <FormField label="Device brand" required maxLength={80} value={deviceBrand} onChange={e => setDeviceBrand(e.target.value)} disabled={submitting} placeholder="For example, Samsung" />
                  <FormField label="Device model" required maxLength={80} value={deviceModel} onChange={e => setDeviceModel(e.target.value)} disabled={submitting} placeholder="Model name or unknown" />
                </div>
                {bookingError && (
                  <p role="alert" className="text-error text-sm">
                    {bookingError}
                  </p>
                )}
                {bookingError && (
                  <Link
                    to="/booked-services"
                    className="text-primary text-sm ga-text-link"
                  >
                    Check My bookings →
                  </Link>
                )}
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={
                    availability?.loading ||
                    !!availability?.error ||
                    availability?.open === false ||
                    (availability?.mode === "appointments" && !time)
                  }
                  className="w-full"
                >
                  {submitting ? "Sending request…" : "Send booking request"}
                </Button>
              </form>
            </Dialog>
          </>
        )}
      </div>
    </>
  );
};
export default ServiceDetails;
