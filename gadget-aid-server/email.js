// Provider secrets are read only by the server entry. No request body can select
// the recipient, sender or destination API. Email content omits private notes.
const createEmailSender = ({ apiKey, from, fetchImpl = fetch }) => {
  if (!apiKey || !from) return null;
  return async ({ to, subject, text, idempotencyKey }) => {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Object.assign(new Error("Email delivery failed."), {
        retryable:
          response.status === 429 ||
          response.status >= 500 ||
          response.status === 408,
      });
    const data = await response.json();
    if (typeof data.id !== "string")
      throw new Error("Email acceptance was not confirmed.");
    return { id: data.id };
  };
};
module.exports = { createEmailSender };
