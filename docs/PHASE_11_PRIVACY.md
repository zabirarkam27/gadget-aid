# Repair assistant privacy and safety design

6 November 2026. Scope: Phase 11 text-only guided assistant and optional AI classification. No private passport reuse, image upload, booking automation or autonomous agent tools.

## Data flow

Signed-in customer → validated device category, optional brand/model, symptoms (10–1,000 characters), onset and danger checkbox → GadgetAid backend. No assistant draft/history is written to MongoDB, logs, localStorage or analytics. React state is cleared when the account changes or page unmounts. The backend never fetches saved passports, serials, receipts, repair history or profile details for the assistant. Do not enter passwords or personal identifiers. Existing independent booking/account data is unaffected.

Guided mode uses local rules and public service records; it sends nothing to an AI provider. With AI configured, the user must choose AI mode and accept policy `repair-ai-v1` for the current description. Editing a field clears consent. Only category/brand/model/symptoms/onset are sent, through Vercel AI Gateway to the configured provider. UID, email, auth token and database records are never part of the model prompt. No model tools, browsing or conversation memory are provided. The model may process/retain requests under its provider/Gateway policies; zero retention is not promised. A future provider, retention or input change requires reviewing this design and policy version. SDK telemetry is disabled; infrastructure request-body logging must remain off. External processing requires both server enablement and request consent.

The owner has no AI Gateway key. Therefore the real local/production model integration is not activated. Configuration returns `aiAvailable=false`; the UI labels output as rules-based rather than AI-generated. No live provider call was performed. A configured provider failure returns honest guided fallback, never a fabricated AI answer.

## Safety boundaries

The permanent UI safety notice, explicit danger checkbox and server English/Bangla hazard checks precede AI. Heat/swelling/smoke/burning smell/liquid/sparks trigger fixed stop-use/charging guidance and qualified help; fire/smoke is not handled as an ordinary booking wait. No model request occurs in this branch, even with consent. Keyword checks are conservative and cannot identify every language, spelling, negation or hazard. The notice and all normal steps retain safety conditions; this is not a validated diagnostic or emergency service.

The AI returns only allowlisted issue/question IDs in a bounded structured object. Both SDK and application validate it. The UI maps IDs to fixed preliminary categories/questions and fixed safe steps. Raw model instructions, diagnosis, HTML, links, price/warranty promises or repair procedures are never rendered. Invalid output is discarded. This intentionally constrained classification is AI assistance; ordinary guided results are explicitly distinguished. Safety text follows [consumer battery safety guidance](https://www.consumerproductsafety.gov.sg/consumers/product-safety-tips/products-that-charge-or-power-appliances/safety-tips-on-lithium-ion-batteries/) and [Microsoft device repair safety](https://learn.microsoft.com/en-us/surface/service-guides/surface-repair-safety-guidelines); do not attempt the technician procedures from those sources.

Suggested services come solely from bounded, filtered real database queries and existing publication/account/role checks. The model cannot invent listings or choose URLs. Related listings are not a compatibility, diagnosis, availability or quality guarantee; the user confirms scope with the provider. No booking is submitted by the assistant. Existing direct catalogue/booking paths remain available.

## Operational controls

AI is off unless `AI_REPAIR_ENABLED=true` and server-only `AI_GATEWAY_API_KEY` exists. Never use a VITE-prefixed key. AI SDK 7 uses structured `generateText`/`Output.object` through Gateway; the configured default model ID was checked against the public model catalogue. Operator may change `AI_REPAIR_MODEL` only after reviewing provider/data handling.

At most 10 AI attempts/user/day and 100 total/day, using transactionally updated fixed `operationMeta` counters and Bangladesh dates; failed attempts count. Only UID-linked counts/day are stored, not prompts/results. Counts overwrite on subsequent days; there is no assistant-history store. Two in-flight AI calls per server instance, 15-second provider abort, max 500 output tokens, no automatic model retry. Limits control calls/tokens, not a currency-denominated spending cap. Serverless instances can each have two active calls; shared daily quotas still apply. Guided requests have no paid calls; platform traffic protection remains a separate infrastructure responsibility.

To activate later: add the server key, review Gateway/provider retention settings and account spend controls, set the enable flag, restart/deploy matched backend, then make one consented synthetic request and verify provider acceptance plus labeled output. Do not claim live AI verification until this is done. The user can continue with guided mode or the catalogue now.
