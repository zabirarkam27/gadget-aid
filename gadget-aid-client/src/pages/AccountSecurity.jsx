import { useContext, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../provider/AuthContext";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PasswordField from "../components/ui/PasswordField";
import Button from "../components/Button";
import { authMessage } from "../utils/authFeedback";
import { passwordHint } from "../utils/accountSecurity";

export default function AccountSecurity() {
  const { user, security } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pending, setPending] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [completed, setCompleted] = useState(false),
    [version, setVersion] = useState(0);
  const lock = useRef(false),
    passwordForm = useRef(null),
    googleForm = useRef(null);
  const hasPassword = user?.providerData?.some(
      (p) => p.providerId === "password",
    ),
    hasGoogle = user?.providerData?.some((p) => p.providerId === "google.com");
  const run = async (event, kind) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(kind);
    setError("");
    setNotice("");
    const values = new FormData(event.currentTarget);
    try {
      if (kind === "password") {
        const result = await security.changePassword({
          currentPassword: values.get("currentPassword") || "",
          newPassword: values.get("newPassword"),
          confirmation: values.get("confirmation"),
        });
        setCompleted(true);
        setNotice(
          result.signedOut
            ? "Password saved. Sign in again with your new password."
            : "Password saved. Sign out now, then sign in with your new password.",
        );
        if (result.signedOut)
          navigate("/login", {
            replace: true,
            state: {
              securityNotice: "Password saved. Sign in with your new password.",
            },
          });
      } else {
        await security.linkGoogle({
          currentPassword: values.get("currentPassword") || "",
        });
        setVersion((v) => v + 1);
        setNotice(
          "Google sign-in is linked to this same account. Your existing role is preserved.",
        );
      }
    } catch (failure) {
      setError(authMessage(failure));
    } finally {
      passwordForm.current?.reset();
      googleForm.current?.reset();
      lock.current = false;
      setPending("");
    }
  };
  return (
    <DashboardLayout
      title="Account security"
      description="Manage your password and sign-in methods. Changes require you to verify your identity again."
    >
      <div className="max-w-2xl space-y-6" key={version}>
        <section className="ga-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Sign-in methods</h2>
          <p className="break-words">{user?.email}</p>
          <p className="ga-muted">
            Email/password: {hasPassword ? "Connected" : "Not connected"} ·
            Google: {hasGoogle ? "Connected" : "Not connected"}
          </p>
        </section>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-success">
            {notice}
          </p>
        )}
        {completed ? (
          <Button to="/login">Continue to login</Button>
        ) : (
          <>
            <section className="ga-surface p-6 space-y-5">
              <h2 className="text-xl font-semibold">
                {hasPassword ? "Change password" : "Add a password"}
              </h2>
              <p className="ga-muted">
                {hasPassword
                  ? "Confirm your current password before changing it."
                  : "Verify with your linked Google account to add email/password login."}{" "}
                After saving, sign in again. Firebase revokes earlier sessions;
                private APIs check revocation on each request.
              </p>
              <form
                ref={passwordForm}
                className="space-y-5"
                onSubmit={(event) => run(event, "password")}
              >
                <fieldset
                  disabled={!!pending || !security}
                  className="space-y-5"
                >
                  {hasPassword && (
                    <PasswordField
                      label="Current password"
                      name="currentPassword"
                      autoComplete="current-password"
                      required
                    />
                  )}
                  <PasswordField
                    label="New password"
                    name="newPassword"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    helper={passwordHint}
                  />
                  <PasswordField
                    label="Confirm new password"
                    name="confirmation"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                  />
                  <Button type="submit" loading={pending === "password"}>
                    {hasPassword
                      ? "Save new password"
                      : "Verify Google and add password"}
                  </Button>
                </fieldset>
              </form>
            </section>
            {!hasGoogle && (
              <section className="ga-surface p-6 space-y-5">
                <h2 className="text-xl font-semibold">Connect Google</h2>
                <p className="ga-muted">
                  Connect a Google account you control so both sign-in methods
                  open this same GadgetAid account. If Google is already linked
                  to a different account, no accounts or roles are merged
                  automatically.
                </p>
                <form
                  ref={googleForm}
                  className="space-y-5"
                  onSubmit={(event) => run(event, "google")}
                >
                  <fieldset
                    disabled={!!pending || !security}
                    className="space-y-5"
                  >
                    {hasPassword && (
                      <PasswordField
                        label="Current password to connect Google"
                        name="currentPassword"
                        autoComplete="current-password"
                        required
                      />
                    )}
                    <Button
                      type="submit"
                      variant="outline"
                      loading={pending === "google"}
                    >
                      Verify identity and connect Google
                    </Button>
                  </fieldset>
                </form>
              </section>
            )}
          </>
        )}
        <p className="ga-muted">
          Forgot your password?{" "}
          <Link
            className="text-primary ga-text-link"
            to="/forgot-password"
            state={{ email: user?.email }}
          >
            Request a Firebase reset link
          </Link>
          . Enter passwords only in the app or the Firebase reset page.
        </p>
      </div>
    </DashboardLayout>
  );
}
