import { Link } from "react-router-dom";
import { FiArrowUpRight } from "react-icons/fi";
import Brand from "./ui/Brand";

const Footer = () => (
  <footer className="ga-footer">
    <div className="ga-container py-12">
      <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
        <div><Brand /><p className="ga-muted mt-4 max-w-sm">A little care. A longer life.<br />Find electronic repair services and keep your repair requests in one place.</p></div>
        <nav aria-label="Explore"><h2 className="font-semibold mb-4">Explore</h2><div className="grid gap-3 ga-muted"><Link to="/" className="ga-text-link">Home</Link><Link to="/services" className="ga-text-link">Find a service</Link><Link to="/contact-us" className="ga-text-link">Contact us</Link></div></nav>
        <nav aria-label="Your GadgetAid account"><h2 className="font-semibold mb-4">Your GadgetAid</h2><div className="grid gap-3 ga-muted"><Link to="/booked-services" className="ga-text-link">My bookings</Link><Link to="/add-service" className="ga-text-link">Offer a service</Link><Link to="/manage-services" className="ga-text-link">Manage services</Link></div></nav>
      </div>
      <div className="mt-10 pt-6 border-t border-base-300 flex flex-wrap items-center justify-between gap-3 text-sm ga-muted"><p>© {new Date().getFullYear()} GadgetAid</p><Link to="/contact-us" className="ga-text-link inline-flex items-center gap-2">Questions about your repair? <FiArrowUpRight aria-hidden="true" /></Link></div>
    </div>
  </footer>
);
export default Footer;
