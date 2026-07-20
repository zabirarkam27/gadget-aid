import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ServiceCard from "./ServiceCard";
import { API_URL } from "../utils/api";

const PopularServices = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/services`)
      .then((res) => res.json())
      .then((data) => {
        const limited = data.slice(0, 6);
        setServices(limited);
      });
  }, []);

  return (
    <div className="bg-gradient-to-r from-base-200 to-base-300 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-primary">
            Popular Services
          </h2>
          <Link to="/services" className="btn btn-primary">
            Show All
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {services.map((service) => (
            <ServiceCard key={service._id} service={service} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PopularServices;
