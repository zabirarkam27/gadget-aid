# Phase 9 — approved roles and authorization

Status: approved by the user after revising the role model to Super Admin, Admin, Technician and Public visitor. Implementation is authorized; real account grants remain separate explicit actions. This document defines the concrete decision required by plan.md: “Only implement after the role model and authorization design are approved.”

## Roles

Use the four role names requested by the user: Super Admin, Admin, Technician and Public visitor. Their names and the permission mapping below were approved by the user.

| Role | Approved permissions |
| --- | --- |
| Super Admin | All Admin operations; grant/revoke Admin access through a protected, confirmed and audited role-management screen. Cannot create other Super Admins through the browser. |
| Admin | Paginated customer/service/booking operations, technician applications and publication review, application restrictions, disputes/reports, review moderation, categories and audit views. May approve/revoke Technician access, but cannot grant Admin/Super Admin, alter their grants or restrict privileged peers. |
| Technician | Manage only their own approved profile, services, availability and provider-side repair workflow; see only their own incoming bookings/conversations; respond to reviews of their repairs. No platform-wide or role-grant access. |
| Public visitor | Browse public services, technician profiles, published reviews and availability. |

Logging in still enables the existing customer capabilities: book services, manage one's own bookings, review an eligible completed repair and open one's own dispute. This is baseline authenticated access, not an additional privileged role. Technician/Admin/Super Admin accounts retain customer capabilities for their own bookings, subject to the same self-review and ownership rules.

A trusted deployment/database operator bootstraps/revokes Super Admin access using a server-only CLI; this is an operational authority, not a fifth application role. No real account is granted or changed during development.

All existing customer/provider ownership checks continue to apply. Admins do not receive a shortcut that impersonates either participant, approves quotations, fabricates completion/reviews, changes quoted prices or reserves arbitrary customer appointments.

## Granting and revoking admin access

Store grants in a private roleGrants collection, keyed by Firebase UID with verified email, role super_admin/admin/technician, active flag, revision, grant/revoke timestamps, accountable actor and reason. Public visitor access needs no privileged grant record.

Registration and editable profile/service/booking bodies cannot assign any privileged role. Client-provided role flags and Firebase custom claims are not authority. Every privileged request checks a current server-side UID/email grant; admin requests also use Firebase revocation checks. Revocation takes effect on the next request.

The server-only CLI resolves an explicitly supplied target UID through Firebase Admin and requires an enabled account with verified email. It can bootstrap/revoke Super Admin access and writes the grant/audit transactionally. There is no first-user auto-promotion, email allowlist shortcut, browser Super Admin grant or browser self-promotion. Real bootstrap operations remain separate explicit actions; only fake grants are used in isolated tests.

Only an active Super Admin can grant/revoke Admin access. Admins and Super Admins can approve/revoke Technician access through the application-review workflow. These operations require recent sign-in, exact target/revision, a reason, explicit confirmation and atomic audit persistence. Normal account restriction tools cannot alter Admin/Super Admin access. The browser cannot remove the last Super Admin; recovery/bootstrap stays with the trusted operator CLI.

Existing provider records are not silently converted into approved Technician grants. Before production enforcement, provide an explicitly reviewed migration/onboarding decision for existing providers; show pending applications clearly and preserve access to existing customer records. Implementation/tests can exercise approved, pending and revoked technicians in isolated data without changing real users.

## Server and client enforcement

- Add a private capabilities endpoint returning only the caller's capabilities, not the grant directory or other users' roles.
- Admin APIs check authorization on the backend before loading operational data. Frontend guards/navigation improve usability but grant no access.
- Sensitive mutations and private-detail inspections require a Firebase sign-in within the last 10 minutes (checked from signed auth_time), a specific reason, explicit confirmation and the current target revision. Stale changes fail instead of overwriting another operator.
- The UI shows the exact target and proposed effect before confirmation. A recent-auth failure directs the operator to sign in again using existing supported authentication.
- No real user is granted Super Admin/Admin/Technician, suspended, disabled, deleted or otherwise changed during development verification. Browser tests use isolated fake identities and fixtures.

## Operational scope

### Overview and customers

Show real booking/workflow, service, technician, review/report and dispute counts with clear source labels. Do not present booked/quoted amounts as collected revenue; payments do not exist.

