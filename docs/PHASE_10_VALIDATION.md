# Phase 10 — Gadget Passport, device history and warranty

## Delivered behavior

Customers can keep private gadget passports at `/devices`: device name/type, optional brand/model, optional private serial number and optional purchase date. Only the owning Firebase UID can read/edit/export/delete a device, including when an Admin knows its ID. Lists omit serial numbers. Serial reveal is explicit in the edit form. New records reject ownership, warranty, upload URL and other unsupported fields.

From a booking's **Gadget Passport & warranty** panel, its actual customer can associate one of their devices, change the association or remove it. Providers receive neither the passport ID nor its serial or unrelated history. Device history shows only linked bookings belonging to the current customer; no old repairs are invented or silently linked. Current provider/customer booking authorization still applies.

QR images are generated locally by the dynamically imported `qrcode` package. The payload contains only the current frontend origin and an opaque device ID, never a serial, email or access token. The linked page and every API require the owning signed-in UID. Possessing the QR grants no access. Localhost QR links work on the same computer; use a deployed matching frontend/backend for cross-device use.

## Data rights and retention

- Device pages, history and all authenticated API responses use `Cache-Control: no-store`.
- Infrastructure backup retention is deployment-managed; deleting a primary device record does not erase files the customer previously exported or independently retained backups.
- Export requires an explicit UI confirmation and downloads JSON containing the device's private fields and linked repair summaries, full warranty terms and claim history. It excludes Firebase credentials and other people's device data. Up to 1,000 linked repairs fit one export; a larger export fails explicitly instead of silently dropping records. Individual history pages remain available.
- Deletion requires the exact device revision and explicit confirmation. It physically erases the device document, including serial, and detaches booking links in one MongoDB transaction. There is no device soft-delete copy or device-content audit log. Original booking/workflow and provider warranty records remain available to their authorized participants as independent service records. Device deletion is not an account-wide booking-history purge.
- Invoice/receipt uploads are deliberately unavailable: secure object storage and server access/retention rules are not configured. No upload endpoint, public receipt URL or bucket write was added. Before enabling uploads, define private storage authorization, content/size validation and malware scanning, signed-link expiry, deletion/backup retention, quotas and orphan cleanup. Existing exported files remain under the customer's own control.
- Restricted members retain record reads, export, device deletion and warranty claim support, but cannot create/edit/relink devices or perform provider warranty changes.

## Provider warranty and claims

No warranty is inferred from a completed status, catalogue claim or profile. Only the canonical approved repair provider can issue permanent repair-specific coverage/exclusions after server-recorded completed handover. Legacy `completed` text without a trusted workflow event is insufficient. Terms require confirmation and the current repair revision. One deterministic warranty ID per canonical booking prevents duplicate terms, including uppercase ID variants.

The provider chooses 1–730 days and supplies coverage (20–2,000 characters) and optional exclusions (up to 2,000). Start date comes from the recorded provider handover event in Bangladesh time; end date is inclusive (`start + durationDays - 1`). Late issuance does not move the handover date or imply that expired coverage is still current. The UI labels the provider and distinguishes date eligibility from claim approval; there is no platform-wide warranty promise.

An eligible customer can open one claim thread (20–4,000 characters) per repair warranty while within its stated dates. The original provider records reasoned, confirmed decisions: `submitted → in_review → approved/rejected`, then `approved → fulfilled`. Each decision uses the current warranty revision and appends a visible actor-role/timestamp/note history. A claim already opened can continue after expiry; new out-of-date claims are refused with booking-support guidance. Warranty actions never change the original repair status, quotation approval or financial records. Multiple independent claims, terms amendments, appeals/reopening and manufacturer/purchase warranties are outside this phase; existing booking support remains available.

## Storage and rollout

New collections: `devices`, `repairWarranties`; `bookings.deviceId` stores a canonical optional reference, and the existing private `operationMeta` collection serializes the per-owner 200-device cap. Lists/history use filter-scoped bounded cursors (default 25, max 100; UI 20). Device edits, associations, deletion, warranty issuance and claims use the session-bound transaction adapter. Link writes touch the device, coordinating with deletion to prevent dangling references. There is no nontransactional fallback.

Deploy the matched frontend/backend and allow the database account to create/write these collections on a transaction-capable replica set. No Atlas device/warranty records, production backfills or indexes were changed during validation. For substantial datasets, provision reviewed indexes on `devices: {ownerUid:1,_id:-1}` and `bookings: {deviceId:1,userEmail:1,userUid:1,_id:-1}`; default `_id` indexes support exact device/warranty lookup. Existing legacy records stay unchanged until a customer explicitly links a device.

## Verification

- Backend: **91 passing tests**, including 9 Phase 10 tests for UID privacy, forged fields/dates, canonical IDs, paging, revisions, restricted-member rights, participant-only associations, private exports, deletion rollback, recorded-handover eligibility, immutable terms, claim transitions and expiry.
- Client: **18 passing tests**, ESLint and production build. QR generation is a separate dynamically loaded bundle. The existing main-bundle size warning remains.
- Real local MongoDB replica set: the integration suite passed warranty-insert rollback, device-delete/link rollback and concurrent claim serialization; device erasure retained the original warranty. Existing appointment contention, calendar/moderation and admin-audit rollback checks still pass. The isolated suite imports no production environment and uses the documented loopback test port.
- Browser with synthetic identities: created a private device/serial, generated its QR, confirmed Admin cannot see its passport, linked a customer booking, completed the provider handover, issued provider terms, submitted a customer claim, recorded review/approval/fulfillment and confirmed customer-visible history. Downloaded the JSON export. Inspected the deletion dialog without deleting real data. Mobile content fit inside a 390px viewport and the serial was absent from visible page text. No real customer data or files were used.
- Screenshots: [desktop passport](screenshots/phase-10-passport-desktop.png), [mobile passport](screenshots/phase-10-passport-mobile.png), [warranty claim history](screenshots/phase-10-warranty-claim.png).

Repeat browser QA with `npm run qa` from the client; use the demo toolbar at `http://127.0.0.1:5176/devices`. For a repeatable handover, the seeded in-progress repair can advance through quality check, ready for collection and completed. Restarting QA resets its synthetic database. For real MongoDB checks use the disposable replica-set commands in [Phase 8 validation](PHASE_8_VALIDATION.md) and run `npm run test:mongo`. Remove only the verified test container after checking.
