# API contract — Phase 8

Current implementation as of 2026-11-06. Historical Phase 0 API map remains in API_MAP.md. Server entry is `gadget-aid-server/index.js`; injectable Express handlers are in `app.js`, domain validation/serialization in `domain.js`, and repair rules/handlers in `workflow-model.js` and `workflow.js`.

## Identity and ownership

Private endpoints require `Authorization: Bearer <Firebase ID token>`. Production uses Firebase Admin `verifyIdToken`; UID and email must be present. Email is never taken from query parameters or a submitted booking body. New services/bookings carry server-written UID plus token email. Ownership requires the verified email and, when a UID exists, the matching UID. Legacy records without a UID retain the verified-email ownership rule. Injected legacy UID fields cannot override the email owner. The product does not offer email changes; external Firebase email changes require separately reviewed ownership reconciliation.

Provider booking read/update access is derived from the referenced service's ownership, including soft-removed service references. The booking's stored providerEmail cannot grant access. An orphan legacy service reference is denied to providers instead of trusting a client-authored snapshot; customer history remains available to its owner.

## Endpoints

| Method/path | Access | Response/behavior |
| --- | --- | --- |
| GET `/` | Public | Liveness text |
| GET `/health` | Public | 200 `{status:ready}` after DB readiness, otherwise safe503 |
| GET `/services` | Public | Active service array; no server pagination/filter API |
| GET `/services/:id` | Public | Service or400/404; private guard still applies in frontend |
| GET `/my-services` | Token | Only the owner's active listings |
| POST `/services` | Token | Validated five service fields, owner/profile/timestamp from token/server; 201 insertedId |
| PUT `/services/:id` | Owner | Validated five editable fields; matchedCount/modifiedCount response (a no-op is successful) |
| DELETE `/services/:id` | Owner | Soft removal: deletedAt/updatedAt server dates; legacy-compatible deletedCount response |
| POST `/bookings` | Token | Canonical service snapshot, authenticated customer, server status/dates; 201 insertedId + bookingId |
| GET `/bookings` | Customer | Only their booking snapshots, including history of removed services |
| GET `/all-bookings` | Provider | Only bookings referencing services owned by the caller; legacy providerEmail alone is insufficient |
| PATCH `/all-bookings/:id` | Canonical service owner | Controlled transition with status, expectedRevision and optional note; response includes updated booking and matchedCount/modifiedCount |

Phase 6 adds controlled stages, diagnosis, quotation decisions, and quotation clarification notes. Admin, payments, scheduling, general messaging and notifications are added by Phase 7 below.

## Service validation

Editable fields: name (trimmed2–120 chars), area (2–160), description (10–5000), image (absolute http/https URL up to2048 chars without embedded credentials), price (finite numeric value/string, 0–1,000,000, cent precision). Prices normalize to a numeric two-decimal monetary value. The frontend applies matching checks; parity cases are tested. Request JSON is limited to64KB.

POST accepts old providerName/providerEmail/providerImage/providerPhoto/createdAt display fields for compatibility, but profile/timestamps are derived from the token and server; forged providerEmail is rejected. UID, `_id` and unknown fields are not accepted. PUT accepts only the five editable fields.

Reads normalize providerImage/providerPhoto to providerPhoto without a database backfill. Malformed legacy display text/URLs/prices are safely represented rather than passed to React as arbitrary objects. New createdAt/updatedAt fields are BSON dates. Service responses omit internal ownership UID fields and include a derived bookable boolean; invalid or removed services cannot accept bookings.

## Booking request and duplication policy

Preferred body:

```json
{"serviceId":"<24 hex characters>","date":"YYYY-MM-DD","instruction":"Optional details"}
```

The date must be a real calendar date, today or later in Asia/Dhaka; it is a date request unless an appointment is selected under the Phase 8 rules below. Instructions are optional strings, maximum2000 chars. The service must exist, be active and have a usable canonical price/provider/name.

Provider identity, service name/image, price, customer identity, initial pending status and timestamps are derived server-side. Matching old snapshot fields remain accepted, but mismatched price/provider/name/image and non-pending status are rejected. Unknown fields are rejected. A client-provided userName is not used; userEmail, if supplied by an old client, must match the token.

