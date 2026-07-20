import { useContext } from "react";
import { AuthContext } from "../provider/AuthProvider";
import { Navigate, useLocation } from "react-router-dom";

const PrivateRoutes = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return <span className="loading loading-ring loading-lg"></span>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ form: location }} replace />;
  }

  return children;
};

export default PrivateRoutes;
