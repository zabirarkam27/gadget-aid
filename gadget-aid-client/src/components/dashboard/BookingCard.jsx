import { useState } from "react";
import { FiCalendar } from "react-icons/fi";
import StatusBadge from "../ui/StatusBadge";
import Dialog from "../ui/Dialog";
import ServiceImage from "../ui/ServiceImage";
import Button from "../Button";
import { bookingStatus, dateLabel, priceLabel } from "../../utils/workspace";
const BookingCard = ({ booking, provider = false, action }) => {
  const [open, setOpen] = useState(false);
  const status = bookingStatus(booking);
  return <article className="ga-surface overflow-hidden flex flex-col min-w-0">
    <div className="h-40 bg-base-300"><ServiceImage src={booking.serviceImage} alt={booking.serviceName || "Repair service"} /></div>
    <div className="p-6 flex flex-1 flex-col gap-4"><div className="flex flex-wrap justify-between items-center gap-3"><StatusBadge status={status} /><span className="ga-numeric font-semibold">{priceLabel(booking.price)}</span></div><h2 className="text-xl font-semibold">{booking.serviceName || "Repair service"}</h2><div className="text-sm ga-muted space-y-2"><p className="break-words">{provider ? "Customer" : "Provider"}: {provider ? booking.userName || booking.userEmail : booking.providerName || "Service provider"}</p><p className="inline-flex gap-2 items-center"><FiCalendar aria-hidden="true" />{dateLabel(booking.date)}</p></div><div className="mt-auto space-y-4">{action}<Button variant="outline" className="w-full" onClick={() => setOpen(true)}>View booking</Button></div></div>
    <Dialog open={open} onClose={() => setOpen(false)} title={booking.serviceName || "Booking details"}><StatusBadge status={status} /><dl className="grid gap-4 text-sm mt-6"><div><dt className="ga-muted">Booking reference</dt><dd className="break-all font-mono mt-1">{booking._id}</dd></div><div><dt className="ga-muted">Preferred date</dt><dd>{dateLabel(booking.date)}</dd></div><div><dt className="ga-muted">Listed price</dt><dd>{priceLabel(booking.price)}</dd></div><div><dt className="ga-muted">{provider ? "Customer email" : "Provider"}</dt><dd className="break-words">{provider ? booking.userEmail : booking.providerName || "Service provider"}</dd></div><div><dt className="ga-muted">Instructions</dt><dd className="whitespace-pre-line break-words mt-1">{booking.instruction || "No additional instructions."}</dd></div></dl><p className="ga-muted text-xs mt-6">The date is a preference. Confirm arrangements and additional work with the provider. Refresh your workspace for status updates.</p></Dialog>
  </article>;
};
export default BookingCard;
