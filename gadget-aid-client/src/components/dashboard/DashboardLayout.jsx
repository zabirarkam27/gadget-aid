import { NavLink } from "react-router-dom";
import { Helmet } from "react-helmet-async";
const links = [["/my-technician", "Technician profile"],
  ["/notifications", "Notifications"],
  ["/booked-services", "My bookings"],
  ["/service-to-do", "Work queue"],
  ["/manage-services", "My services"],
  ["/add-service", "Add a service"],
];
const DashboardLayout = ({
  title,
  description,
  eyebrow = "Your workspace",
  action,
  children,
}) => (
  <div className="ga-container ga-section">
    <Helmet>
      <title>{title} | GadgetAid</title>
    </Helmet>
    <div className="flex flex-wrap items-end justify-between gap-5 mb-8">
      <div>
        <p className="ga-eyebrow mb-3">{eyebrow}</p>
        <h1 className="text-page font-bold">{title}</h1>
        <p className="ga-muted mt-3 max-w-2xl">{description}</p>
      </div>
      {action}
    </div>
    <nav
      aria-label="Workspace navigation"
      className="flex flex-wrap gap-2 mb-8 border-b border-base-300 pb-5"
    >
      {links.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `ga-nav-link ${isActive ? "ga-nav-active" : ""}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
    {children}
  </div>
);
export default DashboardLayout;
