export const bookingStatus = booking => {
  const value = booking.status || booking.serviceStatus || "pending";
  return typeof value === "string" ? value.toLowerCase() : "unknown";
};
export const priceLabel = value => value == null || value === "" || !Number.isFinite(Number(value)) ? "Price unavailable" : `$${Number(value).toFixed(2)}`;
export const dateLabel = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date not provided";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Date not provided" : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
};
export const statusCounts = bookings => ["pending", "working", "completed"].map(status => ({ label: status === "working" ? "In progress" : status === "pending" ? "Pending requests" : "Completed", value: bookings.filter(booking => bookingStatus(booking) === status).length }));
