import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../provider/AuthProvider";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";

const ServiceDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState("");
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/services/${id}`)
      .then((res) => res.json())
      .then((data) => setService(data))
      .catch((err) => console.error("Error fetching service:", err));
  }, [id]);

  const handleBooking = async () => {
    const booking = {
      serviceId: service._id,
      serviceName: service.name,
      serviceImage: service.image,
      providerEmail: service.providerEmail,
      providerName: service.providerName,
      userName: user.displayName,
      date,
      instruction,
      price: service.price,
      status: "pending",
    };

    try {
      const res = await authFetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(booking),
      });

      const data = await res.json();
      if (data.insertedId) {
        toast.success("Service booked successfully!");
        setShowModal(false);
        navigate("/booked-services");
      } else {
        toast.error("Booking failed.");
      }
    } catch (error) {
      console.error("Error booking service:", error);
      toast.error("Booking failed.");
    }
  };

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-base-200 to-base-300 px-4 py-12">
      <Helmet>
        <title>Service Details | GadgetAid</title>
      </Helmet>

      <div className="max-w-4xl mx-auto bg-base-100 rounded-xl shadow-xl p-8 border border-base-300">
        <h2 className="text-3xl font-bold mb-6 text-center text-primary">
          {service.name}
        </h2>

        <img
          src={service.image}
          alt={service.name}
          className="w-full rounded-lg mb-6"
        />

        <p className="text-base-content/70 mb-4">
          <span className="font-semibold">Description:</span>{" "}
          {service.description}
        </p>

        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          <div>
            <p>
              <strong>Service Area:</strong> {service.area}
            </p>
            <p>
              <strong>Price:</strong> ${service.price}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <img
              src={service.providerPhoto}
              alt={service.providerName}
              className="w-12 h-12 rounded-full"
            />
            <p className="font-medium">{service.providerName}</p>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary px-6"
          >
            Book Now
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-base-100 p-6 rounded-lg max-w-lg w-full space-y-4 relative shadow-2xl">
            <button
              className="absolute top-2 right-2 text-base-content/50 hover:text-base-content"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-primary mb-2">
              Book Service
            </h3>

            <div className="grid grid-cols-1 gap-2">
              <input
                className="input input-bordered"
                value={service.name}
                readOnly
              />
              <input
                className="input input-bordered"
                value={service.providerName}
                readOnly
              />
              <input
                className="input input-bordered"
                value={user.email}
                readOnly
              />
              <input
                className="input input-bordered"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <textarea
                className="textarea textarea-bordered"
                placeholder="Special instruction (address, plan, etc.)"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
              <input
                className="input input-bordered"
                value={`$${service.price}`}
                readOnly
              />
              <button
                className="btn btn-primary"
                onClick={handleBooking}
              >
                Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceDetails;
