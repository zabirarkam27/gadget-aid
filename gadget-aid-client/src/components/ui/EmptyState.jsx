const EmptyState = ({ title, description, action, className = "" }) => (
  <div className={`ga-surface ga-state ${className}`}>
    <h2 className="text-section font-semibold">{title}</h2>
    {description && <p className="ga-muted mx-auto mt-3 max-w-md">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default EmptyState;
