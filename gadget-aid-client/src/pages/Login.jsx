import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { AuthContext } from "../provider/AuthProvider";
import { Helmet } from "react-helmet-async";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");

  const { login, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  const from = location.state?.from?.pathname || "/";

  // Email/Password Login
  const handleLogin = (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;

    // Password validation
    if (password.length < 6) {
      return toast.error("Password must be at least 6 characters long.");
    }
    if (!/[A-Z]/.test(password)) {
      return toast.error(
        "Password must contain at least one uppercase letter."
      );
    }
    if (!/[a-z]/.test(password)) {
      return toast.error(
        "Password must contain at least one lowercase letter."
      );
    }

    login(email, password)
      .then((result) => {
        setUser(result.user);
        toast.success("Login Successful!");
        navigate(from, { replace: true });
      })
      .catch(() => {
        toast.error("Login Failed! Please check your credentials.");
      });
  };

  // Google Login
  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        setUser(result.user);
        toast.success("Successfully Logged in with Google!");
        navigate(from, { replace: true });
      })
      .catch(() => {
        toast.error("Google login failed.");
      });
  };

  return (
    <>
      <Helmet>
        <title>Login || GadgetAid</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-300 to-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 border border-base-300 w-full max-w-md p-6 rounded-2xl shadow-xl">
          <h2 className="text-3xl font-bold text-center mb-4 text-base-content">
            Welcome Back
          </h2>
          <p className="text-sm text-center text-base-content/70 mb-6">
            Login to manage your services and stay connected.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block mb-1 text-sm font-medium text-base-content/80">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full"
                placeholder="Enter your email"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <label className="block mb-1 text-sm font-medium text-base-content/80">
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                className="input input-bordered w-full pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-base-content/60"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
              <div className="text-right mt-1">
                <Link
                  to="/forgot-password"
                  state={{ email }}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="btn btn-primary w-full rounded-full transition"
            >
              Login
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="border-t flex-grow border-base-300"></div>
            <span className="mx-3 text-sm text-base-content/40">OR</span>
            <div className="border-t flex-grow border-base-300"></div>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            className="btn btn-outline w-full rounded-full transition flex items-center justify-center gap-2"
          >
            <img
              className="w-5 h-5"
              src="https://img.icons8.com/color/48/google-logo.png"
              alt="Google Icon"
            />
            Login with Google
          </button>

          {/* Register Link */}
          <p className="text-center text-sm mt-6">
            Don't have an account?
            <Link to="/register" className="text-primary ml-1 hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;
