import { useState } from "react";

const Avatar = ({ src, name = "Service provider", className = "h-10 w-10" }) => {
  const [failedSource, setFailedSource] = useState(null);
  return src && failedSource !== src ? (
    <img src={src} alt={name} className={`rounded-full object-cover ${className}`} onError={() => setFailedSource(src)} referrerPolicy="no-referrer" />
  ) : (
    <span role="img" aria-label={name} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold ${className}`}>{name.trim().charAt(0).toUpperCase() || "G"}</span>
  );
};
export default Avatar;
