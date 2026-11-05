import { motion } from "framer-motion";
import bannerImg from "../../public/banner.png"; 
import Button from "./Button";

const Banner = () => {
  return (
    <div className="relative w-full h-[80vh] bg-slate-950 text-white overflow-hidden">
      {/* Background Image */}
      <img
        src={bannerImg}
        alt="Gadget Repair Banner"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />

      {/* Overlay Content */}
      <div className="relative z-10 flex flex-col justify-center items-start h-full max-w-7xl mx-auto px-6">
        <motion.h1
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-4xl md:text-6xl font-bold leading-tight mb-4"
        >
          Welcome to <span className="text-sky-400">GadgetAid</span>
        </motion.h1>

        <motion.p
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-lg md:text-xl mb-6"
        >
          We bring your damaged devices back to life. Fast, affordable &
          reliable electronic repair services.
        </motion.p>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Button to="/services">Book a Repair</Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Banner;
