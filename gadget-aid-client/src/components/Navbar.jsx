import { useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../../public/logo.png";
import ThemeChanger from "./ThemeChanger";
import { AuthContext } from "../provider/AuthProvider";

const Navbar = () => {
  const { user, logOut } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogOut = () => {
    logOut()
      .then(() => {
        navigate("/");
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const links = (
    <>
      <li>
        <NavLink to="/" className="hover:text-primary">
          Home
        </NavLink>
      </li>
      <li>
        <NavLink to="/services" className="hover:text-primary">
          Services
        </NavLink>
      </li>
      {user && (
        <li>
          <details>
            <summary className="hover:text-primary">Dashboard</summary>
            <ul className="p-2 bg-base-100 z-[2] w-48 rounded-box shadow space-y-1">
              <li>
                <NavLink to="/add-service" className="hover:text-primary">
                  Add Service
                </NavLink>
              </li>
              <li>
                <NavLink to="/manage-services" className="hover:text-primary">
                  Manage Service
                </NavLink>
              </li>
              <li>
                <NavLink to="/booked-services" className="hover:text-primary">
                  Booked Services
                </NavLink>
              </li>
              <li>
                <NavLink to="/service-to-do" className="hover:text-primary">
                  Service-To-Do
                </NavLink>
              </li>
            </ul>
          </details>
        </li>
      )}
    </>
  );

  return (
    <div className="sticky top-0 z-50 w-full px-2 md:px-4 backdrop-blur-lg bg-base-100/70 shadow-md border-b border-base-300/60">
      <div className="navbar md:container md:mx-auto md:max-w-screen-xl">
        {/* Left: Logo + Hamburger */}
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[5] p-2 shadow bg-base-100 rounded-box w-52"
            >
              {links}
              <ThemeChanger className="block lg:hidden" />
            </ul>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center md:justify-start gap-2"
          >
            <img
              src={logo}
              alt="Gadget Aid Logo"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-xl font-bold tracking-wide">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Gadget
              </span>
              <span className="text-base-content">Aid</span>
            </span>
          </Link>
        </div>

        {/* Center: Menu links for desktop */}
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1 space-x-1">{links}</ul>
        </div>

        {/* Right: Theme + Auth */}
        <div className="navbar-end gap-2 md:gap-4">
          <div className="hidden lg:block">
            <ThemeChanger />
          </div>
          {user?.email ? (
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost rounded-full w-10 p-0"
              >
                <img
                  className="rounded-full w-8 h-8 object-cover"
                  src={user?.photoURL}
                  title={user?.displayName}
                  alt={user?.displayName}
                />
              </div>
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content bg-base-100 rounded-box mt-3 w-40 p-2 shadow z-[5]"
              >
                <li>
                  <button
                    onClick={handleLogOut}
                    className="btn btn-sm btn-ghost w-full text-sm"
                  >
                    Log Out
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm rounded-lg">
                Login
              </Link>
              <Link
                to="/register"
                className="btn btn-primary btn-sm rounded-lg"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
