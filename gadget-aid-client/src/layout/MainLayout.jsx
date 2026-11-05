import NotificationsProvider from "../provider/NotificationsProvider";
import { HelmetProvider } from "react-helmet-async";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const MainLayout = () => (
  <HelmetProvider>
    <NotificationsProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="ga-skip-link">
          Skip to content
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0">
          <Outlet />
        </main>
        <Footer />
      </div>
    </NotificationsProvider>
  </HelmetProvider>
);
export default MainLayout;
