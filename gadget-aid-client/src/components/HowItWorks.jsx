import { createElement } from "react";
import { FiSearch, FiCalendar, FiTool } from "react-icons/fi";
const steps = [
  [FiSearch, "01", "Find your service", "Browse repair services and compare the provider, service area and listed price."],
  [FiCalendar, "02", "Send a booking request", "Sign in, choose your preferred date and share useful details with the provider."],
  [FiTool, "03", "Follow the progress", "Open My bookings to see the status as your provider updates the repair."]
];
const HowItWorks = () => (
  <section className="ga-container ga-section" aria-labelledby="process-title"><div className="max-w-xl mb-10"><p className="ga-eyebrow mb-3">From problem to progress</p><h2 id="process-title" className="text-page font-bold">A clearer path to repair.</h2></div><div className="grid md:grid-cols-3 gap-8">{steps.map(([Icon, number, title, copy]) => <div key={number} className="border-t border-base-300 pt-6"><div className="flex justify-between items-center mb-6">{createElement(Icon, {size: 26, className: "text-primary", "aria-hidden": true})}<span className="ga-muted text-sm ga-numeric">/{number}</span></div><h3 className="text-xl font-semibold mb-3">{title}</h3><p className="ga-muted">{copy}</p></div>)}</div></section>
);
export default HowItWorks;
