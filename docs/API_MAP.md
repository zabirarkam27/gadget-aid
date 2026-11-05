# API, identity, and inferred data contracts

Phase 0 source baseline: `gadget-aid-server/index.js`. Client base: `gadget-aid-client/src/utils/api.js` reads `VITE_API_URL` without fallback or validation. Private calls use `utils/authFetch.js`; public calls use fetch. All collections are in `gadgetAidDB`. No live private records or write endpoints were exercised.

## Endpoints

| Method/path | Access/check | Input and collection operation | Response / client consumer |
| --- | --- | --- | --- |
| GET `/` | Public | No DB check | Text liveness message; not used by UI |
| GET `/services` | Public | `services.find().toArray()`; ignores filters/pagination | Array of full service documents; Services + PopularServices |
| GET `/services/:id` | Public; valid Mongo ObjectId | `services.findOne(_id)` | Document; 400 invalid ID, 404 absent, caught 500; ServiceDetails |
| GET `/my-services` | Firebase token | `services.find({providerEmail: decodedEmail})` | Array; ManageService |
| POST `/services` | Firebase token | Truthy name/price/area/description/image required; spreads body and overwrites providerEmail from token | Mongo insert result (`acknowledged`, `insertedId`); AddService; missing fields 400 |
| PUT `/services/:id` | Token, valid ID, existing record, matching providerEmail | Sets name/price/area/description/image from body; no field validation | Mongo update result (`matchedCount`, `modifiedCount`, etc.); ManageService; 404/403 |
| DELETE `/services/:id` | Token, valid ID, existing record, matching providerEmail | Deletes service; no booking cascade policy | Mongo delete result (`deletedCount`); ManageService; 404/403/caught delete 500 |
| POST `/bookings` | Firebase token | Truthy serviceId/serviceName/date required; spreads body and overwrites userEmail from token; no service lookup | Mongo insert result; ServiceDetails; missing fields 400 |
| GET `/bookings` | Firebase token | `bookings.find({userEmail: decodedEmail})` | Array; BookedServices |
| GET `/all-bookings` | Firebase token | `bookings.find({providerEmail: decodedEmail})` | Provider-scoped array, despite endpoint name; ServiceToDo |
| PATCH `/all-bookings/:id` | Token, valid ID; status in enum; existing booking, matching providerEmail | `$set: {status}` | Mongo update result; ServiceToDo; 400 invalid status, 404 absent, 403 non-owner |

Token failures/missing bearer header return 401 `{message: "Unauthorized access"}`. Invalid path IDs return 400 `{message: "Invalid id"}`. Private routes derive identity from verified token email, not a query parameter. Status enum is exactly `pending`, `working`, `completed`; any transition among them is accepted. No UID/role guard, timestamps or history is recorded on status update.

Success response shapes vary between arrays, documents, text and Mongo results; errors usually have `message`, while uncaught errors use Express defaults. Most operations have no local try/catch or centralized JSON error handler. Client callers generally parse JSON without checking `res.ok` or validating shape. A 401 object stored as a list can reach `.map` and throw, or be mistaken for an empty result; fetch failures are often console-only.

## Services — inferred documents

| Field | Writer / expected value | Caveat |
| --- | --- | --- |
| `_id` | Mongo ObjectId | POST spreads body, so arbitrary client fields can reach insertion |
| `name`, `area`, `description`, `image` | AddService form strings; image URL | POST checks truthiness, PUT not validated; no length/type/URL allowlist |
| `price` | Number input `.value`, therefore normally string | No canonical numeric conversion/range/currency validation; numeric zero fails POST truthiness while string `"0"` passes |
| `providerEmail` | Server overwrites with token email | Used for listing/edit/delete ownership; publicly returned in whole service document |
| `providerName` | Client `user.displayName` | Not authoritative server profile lookup |
| `providerImage` | AddService `user.photoURL` | Card/details read `providerPhoto` instead; no normalization |
| `providerPhoto` | Expected by display components | Not written by current creation form; historical population unverified |
| `createdAt` | Client Date serialized to ISO string | No server timestamp; PUT does not update it |

No validator, explicit indexes, service active/bookable flag, categories, ratings or verified-provider fields are defined. Do not infer them from UI marketing copy or use them for filters without designing the contract.

## Bookings — inferred documents

Current ServiceDetails submits `serviceId`, `serviceName`, `serviceImage`, `providerEmail`, `providerName`, `userName`, `date`, `instruction`, `price`, `status: "pending"`. Server spreads the whole body and adds/overrides `userEmail` from token. Mongo creates `_id` normally. `serviceId` is a client string; it is not validated as an ObjectId or checked against services. `date` is a date-input string with no server format/range/availability check. Price, service snapshot, provider identity and initial status remain client-controlled.

Customer cards read `status` with fallback `serviceStatus`; provider queue ignores the legacy field and defaults missing status to pending. No backfill or legacy DB inspection has been done. There are no uniqueness constraints, idempotency keys, creation/update timestamps, quotation objects, status event records, or defined cancellation/payment/warranty references. Service deletion leaves independent snapshot bookings behind.

The forged providerEmail problem affects both data accuracy and status authorization: a customer's body can name a different provider, and future provider access trusts the stored value. The token still correctly limits customer list access to the authenticated email; this does not make the service/provider snapshot authoritative.

## Runtime and configuration boundaries

Server initializes Firebase Admin from environment, converts literal newlines in private key, sets DNS resolvers, starts Mongo connection asynchronously and exports the app for Vercel. Routes can run before collections are assigned, and connection failure only logs. `express.json()` uses library defaults; there are no custom request-size settings, rate limits, DB schema/index setup or pagination. CORS uses comma-separated `CORS_ORIGINS`, falling back to localhost; CORS is not authorization.

There is no password-reset server endpoint (Firebase client SDK would handle it), support submission endpoint, upload endpoint, admin endpoint, search endpoint, or real-time channel. No privileged configuration was printed or changed.

## Proposed bounded contract change for review

Before new booking functionality ships: accept service identifier plus customer booking details; resolve canonical service on the server; derive price/provider/name/image; set authenticated customer and pending status server-side; validate ID/date/fields; define duplicate/self-booking rules; return stable booking ID. Preserve old records or plan a safe backfill only after observing an authorized development dataset. Add meaningful authorization/tampering tests against isolated fixtures. This is a recommendation, not implemented Phase 0 work.
