import { useContext } from "react";
import { AccessContext } from "../../provider/AccessContext";
import { NavLink } from "react-router-dom";
import { Helmet } from "react-helmet-async";
const links = [
  ["/account-access", "Account access"],
  ["/account-security", "Account security"],
  ["/my-disputes", "My support requests"],
  ["/my-technician", "Technician profile"],
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
}) => {
  const access = useContext(AccessContext);
  const visible = [
    ...(access.admin ? [["/admin", "Platform operations"]] : []),
    ...links.filter(([path]) =>
      ["/my-technician", "/add-service"].includes(path)
        ? access.canProvide
        : ["/service-to-do", "/manage-services"].includes(path)
          ? access.canProvide || access.hasProviderHistory
          : true,
    ),
  ];
  return (
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
        {visible.map(([to, label]) => (
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
};
export default DashboardLayout;
