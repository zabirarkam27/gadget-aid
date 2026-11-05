import { Fragment, useContext } from "react";
import { AuthContext } from "../provider/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const PrivateRoutes = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return <div role="status" className="ga-container ga-section"><span className="sr-only">Checking your account</span><span className="loading loading-ring loading-lg" aria-hidden="true" /></div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Fragment key={user.uid || user.email}>{children}</Fragment>;
};

export default PrivateRoutes;
