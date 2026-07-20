import { useContext, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AuthContext } from "../provider/AuthProvider";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";

const ServiceToDo = () => {
  const { user } = useContext(AuthContext);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        // Server now filters by the logged-in provider's token — no need to
        // fetch everything and filter on the client.
        const res = await authFetch(`${API_URL}/all-bookings`);
        const data = await res.json();
        setBookings(data);
      } catch (err) {
        console.error("Failed to fetch bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchBookings();
    }
  }, [user]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await authFetch(`${API_URL}/all-bookings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (data.modifiedCount > 0) {
        setBookings((prev) =>
          prev.map((booking) =>
            booking._id === id ? { ...booking, status: newStatus } : booking
          )
        );
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 px-4 py-12">
      <Helmet>
        <title>Service-To-Do | GadgetAid</title>
      </Helmet>

      <h2 className="text-3xl font-bold text-center text-primary mb-8">
        Your Services Booked by Others
      </h2>

      {loading ? (
        <div className="flex justify-center items-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-center text-base-content/60">
          No bookings found where you are the service provider.
        </p>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {bookings.map((booking) => (
            <div
              key={booking._id}
              className="bg-base-100 rounded-lg shadow-md p-5 border border-base-300"
            >
              <div className="mb-2">
                <h3 className="text-xl font-semibold text-primary mb-1">
                  {booking.serviceName}
                </h3>
                <p className="text-base-content/70">
                  <strong>Customer:</strong> {booking.userEmail}
                </p>
                <p className="text-base-content/70">
                  <strong>Status:</strong>{" "}
                  <span className="capitalize text-primary font-medium">
                    {booking.status || "pending"}
                  </span>
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-base-content/80 mb-1">
                  Update Status:
                </label>
                <select
                  className="select select-bordered w-full sm:w-1/2"
                  value={booking.status || "pending"}
                  onChange={(e) =>
                    handleStatusChange(booking._id, e.target.value)
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="working">Working</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceToDo;
