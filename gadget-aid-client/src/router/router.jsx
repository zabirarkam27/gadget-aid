import TechnicianProfile from "../pages/TechnicianProfile";
import TechnicianSettings from "../pages/TechnicianSettings";
import Notifications from "../pages/Notifications";
import RepairDetails from "../pages/RepairDetails";
import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Registration from "../pages/Registration";
import AddService from "../pages/AddService";
import BookedServices from "../pages/BookedServices";
import ServiceToDo from "../pages/ServiceToDo";
import Services from "./../components/Services";
import ServiceDetails from "./../components/ServiceDetails";
import ManageService from "./../pages/ManageService";
import PrivateRoutes from "./PrivateRoutes";
import Error from "../pages/Error";
import ContactUs from "../pages/ContactUs";
import ForgotPassword from "../pages/ForgotPassword";

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <Error />,
    children: [
      {path:"/technicians/:id",element:<TechnicianProfile />},
      {path:"/my-technician",element:<PrivateRoutes><TechnicianSettings /></PrivateRoutes>},
      {path:"/notifications",element:<PrivateRoutes><Notifications /></PrivateRoutes>},
      {path:"/bookings/:id",element:<PrivateRoutes><RepairDetails /></PrivateRoutes>},
      { path: "/forgot-password", element: <ForgotPassword /> },
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/register",
        element: <Registration />,
      },
      {
        path: "/services",
        element: <Services />,
      },
      {
        path: "/services/:id",
        element: (
          <PrivateRoutes>
            <ServiceDetails />
          </PrivateRoutes>
        ),
      },
      {
        path: "/add-service",
        element: (
          <PrivateRoutes>
            <AddService />
          </PrivateRoutes>
        ),
      },
      {
        path: "/manage-services",
        element: (
          <PrivateRoutes>
            <ManageService />
          </PrivateRoutes>
        ),
      },
      {
        path: "/booked-services",
        element: (
          <PrivateRoutes>
            <BookedServices />
          </PrivateRoutes>
        ),
      },
      {
        path: "/service-to-do",
        element: (
          <PrivateRoutes>
            <ServiceToDo />
          </PrivateRoutes>
        ),
      },
      {
        path: "/contact-us",
        element: <ContactUs />,
      },
    ],
  },
]);

export default router;
