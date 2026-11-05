import { Link } from "react-router-dom";
import { FiMail, FiArrowUpRight, FiCalendar, FiTool } from "react-icons/fi";
import { Helmet } from "react-helmet-async";
import Button from "../components/Button";
const ContactUs=()=> <>
  <Helmet><title>Contact us | GadgetAid</title><meta name="description" content="Get help with GadgetAid, service discovery and repair bookings." /></Helmet>
  <div className="ga-page-heading"><div className="ga-container"><p className="ga-eyebrow mb-4">A little help goes a long way</p><h1 className="text-page font-bold">Let’s get you back on track.</h1><p className="ga-muted mt-4 max-w-xl">Questions about using GadgetAid? Here’s where to start.</p></div></div>
  <section className="ga-container ga-section grid lg:grid-cols-[1.2fr_1fr] gap-8">
    <div className="ga-surface p-7 sm:p-10"><FiMail className="text-primary mb-6" size={32} aria-hidden="true" /><h2 className="text-section font-semibold">Talk to GadgetAid</h2><p className="ga-muted mt-4 max-w-md">Email us about using the platform. Include the service name and a short description of what you need help with.</p><a href="mailto:support@gadgetaid.com" className="text-primary font-semibold inline-flex items-center gap-2 mt-7 break-all">support@gadgetaid.com <FiArrowUpRight className="shrink-0" aria-hidden="true" /></a><p className="ga-muted text-sm mt-6">This opens your email app. Please don’t include passwords, payment details or other sensitive information.</p></div>
    <div className="space-y-6"><div className="ga-surface p-7"><FiCalendar className="text-primary mb-4" size={24} aria-hidden="true" /><h2 className="text-xl font-semibold">An existing booking?</h2><p className="ga-muted text-sm mt-3 mb-5">Check the provider, date and latest status in your bookings. Confirm repair arrangements directly with your provider.</p><Button to="/booked-services" variant="outline">View my bookings</Button></div><div className="ga-surface p-7"><FiTool className="text-primary mb-4" size={24} aria-hidden="true" /><h2 className="text-xl font-semibold">Looking for a repair?</h2><p className="ga-muted text-sm mt-3 mb-5">Browse the catalogue for service information, coverage and listed prices.</p><Link to="/services" className="text-primary ga-text-link">Explore services ↗</Link></div></div>
  </section>
</>;
export default ContactUs;
