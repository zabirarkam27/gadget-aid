export const readJson = async response => {
  if (!response.ok) {
    let body; try { body = await response.json(); } catch { body = {}; }
    const messages = {
      DUPLICATE_BOOKING:"You already have a booking for this service and date. Check My bookings.",
      INVALID_SERVICE_SNAPSHOT:"The service details have changed. Reload the service and try again.",
      INVALID_STATUS:"Choose a valid repair status.",
      VALIDATION_ERROR:"Check the form details and try again.",
      SERVICE_UNAVAILABLE:"This service is unavailable right now. Please try again later."
    };
    const fallback = response.status === 401 ? "Your session has expired. Log in again to continue." : response.status === 403 ? "You do not have permission to make this change." : response.status === 404 ? "This record could not be found." : "We could not complete that request. Please try again.";
    const known = Object.hasOwn(messages,body?.code);
    throw Object.assign(new Error(known ? messages[body.code] : fallback),{status:response.status,code:typeof body?.code === "string" ? body.code : "REQUEST_FAILED",fields:body?.fields});
  }
  try { return await response.json(); }
  catch { throw Object.assign(new Error("The server returned an unreadable response. Please try again."),{status:502,code:"INVALID_RESPONSE"}); }
};
