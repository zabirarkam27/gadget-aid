import { motion } from "framer-motion";

const HowItWorks = () => {
  const steps = [
    {
      title: "1. Choose Your Service",
      description: "Browse our service list and select the repair you need.",
    },
    {
      title: "2. Book Online",
      description: "Fill out a short form and confirm your booking instantly.",
    },
    {
      title: "3. Get It Fixed",
      description: "We repair your device and notify you when it’s done.",
    },
  ];

  return (
    <section className="bg-base-100 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-12"
        >
          How It Works
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2, duration: 0.6 }}
              className="bg-base-200 hover:bg-base-300 transition-colors rounded-xl p-6 shadow-md flex flex-col items-center text-center h-full"
            >
              <div className="text-3xl font-bold text-primary mb-2">
                {step.title}
              </div>
              <p className="text-base-content/70 text-base sm:text-lg">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
