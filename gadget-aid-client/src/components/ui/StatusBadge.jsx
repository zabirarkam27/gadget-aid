import { repairStatuses } from "../../utils/workspace";
const StatusBadge = ({ status, className = "" }) => (
  <span
    className={`badge badge-soft ${status === "completed" ? "badge-success" : ["cancelled", "rejected"].includes(status) ? "badge-error" : status === "awaiting_approval" ? "badge-warning" : "badge-info"} ${className}`}
  >
    {repairStatuses[status] || "Unknown status"}
  </span>
);
export default StatusBadge;
