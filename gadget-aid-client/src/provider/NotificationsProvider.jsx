import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { NotificationsContext } from "./NotificationsContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
const empty = { items: [], unreadCount: 0, unreadMessages: 0 };
const NotificationsProvider = ({ children }) => {
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
    let controller;
    let active = true;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setState((previous) =>
        previous.owner === owner
          ? { ...previous, loading: !previous.items.length, error: "" }
          : { owner, ...empty, loading: true, error: "" },
      );
      authFetch(`${API_URL}/notifications`, { signal })
        .then(readJson)
        .then((data) => {
          if (
            !Array.isArray(data.items) ||
            !Number.isInteger(data.unreadCount) ||
            !Number.isInteger(data.unreadMessages)
          )
            throw new Error("Invalid notification response");
          if (active && !signal.aborted)
            setState({ owner, ...data, loading: false, error: "" });
        })
        .catch((error) => {
          if (active && !signal.aborted)
            setState((previous) => ({
              ...previous,
              owner,
              loading: false,
              error: error.message || "Notifications could not be loaded.",
            }));
        });
    };
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [owner, attempt]);
  const visible =
    state.owner === owner && owner
      ? state
      : { ...empty, loading: !!owner, error: "" };
  const markRead = async (ids) => {
    await authFetch(`${API_URL}/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then(readJson);
    refresh();
  };
  return (
    <NotificationsContext.Provider value={{ ...visible, refresh, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
};
export default NotificationsProvider;
