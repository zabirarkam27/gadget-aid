import { createElement } from "react";
import { FiDollarSign, FiUser, FiActivity } from "react-icons/fi";
const benefits = [[FiDollarSign, "See the listed price", "Compare what providers list before you send a booking request."], [FiUser, "Know the provider", "See who offers the service and the area they cover."], [FiActivity, "Keep track in one place", "Your booking page keeps the service, date and latest repair status together."]];
const FeaturedSection = () => (
  <section className="bg-base-100 border-y border-base-300"><div className="ga-container ga-section"><p className="ga-eyebrow mb-3">Less guesswork</p><h2 className="text-page font-bold mb-10">Know your next step.</h2><div className="grid md:grid-cols-3 gap-8">{benefits.map(([Icon,title,copy]) => <div key={title}>{createElement(Icon, {size: 26, className: "text-primary mb-5", "aria-hidden": true})}<h3 className="text-xl font-semibold mb-3">{title}</h3><p className="ga-muted">{copy}</p></div>)}</div></div></section>
);
export default FeaturedSection;
