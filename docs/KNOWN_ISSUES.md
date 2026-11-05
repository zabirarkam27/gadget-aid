# Known issues and verification gaps

2026-11-05, commit `97d1ec7`. Priorities describe impact; source findings have not been exploited against production. No fixes are included in Phase 0.

| ID / priority | Finding and impact | Responsible source | Evidence / recommended next action |
| --- | --- | --- | --- |
| B01 / High | Booking body controls price, service snapshot, provider identity, initial status and arbitrary extra fields; nonexistent service IDs accepted if truthy | Server `index.js` POST `/bookings`; client `components/ServiceDetails.jsx` | Source confirmed. Derive canonical service fields/server status and validate input before new booking releases |
| B02 / High | Service creation checks truthiness only; edit has no validation; both lack canonical types/limits | Server POST/PUT `/services`, client AddService/ManageService | Source confirmed. Define allowlisted DTO and numeric/date/string validation; retain ownership checks |
| A01 / Medium | Guard stores `form`, login reads `from`; login loses intended private route | Client `router/PrivateRoutes.jsx`, `pages/Login.jsx` | Source confirmed; guest detail guard observed live. Normalize state and preserve safe internal pathname/search/hash |
| A02 / Medium | Forgot-password link has no route or Firebase reset handler | Client Login + router | Live link opened not-found. Implement bounded reset flow later |
| A03 / Medium | Login enforces uppercase/lowercase composition instead of allowing Firebase to check existing password | Client `pages/Login.jsx` | Source confirmed; can reject existing valid credentials. Keep creation rules at registration |
| D01 / Medium | `providerImage` written, `providerPhoto` rendered; profile nulls lack fallback | Client AddService, ServiceCard, ServiceDetails, Navbar | Source confirmed; observed seeded records rendering does not establish compatibility for new records. Normalize with backward compatibility |
| R01 / High | Fetch callers ignore HTTP status/response shape; list error objects can crash rendering | Client Services/PopularServices/BookedServices/ManageService/ServiceToDo/ServiceDetails | Source confirmed. Add shared response handling with distinct loading/error/empty states |
| R02 / Medium | Failed detail fetch leaves spinner; 400/404 JSON treated as service | Client `components/ServiceDetails.jsx` | Source confirmed. Explicit not-found/error/retry state |
| R03 / Medium | Duplicate booking submissions possible; no in-flight disable or server uniqueness/idempotency policy | ServiceDetails + server POST `/bookings` | Source confirmed. Define duplicate policy before adding protection |
| R04 / Medium | Date required attribute is outside form submission; no past-date/range validation | ServiceDetails + booking endpoint | Source confirmed. Validate before submission and on server |
| R05 / Medium | Mongo initialization races requests; startup failure logs without readiness gate | Server `run()` and route registration | Source confirmed. Await shared connection/readiness and handle failure consistently |
| R06 / Medium | Uncaught DB errors lack centralized JSON response handling | Server `index.js` | Source confirmed. Add safe consistent error middleware; exact production error output untested |
| R07 / Medium | Full collection reads and no pagination; missing rate limits and explicit operational constraints | Server services/bookings list endpoints | Source confirmed. Prioritize by actual traffic and abuse needs; no load test performed |
| W01 / Medium | Status can jump/backtrack; no timestamp/history; legacy `serviceStatus` ignored by provider | ServiceToDo, BookedServices, server PATCH | Source confirmed. Define compatibility and lifecycle separately from visual redesign |
| W02 / Medium | Status update errors/success not visible; edit no-op treated as failure; pending controls absent | ServiceToDo, ManageService | Source confirmed. Interpret matchedCount and show useful feedback |
| X01 / Medium | Labels not associated with inputs, unnamed icon/hamburger/avatar buttons, custom modals lack dialog/focus/Escape behavior | Login, Registration, AddService, ManageService, ServiceDetails, Navbar | Source confirmed; live AX shows unnamed controls. Add accessible field/dialog patterns |
| X02 / Medium | No reduced-motion strategy; smooth scrolling/entrance/hover animations always configured | `src/index.css`, animated home components, ServiceCard | Source confirmed. Respect user motion preferences |
| X03 / Low | Banner nests interactive Link inside Button | Banner + Button | Source and live AX confirmed. Use a single navigational element |
| U01 / Medium | Two ThemeChanger instances keep independent state while writing one HTML attribute/storage key | Navbar + ThemeChanger | Source confirmed; not toggled live. Use one synchronized source of truth; desired dark default is Phase 1 |
| U02 / Medium | Dialog sizing/scrolling and shell overlap not comprehensively validated | ManageService, ServiceDetails, Navbar | Source risk: overlays and navbar share z-50; dialog has no explicit small-screen overflow design |
| C01 / Medium | Popular means first six, not measured popularity; thousands of customers/guaranteed satisfaction/notifications claims lack implementing data/policy | PopularServices, AboutUs, FeaturedSection, HowItWorks, README files | Source and live copy confirmed. Replace or substantiate during page redesign |
| C02 / Low | Contact email is text; mailbox ownership/delivery unknown; generic social homepages | ContactUs, Footer | Live/source confirmed. Verify actual contacts and use supported links; no fake form exists |
| Q01 / Medium | Lint fails on five motion imports; auth module fast-refresh warning | AboutUs, Banner, FeaturedSection, HowItWorks, ServiceCard, AuthProvider; ESLint config | Executed lint. Inspect JSX member-expression lint/config handling rather than blindly deleting used motion imports |
| Q02 / Medium | No real automated suite; backend test intentionally fails | Both package manifests | Commands executed. Add tests for integrity/authorization with implementation task |
| P01 / Low | Single JS bundle 641.82 kB (185.42 kB gzip) exceeds Vite warning threshold | Router imports and client dependency graph | Build measured only; runtime/Web Vitals/network performance unmeasured |
| P02 / Low | Image fallbacks/lazy loading missing; remote AboutUs duplicates local asset; favicon MIME mismatches PNG | Cards, details, Navbar, AboutUs, index.html | Source confirmed. Reuse/optimize existing assets and add fallbacks |
| G01 / Low | README claims real-time status and lists missing/obsolete architecture files | Root/client README | Compare actual route/API maps; revise with relevant implementation phase |

