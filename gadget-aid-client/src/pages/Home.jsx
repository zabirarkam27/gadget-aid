import { createElement } from "react";
import { Link } from "react-router-dom";
import { FiSmartphone, FiMonitor, FiTv, FiArrowUpRight } from "react-icons/fi";
import { Helmet } from "react-helmet-async";
import Banner from "../components/Banner";
import PopularServices from "../components/PopularServices";
import HowItWorks from "../components/HowItWorks";
import FeaturedSection from "../components/FeaturedSection";
import AboutUs from "../components/AboutUs";
const shortcuts = [[FiSmartphone,"Phones","phone"],[FiMonitor,"Laptops","laptop"],[FiTv,"TV repairs","tv"]];
const faqs = [["Do I need an account to book?", "Yes. Sign in to view service details, send a booking request and access your bookings."],["Is the booking date a confirmed appointment?", "It is your preferred date. Confirm arrangements and any additional work with the provider."],["Does every repair include a warranty?", "Warranty terms depend on the service provider. Check the service description and confirm coverage before proceeding."],["How do I see repair updates?", "Open My bookings to see the latest pending, working or completed status. Refresh the page for updates."]];
const Home = () => <>
  <Helmet><title>GadgetAid | A second life for your tech</title><meta name="description" content="Find electronic repair services, compare provider details and manage your repair bookings with GadgetAid." /></Helmet>
  <Banner />
  <section className="ga-container pt-10" aria-label="Repair discovery shortcuts"><div className="grid sm:grid-cols-3 gap-4">{shortcuts.map(([Icon,label,q]) => <Link key={label} to={`/services?q=${q}`} className="ga-discovery-link">{createElement(Icon, {size: 24, className: "text-primary", "aria-hidden": true})}<span className="font-semibold flex-1">{label}</span><FiArrowUpRight className="ga-muted" aria-hidden="true" /></Link>)}</div><p className="ga-muted text-xs mt-3">Quick searches across service names, not fixed categories.</p></section>
  <PopularServices /><HowItWorks /><FeaturedSection /><AboutUs />
  <section className="ga-container ga-section border-t border-base-300 grid lg:grid-cols-[1fr_1.4fr] gap-10"><div><p className="ga-eyebrow mb-3">Before you book</p><h2 className="text-page font-bold">Good questions.<br />Clear answers.</h2><Link to="/contact-us" className="inline-block text-primary mt-5 ga-text-link">Still need a hand? ↗</Link></div><div>{faqs.map(([question,answer]) => <details key={question} className="ga-faq"><summary>{question}<span aria-hidden="true">+</span></summary><p className="ga-muted pb-5 pr-5">{answer}</p></details>)}</div></section>
</>;
export default Home;
