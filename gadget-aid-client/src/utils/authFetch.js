import { getAuth } from "firebase/auth";

// Use this instead of plain fetch() for any request that hits a
// private (verifyToken-protected) endpoint on the server.
export const authFetch = async (url, options = {}) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const token = currentUser ? await currentUser.getIdToken() : null;

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return fetch(url, { ...options, headers });
};
