import { useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../src/provider/AuthContext";
import { returnPath } from "../../src/utils/authFeedback";
import AuthShell from "../../src/components/ui/AuthShell";
import FormField from "../../src/components/ui/FormField";
import PasswordField from "../../src/components/ui/PasswordField";
import Button from "../../src/components/Button";

export default function DemoLogin() {
  const { login } = useContext(AuthContext);
  const location = useLocation(),
    navigate = useNavigate();
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await login(form.get("email"), form.get("password"));
      navigate(location.state?.from ? returnPath(location.state) : "/admin", {
        replace: true,
      });
    } catch {
      setError("The demo email or password is incorrect.");
    }
  };
  return (
    <AuthShell
      title="Demo login"
      description="Isolated local demo only. Use the demo credentials from README. Never enter real account credentials here."
    >
      <form className="space-y-5" onSubmit={submit}>
        <FormField
          label="Demo email"
          name="email"
          type="email"
          autoComplete="off"
          required
        />
        <PasswordField name="password" autoComplete="off" required />
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full">
          Log in to demo
        </Button>
      </form>
    </AuthShell>
  );
}