There may be one booking per authenticated customer/service/date, across all statuses. Retrying the same day with changed instructions does not overwrite the first request. A precheck detects legacy duplicates; new requests derive a deterministic ObjectId from UID/service/date. MongoDB's existing unique `_id` constraint therefore also prevents concurrent inserts without a new production index or migration. Ten concurrent requests were tested against the fixture: one creation and nine409 duplicates. Actual MongoDB race/load testing was not performed.

Duplicate response: HTTP409 `{code:DUPLICATE_BOOKING,message,bookingId}` referring to the caller's existing booking. The client displays useful feedback and a My bookings link. This protects booking creation; it does not claim general idempotency for every write.

## Error contract

Expected errors return JSON `{message,code,fields?}`. Common statuses: 400 validation/invalid IDs/invalid JSON; 401 missing/expired token; 403 wrong owner; 404 missing resource; 409 duplicate/unbookable service; 413 oversized body; 503 unready/unavailable DB; 500 unexpected failure. Internal exceptions, credentials and stack traces are not returned. Client transport maps known codes to useful feedback and does not show arbitrary server diagnostics.

All frontend fetch paths now check HTTP/shape errors and expose loading/error/empty/success/retry as appropriate. Private requests acquire Firebase ID tokens, retry once only on401 with a forced token refresh, and stop if the session changes or request is aborted. Network failures and500 responses on mutations are not automatically replayed. Keyed private subtrees clear pending UI state across identity switches.

## Compatibility and rollout

No existing records were migrated, deleted or backfilled during implementation. Future removals retain reference records. Historically orphaned provider jobs require verified reconciliation; granting access based on an unverified email snapshot would restore the original vulnerability. Legacy duplicate rows remain as history; new duplicate inserts are blocked.

Deploy backend before frontend. Keep the secured backend if reverting the UI; older backend code would expose soft-removed listings and resume trusting client snapshots. User approval is still needed for production deployment or any data reconciliation. This task pushed source changes only.

## Phase 6 repair workflow

GET `/bookings/:id` is private to the verified customer or canonical service owner. Returns booking, `repairRevision`, participant permissions, server-derived available `actions`, current quotation and full diagnosis/quotation/event history. Lists include revision and current-quotation summaries. Frontend `?view=provider` is presentation only and grants no permission.

All workflow mutations require the detail response's integer `expectedRevision`. One MongoDB update compares record ID, stored status and revision, then writes status, revision, repair history and updatedAt together. Stale/concurrent writes return 409 `STALE_WORKFLOW`; refresh before retrying. New bookings initialize version 2 tracking and a customer `booking_created` event. No mutation is automatically replayed.

| Method/path | Actor | Body beyond expectedRevision |
| --- | --- | --- |
| PATCH `/all-bookings/:id` | Provider | `status`, optional `note`; cancellation/rejection and returning to an earlier test stage require a reason |
| POST `/bookings/:id/diagnoses` | Provider | `summary` 10–2000 chars, `issue` 3–1000, `recommendedRepair` 3–2000 |
| POST `/bookings/:id/quotations` | Provider | `parts`, `labor`, `estimatedCompletion` 3–160 chars, optional `expiresOn` YYYY-MM-DD |
| POST `/bookings/:id/quotations/:quoteId/decision` | Customer | `decision`: approve/reject; rejection requires `note` 3–1000 chars |
| POST `/bookings/:id/quotations/:quoteId/questions` | Customer | `question` 3–1000 chars |
| POST `/bookings/:id/quotations/:quoteId/questions/:questionId/answer` | Provider | `answer` 3–2000 chars; one immutable answer per question |
| POST `/bookings/:id/cancel` | Customer | `note` 3–1000 chars; only before approval |

Diagnosis, quotation and question creation return 201 `{booking}`; other mutations return 200 `{booking}` (transition retains acknowledged/matchedCount/modifiedCount). Unknown fields are rejected.

Allowed provider transitions:

- pending → confirmed / rejected
- confirmed → device_received / diagnosing / cancelled (receipt optional for remote work)
- device_received → diagnosing / cancelled
- diagnosing → cancelled; diagnosis and quotation use dedicated endpoints
- awaiting_approval → cancelled; revised unapproved quotes may be sent
- approved → repairing / cancelled
- repairing → quality_check / cancelled
- quality_check → ready_for_collection / repairing / cancelled
- ready_for_collection → completed / quality_check / cancelled

Quote publication atomically records quotation_sent then awaiting_approval. Customer approval records explicit approved stage; rejection returns to diagnosing for revision. Completed/cancelled/rejected are terminal. Old working request alias means repairing and cannot bypass approval. Work, quality check, collection and completion require approved current quotation except the legacy policy below. Customer may cancel any preapproval booking with a reason. Provider cancellation after approval requires a reason; no refund policy is implemented.

