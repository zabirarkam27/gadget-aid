# Phase 5 — Reliability and booking integrity

Completed 2026-11-06, Asia/Dhaka, on main after Phase 4 checkpoint `73a3936`. Scope: protect existing features, preserve working routes, validate inputs and verify customer/provider flows. No Phase 6 workflow, deployment, production data write or migration was performed.

## What changed

- Booking creation accepts serviceId, preferred date and optional instructions; the server resolves authoritative service/provider/price fields and token-derived customer identity, sets pending and server timestamps.
- Matching legacy snapshot bodies remain compatible. Forged price/provider/name/image/status or arbitrary fields are rejected. New service owner/profile/timestamps are server-derived; service writes use validated allowlisted fields.
- New UID fields supplement the existing verified-email ownership rule. Provider queues and status changes resolve canonical service ownership instead of trusting booking.providerEmail. Private lists ignore user-supplied identity queries.
- One customer/service/date is allowed across statuses. Duplicate requests return409 and the existing booking reference. New deterministic IDs use MongoDB's existing `_id` uniqueness for concurrent protection, without creating an index or migrating existing documents.
- Service removal now hides the listing and retains its owner reference for repair history. Unknown legacy ownership fails closed. Provider photo aliases normalize on read; malformed legacy display objects are not rendered directly.
- Express handlers await database readiness and return safe consistent errors; health endpoint, body-size limit and JSON validation added. Production boot remains Firebase Admin + MongoDB with the existing configuration.
- Private frontend requests refresh once after401, check account continuity/cancellation and never automatically replay network-failed/500 mutations. Private route subtrees reset across identity changes. Collection responses are checked before use.
- Service/date rules match frontend/backend; date policy uses Bangladesh time. Duplicate booking feedback links to My bookings. Loading, empty, error, confirmation and success states are implemented for existing workspaces.
- AuthContext moved into a pure module to avoid the existing Fast Refresh export issue and keep QA independent of Firebase initialization. Existing login, Google, reset and logout operations remain unchanged.
- README files now describe actual refresh behavior, features, startup, tests and deployment order rather than unimplemented real-time claims.

## Files changed

Paths are repository-relative; Phase 4 page/component inventory is in PHASE_4_VALIDATION.md.

| Files | Purpose |
| --- | --- |
| `gadget-aid-server/index.js` | Thin production entry: existing env/Firebase/MongoDB setup and shared readiness promise |
| `gadget-aid-server/app.js` | Injectable Express endpoints, auth/ownership checks, canonical snapshots, soft removal, safe errors |
| `gadget-aid-server/domain.js` | Validation, identity filters, canonical response serialization, date/price rules and deterministic booking IDs |
| `gadget-aid-server/package.json`, `tests/api.test.cjs`, `tests/fixtures.cjs` | Actual backend test command, HTTP authorization/integrity tests, isolated memory collection fixtures |
| `gadget-aid-client/src/utils/authenticatedRequest.js`, `authFetch.js`, `readJson.js` | Safe token/session transport, single401 refresh and response handling |
| `gadget-aid-client/src/utils/bookingValidation.js`, `serviceValidation.js`, `workspace.js`, `authFeedback.js` | Consistent input/date/display/status/error rules |
| `gadget-aid-client/src/hooks/usePrivateCollection.js`, `useServices.js` | Collection shape validation and cancellation-safe state |
| `gadget-aid-client/src/components/ServiceDetails.jsx` | Minimal booking body, date checks, unavailable-listing state and duplicate recovery |
| `gadget-aid-client/src/pages/AddService.jsx`, `ManageService.jsx`, `ServiceToDo.jsx` | Minimal service body and useful mutation/session feedback; stale removal recovery |
| `gadget-aid-client/src/provider/AuthContext.js`, `AuthProvider.jsx`, `src/router/PrivateRoutes.jsx` | Shared pure context, protected subtree identity reset |
| `gadget-aid-client/src/components/Navbar.jsx`, `src/pages/Login.jsx`, `Registration.jsx` | Import the same context without changing auth behavior |
| `gadget-aid-client/src/index.css` | Explicit source scan so production classes also compile in isolated QA |
| `gadget-aid-client/package.json`, `tests/public-flows.test.js`, `tests/reliability.test.js` | Test commands and frontend boundary tests |
| `gadget-aid-client/tests/qa-server.mjs`, `tests/qa/{index.html,main.jsx,App.jsx,state.js,transport.js}` | Separate demo browser root, fake test identities, same API handlers with memory data; no production build entry |
| `README.md`, `gadget-aid-client/README.md`, `docs/API_CONTRACT.md`, this report | Current setup, contracts, policy, rollout and evidence |
| `docs/screenshots/phase-4-*-qa.jpg` | Explicitly labelled demo customer/provider/mobile screenshots; no real private data |

## Commands and results

Frontend: `npm run build`, `npm run lint`, `npm test`. Backend: `npm test`; `node --check index.js`, `node --check app.js`, `node --check domain.js`. Final outputs are recorded in the task: 12 frontend tests and22 backend tests, all passed. No test framework/dependency was added. Node24.15.0 and the existing installed dependencies were used. The existing >500KB bundle warning remains; the AuthProvider lint warning was removed by the context split.

