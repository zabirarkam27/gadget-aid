# API contract — Phase 6

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

Phase 6 adds controlled stages, diagnosis, quotation decisions, and quotation clarification notes. Admin, payments, scheduling, general messaging and notifications remain outside this phase.

## Service validation

Editable fields: name (trimmed2–120 chars), area (2–160), description (10–5000), image (absolute http/https URL up to2048 chars without embedded credentials), price (finite numeric value/string, 0–1,000,000, cent precision). Prices normalize to a numeric two-decimal monetary value. The frontend applies matching checks; parity cases are tested. Request JSON is limited to64KB.

POST accepts old providerName/providerEmail/providerImage/providerPhoto/createdAt display fields for compatibility, but profile/timestamps are derived from the token and server; forged providerEmail is rejected. UID, `_id` and unknown fields are not accepted. PUT accepts only the five editable fields.

Reads normalize providerImage/providerPhoto to providerPhoto without a database backfill. Malformed legacy display text/URLs/prices are safely represented rather than passed to React as arbitrary objects. New createdAt/updatedAt fields are BSON dates. Service responses omit internal ownership UID fields and include a derived bookable boolean; invalid or removed services cannot accept bookings.

## Booking request and duplication policy

Preferred body:

```json
{"serviceId":"<24 hex characters>","date":"YYYY-MM-DD","instruction":"Optional details"}
```

The date must be a real calendar date, today or later in Asia/Dhaka; it is not a reserved appointment. Instructions are optional strings, maximum2000 chars. The service must exist, be active and have a usable canonical price/provider/name.

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
