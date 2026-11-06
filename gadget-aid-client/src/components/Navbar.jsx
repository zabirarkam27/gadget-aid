import { AccessContext } from "../provider/AccessContext";
import { NotificationsContext } from "../provider/NotificationsContext";
import { useContext, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FiMenu,
  FiArrowUpRight,
  FiLogOut,
  FiChevronDown,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { AuthContext } from "../provider/AuthContext";
import ThemeChanger from "./ThemeChanger";
import Button from "./Button";
import Brand from "./ui/Brand";
import Avatar from "./ui/Avatar";

const publicLinks = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/contact-us", "Contact"],
];
const accountLinks = [
  ["/devices", "My devices"],
  ["/account-security", "Account security"],
  ["/account-access", "Account access"],
  ["/my-disputes", "My support requests"],
  ["/my-technician", "Technician profile"],
  ["/notifications", "Notifications"],
  ["/booked-services", "My bookings"],
  ["/add-service", "Add a service"],
  ["/manage-services", "My services"],
  ["/service-to-do", "Work queue"],
];
const navClass = ({ isActive }) =>
  `ga-nav-link ${isActive ? "ga-nav-active" : ""}`;

const Navbar = () => {
  const { user, logOut } = useContext(AuthContext);
  const access = useContext(AccessContext);
  const accountItems = [
    ...(access.admin ? [["/admin", "Platform operations"]] : []),
    ...accountLinks.filter(([path]) =>
      ["/my-technician", "/add-service"].includes(path)
        ? access.canProvide
        : ["/service-to-do", "/manage-services"].includes(path)
          ? access.canProvide || access.hasProviderHistory
          : true,
    ),
  ];
  const notifications = useContext(NotificationsContext);
  const [signingOut, setSigningOut] = useState(false);
  const headerRef = useRef(null);
  const navigate = useNavigate();
  const closeMenus = () =>
    headerRef.current?.querySelectorAll("details[open]").forEach((menu) => {
      menu.open = false;
    });

  useEffect(() => {
    const dismiss = (event) => {
      if (!headerRef.current?.contains(event.target)) closeMenus();
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  const logout = async () => {
    setSigningOut(true);
    try {
      await logOut();
      closeMenus();
      navigate("/");
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };
  const links = (items) =>
    items.map(([to, label]) => (
      <NavLink
        key={to}
        to={to}
        end={to === "/"}
        className={navClass}
        onClick={closeMenus}
      >
        {label}
      </NavLink>
    ));

  return (
    <header
      ref={headerRef}
      className="ga-header"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          const menu = event.target.closest("details[open]");
          closeMenus();
          menu?.querySelector("summary")?.focus();
        }
      }}
    >
      <div className="ga-container flex h-20 items-center justify-between gap-3">
        <Brand />
        <nav
          aria-label="Main navigation"
          className="hidden lg:flex items-center gap-1"
        >
          {links(publicLinks)}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ThemeChanger />
          </div>
          {user && (
            <NavLink
              to="/notifications"
              className="ga-nav-link text-sm"
              aria-label={`Notifications (${notifications?.unreadCount || 0} unread, ${notifications?.unreadMessages || 0} unread messages)`}
            >
              Alerts
              {notifications?.unreadCount > 0 && (
                <span className="badge badge-primary badge-sm ml-1">
                  {notifications.unreadCount}
                </span>
              )}
              {notifications?.unreadMessages > 0 && (
                <span className="badge badge-outline badge-sm ml-1">
                  {notifications.unreadMessages} msg
                </span>
              )}
            </NavLink>
          )}
          {user ? (
            <details className="relative hidden lg:block">
              <summary className="ga-account-trigger">
                <Avatar
                  src={user.photoURL}
                  name={user.displayName || "Your account"}
                  className="h-8 w-8"
                />
                <span>My account</span>
                <FiChevronDown aria-hidden="true" />
              </summary>
              <div className="ga-nav-panel right-0 w-64">
                <p className="px-3 py-2 font-semibold truncate">
                  {user.displayName || "Your account"}
                </p>
                <nav aria-label="Account navigation" className="grid gap-1">
                  {links(accountItems)}
                </nav>
                <Button
                  variant="ghost"
                  className="mt-3 w-full justify-start"
                  onClick={logout}
                  loading={signingOut}
                >
                  <FiLogOut aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </details>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Button to="/login" variant="ghost">
                Log in
              </Button>
              <Button to="/register">
                Get started <FiArrowUpRight aria-hidden="true" />
              </Button>
            </div>
          )}
          <details className="lg:hidden">
            <summary className="ga-menu-trigger" aria-label="Open navigation">
              <FiMenu size={22} aria-hidden="true" />
            </summary>
            <div className="ga-nav-panel left-4 right-4 max-h-[calc(100dvh-7rem)] overflow-y-auto">
              <nav aria-label="Mobile navigation" className="grid gap-1">
                {links(publicLinks)}
              </nav>
              {user && (
                <>
                  <p className="ga-eyebrow px-3 mt-5 mb-2">Your workspace</p>
                  <nav
                    aria-label="Mobile account navigation"
                    className="grid gap-1"
                  >
                    {links(accountItems)}
                  </nav>
                </>
              )}
              <div className="mt-4 border-t border-base-300 pt-4 flex flex-wrap items-center gap-3">
                <ThemeChanger />
                {user ? (
                  <Button variant="ghost" onClick={logout} loading={signingOut}>
                    Sign out
                  </Button>
                ) : (
                  <>
                    <Button to="/login" variant="outline" onClick={closeMenus}>
                      Log in
                    </Button>
                    <Button to="/register" onClick={closeMenus}>
                      Get started
                    </Button>
                  </>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
};
export default Navbar;
