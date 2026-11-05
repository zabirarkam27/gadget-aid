const statuses = {
  pending: { label: "Pending", style: "badge-warning" },
  working: { label: "Working", style: "badge-info" },
  completed: { label: "Completed", style: "badge-success" },
};

const StatusBadge = ({ status, className = "" }) => {
  const state = statuses[status] || { label: "Unknown status", style: "badge-outline text-base-content" };
  return <span className={`badge ${statuses[status] ? "badge-soft" : ""} ${state.style} ${className}`}>{state.label}</span>;
};

export default StatusBadge;
