import { FiArrowUpRight, FiMapPin } from "react-icons/fi";
import Button from "./Button";
import Avatar from "./ui/Avatar";
import ServiceImage from "./ui/ServiceImage";

const ServiceCard = ({ service }) => (
  <article className="ga-surface overflow-hidden flex flex-col group">
    <div className="aspect-[16/10] overflow-hidden bg-base-300"><ServiceImage src={service.image} alt={service.name || "Repair service"} className="transition-transform duration-300 motion-safe:group-hover:scale-105" /></div>
    <div className="p-5 sm:p-6 flex flex-1 flex-col">
      <p className="ga-muted text-xs flex items-center gap-1.5 mb-3"><FiMapPin aria-hidden="true" />{service.area || "Contact provider for service area"}</p>
      <h3 className="text-xl font-semibold leading-snug">{service.name || "Repair service"}</h3>
      <p className="ga-muted text-sm mt-3 line-clamp-2">{service.description || "Open the service for more information."}</p>
      <div className="mt-5 flex items-center gap-2.5"><Avatar src={service.providerPhoto || service.providerImage} name={service.providerName || "Service provider"} className="h-8 w-8" /><span className="text-sm truncate">{service.providerName || "Service provider"}</span></div>
      <div className="mt-auto pt-6 flex flex-wrap items-center justify-between gap-3"><p className="ga-numeric text-xl font-bold">{service.price !== undefined && service.price !== null ? `$${service.price}` : "Ask provider"}</p><Button to={`/services/${service._id}`} variant="outline" size="sm" aria-label={`View ${service.name || "service"}`}>View details <FiArrowUpRight aria-hidden="true" /></Button></div>
    </div>
  </article>
);
export default ServiceCard;