## Limits and deferred verification

- No credentials submitted or private accounts/records accessed; registration, Google login, logout, CRUD, booking, cross-user rejection and token expiry are not runtime-verified.
- Production backend revision, dashboard configuration, database indexes/schema/legacy documents, security rules and backups are not verified. Current code's checks must not be assumed to describe an older deployment.
- Geometry checks covered a filtered public listing only. Full visual screenshots at every width, all-route responsive checks, keyboard traversal, dialogs, contrast ratios, both themes and reduced-motion browser behavior remain pending.
- A captured public-browser error/warning log sample was empty. That is not a guarantee of no console errors or failed network requests; no network trace was captured.
- Live listing initially displayed no-match text before records arrived, then loaded successfully. Do not report this as API downtime; it demonstrates the missing loading state.
- The `404.png` asset exists. No missing-file bug is claimed for it.

Recommended first fix: B01 as a separately scoped reliability task with isolated authorization and tampered-payload tests. The plan's next design step is a reviewed proposal, then Phase 1 foundation; no later phase was started here.

## Phase 5 follow-up (2026-11-06)

The table above is the original Phase 0 baseline. Current outcomes and residuals are recorded in [PHASE_5_VALIDATION.md](PHASE_5_VALIDATION.md) and [API_CONTRACT.md](API_CONTRACT.md). Booking integrity/ownership, service validation, provider-photo normalization, request states, duplicate handling, accessible workspace forms/dialogs and misleading README claims have now been addressed. Earlier phases added password reset, safe return navigation, themes and shared focus/motion patterns. Historical orphan ownership and live Firebase/email delivery remain explicit limits; bundle-size, backend pagination and larger-scale performance work are not claimed complete.