Parts: at most 20 lines with name 2–120 chars, integer quantity 1–100 and nonnegative unitPrice with cent precision. Labor follows the monetary rules. Server computes USD line totals and total in integer cents, capped at 1,000,000; submitted totals, IDs, decision actors and timestamps are rejected. Zero-cost quotes are valid. Completion is descriptive after approval, not a reserved slot. Optional expiry is end of chosen Asia/Dhaka day and must be future when sent. Expired approval returns 410 QUOTE_EXPIRED. Unanswered questions pause approval (409 CLARIFICATION_PENDING).

Diagnosis/quotation versions append. A revised sent quote becomes superseded; original content/questions remain. Approved quotation content cannot be replaced. Decisions/supersession/withdrawal add metadata. Limits: 20 diagnoses, 20 quotes, 10 questions per quote, 300 events; reaching a limit fails explicitly without trimming history.

Every event includes booking ID, previous/new status, verified actor UID/role, server timestamp, optional note, linked version/question IDs and customerVisible:true. All notes are shared with both participants. Reads do not mutate data.

### Legacy compatibility and rollout

Existing pending records enter full approval workflow on first mutation with an honest legacy_workflow_started event. Existing working/serviceStatus working records display as repairing and may finish without retroactively inventing approval; the legacy-in-progress notice remains visible. Legacy completed records stay terminal. No bulk migration runs. A trusted version-2 workflow requires a BSON Date start marker, valid revision and history arrays; JSON lookalike approval fields from the old permissive API are ignored. Malformed revisions fail closed for review. Ownership rules remain unchanged, including removed listings and denying unverifiable provider references.

Deploy matching backend/frontend together. Old status dropdowns cannot execute the new workflow without revisions/approval. Do not roll back only backend to arbitrary three-status updates; that removes workflow protections.

## Phase 7 communication

All user endpoints require a Firebase ID token. Only the customer or canonical service owner can access a booking conversation, including soft-removed services. Stored provider snapshots never grant access. Notification reads also recheck current booking ownership and recipient UID/email; changing an email query parameter has no effect. Notification/message responses omit private participant email addresses, UIDs, email payloads and delivery state.

| Method/path | Body | Result |
| --- | --- | --- |
| GET `/notifications` | None | `{items,unreadCount,unreadMessages}`; latest 100 authorized alerts, total unread counts across authorized records |
| POST `/notifications/read` | `{ids:[notificationId]}` up to 100 | Idempotent mark-read of those authorized alerts; preserves first read timestamp |
| GET `/bookings/:id/messages` | None | `{messages,unreadCount,lastMessageId,canSend,limitReached}`; reads do not mark messages read |
| POST `/bookings/:id/messages` | `{text,requestId}` | 201 conversation response; same sender/booking/reference/content resubmission reuses the existing message |
| POST `/bookings/:id/messages/read` | `{throughId}` | Marks only messages through that displayed ID read; returns conversation; later arrivals stay unread |
| GET `/internal/jobs/email` | None; `Authorization: Bearer <CRON_SECRET>` | Aggregate accepted/retry/failed/skipped counts; ordinary Firebase tokens cannot invoke it |

Messages are plain text, 1–2000 trimmed characters, with a 16–80 character alphanumeric/hyphen request reference generated by the client. IDs, role, sender UID and timestamp are server-derived. Unknown fields are rejected. Reusing a reference with changed content returns 409 MESSAGE_REFERENCE_CONFLICT. Each sender may send once per five seconds (429 MESSAGE_RATE_LIMIT); replaying the same accepted reference is allowed immediately. Conversations cap at 200 immutable messages, returning 409 CONVERSATION_LIMIT without trimming history. They remain readable afterward. Orphan customer history stays readable; sending is disabled when the other participant cannot be verified. Messaging is allowed after repair completion and does not change repairRevision or authorize quotations.

`bookingThreads` stores one document per booking, with a separate revision, immutable message array and monotonic participant read cursors. Atomic revision comparison with bounded retries prevents lost messages and regressed cursors. A read-through ID acknowledges only the displayed prefix, even if a new message arrives concurrently. Explicit message reads also mark already-projected message alerts for that prefix; later projection initializes the correct read state. Marking an alert read alone does not acknowledge the conversation.

