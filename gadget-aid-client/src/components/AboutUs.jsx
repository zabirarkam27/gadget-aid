
import Button from "./Button";
const AboutUs = () => (
  <section className="ga-container ga-section grid md:grid-cols-2 gap-10 lg:gap-20 items-center"><div className="aspect-[4/3] rounded-2xl overflow-hidden bg-base-300"><img src="/about-us.png" alt="Electronic device repair workspace" loading="lazy" className="h-full w-full object-cover" /></div><div><p className="ga-eyebrow mb-4">Keep good tech in use</p><h2 className="text-page font-bold">A repair can be<br />a fresh start.</h2><p className="ga-muted mt-5">GadgetAid connects people who need a repair with people who offer one. Explore the service details, understand the listed price and keep a record of your request.</p><p className="ga-muted mt-4 mb-7">Repair electronics? Publish your services and manage incoming bookings from your account.</p><Button to="/add-service" variant="outline">Offer a repair service ↗</Button></div></section>
);
export default AboutUs;

