# API contract — Phase 5

Current implementation as of 2026-11-06. Historical Phase 0 API map remains in API_MAP.md. Server entry is `gadget-aid-server/index.js`; injectable Express handlers are in `app.js`, domain validation/serialization in `domain.js`.

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
| PATCH `/all-bookings/:id` | Canonical service owner | Only status field; allowed values pending/working/completed; matchedCount/modifiedCount |

No new role, admin, payment, availability, scheduling or messaging endpoint exists. The existing three-status workflow is retained; the extended state machine/timeline remains Phase 6.

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
