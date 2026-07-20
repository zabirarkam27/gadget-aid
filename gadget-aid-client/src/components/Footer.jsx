import { FaFacebook, FaLinkedin } from "react-icons/fa";
import { Link } from "react-router-dom";
import logo from "../../public/logo.png";

const Footer = () => {
  return (
    <footer className="footer p-10 sm:footer-horizontal text-base-content bg-base-200/70 backdrop-blur-xl border-t border-base-300 shadow-xl">
      {/* Section 1: Logo + Name */}
      <aside>
        <Link to="/" className="inline-flex items-center gap-2 mb-2">
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
        <p className="text-sm text-base-content/70">
          Reliable Electronic Repairing Services
        </p>
      </aside>

      {/* Section 2: Useful Links */}
      <nav>
        <header className="footer-title">Quick Links</header>
        <Link to="/" className="link link-hover">
          Home
        </Link>
        <Link to="/services" className="link link-hover">
          Services
        </Link>
        <Link to="/contact-us" className="link link-hover">
          Contact Us
        </Link>
      </nav>

      {/* Section 3: Social Icons */}
      <nav>
        <header className="footer-title">Follow Us</header>
        <div className="flex gap-4 text-xl">
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition"
            title="Facebook"
          >
            <FaFacebook />
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition"
            title="LinkedIn"
          >
            <FaLinkedin />
          </a>
        </div>
      </nav>
    </footer>
  );
};

export default Footer;
