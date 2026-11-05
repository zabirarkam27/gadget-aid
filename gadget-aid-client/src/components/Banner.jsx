import { FiArrowUpRight, FiArrowRight } from "react-icons/fi";

import Button from "./Button";

const Banner = () => (
  <section className="ga-hero overflow-hidden">
    <div className="ga-container grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-14 lg:py-20">
      <div>
        <p className="ga-eyebrow mb-5 inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Repair. Reuse. Keep going.</p>
        <h1 className="ga-hero-title">Your tech deserves<br />a <span className="text-primary">second life.</span></h1>
        <p className="ga-muted text-lg max-w-lg mt-6">A cracked screen. A laptop that won’t start. Find a repair service, meet the provider and take the next step with GadgetAid.</p>
        <div className="flex flex-wrap gap-3 mt-8"><Button to="/services" size="lg">Find a repair service <FiArrowUpRight aria-hidden="true" /></Button><Button to="/contact-us" variant="ghost">Have a question? <FiArrowRight aria-hidden="true" /></Button></div>
        <p className="ga-muted text-xs mt-8 tracking-wide">PHONES · COMPUTERS · HOME ELECTRONICS</p>
      </div>
      <div className="ga-hero-art">
        <img src="/banner.png" alt="Exploded view of a smartphone and its internal components" width="640" height="520" className="w-full h-full object-cover" fetchPriority="high" />
        <div className="ga-hero-caption"><span className="text-primary text-xs tracking-widest uppercase">Care for what connects you</span><p className="text-white font-semibold mt-1">Small repair. More possibilities.</p></div>
      </div>
    </div>
  </section>
);
export default Banner;
