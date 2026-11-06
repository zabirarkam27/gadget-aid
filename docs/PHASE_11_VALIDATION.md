# Phase 11 — Repair assistant

6 November 2026. Text-only assistant at `/repair-assistant`, linked from the home hero and signed-in workspace. Guided mode works without external AI; optional AI classification requires operator configuration and per-description consent. The owner has no AI Gateway key, so live AI activation/provider quality remains unverified and is not claimed complete.

## Delivered behavior

- Category, optional brand/model and onset, bounded symptom description, explicit danger checkbox. All server fields allowlisted/type-checked; account/device/receipt IDs and uploads rejected.
- Fixed stop-use/charging and qualified-help guidance before the model for recognized English/Bangla hazards or an explicit danger flag. No diagnosis claim or hazardous DIY instructions. Keyword detection is conservative, not a complete hazard classifier; permanent safety guidance remains visible.
- Optional AI selects only issue/question IDs using AI SDK 7.0.163 structured output through Gateway, with runtime validation. Model output cannot introduce arbitrary troubleshooting, HTML, links, pricing, warranties or service records. No autonomous agent/tools are used; a single bounded classification call suffices.
- Related services are bounded real MongoDB records and pass current visibility/account/role checks. No results and catalogue failure have honest states; direct service discovery/booking remains available.
- Per-description consent, no automatic private data retrieval, no assistant history storage, identity-keyed form reset, client aborts and external-provider failure fallback. See [explicit privacy/data-handling design](PHASE_11_PRIVACY.md).
- AI attempts have shared per-user/global daily quotas, instance concurrency cap, 15-second provider abort, 500 output-token cap, no SDK retries and telemetry/input/output recording disabled. Counters contain only UID-linked day/count metadata; no prompt/result retention in application storage.

## Executed checks

- Backend: **109 passing tests**, including six new assistant tests. Missing/invalid identity, malformed inputs/extra fields, missing/stale consent, English/Bangla/zero-width hazard text, danger override, no model call on safety paths, visible real service IDs, moderated listing exclusion, no guided-mode persistence, AI output allowlist, provider failure fallback, quota enforcement and SDK adapter bounds are covered.
- Real local MongoDB replica set: integration suite passed. Eight consented fake classifications followed by six competing requests admitted exactly two more AI attempts; shared user/global counters remained 10. Existing appointment contention and booking/admin/review/warranty/receipt rollback checks still passed. The fixture classifier made no external requests. Database/container are disposable, with no production data.
- Frontend: ESLint, 18 existing tests, production build. Assistant route is lazy loaded (~8.1 kB before gzip); no 500 kB chunk warning. Backend files passed `node --check`; actual installed SDK exports and bundled structured-output/schema/telemetry documentation were checked. This JS repository has no TypeScript typecheck script.
- Browser, isolated memory fixture only: guided matching to real fixture listings; English input and Bangla swelling/heat safety output; offline request preserves draft; changing accounts clears it. Simulated classifier enabled only in QA to verify submit blocked before consent, consent reset after editing, labeled AI results, and danger checkbox returning to non-AI mode. Standard QA was restored with fake AI disabled afterwards. No real key, external model, personal record, production booking or Firebase account was used.
- 360/390/768/1366/1440 widths: guided, safety and simulated-AI results, **15 geometry checks**, all actual widths matched and no page horizontal overflow. Error-level browser log sample was empty. This is not an exhaustive accessibility audit, real model evaluation or load test.

Evidence: [geometry](PHASE_11_RESPONSIVE.json), [guided desktop](screenshots/phase-11-guided-desktop.png), [safety mobile](screenshots/phase-11-safety-mobile.png). Repeat isolated UI tests with `npm run qa`; `QA_ASSISTANT_AI=1` deliberately substitutes a fake classifier and must never be deployed. Ordinary QA has no AI provider.

## Remaining activation dependency

Configure server-only `AI_GATEWAY_API_KEY`, review Gateway/model-provider retention and spend settings, then enable `AI_REPAIR_ENABLED=true`. Default `AI_REPAIR_MODEL=openai/gpt-6.1-sol` was verified against the public Gateway catalogue on this date. Confirm a consented synthetic provider request after configuration before reporting live AI success. Image input is optional in the plan and deliberately omitted: receipt-storage consent does not authorize sending private files to a model. Provider response quality and production load are not verified. No new production deployment or schema migration is included in this phase.