New repair events carry a server-written notify marker in the same atomic booking update as their audit history. Booking creation, acceptance/rejection, receipt, diagnosis, quotation, approval/rejection, repair, testing/readiness, completion/cancellation and quotation clarification create alerts for the other participant. Quotation publication produces one alert rather than a duplicate approval-request alert. Legacy tracking-start events and pre-Phase-7 events do not notify. Messages are their own durable sources. Self-directed modern notifications are omitted.

Notifications materialize in the `notifications` collection from committed event/message sources on authorized notification reads or email-job runs. Deterministic source/recipient ObjectIds and MongoDB unique `_id` constraints prevent duplicates across retries. Projection failure can delay alerts but cannot roll back a booking/message; the next read/job reconciles committed sources. This uses recoverable projection rather than a cross-collection transaction. The existing repair history is not replayed as a historical email blast.

The shared frontend provider checks notifications every 30 seconds while visible and refreshes on visibility return; conversation polling runs only on the detail page. Requests abort on account/page changes and private state is reset or hidden across identity changes. The UI calls this refresh/polling, never instant real-time. Manual retry is available; failed messages keep their draft/reference until successful or edited.

Email delivery configuration, retry/lease limits, operational recovery and verified-provider references are documented in [EMAIL_DELIVERY.md](EMAIL_DELIVERY.md). Preferences, attachments, message editing/deletion and realtime transport remain outside Phase 7.

## Phase 8 profiles, availability and reviews

| Method/path | Access | Contract |
| --- | --- | --- |
| GET `/my-technician` | Token | Current identity's editable profile, public fields plus revision/exists; fallback without creating a record |
| PUT `/my-technician` | Token owner | Full editable profile and expectedRevision; response public fields plus new revision |
| GET `/technicians/:id` | Public | Safe profile, owned active service summaries, eligible published reviews, averageRating and reviewCount |
| GET `/technicians/:id/reviews` | Public | Eligible published review array; public review identity does not expose private booking reference |
| GET `/services/:id/availability?date=YYYY-MM-DD` | Public | configured, requests/appointments mode, Asia/Dhaka, 60-minute duration, date, open and unreserved slot strings |
| GET `/bookings/:id/review` | Booking participant | eligible/reason, existing review and technicianId; only eligible customer gets a submission form |
| POST `/bookings/:id/review` | Eligible customer | rating integer 1–5 and feedback 20–2000 chars; 201 public review; duplicate409 REVIEW_EXISTS |
| POST `/reviews/:id/response` | Canonical service owner | text 3–2000 chars; one permanent provider response |
| POST `/reviews/:id/report` | Token | category abuse/privacy/spam/authenticity/other and details 10–1000 chars; 201 pending or200 already_reported |

Editable profile fields: businessName 2–120 chars; photo optional HTTP(S) URL; bio up to2000; skills up to20 unique 2–80 char strings; categories up to12 unique 2–80 char strings; area up to160; yearsExperience null or integer0–80; certifications up to10 unique 2–160 char claims; availability; expectedRevision. Unknown fields, owner IDs/emails, verification flags, rating aggregates and reservations are rejected. Identity is derived from the token, and stored UID/email must both match. Public claimsVerified is always false. Legacy listings get a safe fallback profile without a backfill. Public technician responses omit owner credentials, calendar reservations, private participant identities and report data.

Availability input is `{configured,mode,weekly,exceptions}`. Mode is requests or appointments. Weekly contains exactly seven distinct day0–6 entries (Sunday–Saturday) with closed boolean, start and end HH:00. Closing may be24:00, must follow opening, and overnight/split windows are unsupported. Exceptions have a unique valid date and the same closed/start/end fields, replacing that day's weekly window; at most60. Time zone and slot duration are server-controlled. Configured bookings are at most90 days ahead. Request mode validates open days and rejects a submitted time; unconfigured providers keep the existing date-request behavior.

POST `/bookings` now also accepts optional `time` HH:00. For configured appointment providers it is required, must be an offered future whole-hour start within open hours, and must be free across every service owned by that technician. For date-request providers it must be omitted/empty. Client-supplied appointment IDs, durations and timestamps are rejected. Booking reads include a trusted appointment object with technicianId, date, time, Asia/Dhaka, server-derived UTC startsAt/endsAt and durationMinutes60, or null for date requests. Old JSON lookalike appointment fields are not trusted.

