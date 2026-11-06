# Full plan audit and release

6 November 2026 (Asia/Dhaka). Scope: the owner's request to check the entire plan, fill gaps, push main and publish the existing Firebase/Vercel application. The original phase documents remain historical records; this report is the current cross-phase status.

## Plan coverage

| Plan | Current implementation and evidence |
| --- | --- |
| 0 Audit | Product/API/route baseline and phase validation documents exist. Original baseline findings are historical, not current security claims. |
| 1 Design system | Central theme tokens, shared controls, status badges, dialogs, skeletons, empty states, focus styles and reduced-motion rules; DESIGN_SYSTEM.md. |
| 2 Global shell | Responsive navbar/account menu, theme toggle, footer, guarded navigation and consistent page shell. Previous browser evidence covers mobile Escape/focus return and both auth states. |
| 3 Public pages | Redesigned home/catalogue/details/auth/contact; database search/filter/sort/paging, canonical booking inputs and supported provider/profile paths. Unverified support mailbox removed in this audit. |
| 4 Workspaces | Own customer bookings, canonical provider queue/services, status/search/whole-workspace counters and responsive forms. No fabricated earnings/payment widgets. |
| 5 Reliability | Token refresh/session isolation, safe errors, server-derived snapshots, ownership/role guards, controlled duplicate booking and consistent validation. Security dependencies and missing image fallbacks fixed in this audit. |
| 6 Repair workflow | Controlled stages, versioned diagnosis/quotation, customer decisions/questions, explicit revisions, expiry, timeline and tracked handover. Backend lifecycle tests pass. |
| 7 Communication | Private threads, unread counts, persistent notifications/read actions, durable email outbox and retry adapter. **Booking email delivery is not activated:** no verified sender/account/key. Firebase reset mail is a separate service. |
| 8 Technicians | Self-reported profile claims, real verified-completion reviews/responses/reports, weekly hours/exceptions, Bangladesh time and transactional slot contention. |
| 9 Operations | Approved Super Admin/Admin/Technician/Public model, backend grants, recent-auth sensitive actions, atomic audit, masked/paged views, categories, disputes and moderation. |
| 10 Devices | Owner-private passports/QR/export/deletion, encrypted normalized receipt photos and provider warranty/claim workflow. Existing encryption key is preserved. PDF was optional and remains unsupported. |
| 11 Assistant | Safe guided flow and real service matching; optional consented structured AI integration. **External AI is not activated:** owner has no Gateway key. Rules-based results are labeled honestly; hazard guidance bypasses the model. |
| 12 Differentiators | Calculator, real-listing estimate, consented/moderated encrypted gallery, informational recycling, private bookmarks/three-service comparison and transactional discount points. Full policy and 75 responsive checks in Phase 12 documents. |
| Technical quality | Bounded catalogue/workspace paging, centralized errors/auth, request size limits, CORS, health readiness, upload constraints and lazy routes. This audit adds supplemental request limits, hosting/API security headers, cache policy and GitHub checks. |

Optional/future items in the plan are not silently represented as active services: notification preferences, instant push, payment processing, actual recycling collection, model-specific parts pricing and external AI images are not advertised. Review query plans before large-scale growth: legacy technician lookup/review eligibility reconciliation still performs broader source scans. No load/Web Vitals or complete screen-reader certification is claimed.

## Gaps closed in this audit

1. Replaced the unverified `support@gadgetaid.com` contact claim with the actual booking conversation/dispute route. An optional validated public `VITE_SUPPORT_EMAIL` can be configured after mailbox ownership/delivery is verified; no personal email was published.
2. Added clear public-gallery image-unavailable feedback (including withdrawal races) and private decode-error feedback.
3. Patched audited dependency chains, removed unused localforage/match-sorter/sort-by, resolved the React 19/Helmet peer conflict, migrated Firebase Admin to modular Auth entry points and declared Node 22 for deployment. Explicit patched gRPC/glob/minimatch overrides are recorded in lockfiles. These are security-driven updates, not a framework rewrite.
4. Added API no-sniff/referrer/CSP headers and a bounded per-instance request budget before body parsing. Estimates count six units; ordinary requests one, budget 180/minute/IP and maximum 5,000 active buckets. Retry-After and safe 429 feedback are returned. Local forwarded headers are ignored; only the explicit Vercel runtime uses its edge-overwritten forwarded IP. No raw IP is logged/persisted. This is supplemental protection, not a distributed firewall; existing shared AI/upload quotas remain.
5. Added Firebase security headers, revalidation for page shells and immutable caching for hashed assets. Authentication popup/iframe behavior is preserved; no restrictive frontend CSP was guessed.
6. Added GitHub Actions checks on main/PR: Node 22 clean installs, production dependency audit, tests, client lint/build and disposable real-MongoDB transaction tests. CI needs no production credentials and does not automatically deploy or send email.

Technical references: [Firebase Admin v14 migration](https://firebase.google.com/support/release-notes/admin/node), [Firebase Hosting headers](https://firebase.google.com/docs/hosting/full-config#headers), [Vercel request headers](https://vercel.com/docs/headers/request-headers).

## Validation

- Backend: 131 tests passed; real local MongoDB transaction suites: 2 passed. Includes authorization, tampered bookings, duplicates, slot contention, moderation/audit rollback, encrypted receipts/gallery, wallet spending/refund and limiter spoofing/expiry/capacity.
- Frontend: 21 tests passed; lint and production build passed. Security-updated build has lazy routes, a 372.39 kB entry and 174.85 kB Firebase chunk; no 500 kB chunk warning.
- Both production dependency audits report zero vulnerabilities after patches. Clean peer resolution now works without legacy-peer-deps. Local verification runtime is Node 24; deployment/CI target is Node 22.
- Production build target checked without printing credentials: API gadget-aid-server.vercel.app, Firebase project gadget-aid. No production secret, account, role, encryption key or database migration is changed by this release.
- Prior full-flow browser evidence: AUDIT_FOLLOWUP.md, PHASE_11_VALIDATION.md and PHASE_12_VALIDATION.md. Synthetic fixtures only for private mutation flows. Live public smoke results and release identifiers will be recorded after deployment.

## Configuration still required

Booking email needs an operator-owned verified sending domain/sender, backend Resend key and protected scheduler secret/configuration. Optional external AI needs an operator-supplied AI Gateway key and explicit feature enablement. These credentials/accounts cannot be fabricated or borrowed from Firebase authentication. Existing in-app communication and guided repair flow remain usable. A general public support mailbox is optional and currently unpublished.

## Release and rollback

Publish the backend first, check readiness/private-route rejection/CORS, then deploy only Firebase Hosting with the matching production frontend build. Reuse existing projects and secret stores; never generate a replacement receipt key. Previous backend checkpoint: dpl_H3v7KVV2XQsxnAkCAb6q9NRX5Jy9. Previous Firebase Hosting version: 42daecc043b1c521. Coordinate rollback of client/server and preserve all existing encryption key material. Deployment evidence follows in LIVE_FULL_RELEASE.md.
