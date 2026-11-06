import { Suspense, useContext } from "react";
import AccessProvider from "../provider/AccessProvider";
import { AccessContext } from "../provider/AccessContext";
import NotificationsProvider from "../provider/NotificationsProvider";
import { HelmetProvider } from "react-helmet-async";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const RestrictionNotice = () => {
  const access = useContext(AccessContext);
  return access.restricted ? (
    <p
      className="bg-warning/15 text-warning ga-container py-3 text-sm"
      role="status"
    >
      Your account is restricted. Existing records, eligible booking
      cancellation and booking support remain available.
    </p>
  ) : null;
};
const MainLayout = () => (
  <HelmetProvider>
    <AccessProvider>
      <NotificationsProvider>
        <div className="flex min-h-screen flex-col">
          <a href="#main-content" className="ga-skip-link">
            Skip to content
          </a>
          <Navbar />
          <RestrictionNotice />
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0">
            <Suspense fallback={<div className="ga-container ga-section" role="status">Loading page...</div>}><Outlet /></Suspense>
          </main>
          <Footer />
        </div>
      </NotificationsProvider>
    </AccessProvider>
  </HelmetProvider>
);
export default MainLayout;
