const Skeleton = ({ className = "h-5 w-full", label = "Loading content" }) => (
  <div role="status" className="min-w-0">
    <span className="sr-only">{label}</span>
    <div className={`skeleton ga-skeleton ${className}`} aria-hidden="true" />
  </div>
);

export default Skeleton;
