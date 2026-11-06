import { useContext, useRef, useState } from "react";
import { AuthContext } from "../provider/AuthContext";
import Button from "./Button";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
export default function SaveTechnician({ serviceId }) {
  const { user } = useContext(AuthContext);
  return user ? (
    <Save key={`${user.uid}:${serviceId}`} serviceId={serviceId} />
  ) : (
    <Button to="/saved-technicians" variant="outline">
      Sign in to save technicians
    </Button>
  );
}
function Save({ serviceId }) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await authFetch(`${API_URL}/saved-technicians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      }).then(readJson);
      setNotice("Technician saved to your private list.");
    } catch (f) {
      setError(f.message || "The technician could not be saved.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={!serviceId}
        loading={busy}
        onClick={save}
      >
        Save technician
      </Button>
      {notice && (
        <p role="status" className="text-sm">
          {notice}{" "}
          <Button to="/saved-technicians" variant="ghost" size="sm">
            View saved
          </Button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
