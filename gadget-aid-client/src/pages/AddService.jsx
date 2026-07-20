import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../provider/AuthProvider";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";

const AddService = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAddService = async (e) => {
    e.preventDefault();
    setLoading(true);

    const form = e.target;
    const image = form.image.value;
    const name = form.name.value;
    const price = form.price.value;
    const area = form.area.value;
    const description = form.description.value;

    const newService = {
      image,
      name,
      price,
      area,
      description,
      providerName: user.displayName,
      providerEmail: user.email,
      providerImage: user.photoURL,
      createdAt: new Date(),
    };

    try {
      const res = await authFetch(`${API_URL}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newService),
      });

      const data = await res.json();
      if (data.insertedId) {
        toast.success("Service added successfully!");
        form.reset();

        setTimeout(() => {
          navigate("/services");
        }, 1500);
      } else {
        toast.error("Failed to add service. Try again.");
      }
    } catch (error) {
      console.error("Error adding service:", error);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-base-200 to-base-300 px-4 py-12">
      <Helmet>
        <title>Add Service | GadgetAid</title>
      </Helmet>

      <div className="max-w-3xl mx-auto bg-base-100 rounded-xl shadow-xl p-8 border border-base-300">
        <h2 className="text-3xl font-bold text-center mb-6 text-primary">
          Add New Service
        </h2>

        <form onSubmit={handleAddService} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Service Image URL</span>
            </label>
            <input
              type="url"
              name="image"
              required
              className="input input-bordered w-full"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">
                <span className="label-text">Service Name</span>
              </label>
              <input
                type="text"
                name="name"
                required
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text">Price ($)</span>
              </label>
              <input
                type="number"
                name="price"
                required
                className="input input-bordered w-full"
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="label">
              <span className="label-text">Service Area</span>
            </label>
            <input
              type="text"
              name="area"
              required
              className="input input-bordered w-full"
              placeholder="e.g., Dhanmondi, Dhaka"
            />
          </div>

          <div>
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              name="description"
              required
              rows="4"
              className="textarea textarea-bordered w-full"
              placeholder="Describe the service..."
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full mt-4"
          >
            {loading ? "Adding..." : "Add Service"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddService;
