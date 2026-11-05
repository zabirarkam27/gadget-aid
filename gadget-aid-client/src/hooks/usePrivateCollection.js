import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../provider/AuthProvider";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";

const usePrivateCollection = (path) => {
  const { user } = useContext(AuthContext);
  const owner = user?.uid || user?.email || "";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ owner: "", data: [], loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ owner, data: [], loading: !!owner, error: owner ? "" : "Please log in to view this workspace." });
    if (owner) {
      authFetch(`${API_URL}${path}`, { signal: controller.signal }).then(readJson).then(data => {
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        if (!controller.signal.aborted) setState({ owner, data, loading: false, error: "" });
      }).catch(error => {
        if (!controller.signal.aborted) setState({ owner, data: [], loading: false, error: error.status === 401 ? "Your session has expired. Log in again to continue." : "This workspace could not be loaded. Please try again." });
      });
    }
    return () => controller.abort();
  }, [owner, path, attempt]);
  const visible = state.owner === owner ? state : { data: [], loading: true, error: "" };
  const setData = update => setState(previous => previous.owner === owner ? { ...previous, data: typeof update === "function" ? update(previous.data) : update } : previous);
  return { ...visible, setData, retry: () => setAttempt(value => value + 1) };
};
export default usePrivateCollection;