A MongoDB transaction rechecks date, canonical listing and schedule, reserves the provider slot by profile/calendar revision, guards the canonical listing and inserts the booking together. Booking failure rolls back the reservation. Rejection/cancellation updates repair history and releases a reserved slot in the same transaction. Schedule edits preserve all nonexpired reserved windows and reject conflicts. Up to500 nonexpired calendar reservations are retained; past entries are pruned on calendar writes. Stale revision409 STALE_PROFILE, conflicting hours409 AVAILABILITY_CONFLICT, closed date409 PROVIDER_CLOSED, missing/invalid slot409 SLOT_REQUIRED and taken/past time409 SLOT_UNAVAILABLE are mapped to usable client feedback. Transaction support is required; no unsafe fallback exists.

The original customer/service/date duplicate rule remains, even after cancellation. It prevents duplicate creation, rather than implementing rescheduling or replacement of existing records. Reservations hold capacity from pending request onward; this does not bypass provider acceptance or quotation approval.

Review eligibility requires customer identity match, another provider, completed workflow and a server-recorded provider completed-handover event in trusted tracking. A plain legacy completed string is insufficient. Deterministic per-booking review IDs prevent concurrent duplicates. Public aggregates include only valid ratings on eligible canonical-provider records whose deterministic ID and trusted creation marker match and whose moderation state is published; null average represents no reviews. Customer email/UID and private booking reference are omitted. There is no client rating-count field, review editing or self-review exception.

Reports remain private and deduplicate per verified account/review; they do not auto-hide or change aggregates. A server-only operator CLI, requiring existing database authorization and an explicit write opt-in, can hide/restore with actor/reason/time audit history and resolve pending reports transactionally. No public admin/moderation endpoint or new role is created. Operator steps, limits, local transaction test evidence and rollout requirements are in [PHASE_8_VALIDATION.md](PHASE_8_VALIDATION.md).
# Phase 9 operations extension

The approved role model and production onboarding requirements are documented in [Phase 9 authorization](PHASE_9_AUTHORIZATION.md) and [setup/validation](PHASE_9_VALIDATION.md). Existing participant ownership and repair-approval rules remain enforced.

| Endpoint | Access and input |
| --- | --- |
| `GET /my-capabilities` | Signed-in caller only; current server role/capabilities, own application/publication state, provider-history indicator. |
| `POST /technician-application` | Unrestricted signed-in caller; `businessName`, `statement`, `expectedRevision`; approval is not client controlled. |
| `GET /categories` | Public active categories only. Service create/edit accepts optional active `categoryId`; archived current references may be retained. |
| `POST /bookings/:id/disputes` | Actual participant; `subject` (5–160), `description` (20–4,000); one request per participant/booking. |
| `GET /bookings/:id/disputes`, `GET /my-disputes` | Participant's own submissions; `my-disputes` accepts bounded pagination and `status`. |
| `GET /admin/overview` | Admin/Super Admin; actual record counts. |
| `GET /admin/customers` | Masked Firebase directory with `limit`, Firebase `cursor`; no arbitrary search/export. |
| `GET /admin/{bookings,services,technicians,applications,roles,reviews,reports,disputes,categories,audit,email}` | Admin/Super Admin; `{items,nextCursor,limit}`; descending ID cursors scoped to filters, default 25/max 100. `q` literal search supported on bookings/services/technicians/applications/disputes/categories/audit; allowlisted `status` on bookings/applications/reviews/reports/disputes/categories/email. Unsupported filters/operators are rejected. |
| `POST /admin/inspect/{customer,booking,technician,application,service,dispute,review,report}/:id` | Sensitive audited detail; `reason`, `confirmed:true`; recent sign-in. Whitelisted fields only. Profile claims remain explicitly unverified. |
| `GET /admin/role-target/:uid` | Minimal masked exact target and role revision; no credentials. |
| `POST /admin/accounts/:uid/state` | `state:active/restricted`; privileged peers excluded. |
| `POST /admin/roles/:uid` | `role:admin/technician`, `active:boolean`; Super Admin required for Admin changes. Active Technician grants require an approved application. No Super Admin assignment endpoint. |
| `POST /admin/applications/:uid/decision` | `decision:approve/changes_requested`; approval and Technician grant commit together. |
| `POST /admin/services/:id/publication` | `state:visible/hidden`; separate from provider edits/removal. |
| `POST /admin/technicians/:id/publication` | `state:approved/changes_requested/restricted`; publication review does not verify credentials. |
| `POST /admin/reviews/:id/moderate` | `action:hide/restore`; report resolution and review moderation commit with audit. |
| `POST /admin/reports/:id/resolve` | `resolution` (10–1,000); does not automatically hide the review. |
| `POST /admin/disputes/:id/resolve` | `state:in_review/resolved`, `resolution` (required 10–2,000 when resolved); records history without changing repair status/payments. |
| `POST /admin/categories`, `POST /admin/categories/:id` | `name`, immutable `slug`, `state:active/archived`; existing references preserved. |

