# Phase 12 validation

6 November 2026. Implements plan sections 12.1–12.6. The owner selected discount points with one-year validity and delegated the rate decision. Full rules, privacy boundaries and deployment requirements are in [Phase 12 design](PHASE_12_DESIGN.md).

## Delivered

| Plan | Implementation |
| --- | --- |
| 12.1 Repair vs replace | `/repair-calculator`: local arithmetic from explicit costs and lifetime assumptions, with no predicted lifetime or financial certainty. |
| 12.2 Cost estimator | `/repair-estimate`: category/symptom matching against real visible listings, bounded sample and nonbinding range. Model context is shown but cannot manufacture model-specific prices. |
| 12.3 Before/after examples | Provider draft from a trusted completed repair, validated encrypted images, immutable customer-reviewed proposal, exact consent, audited recent-sign-in admin inspection/publication, participant withdrawal and atomic media erasure. |
| 12.4 Recycling | `/recycling`: general safety/disposal information and official references; explicitly no GadgetAid collection partner or pickup. |
| 12.5 Save and compare | UID-private saved technicians and consistent comparison of up to three visible real services. Unavailable entries stay unavailable. |
| 12.6 Referral/loyalty | Private credit/spend history, trusted new completion eligibility, referral limits, seven-day maturity, 365-day expiry and transactional quotation redemption/refund. |

The provider voluntarily funds each offer: 100 mature points gives 5% off labor, capped at USD 5; parts are excluded. The customer must separately authorize spending. Eligible repairs earn 20 once per Bangladesh day; a qualifying first referred repair earns the inviter 40, capped at three referral rewards per month. Minimum quote/labor values and other eligibility rules are stated in the product policy. No cash/payment API or automatic provider enrolment was added.

## Automated verification

- Backend: `npm test` — 128 passed, including 19 new Phase 12 tests.
- Frontend: `npm test` — 21 passed, including three new calculator boundary/arithmetic tests.
- Frontend: `npm run lint` and `npm run build` passed. Main bundle 356.10 kB, Firebase separated at 174.85 kB; new pages are lazy routes.
- `npm run test:mongo` — two suites passed against a disposable local MongoDB replica set at loopback port 27028, using random test databases and synthetic identities. These tests never read production credentials or connect to Atlas.

Coverage includes current ownership/visibility, private response allowlists, forged consent/roles/revisions, exact-revision admin image inspection, metadata stripping/encrypted image round trip, quota counters and atomic erasure. Failed gallery audit/erasure rolls back content and counters. Concurrent cold wallet/bookmark creation remains idempotent. Ledger insertion failure rolls back quotation approval; two competing approvals cannot spend the same 100 points. Cancellation restores only unexpired allocations once. Pending/expired/restricted wallets and revoked funding providers cannot redeem. The real MongoDB test also drives a newly approved repair through all handover stages and projects its pending reward.

## Browser verification

An isolated memory-backed app at port 5176 and API at 5055 used synthetic customer/provider/admin identities. No real Firebase account, customer photo, notification email, external model call or production data was used.

Verified calculator output, real-fixture listing estimates, two/three-service comparison, saved-technician ownership isolation, referral claim, provider discount opt-in, explicit customer approval, correct original labor/discount/net total, points spend and pending handover credit. Verified private provider images, customer consent, audited admin inspection/publication and signed-out public gallery with no private identifiers in its DOM. Gallery images were synthetic solid-color images uploaded through the local raw API; native file-picker selection was not exercised.

Fifteen populated screen states at widths 360, 390, 768, 1366 and 1440 produced 75 geometry checks without horizontal document overflow. See [measurements](PHASE_12_RESPONSIVE.json) and [synthetic gallery screenshot](screenshots/phase12-gallery-desktop.png). No browser console errors were captured at the final check. Temporary viewport overrides were reset.

## Operational limits

This is a local/code release, not a production deployment. The existing real local backend is restarted with the new implementation; readiness and public/private route boundaries are smoke-tested without synthetic production writes. No historical reward backfill, production gallery publication, real redemption, email delivery or external AI activation was performed.

Completion records and caps reduce abuse; they do not prove payment or eliminate colluding accounts/providers. Human moderation must check visible identifiers in images. Public copies cannot be revoked outside GadgetAid. Listing ranges are not model-specific final bills, and recycling references do not establish a Bangladesh collection service. Existing MongoDB transactions and the existing receipt encryption key are required; review query indexes/capacity before large-scale rollout.
