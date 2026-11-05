import { useEffect, useState } from "react";
import { API_URL } from "../utils/api";
import { readJson } from "../utils/readJson";

const useServices = () => {
  const [state, setState] = useState({ data: [], loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: [], loading: true, error: "" });
    fetch(`${API_URL}/services`, { signal: controller.signal }).then(readJson).then(data => {
      if (!Array.isArray(data) || data.some(item => !item || typeof item !== "object" || !item._id)) throw new Error("Unexpected service response");
      if (!controller.signal.aborted) setState({ data, loading: false, error: "" });
    }).catch(error => {
      if (error.name !== "AbortError" && !controller.signal.aborted) setState({ data: [], loading: false, error: "Services are unavailable right now. Please try again." });
    });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
};
export default useServices;