All admin POSTs require a specific 10–1,000 character `reason`, `confirmed:true` and signed Firebase `auth_time` within 10 minutes. Mutations also require integer `expectedRevision` (zero for absent controls/new categories). Stale state returns 409; no automatic replay. Reasons on applications/publication are shared with the affected provider/applicant. Private inspections use POST to require an accountable reason before data is returned; they do not require a mutation revision. State and minimal audit entries share one transaction. Failure returns a safe error and no private details or partial state.

Common additional codes: `ADMIN_REQUIRED`, `TECHNICIAN_REQUIRED`, `ADMIN_REAUTH_REQUIRED`, `CONFIRMATION_REQUIRED`, `ACCOUNT_RESTRICTED`, `ACCOUNT_NOT_VERIFIED`, `APPLICATION_REQUIRED`, `STALE_OPERATION`, `INVALID_CURSOR`, `CATEGORY_UNAVAILABLE`, `DISPUTE_EXISTS`. Admin requests perform Firebase revocation checking plus current server-grant validation. UI role flags never authorize API access.
# Phase 10 passport and warranty extension

Every endpoint below requires a verified Firebase identity token with revocation checks. Device ownership is enforced by Firebase UID; Admin has no passport override. Lists omit serials, private responses use `Cache-Control: no-store`, and caller-supplied ownership/upload/verification fields are rejected.

| Endpoint | Contract |
| --- | --- |
| `GET /devices` | Own devices; `limit` 1–100, filter-scoped `cursor`, optional literal `q` on label/type/brand/model; `{items,nextCursor,limit}`. |
| `POST /devices` | `label` (2–100), `type` (2–60), `brand` (0–80), `model` (0–120), `serialNumber` (0–160), `purchaseDate` (optional valid nonfuture date/null); max 200 owned devices. |
| `GET /devices/:id` | Owner-only full device; nonexistent/other-owner ID returns 404. |
| `PUT /devices/:id` | Same device fields plus integer `expectedRevision`; stale writes fail 409. |
| `GET /devices/:id/history` | Owner-only paginated own linked repair summaries and provider warranty/claim records. |
| `GET /devices/:id/export` | Owner-only private JSON attachment, up to 1,000 linked repair summaries. Larger exports explicitly fail with `EXPORT_LIMIT`. |
| `DELETE /devices/:id` | `confirmed:true`, `expectedRevision`; atomically erase the device and detach booking references; preserve independent booking/warranty records. |
| `GET /bookings/:id/passport` | Actual participants only; customer gets own linked device summary (no serial), both get provider warranty/claim history and server-derived action capabilities. |
| `PUT /bookings/:id/device` | Customer only; `deviceId` or null and `expectedDeviceId` or null. Target device must belong to caller. Canonical IDs stored. |
| `POST /bookings/:id/warranty` | Canonical approved provider after recorded completed handover; `durationDays` 1–730, `coverage`, `exclusions`, `confirmed:true`, `expectedRevision` of repair. One permanent record per booking. |
| `POST /bookings/:id/warranty/claims` | Actual customer, within warranty dates; `description`, warranty `expectedRevision`; one claim thread per warranty. |
| `POST /bookings/:id/warranty/decision` | Original canonical provider; `state`, `note` (10–2,000), `confirmed:true`, warranty `expectedRevision`; only allowed forward transitions. |

Warranty dates derive from the server-recorded provider handover in Bangladesh time; date eligibility never implies claim approval. Additional codes: `STALE_PASSPORT`, `DEVICE_LIMIT`, `EXPORT_LIMIT`, `HANDOVER_REQUIRED`, `WARRANTY_EXISTS`, `WARRANTY_EXPIRED`, `CLAIM_EXISTS`, `INVALID_CLAIM_TRANSITION`. Details/retention/limits are in [Phase 10 validation](PHASE_10_VALIDATION.md). There is no upload, public passport or manufacturer-warranty endpoint.
