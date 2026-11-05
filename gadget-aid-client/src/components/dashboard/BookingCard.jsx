import { FiCalendar } from "react-icons/fi";
import StatusBadge from "../ui/StatusBadge";
import ServiceImage from "../ui/ServiceImage";
import Button from "../Button";
import { bookingStatus, dateLabel, priceLabel } from "../../utils/workspace";
const BookingCard = ({ booking, provider = false, action }) => {
  const status = bookingStatus(booking);
  return (
    <article className="ga-surface overflow-hidden flex flex-col min-w-0">
      <div className="h-40 bg-base-300">
        <ServiceImage
          src={booking.serviceImage}
          alt={booking.serviceName || "Repair service"}
        />
      </div>
      <div className="p-6 flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <StatusBadge status={status} />
          <span className="ga-numeric font-semibold">
            {priceLabel(booking.price)}
          </span>
        </div>
        <h2 className="text-xl font-semibold">
          {booking.serviceName || "Repair service"}
        </h2>
        <div className="text-sm ga-muted space-y-2">
          <p className="break-words">
            {provider ? "Customer" : "Provider"}:{" "}
            {provider
              ? booking.userName || booking.userEmail
              : booking.providerName || "Service provider"}
          </p>
          <p className="inline-flex gap-2 items-center">
            <FiCalendar aria-hidden="true" />
            {dateLabel(booking.date)}
          </p>
        </div>
        <div className="mt-auto space-y-4">
          {action}
          <Button
            variant="outline"
            className="w-full"
            to={`/bookings/${booking._id}${provider ? "?view=provider" : ""}`}
          >
            {provider
              ? "Manage repair"
              : status === "awaiting_approval"
                ? "Review quotation"
                : "Track repair"}
          </Button>
        </div>
      </div>
    </article>
  );
};
export default BookingCard;
