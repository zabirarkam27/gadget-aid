import { useContext } from "react";
import { AccessContext } from "../provider/AccessContext";
import Button from "../components/Button";
const CapabilityGate = ({ admin = false, children }) => {
  const access = useContext(AccessContext);
  if (access.loading)
    return (
      <p className="ga-container ga-section" role="status">
        Checking account access…
      </p>
    );
  if (access.error)
    return (
      <div className="ga-container ga-section">
        <p role="alert" className="text-error">
          {access.error}
        </p>
        <Button onClick={access.refresh}>Retry account access</Button>
      </div>
    );
  if (admin ? !access.admin : !access.canProvide || access.restricted)
    return (
      <div className="ga-container ga-section space-y-5">
        <h1 className="text-page font-bold">
          {admin
            ? "Administrator access required"
            : "Technician approval required"}
        </h1>
        <p className="ga-muted">
          {admin
            ? "This workspace is available only to authorized Admin and Super Admin accounts."
            : "Apply for technician access to publish services and manage provider work. Your customer bookings and existing records remain available."}
        </p>
        <Button to="/account-access">View account access</Button>
        <Button to="/booked-services" variant="ghost">
          My bookings
        </Button>
      </div>
    );
  return children;
};
export default CapabilityGate;
