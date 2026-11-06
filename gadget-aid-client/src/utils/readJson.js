export const readJson = async (response) => {
  if (!response.ok) {
    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    const messages = {
      RECEIPT_UNAVAILABLE:
        "Private receipt storage is unavailable or its encryption key needs attention. Try again later.",
      RECEIPT_POLICY_REQUIRED:
        "Review and accept the private receipt storage and deletion policy first.",
      RECEIPT_TOO_LARGE:
        "Choose a JPEG/PNG receipt photo no larger than 3 MiB.",
      RECEIPT_TYPE:
        "Only JPEG and PNG receipt photos are supported. PDF, SVG and other files are not accepted.",
      RECEIPT_INVALID_IMAGE:
        "This receipt photo is damaged, unsupported or exceeds the safe image dimensions.",
      RECEIPT_QUOTA:
        "Receipt storage is full: up to 10 per device, 50 per account and 30 MiB per account. Download and delete an old receipt first.",
      RECEIPT_BUSY: "Receipt processing is busy. Wait a moment and try again.",
      RECEIPT_RATE_LIMIT:
        "Too many receipt uploads. Wait a minute before trying again.",
      UPLOAD_REFERENCE_CONFLICT:
        "This upload reference belongs to a different receipt. Select the file again for a new upload.",
      REQUEST_TOO_LARGE:
        "The request is too large. Receipt photos must be no larger than 3 MiB.",
      STALE_PASSPORT:
        "The device, linked repair or warranty changed. Refresh before saving again.",
      DEVICE_LIMIT:
        "You can keep up to 200 private devices. Export and remove an old device before adding another.",
      EXPORT_LIMIT:
        "This history exceeds the single-file export limit. Use its paginated repair history.",
      HANDOVER_REQUIRED:
        "Warranty terms require a recorded completed handover by the provider.",
      WARRANTY_EXISTS:
        "Provider warranty terms have already been issued and cannot be replaced.",
      WARRANTY_EXPIRED:
        "This warranty is outside its stated dates. Booking support remains available.",
      CLAIM_EXISTS:
        "This warranty already has a claim. Follow the existing claim history.",
      INVALID_CLAIM_TRANSITION:
        "This claim decision is not available from its current state. Refresh the warranty.",
      DUPLICATE_BOOKING:
        "You already have a booking for this service and date. Check My bookings.",
      INVALID_SERVICE_SNAPSHOT:
        "The service details have changed. Reload the service and try again.",
      ADMIN_REQUIRED: "Administrator access is required or was revoked.",
      ADMIN_REAUTH_REQUIRED: "Sign in again before this sensitive action.",
      TECHNICIAN_REQUIRED:
        "Technician approval is required. Open Account access to apply.",
      ACCOUNT_RESTRICTED:
        "This account is restricted. Existing records and booking support remain available.",
      ACCOUNT_NOT_VERIFIED:
        "The target account must be enabled and have a verified email.",
      APPLICATION_REQUIRED:
        "Review and approve the technician application first.",
      APPLICATION_EXISTS:
        "An application is pending, or technician access is already available.",
      CONFIRMATION_REQUIRED:
        "Review the exact target, confirm the action and provide a specific reason.",
      STALE_OPERATION:
        "This record changed. Reload it before confirming an action.",
      INVALID_CURSOR: "This page cursor is invalid. Reset the filters.",
      ADMIN_DIRECTORY_UNAVAILABLE:
        "The account directory is unavailable. Retry later.",
      CATEGORY_EXISTS: "This category slug already exists.",
      CATEGORY_UNAVAILABLE: "Choose an active service category.",
      CATEGORY_LIMIT: "The active category directory is full.",
      DISPUTE_EXISTS:
        "A dispute already exists for this booking. Follow its status in Booking support.",
      STALE_PROFILE:
        "The profile or availability changed. Reload before saving or booking.",
      AVAILABILITY_CONFLICT:
        "These hours conflict with a reserved appointment. Keep its hours open or cancel the booking first.",
      SLOT_REQUIRED:
        "Choose one of the provider's available appointment times.",
      SLOT_UNAVAILABLE:
        "This time is no longer available. Choose another appointment time.",
      PROVIDER_CLOSED:
        "The provider is closed on this date. Choose another date.",
      CALENDAR_LIMIT: "This provider's appointment calendar is full.",
      REVIEW_NOT_ELIGIBLE:
        "Only the customer of a verified completed repair can review it.",
      REVIEW_EXISTS: "This booking already has a review.",
      RESPONSE_EXISTS: "A provider response has already been saved.",
      STALE_REVIEW: "This review changed. Refresh before responding.",
      REVIEW_UNAVAILABLE: "This review is under moderation.",
      STALE_CONVERSATION: "The conversation changed. Refresh and retry.",
      PARTICIPANT_UNAVAILABLE: "The other booking participant is unavailable.",
      MESSAGE_REFERENCE_CONFLICT:
        "This message reference was used already. Edit the message before sending again.",
      MESSAGE_RATE_LIMIT: "Wait a few seconds before sending another message.",
      CONVERSATION_LIMIT: "This conversation reached its 200-message limit.",
      STALE_WORKFLOW: "This repair changed. Refresh before trying again.",
      STALE_QUOTATION: "This quotation changed. Refresh before deciding.",
      INVALID_TRANSITION:
        "Complete the earlier repair stages and customer approval first.",
      QUOTE_EXPIRED:
        "This quotation expired. Ask the provider for an updated quotation.",
      CLARIFICATION_PENDING:
        "Wait for your quotation question to be answered before approving.",
      DIAGNOSIS_REQUIRED: "Record a diagnosis before sending a quotation.",
      WORKFLOW_REVIEW_REQUIRED:
        "This legacy booking needs a data review before changes can continue.",
      WORKFLOW_LIMIT:
        "This repair reached its tracking limit. Contact support for review.",
      INVALID_STATUS: "Choose a valid repair status.",
      VALIDATION_ERROR: "Check the form details and try again.",
      SERVICE_UNAVAILABLE:
        "This service is unavailable right now. Please try again later.",
    };
    const fallback =
      response.status === 401
        ? "Your session has expired. Log in again to continue."
        : response.status === 403
          ? "You do not have permission to make this change."
          : response.status === 404
            ? "This record could not be found."
            : "We could not complete that request. Please try again.";
    const known = Object.hasOwn(messages, body?.code);
    throw Object.assign(new Error(known ? messages[body.code] : fallback), {
      status: response.status,
      code: typeof body?.code === "string" ? body.code : "REQUEST_FAILED",
      fields: body?.fields,
    });
  }
  try {
    return await response.json();
  } catch {
    throw Object.assign(
      new Error(
        "The server returned an unreadable response. Please try again.",
      ),
      { status: 502, code: "INVALID_RESPONSE" },
    );
  }
};
