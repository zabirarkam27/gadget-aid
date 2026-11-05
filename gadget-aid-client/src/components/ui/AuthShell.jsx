import { FiTool, FiArrowUpRight } from "react-icons/fi";
import { Link } from "react-router-dom";
const AuthShell = ({ title, description, eyebrow = "Your GadgetAid account", children }) => (
  <section className="ga-container ga-section grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
    <aside className="hidden lg:block"><div className="ga-auth-symbol"><FiTool size={48} aria-hidden="true" /></div><p className="ga-eyebrow mt-8 mb-4">Keep good tech going</p><h2 className="text-display font-bold max-w-lg">A better way to<br /><span className="text-primary">get it fixed.</span></h2><p className="ga-muted text-lg max-w-md mt-6">Discover repair services, send a booking request and keep track of your repairs from one account.</p><Link to="/services" className="text-primary ga-text-link inline-flex gap-2 items-center mt-8">Explore the services <FiArrowUpRight aria-hidden="true" /></Link></aside>
    <div className="ga-surface w-full max-w-lg mx-auto p-6 sm:p-10"><p className="ga-eyebrow mb-3">{eyebrow}</p><h1 className="text-page font-bold">{title}</h1><p className="ga-muted mt-3 mb-8">{description}</p>{children}</div>
  </section>
);
export default AuthShell;
