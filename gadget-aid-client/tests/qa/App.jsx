import CapabilityGate from "../../src/router/CapabilityGate";
import RepairAssistant from "../../src/pages/RepairAssistant";
import RepairCalculator from "../../src/pages/RepairCalculator";
import RepairEstimate from "../../src/pages/RepairEstimate";
import CompareServices from "../../src/pages/CompareServices";
import SavedTechnicians from "../../src/pages/SavedTechnicians";
import Recycling from "../../src/pages/Recycling";
import RepairGallery from "../../src/pages/RepairGallery";
import GalleryModeration from "../../src/pages/GalleryModeration";
import LoyaltyPolicy from "../../src/pages/LoyaltyPolicy";
import LoyaltyWallet from "../../src/pages/LoyaltyWallet";
import DemoLogin from "./DemoLogin";
import AccountSecurity from "../../src/pages/AccountSecurity";
import Devices from "../../src/pages/Devices";
import {
  createSecurityActions,
  passwordProblem,
} from "../../src/utils/accountSecurity";
import AdminWorkspace from "../../src/pages/AdminWorkspace";
import AccountAccess from "../../src/pages/AccountAccess";
import MyDisputes from "../../src/pages/MyDisputes";
import TechnicianProfile from "../../src/pages/TechnicianProfile";
import TechnicianSettings from "../../src/pages/TechnicianSettings";
import Notifications from "../../src/pages/Notifications";
import RepairDetails from "../../src/pages/RepairDetails";
import { useState } from "react";

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "../../src/index.css";
import { AuthContext } from "../../src/provider/AuthContext";

import MainLayout from "../../src/layout/MainLayout";
import PrivateRoutes from "../../src/router/PrivateRoutes";
import Home from "../../src/pages/Home";
import Services from "../../src/components/Services";
import ServiceDetails from "../../src/components/ServiceDetails";
import BookedServices from "../../src/pages/BookedServices";
import ServiceToDo from "../../src/pages/ServiceToDo";
import AddService from "../../src/pages/AddService";
import ManageService from "../../src/pages/ManageService";
import ErrorPage from "../../src/pages/Error";
import ContactUs from "../../src/pages/ContactUs";
import {
  setFixtureIdentity,
  getFixtureUser,
  setFixtureOffline,
  fixtureLogin,
} from "./state";
const protectedPage = (page) => <PrivateRoutes>{page}</PrivateRoutes>;
const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      {path:"repair-calculator",element:<RepairCalculator/>},
      {path:"repair-estimate",element:<RepairEstimate/>},
      {path:"compare-services",element:<CompareServices/>},
      {path:"recycling",element:<Recycling/>},
      {path:"repair-gallery",element:<RepairGallery/>},
      {path:"loyalty-policy",element:<LoyaltyPolicy/>},
      {path:"loyalty",element:protectedPage(<LoyaltyWallet/>)},
      {path:"saved-technicians",element:protectedPage(<SavedTechnicians/>)},
      {path:"admin/gallery",element:protectedPage(<CapabilityGate admin><GalleryModeration/></CapabilityGate>)},
      { path: "repair-assistant", element: protectedPage(<RepairAssistant />) },
      {
        path: "devices",
        element: protectedPage(<Devices key="device-list" />),
      },
      {
        path: "devices/:id",
        element: protectedPage(<Devices key="device-detail" />),
      },
      { path: "account-security", element: protectedPage(<AccountSecurity />) },
      {
        path: "admin",
        element: protectedPage(
          <CapabilityGate admin>
            <AdminWorkspace />
          </CapabilityGate>,
        ),
      },
      { path: "account-access", element: protectedPage(<AccountAccess />) },
      { path: "my-disputes", element: protectedPage(<MyDisputes />) },
      { path: "technicians/:id", element: <TechnicianProfile /> },
      {
        path: "my-technician",
        element: protectedPage(
          <CapabilityGate>
            <TechnicianSettings />
          </CapabilityGate>,
        ),
      },
      { path: "notifications", element: protectedPage(<Notifications />) },
      { path: "bookings/:id", element: protectedPage(<RepairDetails />) },
      { index: true, element: <Home /> },
      { path: "services", element: <Services /> },
      { path: "services/:id", element: protectedPage(<ServiceDetails />) },
      { path: "booked-services", element: protectedPage(<BookedServices />) },
      { path: "service-to-do", element: protectedPage(<ServiceToDo />) },
      { path: "manage-services", element: protectedPage(<ManageService />) },
      {
        path: "add-service",
        element: protectedPage(
          <CapabilityGate>
            <AddService />
          </CapabilityGate>,
        ),
      },
      { path: "contact-us", element: <ContactUs /> },
      {
        path: "login",
        element: <DemoLogin />,
      },
    ],
  },
]);
const QA = () => {
  const [user, setUser] = useState(getFixtureUser);
  const [offline, setOffline] = useState(false);
  const choose = (value) => {
    setFixtureIdentity(value);
    setUser(getFixtureUser());
  };
  const security = createSecurityActions({
    getUser: getFixtureUser,
    validatePassword: async (value) => !passwordProblem(value),
    reauthenticatePassword: async (u, password) => {
      if (password !== "GadgetAidDemo123!")
        throw Object.assign(Error("Invalid demo password"), {
          code: "auth/invalid-credential",
        });
    },
    reauthenticateGoogle: async () => {
      throw Error("Google popup is unavailable in isolated QA");
    },
    updatePassword: async () => {},
    linkPassword: async () => {},
    linkGoogle: async () => {
      throw Object.assign(Error("Real Google is unavailable in isolated QA"), {
        code: "auth/popup-closed-by-user",
      });
    },
    reload: async () => {},
    signOut: async () => choose(""),
  });
  return (
    <AuthContext.Provider
      value={{
        user,
        security,
        loading: false,
        setUser,
        logOut: async () => choose(""),
        login: async (email, password) => {
          const result = fixtureLogin(email, password);
          setUser(result.user);
          return result;
        },
      }}
    >
      <div className="bg-warning text-warning-content px-4 py-3 text-sm flex flex-wrap gap-4 items-center">
        <strong>ISOLATED QA · Demo data only</strong>
        <label>
          Demo session{" "}
          <select
            aria-label="Demo session"
            className="border rounded px-2 py-1"
            value={user ? user.uid.replace("qa-", "") : ""}
            onChange={(event) => choose(event.target.value)}
          >
            <option value="customer">Customer</option>
            <option value="provider">Provider</option>
            <option value="other">Other technician</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
            <option value="">Signed out</option>
          </select>
        </label>
        <label className="inline-flex gap-2 items-center">
          <input
            type="checkbox"
            checked={offline}
            onChange={(event) => {
              setOffline(event.target.checked);
              setFixtureOffline(event.target.checked);
            }}
          />
          Simulate offline requests
        </label>
        <span>No real Firebase tokens or MongoDB connections.</span>
      </div>
      <ToastContainer />
      <RouterProvider router={router} />
    </AuthContext.Provider>
  );
};

export default QA;
