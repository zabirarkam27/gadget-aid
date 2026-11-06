import { Helmet } from "react-helmet-async";
import { NavLink } from "react-router-dom";
const links = [
  ["/repair-calculator", "Repair vs replace"],
  ["/repair-estimate", "Listed-price estimate"],
  ["/compare-services", "Compare services"],
  ["/repair-gallery", "Repair gallery"],
  ["/recycling", "Responsible recycling"],
];
export default function ToolLayout({ title, description, children }) {
  return (
    <section className="ga-container ga-section min-w-0">
      <Helmet>
        <title>{`${title} | GadgetAid`}</title>
      </Helmet>
      <p className="ga-eyebrow mb-3">Make an informed repair choice</p>
      <h1 className="text-page font-bold">{title}</h1>
      <p className="ga-muted mt-4 max-w-3xl">{description}</p>
      <nav aria-label="Repair tools" className="flex flex-wrap gap-2 my-7">
        {links.map(([path, label]) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `ga-nav-link ${isActive ? "ga-nav-active" : ""}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {children}
    </section>
  );
}
