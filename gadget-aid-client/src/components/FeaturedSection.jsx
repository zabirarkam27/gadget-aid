import { motion } from "framer-motion";

const FeaturedSection = () => {
  return (
    <section className="py-12 md:py-16 bg-base-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-4"
        >
          Why Choose <span className="text-primary">GadgetAid?</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-base-content/70 text-base sm:text-lg max-w-2xl mx-auto mb-10 px-2"
        >
          We offer expert electronic repair services with fast turnaround,
          affordable pricing, and guaranteed satisfaction.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {[
            { title: "Expert Technicians", icon: "🛠️" },
            { title: "Quick Turnaround", icon: "⏱️" },
            { title: "Affordable Pricing", icon: "💰" },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.2, duration: 0.6 }}
              className="bg-base-200 hover:bg-base-300 transition-colors rounded-xl p-5 md:p-6 shadow-md"
            >
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="text-lg sm:text-xl font-semibold">{item.title}</h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedSection;
