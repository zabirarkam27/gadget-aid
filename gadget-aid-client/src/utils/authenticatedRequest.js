const sessionError = () => Object.assign(new Error("Your session has expired. Log in again to continue."), {status:401,code:"UNAUTHENTICATED"});
const networkError = () => Object.assign(new Error("Check your connection and try again."), {status:0,code:"NETWORK_ERROR"});
export const createAuthFetch = ({ getUser, fetchImpl = fetch }) => async (url, options = {}) => {
  const user = getUser();
  if (!user) throw sessionError();
  const ensureSession = () => {
    options.signal?.throwIfAborted();
    if (getUser()?.uid !== user.uid) throw sessionError();
  };
  const send = async refresh => {
    ensureSession();
    let token;
    try { token = await user.getIdToken(refresh); }
    catch (error) { if (error.code === "auth/network-request-failed") throw networkError(); throw sessionError(); }
    ensureSession();
    const headers = new Headers(options.headers);
    headers.set("Authorization",`Bearer ${token}`);
    try { return await fetchImpl(url,{...options,headers}); }
    catch(error) { if (error.name === "AbortError") throw error; throw networkError(); }
  };
  let response = await send(false);
  // A 401 is rejected before any protected mutation. Retry only that response once.
  if (response.status === 401) response = await send(true);
  return response;
};
