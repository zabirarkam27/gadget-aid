import { motion } from "framer-motion";

const AboutUs = () => {
  return (
    <section className="bg-gradient-to-r from-primary/10 to-secondary/10 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-10">
        {/* Left Image Section */}
        <motion.div
          initial={{ opacity: 0, y: -60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full md:w-1/2"
        >
          <img
            src="https://i.ibb.co/8nscCQcf/about-us.png"
            alt="About GadgetAid"
            className="w-full rounded-xl shadow-xl"
          />
        </motion.div>

        {/* Right Text Section */}
        <motion.div
          initial={{ opacity: 0, xy: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full md:w-1/2 text-center md:text-left"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-4">
            About{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Gadget
            </span>
            <span className="text-base-content">Aid</span>
          </h2>
          <p className="text-base-content/70 text-base sm:text-lg mb-4">
            GadgetAid is your one-stop solution for all kinds of gadget repairs.
            We aim to restore your devices to their best condition.
          </p>
          <p className="text-base-content/70 text-base sm:text-lg">
            With thousands of happy customers, we’re trusted for quality,
            transparency, and speed. Your gadgets deserve the best care!
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutUs;
