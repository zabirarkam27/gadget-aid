import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const ServiceCard = ({ service }) => {
  const { _id, name, image, description, price, providerName, providerPhoto } =
    service;

  return (
    <motion.div
      whileHover={{
        scale: 1.03,
        boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.1)",
      }}
      transition={{ type: "spring", stiffness: 300 }}
      className="bg-base-100 rounded-lg shadow-lg p-5 border border-base-300"
    >
      <img
        src={image}
        alt={name}
        className="w-full h-48 object-cover rounded-md mb-4"
      />
      <h3 className="text-xl font-semibold text-primary mb-2">{name}</h3>
      <p className="text-base-content/70 mb-4">
        {description.length > 100
          ? description.slice(0, 100) + "..."
          : description}
      </p>
      <div className="flex items-center gap-3 mb-4">
        <img
          src={providerPhoto}
          alt={providerName}
          className="w-10 h-10 rounded-full"
        />
        <span className="text-base-content/80">{providerName}</span>
      </div>
      <div className="flex justify-between items-center">
        <p className="font-bold text-primary">${price}</p>
        <Link to={`/services/${_id}`} className="btn btn-sm btn-primary">
          View Details
        </Link>
      </div>
    </motion.div>
  );
};

export default ServiceCard;