Backend tests use real Express HTTP requests and the production handler factory with injected token verification and memory collections. They cover missing/invalid/incomplete tokens; canonical snapshots; forged fields; malformed/nonexistent IDs; date/instruction/service validation; duplicate/retry/concurrent submissions; legacy IDs/status/photo compatibility; non-owner edit/delete/status rejection; private list scope; forged legacy providerEmail/UID denial; UID/email collisions; soft removal with repair-history access; orphan ownership denial; unready DB503; malformed/oversized JSON; safe500 errors; malformed legacy display data; and frontend/backend validation parity. They do not call real Firebase or MongoDB. The fixture enforces unique IDs but is not a MongoDB load/concurrency test.

Frontend tests cover safe internal login return paths and legacy state, friendly errors, response status/JSON failures, token attachment/single refresh, session switching, aborted requests, no network/500 mutation replay, Bangladesh dates, legacy/unknown status counts and duplicate recovery feedback.

## Browser end-to-end evidence

Ran `npm run qa` from the client. Isolated UI at `127.0.0.1:5176`, test API at5055. It imports the actual page/components and Express handler factory. The only auth replacement is an explicit fake-token transport and demo context; the API uses a fresh memory fixture. The yellow toolbar labels it as isolated QA. It is not the real application authentication path, and the real API does not accept these demo tokens.

Verified through UI actions:

1. Customer bookings loaded with actual fixture counts; View booking opened the snapshot/reference/instructions dialog. Escape closed it and restored focus.
2. Simulated offline private requests produced an error state, then reconnect + Try again restored the list.
3. Provider queue loaded its requests. Confirming working updated the API record; switching to another provider showed no access to those requests.
4. Customer opened a real service detail component, selected November7 using the native date picker, sent the minimal booking body and landed in My bookings with a new pending request and the canonical $85 price.
5. Repeating the seeded service/date returned the duplicate message and Check My bookings link; no extra booking appeared.
6. Provider moved the new booking pending→working→completed with confirmation. The customer then saw completed and the matching summary count.
7. Provider created a disposable demo service, edited its name/price, cancelled removal, then confirmed removal. Own-list counts and success feedback updated correctly. All writes stayed in memory.
8. Status filtering, account switching, authenticated mobile/desktop account navigation, Escape dismissal and sign-out were exercised. Real Firebase credentials were never entered.
9. Authenticated missing-service response rendered the unavailable/retry state. A clean reload after the context split displayed the expected two fixture bookings.

Browser automation's synthetic date fill did not commit the controlled date state; the native picker/keyboard was used to verify real input behavior. Initial QA source scanning and HMR entry/context changes caused transient development-only styles/root/context warnings while editing. Explicit Tailwind source scan, separated/cached mount entry and full reload resolved those edit-time issues; final fresh loads were checked separately. Do not count historical editing logs as production error-free certification.

## Responsive and theme checks

Routes `/booked-services`, `/service-to-do`, `/manage-services`, `/add-service`, `/services/111111111111111111111111` were inspected with demo identities and loaded data at360,390,768,1366,1440px (height900). All25 requested widths matched actual viewport widths and showed no horizontal overflow. Corresponding document widths were345,375,753,1351,1425px. Customer/provider views, a mobile customer page, native dialogs and both themes were visually inspected; temporary viewport overrides were reset.

Saved screenshots: `phase-4-customer-qa.jpg`, `phase-4-provider-qa.jpg`, `phase-4-customer-mobile-qa.jpg`, `phase-4-workspace-preview-qa.jpg`. Each includes the demo-only toolbar. These are not private production account screenshots.

## Real local app smoke and limits

The actual backend/frontend were restarted locally with the existing configuration, not deployed. Read-only checks confirmed `/health`200, `/services`200 with13 records and canonical providerPhoto output, CORS allowing localhost5173, and `/bookings`401 without a token. No real booking/service write, schema backfill, index creation, credential change or production environment update occurred.

Actual Firebase Google/email login, password reset delivery, token expiry/revocation and private writes against the user's MongoDB were not exercised. Existing SDK calls are retained; token retry logic and API authorization were tested at injectable boundaries. The real MongoDB's unique ID behavior is relied on, not altered by a migration.

## Compatibility, residual issues and next task

- Historically orphaned provider bookings are deliberately withheld until ownership can be proved. Customers retain their own history. Existing duplicate/forged snapshot records were not rewritten. See API_CONTRACT.md for reconciliation and soft-removal policy.
- External Firebase email changes are not an existing product feature; ownership reconciliation must be designed before adding it.
- The default production build excludes the QA roots. No production deploy was performed. Deploy secured backend before the matching frontend; keep it when rolling the UI back.
- Backend pagination, distributed rate limits, audit timelines and extended lifecycle rules remain later scoped work. Current status values/transitions are preserved; no quotation state machine was added.
- Bundle-size warning remains. No claim is made that every third-party image, email delivery path, hosting setting or genuine user session has been tested.

Next logical task: Phase 6 diagnosis/quotation/timeline design after reviewing the current API/data policy and planning safe development data. Suggested checkpoints: Secure booking requests; Verify repair workflows.

Final measured production build: 502 modules; JavaScript565.43KB (158.98KB gzip), CSS71.17KB (12.90KB gzip), 2.93s. Final lint passed with zero errors and zero warnings. Backend22 tests and frontend12 tests passed. A fresh QA tab after the context split showed the expected two fixture bookings and an empty error/warning log sample; earlier HMR logs remain historical editing evidence, not current failures.