Read customer identities through a server-only Firebase adapter. Paginate the directory and show minimal fields: UID, display name, masked email, account dates and application restriction status. Opening necessary contact/account details requires a reason and an audited private inspection. Do not add bulk PII exports.

Manage application restrictions separately from Firebase authentication. A restricted member can still read their records, cancel an eligible preapproval booking and submit a booking dispute. They cannot create new bookings/listings/messages/reviews or change provider repair workflows. Restriction/restoration is reversible, confirmed, reasoned and audited. No account deletion, password reset, credential changes or Firebase-wide disabling is included. Admin accounts cannot be restricted through the member-management UI; Admin access is managed by Super Admins; Super Admin access is managed by the trusted operator path.

### Technicians and services

Profile review means publication review, not credential verification. Approval must not change claimsVerified or turn self-reported certificates/experience into platform-verified credentials. Changes-requested notes identify what needs correction.

An explicit restriction may hide the public technician profile/its active listings and stop new bookings; historical bookings remain available to their authorized participants. Service moderation uses a separate admin visibility state so providers cannot undo it by editing or soft-deleting a listing. Unreviewed existing profiles/listings are not silently blocked on rollout.

### Bookings and disputes

All-booking lists are paginated and filterable, showing only the fields necessary for triage. Private instructions/contact/conversation detail require an audited inspection with a reason. Admin views do not change participant ownership.

A booking participant may open a dispute with a subject and description. Operators can assign an in-review state and record a resolution, with status history, accountable actor, reason and timestamps. Resolution does not claim to issue refunds, override customer quotation approval or change repair status automatically. Financial/legal remedies and automatic workflow exceptions remain outside this phase.

### Reviews, reports and categories

Use Phase 8's published/hidden review model and immutable moderation history for admin hide/restore actions. Reports are private, paginated and filterable. Reporting alone never suppresses a rating. Moderate a review and resolve relevant reports in a transaction with an admin audit entry.

Add a controlled category directory with stable IDs/slugs, active/archived state and revisions. Providers can choose active categories for listings. Archival preserves historical references; do not silently rewrite old free-text profile categories or erase listings.

### Audit and privacy

Every privileged mutation and sensitive-data inspection records server-derived actor UID, action, target, reason, time and minimal before/after state. Do not store tokens, credentials, full message bodies or unnecessary contact details in audit entries. The audit view is itself admin-only, paginated and filterable. Denied requests return safe errors without exposing private records.

State changes and their audit records commit in the same MongoDB transaction. If audit persistence fails, the state change must fail too. Sensitive data is returned only after its required access audit succeeds. Preserve existing booking, calendar, review and report audit histories.

## Pagination and input rules

Admin tables use server-side filtering, allowlisted sort/filter fields and bounded page sizes (25 by default, at most100). Use stable cursors instead of loading the full dataset into the browser. Firebase directory pagination uses its server page tokens. Reject arbitrary MongoDB operators, unsupported fields and malformed cursors. Redact list responses by construction rather than relying on hidden UI columns.

## Verification before main push

Test ordinary/missing/forged/revoked Super Admin/Admin/Technician identities, unverified-email grants, recent-auth requirements, privacy redaction, page/filter boundaries, stale revisions, explicit confirmations and audit-write rollback. Confirm member restriction rules across all affected write routes without blocking permitted record reads/cancellations/disputes. Verify moderation/profile restriction cannot be undone through provider endpoints and cannot bypass repair approval or double-booking protections.

Use fake Firebase adapters and isolated data for HTTP/browser tests, plus a disposable local MongoDB replica set for real audit/state transaction rollback. Do not change Atlas records or real Firebase privileges. After checks pass, commit and push code directly to main as previously requested; production activation/grants/deployment remain separate explicit actions.

## Implementation reference check

The installed Firebase Admin SDK exposes verifyIdToken(token, checkRevoked), getUser(uid) and listUsers(maxResults, pageToken). Their use was checked against the official [session management guidance](https://firebase.google.com/docs/auth/admin/manage-sessions) and [user-management guidance](https://firebase.google.com/docs/auth/admin/manage-users). These are server-side operations; no browser/admin request may receive Firebase service credentials. No real Firebase directory lookup or grant has been performed while preparing this proposal.
