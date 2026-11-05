import { useState } from "react";
const ServiceImage = ({ src, alt, className = "", eager = false }) => {
  const [failedSource, setFailedSource] = useState(null);
  return src && failedSource !== src ? <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailedSource(src)} className={`h-full w-full object-cover ${className}`} /> : <div role="img" aria-label={alt} className={`flex h-full w-full items-center justify-center bg-base-300 text-primary ${className}`}><span className="text-sm font-medium">GadgetAid repair service</span></div>;
};
export default ServiceImage;
