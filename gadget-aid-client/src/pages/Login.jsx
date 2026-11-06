import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useRef, useState } from "react";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { Helmet } from "react-helmet-async";
import { AuthContext } from "../provider/AuthContext";
import { authMessage, returnPath } from "../utils/authFeedback";
import Button from "../components/Button";
import AuthShell from "../components/ui/AuthShell";
import FormField from "../components/ui/FormField";
import PasswordField from "../components/ui/PasswordField";

const Login = () => {
  const { login, setUser } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || "");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const authenticate = async (kind, operation) => {
    if (lock.current) return;
    lock.current = true;
    setPending(kind);
    setError("");
    try {
      const result = await operation();
      setUser(result.user);
      navigate(returnPath(location.state), { replace: true });
    } catch (failure) {
      setError(authMessage(failure));
    } finally {
      lock.current = false;
      setPending("");
    }
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    authenticate("email", () => login(email.trim(), form.get("password")));
  };
  return (
    <>
      <Helmet>
        <title>Log in | GadgetAid</title>
      </Helmet>
      <AuthShell
        title="Welcome back."
        description="Log in to manage your services and repair bookings."
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {location.state?.securityNotice && (
            <p role="status" className="text-success">
              {location.state.securityNotice}
            </p>
          )}
          <FormField
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!!pending}
            placeholder="you@example.com"
          />
          <PasswordField
            name="password"
            autoComplete="current-password"
            required
            disabled={!!pending}
          />
          <div className="text-right">
            <Link
              to="/forgot-password"
              state={{ email }}
              className="text-primary text-sm ga-text-link"
            >
              Forgot password?
            </Link>
          </div>
          {error && (
            <p role="alert" className="text-error text-sm">
              {error}
            </p>
          )}
          <Button
            type="submit"
            loading={pending === "email"}
            disabled={!!pending}
            className="w-full"
          >
            {pending === "email" ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <div className="flex items-center gap-4 my-6 ga-muted text-xs">
          <span className="h-px bg-base-300 flex-1" />
          OR
          <span className="h-px bg-base-300 flex-1" />
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={!!pending}
          loading={pending === "google"}
          onClick={() =>
            authenticate("google", () =>
              signInWithPopup(getAuth(), new GoogleAuthProvider()),
            )
          }
        >
          <FcGoogle size={20} aria-hidden="true" />
          Continue with Google
        </Button>
        <p className="ga-muted text-sm text-center mt-6">
          New to GadgetAid?{" "}
          <Link
            to="/register"
            state={location.state}
            className="text-primary ga-text-link"
          >
            Create an account
          </Link>
        </p>
      </AuthShell>
    </>
  );
};
export default Login;
