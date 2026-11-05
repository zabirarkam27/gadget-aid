const STATUS_LABELS = Object.freeze({
  pending: "Pending",
  confirmed: "Confirmed",
  device_received: "Device received",
  diagnosing: "Diagnosing",
  quotation_sent: "Quotation sent",
  awaiting_approval: "Awaiting approval",
  approved: "Approved for repair",
  repairing: "Repairing",
  quality_check: "Quality check",
  ready_for_collection: "Ready for collection",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
});
const STATUSES = Object.keys(STATUS_LABELS);
const TERMINAL = ["completed", "cancelled", "rejected"];
const TRANSITIONS = Object.freeze({
  pending: ["confirmed", "rejected"],
  confirmed: ["device_received", "diagnosing", "cancelled"],
  device_received: ["diagnosing", "cancelled"],
  diagnosing: ["cancelled"],
  quotation_sent: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["cancelled"],
  approved: ["repairing", "cancelled"],
  repairing: ["quality_check", "cancelled"],
  quality_check: ["ready_for_collection", "repairing", "cancelled"],
  ready_for_collection: ["completed", "quality_check", "cancelled"],
});
const CUSTOMER_CANCELLABLE = [
  "pending",
  "confirmed",
  "device_received",
  "diagnosing",
  "quotation_sent",
  "awaiting_approval",
];
const workflowStatus = (booking) => {
  const raw = booking.status || booking.serviceStatus || "pending";
  if (raw === "working") return "repairing";
  return typeof raw === "string" && STATUSES.includes(raw.toLowerCase())
    ? raw.toLowerCase()
    : "unknown";
};
// JSON fields supplied to the old API could not create a BSON Date. Do not trust
// a legacy client's lookalike workflow/approval payload on read or lazy upgrade.
const hasWorkflow = (booking) =>
  booking.workflowVersion === 2 &&
  booking.repair?.startedAt instanceof Date &&
  Number.isSafeInteger(booking.repairRevision) &&
  booking.repairRevision >= 0 &&
  Array.isArray(booking.repair.events) &&
  Array.isArray(booking.repair.diagnoses) &&
  Array.isArray(booking.repair.quotations);
const currentQuote = (booking) =>
  hasWorkflow(booking)
    ? booking.repair.quotations.find(
        (quote) => quote.id === booking.repair.currentQuotationId,
      ) || null
    : null;
const approvedQuote = (booking) => {
  const quote = currentQuote(booking);
  return quote?.status === "approved" ? quote : null;
};
const legacyInProgress = (booking) =>
  hasWorkflow(booking)
    ? booking.repair.legacyInProgress === true
    : booking.status === "working" || booking.serviceStatus === "working";
const providerTransitions = (booking) => {
  const next = TRANSITIONS[workflowStatus(booking)] || [];
  return next.filter(
    (status) =>
      ![
        "repairing",
        "quality_check",
        "ready_for_collection",
        "completed",
      ].includes(status) ||
      !!approvedQuote(booking) ||
      legacyInProgress(booking),
  );
};
const workflowSummary = (booking) => {
  const quote = currentQuote(booking);
  return {
    workflowVersion: hasWorkflow(booking) ? 2 : 1,
    repairRevision: hasWorkflow(booking) ? booking.repairRevision : 0,
    legacyWorkflow: !hasWorkflow(booking) || legacyInProgress(booking),
    quotation: quote
      ? {
          id: quote.id,
          number: quote.number,
          status: quote.status,
          total: quote.total,
          currency: quote.currency,
          expiresOn: quote.expiresOn,
        }
      : null,
  };
};
module.exports = {
  STATUS_LABELS,
  STATUSES,
  TERMINAL,
  TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  workflowStatus,
  hasWorkflow,
  currentQuote,
  approvedQuote,
  legacyInProgress,
  providerTransitions,
  workflowSummary,
};
