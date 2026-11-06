import { lazy } from "react";
const RepairAssistant = lazy(() => import("../pages/RepairAssistant"));
const RepairCalculator = lazy(() => import("../pages/RepairCalculator"));
const RepairEstimate = lazy(() => import("../pages/RepairEstimate"));
const CompareServices = lazy(() => import("../pages/CompareServices"));
const SavedTechnicians = lazy(() => import("../pages/SavedTechnicians"));
const Recycling = lazy(() => import("../pages/Recycling"));
const RepairGallery = lazy(() => import("../pages/RepairGallery"));
const GalleryModeration = lazy(() => import("../pages/GalleryModeration"));
const LoyaltyPolicy = lazy(() => import("../pages/LoyaltyPolicy"));
const LoyaltyWallet = lazy(() => import("../pages/LoyaltyWallet"));
import CapabilityGate from "../router/CapabilityGate";
const AdminWorkspace = lazy(() => import("../pages/AdminWorkspace"));
const AccountAccess = lazy(() => import("../pages/AccountAccess"));
const AccountSecurity = lazy(() => import("../pages/AccountSecurity"));
const Devices = lazy(() => import("../pages/Devices"));
const MyDisputes = lazy(() => import("../pages/MyDisputes"));
const TechnicianProfile = lazy(() => import("../pages/TechnicianProfile"));
const TechnicianSettings = lazy(() => import("../pages/TechnicianSettings"));
const Notifications = lazy(() => import("../pages/Notifications"));
const RepairDetails = lazy(() => import("../pages/RepairDetails"));
import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
const Home = lazy(() => import("../pages/Home"));
const Login = lazy(() => import("../pages/Login"));
const Registration = lazy(() => import("../pages/Registration"));
const AddService = lazy(() => import("../pages/AddService"));
const BookedServices = lazy(() => import("../pages/BookedServices"));
const ServiceToDo = lazy(() => import("../pages/ServiceToDo"));
const Services = lazy(() => import("./../components/Services"));
const ServiceDetails = lazy(() => import("./../components/ServiceDetails"));
const ManageService = lazy(() => import("./../pages/ManageService"));
import PrivateRoutes from "./PrivateRoutes";
import Error from "../pages/Error";
const ContactUs = lazy(() => import("../pages/ContactUs"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <Error />,
    children: [
      {path:"/repair-calculator",element:<RepairCalculator/>},
      {path:"/repair-estimate",element:<RepairEstimate/>},
      {path:"/compare-services",element:<CompareServices/>},
      {path:"/recycling",element:<Recycling/>},
      {path:"/repair-gallery",element:<RepairGallery/>},
      {path:"/loyalty-policy",element:<LoyaltyPolicy/>},
      {path:"/loyalty",element:<PrivateRoutes><LoyaltyWallet/></PrivateRoutes>},
      {path:"/saved-technicians",element:<PrivateRoutes><SavedTechnicians/></PrivateRoutes>},
      {path:"/admin/gallery",element:<PrivateRoutes><CapabilityGate admin><GalleryModeration/></CapabilityGate></PrivateRoutes>},
      { path: "/repair-assistant", element: <PrivateRoutes><RepairAssistant /></PrivateRoutes> },
      {
        path: "/devices",
        element: (
          <PrivateRoutes>
            <Devices key="device-list" />
          </PrivateRoutes>
        ),
      },
      {
        path: "/devices/:id",
        element: (
          <PrivateRoutes>
            <Devices key="device-detail" />
          </PrivateRoutes>
        ),
      },
      {
        path: "/account-security",
        element: (
          <PrivateRoutes>
            <AccountSecurity />
          </PrivateRoutes>
        ),
      },
      {
        path: "/admin",
        element: (
          <PrivateRoutes>
            <CapabilityGate admin>
              <AdminWorkspace />
            </CapabilityGate>
          </PrivateRoutes>
        ),
      },
      {
        path: "/account-access",
        element: (
          <PrivateRoutes>
            <AccountAccess />
          </PrivateRoutes>
        ),
      },
      {
        path: "/my-disputes",
        element: (
          <PrivateRoutes>
            <MyDisputes />
          </PrivateRoutes>
        ),
      },
      { path: "/technicians/:id", element: <TechnicianProfile /> },
      {
        path: "/my-technician",
        element: (
          <PrivateRoutes>
            <CapabilityGate>
              <TechnicianSettings />
            </CapabilityGate>
          </PrivateRoutes>
        ),
      },
      {
        path: "/notifications",
        element: (
          <PrivateRoutes>
            <Notifications />
          </PrivateRoutes>
        ),
      },
      {
        path: "/bookings/:id",
        element: (
          <PrivateRoutes>
            <RepairDetails />
          </PrivateRoutes>
        ),
      },
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
            <CapabilityGate>
              <AddService />
            </CapabilityGate>
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
