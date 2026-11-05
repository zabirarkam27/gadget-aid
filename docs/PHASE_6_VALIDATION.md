# Phase 6 validation — repair workflow

Phase 6 adds controlled repair stages, append-only diagnosis/quotation versions, customer approval/rejection and quotation-specific clarification, and a shared audit timeline. Scope follows Phase 6 of plan.md; general conversations and notifications remain Phase 7.

## Verified

- Frontend: lint passed without warnings; 12 tests passed; production build passed (existing bundle-size advisory remains).

- Backend: 31 isolated HTTP tests passed, including all earlier booking/service/auth protections. The same Express app factory is exercised using memory collections and verified fixture identities. No production Firebase or MongoDB is connected by tests.
- Approval gates: pending cannot jump to work/completion; diagnosis is required for quotation; only the booking customer can approve; unanswered questions and expiry prevent approval; approved quote content stays unchanged through completion.
- Version history: rejected quotations remain available; new quotations have server-derived totals and new IDs; concurrent revision versus approval has exactly one winner. Old revisions and old quote IDs fail safely.
- Permissions: canonical service ownership governs provider access, including removed listings; unrelated accounts cannot inspect or mutate repair details. Customer cancellation is limited to preapproval and terminal records cannot change.
- Legacy: pending enters the new workflow; existing working records finish under an explicit notice without invented approval; old JSON lookalike workflow approvals are ignored.
- Browser QA at loopback 5176 / isolated API 5055: provider accepted request, received device, started diagnosis, saved findings, sent a $70.50 quotation; customer asked a question, approval paused; provider answered; customer explicitly approved; provider advanced through repairing, quality check, ready and completed with handover note. Customer saw approved quote and full timeline. Production records were not changed.
- Browser failure states: offline refresh shows retry and recovers; unrelated provider sees permission error without booking content; session switching resets private state.
- Mobile viewport 390 × 844: quotation costs, shared notes and stacked timeline remain readable without page overflow. Desktop uses paired panels. Screenshots are demo records only.

## Limits

This validates application behavior with HTTP fixtures and the real frontend. MongoDB multi-process race/load testing and real Firebase multi-account end-to-end testing were not performed. Production hosting was not deployed. Existing MongoDB `_id` uniqueness and single-document atomic compare/update semantics are used; no index or bulk migration is required. Updates appear after refresh; no background notifications are claimed. Existing large frontend bundle warning remains.

## Evidence

- [Completed demo repair](screenshots/phase-6-repair-completed.png)
- [Mobile quotation and timeline](screenshots/phase-6-mobile.png)
- [API contract and transition rules](API_CONTRACT.md)
