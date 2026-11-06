import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { AccessContext } from "./AccessContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
const empty = {
  role: "public_visitor",
  admin: false,
  superAdmin: false,
  canProvide: false,
  hasProviderHistory: false,
  restricted: false,
  emailVerified: false,
  application: null,
  publication: null,
};
const AccessProvider = ({ children }) => {
  const { user } = useContext(AuthContext),
    owner = user?.uid || "";
  const [attempt, setAttempt] = useState(0),
    [state, setState] = useState({
      owner: "",
      ...empty,
      loading: false,
      error: "",
    });
  const refresh = useCallback(() => setAttempt((v) => v + 1), []);
  useEffect(() => {
    if (!owner) return;
    let active = true,
      controller;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setState((previous) =>
        previous.owner === owner
          ? { ...previous, error: "" }
          : { owner, ...empty, loading: true, error: "" },
      );
      authFetch(`${API_URL}/my-capabilities`, { signal })
        .then(readJson)
        .then((value) => {
          if (
            !["super_admin", "admin", "technician", "public_visitor"].includes(
              value.role,
            )
          )
            throw new Error("Invalid account access response");
          if (active && !signal.aborted)
            setState({ owner, ...value, loading: false, error: "" });
        })
        .catch((error) => {
          if (active && !signal.aborted)
            setState({ owner, ...empty, loading: false, error: error.message });
        });
    };
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const show = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", show);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", show);
    };
  }, [owner, attempt]);
  return (
    <AccessContext.Provider
      value={{
        ...(state.owner === owner && owner
          ? state
          : { ...empty, loading: !!owner, error: "" }),
        refresh,
      }}
    >
      {children}
    </AccessContext.Provider>
  );
};
export default AccessProvider;
