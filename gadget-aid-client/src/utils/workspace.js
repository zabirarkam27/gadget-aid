export const repairStatuses = {
  pending: "Pending",
  confirmed: "Confirmed",
  device_received: "Device received",
  diagnosing: "Diagnosing",
  quotation_sent: "Quotation sent",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  repairing: "Repairing",
  quality_check: "Quality check",
  ready_for_collection: "Ready for collection",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};
export const bookingStatus = (booking) => {
  const value = booking.status || booking.serviceStatus || "pending";
  return value === "working"
    ? "repairing"
    : typeof value === "string"
      ? value.toLowerCase()
      : "unknown";
};
export const priceLabel = (value) =>
  value == null || value === "" || !Number.isFinite(Number(value))
    ? "Price unavailable"
    : `$${Number(value).toFixed(2)}`;
export const dateLabel = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return "Date not provided";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Date not provided"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
};
export const statusCounts = (bookings) => [
  {
    label: "Open requests",
    value: bookings.filter((b) =>
      [
        "pending",
        "confirmed",
        "device_received",
        "diagnosing",
        "quotation_sent",
        "awaiting_approval",
        "approved",
      ].includes(bookingStatus(b)),
    ).length,
  },
  {
    label: "In progress",
    value: bookings.filter((b) =>
      ["repairing", "quality_check", "ready_for_collection"].includes(
        bookingStatus(b),
      ),
    ).length,
  },
  {
    label: "Completed",
    value: bookings.filter((b) => bookingStatus(b) === "completed").length,
  },
];
