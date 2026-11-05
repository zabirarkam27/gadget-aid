# Phase 7 validation — notifications and communication

Story: an authenticated customer sends a booking message, its canonical provider sees a persistent alert/unread count and replies, the customer sees the reply and status updates, and explicit read actions clear only the intended alerts/messages. Important booking events can be delivered by a separately configured, protected email job without affecting repair state.

## Verification evidence

| Boundary | Result | Evidence |
| --- | --- | --- |
| UI renders | Passed | Notification center, navbar counts and booking conversation; desktop and 390 × 844 mobile screenshots |
| Client → API | Passed | Real frontend with QA token adapter against the same Express app factory; customer/provider round trip, explicit read requests and offline retry |
| API → data | Passed | Isolated HTTP tests persist source events, message revisions/cursors, deduplicated notification documents and email retry/lease state in fresh memory fixtures |
| Data → response | Passed | Authorized outputs omit private identities and outbox payloads; unrelated provider denied; later arrivals stay unread |
| Response → UI | Passed | Alert read left message unread; displayed-message read cleared message count; identity switch removed private details; failed send retained draft and retried once successfully |
| Email provider | Adapter verified; live delivery inactive | Fake sender verified acceptance, retry, permanent failure, concurrent leases and 23-hour review cutoff. Official API contract checked; actual provider keys/sender/job secret absent |

Backend: 44 tests passed (31 earlier API/workflow tests plus 13 communication/email tests). Frontend: 12 tests passed; lint has no warnings; production build passed with the existing large-bundle advisory. Final commands are npm test in the server; npm run lint, npm test and npm run build in the client.

Browser QA used only loopback 5176 / 5055, fake accounts and memory data. The demo clock now progresses from its fixed date so message rate limits can be exercised. Verified customer message, provider notification, separate alert/message read counts, provider reply, confirmed-stage customer alert, bulk visible-alert read, conversation read, unrelated account denial, draft retention on offline failure and successful manual retry. No real Firebase login, production booking modification or external email was performed. Polling is described honestly as 30-second refresh.

Local runtime check: the updated backend serves `/health` 200 ready and `/notifications` 401 without a token; the email job also rejects an unauthenticated request. Removed a stale pre-Phase-7 listener and fixed startup logging so a busy port exits with an explicit bind failure instead of claiming it is listening. No private collection or email job was invoked with production credentials.

## Implemented scope

- Persistent user-scoped notifications for new booking/lifecycle/quotation events and messages; deterministic deduplication, mark-one/visible-read and total unread counts.
- Booking-specific immutable plain-text conversation, participant authorization, request-reference replay protection, five-second sender throttling, 200-message limit and read-through cursors with concurrent-update protection.
- Independent email outbox state and protected batch job with a Resend adapter, leases, stable idempotency keys, bounded retries and safe review states. Projection and email failures do not roll back booking/message writes.
- No automatic historical email blast, attachments, preferences, general admin role, instant realtime transport or email delivery/bounce guarantee.

## Remaining environment work and limits

Real email activation requires backend-only provider key, verified sender, APP_URL, CRON_SECRET and a trusted scheduled job; see [email setup](EMAIL_DELIVERY.md). Production hosting and scheduler were not configured/deployed. New MongoDB notifications and bookingThreads collections will be created on first authorized writes with the server's database permissions; this task ran no production migration or backfill. MongoDB multi-process/load tests and real multi-account Firebase browser testing were not performed. Large-scale source reconciliation needs pagination/index tuning before rollout at scale.

## Screenshots

- [Notification center](screenshots/phase-7-notifications.png)
- [Booking conversation and unread badge](screenshots/phase-7-conversation.png)
- [Mobile conversation](screenshots/phase-7-conversation-mobile.png)
