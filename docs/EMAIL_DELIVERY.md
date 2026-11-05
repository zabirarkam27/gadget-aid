# Email delivery setup and recovery

Phase 7 includes an optional Resend adapter and a durable, protected delivery job. In-app notifications and messages work without email credentials. Actual email delivery is **not enabled** in the checked local environment: RESEND_API_KEY, EMAIL_FROM, APP_URL and CRON_SECRET are absent. No production email was sent or production scheduler created during this task.

## Configure on the backend

1. Configure a Resend account and verified sending domain. Put RESEND_API_KEY and EMAIL_FROM in the **server** environment. Never commit them or use VITE-prefixed secrets.
2. Set APP_URL to the frontend origin, such as `https://gadget-aid.web.app`, without a path, query or embedded credentials. Production email links require HTTPS. This is the URL users open to authenticate and view their booking.
3. Set CRON_SECRET to at least 32 random characters. All four settings are required to enable the server entry's email sender; missing configuration never pretends delivery succeeded.
4. Deploy matching frontend/backend when ready. This task only commits/pushes code; it does not deploy hosting or activate email.
5. Configure a trusted external scheduler to GET `/internal/jobs/email` on the backend with the header `Authorization: Bearer <CRON_SECRET>`, for example every minute. Configure the hosting function and scheduler timeouts for a batch of up to 5 provider calls (each bounded at 15 seconds), plus database reconciliation. No public user/admin action starts the job. Do not put the secret in a query string.

A local/manual runner is available from the server directory:

```powershell
npm run email:deliver
```

It reads CRON_SECRET and optional EMAIL_JOB_URL from the server environment. The default job URL is `http://localhost:5000/internal/jobs/email`. Remote URLs must use HTTPS; redirects are rejected. The runner prints aggregate counts only, never recipients, payloads or credentials. Do not run it against real queued recipients as a test. Browser QA and automated tests use memory records, fake identities and a fake sender.

No automatic Vercel cron schedule or paid resource is provisioned here. The application exposes the protected job so the scheduler can be configured for the actual hosting account. Email preferences remain a later phase.

## Data, failures and duplicates

- Booking events and messages are durable notification sources. A notification read or job reconciles them into the notifications collection. Source/recipient hashes form unique MongoDB IDs. Only events created by Phase 7 notify; older repair history is not bulk emailed.
- The notification document is also the email outbox record, separate from the booking. A projection/delivery outage cannot corrupt or undo a successful booking or message. Reconciliation recovers missing projections.
- The job rechecks recipient identity and canonical booking ownership before sending. A stale recipient is suppressed. Email content uses a generic event title and authenticated booking link; private notes, message bodies and other participant addresses are omitted. Responses expose only aggregate counts.
- A compare-and-set emailRevision and two-minute lease prevent overlapping jobs from claiming the same record. Immutable email payloads and a stable `gadget-aid/<notification-id>` idempotency key protect retries after an uncertain network response or process crash.
- Delivery states: pending → sending → accepted / retry / failed; ownership loss → suppressed. Accepted means the provider accepted the request, **not confirmed inbox delivery**. Delivery/bounce webhooks and inbox guarantees are not implemented.
- Network errors, timeouts, HTTP 408/429 and 5xx retry with delays of 1 minute, 5 minutes, 30 minutes and 2 hours, up to five attempts. Other provider errors become failed for review. Jobs must keep running for due retries to execute.
- Automatic retries stop if the first attempt is more than 23 hours old. Resend retains idempotency keys for 24 hours; the shorter window avoids sending an uncertain old request again after that protection expires. Exhausted/crashed final attempts also require review.
- An update failure after provider acceptance leaves the lease/source record recoverable; retries reuse the payload and key. Preserve sender configuration during retry windows. A changed sender can produce a provider idempotency conflict, which fails for review rather than silently sending twice.

## Operational recovery

Inspect failed/retry/sending/suppressed records through authorized database operations. failureCode is deliberately generic; provider response bodies and secrets are not stored or exposed. Check provider delivery logs using providerMessageId when present. For a pending lease, wait for expiry; the next protected job can retry within the safe window. Fix configuration for future deliveries after permanent errors. Before manually requeuing uncertain/expired failures, reconcile with the provider's records to prevent duplicate emails; do not blindly reset accepted records. No public requeue or admin interface is added in this phase.

Current reconciliation follows the repository's loaded-collection approach, scanning committed booking/thread sources and due notification records. Each delivery batch is capped at five, but source scanning is not yet paginated/index-tuned; validate database load and introduce cursor-based reconciliation before large-scale rollout. Message history is explicitly capped at 200 per booking and displayed alerts at 100, without deleting stored notification history.

Provider contract checked against [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email) and [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys). API acceptance and retry classifications are covered with a fake HTTP adapter; real provider delivery is unverified until credentials, sender verification, scheduler and deployment are configured.
