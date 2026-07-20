import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useContext, useState } from "react";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { AuthContext } from "../provider/AuthProvider";
import { Helmet } from "react-helmet-async";

const Registration = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { createNewUser, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const auth = getAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const name = form.get("name");
    const photo = form.get("photo");
    const email = form.get("email");
    const password = form.get("password");

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.", {
        position: "top-center",
      });
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error("Password must contain at least one uppercase letter.", {
        position: "top-center",
      });
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error("Password must contain at least one lowercase letter.", {
        position: "top-center",
      });
      return;
    }

    createNewUser(email, password)
      .then((result) => {
        const user = result.user;
        return updateProfile(user, {
          displayName: name,
          photoURL: photo,
        })
          .then(() => signOut(auth))
          .then(() => {
            toast.success("Registration Successful! Please Login", {
              position: "top-center",
            });
            navigate("/login");
          });
      })
      .catch((error) => toast.error(error.message));
  };

  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        const user = result.user;
        setUser(user);
        toast.success("Successfully Logged in with Google!", {
          position: "top-center",
        });
        navigate("/");
      })
      .catch((error) => {
        toast.error("Login failed", { position: "top-center" });
        console.error(error.message);
      });
  };

  return (
    <>
      <Helmet>
        <title>Register || GadgetAid</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-300 to-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 border border-base-300 w-full max-w-md p-6 rounded-2xl shadow-xl">
          <h2 className="text-3xl font-bold text-center mb-4 text-base-content">
            REGISTER
          </h2>
          <p className="text-sm text-center text-base-content/70 mb-6">
            Power up your tech life with{" "}
            <span className="font-semibold text-primary">Gadget Aid</span> —
            your trusted hub for expert electronic repairs and digital
            solutions.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block mb-1 text-sm font-medium text-base-content/80">
                Name
              </label>
              <input
                name="name"
                type="text"
                className="input input-bordered w-full"
                placeholder="Enter your name"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block mb-1 text-sm font-medium text-base-content/80">
                Email
              </label>
              <input
                name="email"
                type="email"
                className="input input-bordered w-full"
                placeholder="Enter your email"
                required
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
            </div>

            {/* Photo URL */}
            <div>
              <label className="block mb-1 text-sm font-medium text-base-content/80">
                Photo URL
              </label>
              <input
                name="photo"
                type="text"
                className="input input-bordered w-full"
                placeholder="Paste photo URL"
                required
              />
            </div>

            {/* Register Button */}
            <button
              type="submit"
              className="btn btn-primary w-full rounded-full mt-6"
            >
              Register
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
            type="button"
            onClick={handleGoogleLogin}
            className="btn btn-outline w-full rounded-full hover:shadow-md"
          >
            <img
              src="https://img.icons8.com/?size=100&id=V5cGWnc9R4xj&format=png"
              alt="google-icon"
              className="w-5 h-5 mr-2"
            />
            Continue with Google
          </button>

          {/* Login Link */}
          <p className="text-sm text-center mt-4">
            Already have an account?
            <Link
              to="/login"
              className="text-primary font-semibold ml-1 hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default Registration;
