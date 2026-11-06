import { useContext, useRef, useState } from "react";
import { AccessContext } from "../provider/AccessContext";
import { AuthContext } from "../provider/AuthContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
const labels = {
  super_admin: "Super Admin",
  admin: "Admin",
  technician: "Technician",
  public_visitor: "Customer access",
};
const AccountAccess = () => {
  const access = useContext(AccessContext),
    auth = useContext(AuthContext);
  const [name, setName] = useState(""),
    [statement, setStatement] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      await authFetch(`${API_URL}/technician-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: name,
          statement,
          expectedRevision: access.application?.revision || 0,
        }),
      }).then(readJson);
      setNotice("Your technician application was submitted for review.");
      access.refresh();
    } catch (error) {
      setError(error.message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  const verify = async () => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      await auth.sendVerificationEmail();
      setNotice(
        "Verification email requested. After verifying, sign out and sign in again to refresh account verification.",
      );
    } catch {
      setError(
        "Verification email could not be requested. Please try again later.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <DashboardLayout
      title="Account access"
      description="Your customer access, technician application and approved workspace permissions."
      action={
        <Button variant="outline" onClick={access.refresh}>
          Refresh access
        </Button>
      }
    >
      <div className="ga-surface p-6 space-y-5">
        <h2 className="text-xl font-semibold">
          {access.loading ? "Checking access…" : labels[access.role]}
        </h2>
        {access.error && (
          <p role="alert" className="text-error">
            {access.error}
          </p>
        )}
        <p className="ga-muted">
          Signed-in customers can book services, follow their repairs and review
          eligible completed work. Technician and administrator permissions
          require approval.
        </p>
        {access.restricted && (
          <p role="alert" className="text-warning">
            Your account is restricted. You can read your records, cancel an
            eligible booking and open a booking dispute.
          </p>
        )}
        {!access.emailVerified && (
          <div className="space-y-3">
            <p className="text-warning">
              A verified email is required before privileged access can be
              approved.
            </p>
            {auth.sendVerificationEmail && (
              <Button variant="outline" loading={saving} onClick={verify}>
                Request verification email
              </Button>
            )}
          </div>
        )}
        {access.publication?.state && (
          <p className="ga-muted">
            Profile publication: {access.publication.state.replaceAll("_", " ")}
            {access.publication.note ? ` — ${access.publication.note}` : ""}
          </p>
        )}
        {access.admin && <Button to="/admin">Open platform operations</Button>}
        {access.canProvide && (
          <Button to="/my-technician" variant="outline">
            Manage your technician profile
          </Button>
        )}
        {access.application && (
          <div className="border-t border-base-300 pt-4">
            <h3 className="font-semibold">
              Application: {access.application.state.replaceAll("_", " ")}
            </h3>
            {access.application.note && (
              <p className="mt-2 whitespace-pre-wrap break-words">
                {access.application.note}
              </p>
            )}
          </div>
        )}
        {!access.loading &&
          !access.error &&
          !access.canProvide &&
          !access.restricted &&
          access.application?.state !== "pending" && (
            <form onSubmit={submit}>
              <fieldset disabled={saving} className="space-y-4">
                <h3 className="font-semibold">Apply as a technician</h3>
                <FormField
                  label="Business or display name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <FormField
                  label="Your repair experience and services"
                  as="textarea"
                  required
                  minLength={20}
                  maxLength={2000}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  helper="Explain what you repair and where you work. Do not include passwords or identity documents."
                />
                <Button type="submit" loading={saving}>
                  Submit technician application
                </Button>
              </fieldset>
            </form>
          )}
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
      </div>
    </DashboardLayout>
  );
};
export default AccountAccess;
