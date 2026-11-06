# Phase 9 — platform operations

The user approved Super Admin, Admin, Technician and Public visitor, with authenticated customer capabilities retained. The exact permission mapping is in [the approved authorization design](PHASE_9_AUTHORIZATION.md). Implementation uses current database grants, signed Firebase identity and server ownership checks. No real role grants or production migrations were performed.

## Delivered behavior

- `/account-access` shows current access and a technician application; `/my-disputes` shows only the caller's support requests. Revoked technicians retain authorized booking history.
- `/admin` provides an actual-record overview, bounded account/application/profile/service/booking/review/report/dispute/category/role/audit/email tables, search on supported fields and cursor pagination. Counts are not revenue or delivered-email claims.
- Firebase directory lists mask emails. Private contact, instructions, conversations, report details and application statements require an audited inspection. Firebase credential fields are never serialized.
- Admins review applications, approve/restrict profile publication, hide/restore listings/reviews, resolve support requests/reports, manage categories and restrict/restore ordinary accounts. These actions preserve participant history and do not approve quotes, fabricate handovers, issue refunds or verify professional credentials.
- Only Super Admin can manage Admin access. Admin cannot alter privileged peers. No HTTP endpoint grants Super Admin. Provider actions still require canonical ownership.
- Every admin request verifies token revocation and reloads the database grant. Sensitive operations require signed `auth_time` within 10 minutes, reason, confirmation and revision. Atomic MongoDB transactions commit state and audit together; failed auditing blocks private detail responses.
- Account restriction, technician-role revocation and publication moderation are independent. Provider profile/listing edits cannot undo operator controls. Restricted members can read records, acknowledge alerts/messages, cancel eligible bookings and open disputes.
- Categories have stable deterministic IDs/immutable slugs, at most 200 active entries, and reversible archival. Existing service references survive archival; new assignments require an active category.

## Bootstrap and onboarding

Existing provider records are not converted into approved grants. Their unmoderated public listings remain visible; privileged provider writes require approval. Before production rollout, identify existing providers, have them submit applications and explicitly review approvals. Deploy matching backend/frontend together. Do not bulk approve based on legacy email fields.

For the first real Super Admin, an authorized server/database operator must verify the intended Firebase project, database, exact UID and enabled/verified account. The CLI uses the same server credential variables as `npm start`, and the `gadgetAidDB` database. The command is intentionally inactive without all three explicit environment confirmations:

```powershell
# Run from gadget-aid-server only, with reviewed real server credentials.
$env:SUPER_ADMIN_OPERATOR = '<accountable operator>'
$env:SUPER_ADMIN_CONFIRM_UID = '<exact reviewed Firebase UID>'
$env:SUPER_ADMIN_ALLOW_WRITE = 'yes'
npm run admin:bootstrap -- grant '<exact reviewed Firebase UID>' 'Specific reviewed bootstrap reason'
# For operator-led recovery/revocation, use revoke instead of grant.
Remove-Item Env:SUPER_ADMIN_OPERATOR, Env:SUPER_ADMIN_CONFIRM_UID, Env:SUPER_ADMIN_ALLOW_WRITE
```

This documentation is not an executed bootstrap. No real UID was supplied. The CLI verifies the target identity and commits the grant plus audit transactionally. Super Admin recovery/revocation stays operator-only; the browser cannot create or revoke Super Admins. After bootstrap, Admin access is managed through `/admin` by a recently signed-in Super Admin. Technician access starts with a reviewed application. Never put bootstrap flags, Firebase Admin credentials or database secrets in `VITE_*` variables.

New private collections: `roleGrants`, `accountControls`, `entityControls`, `auditLogs`, `technicianApplications`, `disputes`, `categories`, `operationMeta`. The database account needs transaction-capable replica-set access and collection creation/write permissions. No nontransactional fallback is provided. Audit retention/export policy and large-scale indexing/load testing need deployment-specific decisions; no production indexes or data were changed in this phase.

## Verification evidence

- Backend: **81 passing tests**, including 16 Phase 9 tests. Hierarchy/forged claims/revoked tokens, next-request grant revocation, recent-auth, confirmation, stale revisions, bounded/filter-scoped pagination, masked directory, secret-field exclusion, audit rollback, private inspections, technician approval, independent publication restoration, member restrictions, disputes, categories, moderation/report rollback and trusted bootstrap are covered.
- Client: **12 passing tests**, ESLint and production build. The existing single-bundle size warning remains; build succeeds.
- Local MongoDB: `npm run test:mongo` passed against an isolated official `mongo:8.0` replica set on `127.0.0.1:27028`. Twelve competing reservations produced one winner; booking/calendar/moderation rollback checks still pass. Phase 9 real transactions rolled back failed account, visibility and role changes; failed private inspections returned no detail; committed grant/revocation affected the next request. No Atlas/Firebase writes were used.
- Browser: fake customer denied `/admin`; submitted technician application; Admin recorded an inspection reason and approved it; customer saw Technician workspace. Customer opened a booking dispute, Admin resolved it, customer saw the resolution. Super Admin granted a synthetic Admin role; account lists remained masked and privileged-peer restriction controls were absent. Created a category, inspected audit entries, hid a listing and verified its removal from the public catalogue. Mobile page width remained within the viewport; wide tables scroll inside their container.
- Screenshots: [desktop audit](screenshots/phase-9-audit-desktop.png), [mobile audit](screenshots/phase-9-audit-mobile.png). All identities and content are synthetic.

To repeat browser QA: `npm run qa` in the client, then open `http://127.0.0.1:5176/admin`. The toolbar changes only fake identities; choose Admin or Super Admin to exercise their permissions. Restart to reset data. Never deploy this harness.

To repeat real transaction checks, use the disposable replica-set instructions in [Phase 8 validation](PHASE_8_VALIDATION.md), then run `npm run test:mongo` in the server. The suite imports neither dotenv nor the production entry point and uses a random database name on the fixed loopback QA port. Stop the verified test container afterwards.

No production deployment, real grants, email activation, Firebase account deletion/disablement, refunds or bulk exports were performed.
