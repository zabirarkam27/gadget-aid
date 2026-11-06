export const readJson = async response => {
  if (!response.ok) {
    let body; try { body = await response.json(); } catch { body = {}; }
    const messages = {
      DUPLICATE_BOOKING:"You already have a booking for this service and date. Check My bookings.",
      INVALID_SERVICE_SNAPSHOT:"The service details have changed. Reload the service and try again.",
      STALE_PROFILE:"The profile or availability changed. Reload before saving or booking.",
      AVAILABILITY_CONFLICT:"These hours conflict with a reserved appointment. Keep its hours open or cancel the booking first.",
      SLOT_REQUIRED:"Choose one of the provider's available appointment times.",
      SLOT_UNAVAILABLE:"This time is no longer available. Choose another appointment time.",
      PROVIDER_CLOSED:"The provider is closed on this date. Choose another date.",
      CALENDAR_LIMIT:"This provider's appointment calendar is full.",
      REVIEW_NOT_ELIGIBLE:"Only the customer of a verified completed repair can review it.",
      REVIEW_EXISTS:"This booking already has a review.",
      RESPONSE_EXISTS:"A provider response has already been saved.",
      STALE_REVIEW:"This review changed. Refresh before responding.",
      REVIEW_UNAVAILABLE:"This review is under moderation.",
      STALE_CONVERSATION:"The conversation changed. Refresh and retry.",
      PARTICIPANT_UNAVAILABLE:"The other booking participant is unavailable.",
      MESSAGE_REFERENCE_CONFLICT:"This message reference was used already. Edit the message before sending again.",
      MESSAGE_RATE_LIMIT:"Wait a few seconds before sending another message.",
      CONVERSATION_LIMIT:"This conversation reached its 200-message limit.",
      STALE_WORKFLOW:"This repair changed. Refresh before trying again.",
      STALE_QUOTATION:"This quotation changed. Refresh before deciding.",
      INVALID_TRANSITION:"Complete the earlier repair stages and customer approval first.",
      QUOTE_EXPIRED:"This quotation expired. Ask the provider for an updated quotation.",
      CLARIFICATION_PENDING:"Wait for your quotation question to be answered before approving.",
      DIAGNOSIS_REQUIRED:"Record a diagnosis before sending a quotation.",
      WORKFLOW_REVIEW_REQUIRED:"This legacy booking needs a data review before changes can continue.",
      WORKFLOW_LIMIT:"This repair reached its tracking limit. Contact support for review.",
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
