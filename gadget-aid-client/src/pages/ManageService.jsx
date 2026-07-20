import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../provider/AuthProvider";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";

const ManageService = () => {
  const { user } = useContext(AuthContext);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    if (user?.email) {
      authFetch(`${API_URL}/my-services`)
        .then((res) => res.json())
        .then((data) => {
          setServices(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching services:", err);
          setLoading(false);
        });
    }
  }, [user]); // fixed: dependency array now correctly closes useEffect

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this service?"
    );
    if (!confirmDelete) return;

    try {
      const res = await authFetch(`${API_URL}/services/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.deletedCount > 0) {
        toast.success("Service deleted successfully!");
        setServices(services.filter((service) => service._id !== id));
      } else {
        toast.error("Failed to delete service.");
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Failed to delete service.");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const form = e.target;
    const updatedService = {
      name: form.name.value,
      price: form.price.value,
      area: form.area.value,
      description: form.description.value,
      image: form.image.value,
    };

    try {
      const res = await authFetch(`${API_URL}/services/${selectedService._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedService),
      });
      const result = await res.json();

      if (result.modifiedCount > 0) {
        toast.success("Service updated successfully!");
        const updatedList = services.map((service) =>
          service._id === selectedService._id
            ? { ...service, ...updatedService }
            : service
        );
        setServices(updatedList);
        setSelectedService(null);
      } else {
        toast.error("Failed to update service.");
      }
    } catch (err) {
      console.error("Error updating service:", err);
      toast.error("Failed to update service.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-base-200 to-base-300 px-4 py-12">
      <Helmet>
        <title>Manage Service | GadgetAid</title>
      </Helmet>

      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8 text-primary">
          Manage Your Services
        </h2>

        {loading ? (
          <p className="text-center">Loading...</p>
        ) : services.length === 0 ? (
          <p className="text-center text-base-content/60">No services added yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div
                key={service._id}
                className="bg-base-100 shadow-lg rounded-lg overflow-hidden border border-base-300"
              >
                <img
                  src={service.image}
                  alt={service.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4 space-y-2">
                  <h3 className="text-xl font-semibold text-primary">
                    {service.name}
                  </h3>
                  <p>
                    <strong>Area:</strong> {service.area}
                  </p>
                  <p>
                    <strong>Price:</strong> ${service.price}
                  </p>
                  <p className="text-sm text-base-content/60">
                    {service.description.slice(0, 100)}...
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setSelectedService(service)}
                      className="btn btn-sm btn-info"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(service._id)}
                      className="btn btn-sm btn-error"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-base-100 p-6 rounded-lg max-w-md w-full relative shadow-2xl">
            <button
              className="absolute top-2 right-2 text-base-content/50 hover:text-error text-xl"
              onClick={() => setSelectedService(null)}
            >
              ✕
            </button>
            <h3 className="text-xl font-semibold mb-4 text-primary">
              Edit Service
            </h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <input
                type="text"
                name="name"
                defaultValue={selectedService.name}
                className="input input-bordered w-full"
              />
              <input
                type="number"
                name="price"
                defaultValue={selectedService.price}
                className="input input-bordered w-full"
              />
              <input
                type="text"
                name="area"
                defaultValue={selectedService.area}
                className="input input-bordered w-full"
              />
              <input
                type="url"
                name="image"
                defaultValue={selectedService.image}
                className="input input-bordered w-full"
              />
              <textarea
                name="description"
                defaultValue={selectedService.description}
                className="textarea textarea-bordered w-full"
              ></textarea>
              <button
                type="submit"
                className="btn btn-primary w-full"
              >
                Update
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageService;
