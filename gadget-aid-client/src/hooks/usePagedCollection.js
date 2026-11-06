import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../provider/AuthContext";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";

const empty = { data: [], summary: null, loading: true, loadingMore: false, error: "", moreError: "", nextCursor: null };
export default function usePagedCollection(path, privateRequest = false) {
  const { user } = useContext(AuthContext);
  const owner = privateRequest ? user?.uid || "" : "public";
  const key = `${owner}:${path}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ ...empty, key: "" });
  const session = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    const current = { controller, busy: false };
    session.current = current;
    setState({ ...empty, key, loading: !!owner, error: owner ? "" : "Log in to view this workspace." });
    const request = privateRequest ? authFetch : fetch;
    current.read = async (cursor = "") => {
      if (current.busy || controller.signal.aborted) return;
      current.busy = true;
      if (cursor) setState(previous => previous.key === key ? { ...previous, loadingMore: true, moreError: "" } : previous);
      try {
        const url = `${API_URL}${path}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
        const page = await request(url, { signal: controller.signal }).then(readJson);
        if (!Array.isArray(page.items) || page.items.some(item => !item?._id) || (page.nextCursor !== null && typeof page.nextCursor !== "string")) throw Error("Invalid page");
        if (!controller.signal.aborted) setState(previous => {
          if (previous.key !== key) return previous;
          const data = cursor ? [...previous.data, ...page.items] : page.items;
          return { ...previous, data: [...new Map(data.map(item => [item._id, item])).values()], summary: page.summary || null, nextCursor: page.nextCursor, loading: false, loadingMore: false, error: "", moreError: "" };
        });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => previous.key === key ? { ...previous, loading: false, loadingMore: false, [cursor ? "moreError" : "error"]: error.status === 401 ? "Your session expired. Log in again." : "The list could not be loaded. Please try again." } : previous);
      } finally { current.busy = false; }
    };
    if (owner) current.read();
    return () => controller.abort();
  }, [key, path, owner, privateRequest, attempt]);
  const visible = state.key === key ? state : empty;
  return { ...visible,
    retry: () => setAttempt(value => value + 1),
    loadMore: () => visible.nextCursor && session.current?.read(visible.nextCursor),
    setData: update => setState(previous => previous.key === key ? { ...previous, data: typeof update === "function" ? update(previous.data) : update } : previous),
  };
}
