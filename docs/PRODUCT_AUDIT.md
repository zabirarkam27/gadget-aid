# GadgetAid product audit — Phase 0

Audited 2026-11-05 (Asia/Dhaka), branch `main`, source commit `97d1ec7`. Starting working tree was clean. Scope follows the supplied `C:\Users\Zabir\Downloads\plan.md`: audit only; stop before Phase 1. Application code, dependencies, production configuration, and production records were not changed. Build output was regenerated locally in ignored `dist/`.

## Evidence and confidence

- All tracked application source, package manifests, router, styles, API helpers, Firebase initialization, and hosting configuration were read. No applicable `AGENTS.md` was found in the repository or checked ancestor directories.
- Live browser checks used [the deployed site](https://gadget-aid.web.app/). These confirm observed public behavior, not that the deployed backend matches this checkout.
- Backend findings are from source inspection. No database connection, authenticated API exercise, production write, or migration was performed. Document fields below are inferred contracts, not a database schema or verified sample of private records.
- See [baseline report](BASELINE_VALIDATION.md), [route map](ROUTE_AND_FEATURE_MAP.md), [API map](API_MAP.md), and [issues](KNOWN_ISSUES.md).

## Architecture and repository

| Location | Responsibility |
| --- | --- |
| `gadget-aid-client/src/main.jsx` | React StrictMode, Firebase auth context, toast container, router |
| `gadget-aid-client/src/router/` | Browser routes and login guard |
| `gadget-aid-client/src/provider/AuthProvider.jsx` | Firebase user state and email/password operations |
| `gadget-aid-client/src/pages/` | Authentication, home, customer bookings, provider CRUD/work queue, contact/error |
| `gadget-aid-client/src/components/` | Shell, home sections, listing/cards/details/booking modal |
| `gadget-aid-client/src/utils/` | API base and bearer-token fetch wrapper |
| `gadget-aid-client/src/index.css` | Tailwind 4, DaisyUI 5 custom light/dark themes |
| `gadget-aid-client/public/` | Logo, banner, about image, 404 image, Vite icon, redirects |
| `gadget-aid-server/index.js` | Entire Express API, Firebase Admin verification, MongoDB access |
| Package/lock files in each app | Separate npm applications; no root workspace manifest |
| Root/client `README.md` | Product description, partly outdated architecture/behavior claims |

Other local items include installed `node_modules/`, generated client `dist/` and `.firebase/`, ignored environment files and repair ZIP archives. They are not additional active applications; archives were not unpacked or treated as source. Local `.vscode/` is editor configuration. No tracked tests, database schema/migration files, CI workflows, upload service, or separate role model were found.

Client manifest: React 19, Vite 6, React Router 7, Firebase 11, Tailwind 4, DaisyUI 5, Framer Motion 12, React Icons, React Toastify, React Helmet Async; also localforage, match-sorter and sort-by. Installed Vite reported 6.3.5 and DaisyUI 5.0.35 during build. No dependencies were added or upgraded. Server: CommonJS Node, Express 5, MongoDB driver 6, Firebase Admin 12, cors and dotenv.

## Feature inventory

“Working” means the named behavior was observed live or a local command passed. “Partially Working” means implemented with known gaps and/or without end-to-end verification. “Not Implemented” means no matching route/API/implementation was found in active source.

| Feature | Label | Evidence / limits |
| --- | --- | --- |
| Public home, listing, client-side name search | Working | Live home and populated listing observed; `Smartphone` filters to matching record |
| Public contact information and footer navigation | Working | Live contact page renders; mailbox ownership/delivery unverified |
| Production client build | Working | `npm run build` passes, with bundle warning |
| Email registration/login, Google login, logout | Partially Working | Firebase implementation exists; no credentials submitted, account created, or logout exercised |
| Private-route login guard | Partially Working | Live View Details redirects to login; return path state is broken in source |
| Service details and booking creation | Partially Working | Implemented, but API errors/date validation/booking integrity incomplete; no booking submitted |
| Add/edit/delete own services | Partially Working | Token and ownership checks exist; edit validation/error UX incomplete; no mutations tested |
| Customer booking list | Partially Working | Token-filtered API, spinner and empty state; no authenticated runtime test; errors may masquerade as empty or crash |
| Provider queue and three statuses | Partially Working | Token-filtered API and allowed status values; no transition/history rules or user-facing failure feedback |
| Light/dark theme toggle | Partially Working | Centralized palettes and localStorage exist; two independent toggle instances can disagree; not interacted with live |
| Responsive layouts | Partially Working | Responsive classes and limited live geometry checks exist; full journey matrix not validated |
| Contact submission/support tickets | Not Implemented | Static text only, no form/API |
| Password reset | Not Implemented | Link exists, live destination renders not-found; no reset handler |
| Categories, server filters, pagination | Not Implemented | Listing fetches every service and filters names locally |
| Popularity ranking | Not Implemented | Home takes first six records without ranking |
| Customer/provider/admin roles | Not Implemented | Any authenticated user can provide services and book; no role claims or role collection |
| Push updates, notifications, messaging | Not Implemented | Fetch-on-load and local status update only; no polling, WebSocket or SSE |
| Quotations, payment, invoices, warranty, device history, reviews, availability, AI, admin | Not Implemented | Roadmap items; no routes, collections, or APIs found |

## Authentication and authorization

`AuthProvider` uses Firebase `onAuthStateChanged`, exposes create/login/logout, and blocks initial application rendering with a spinner until auth resolves. Registration creates a Firebase user, updates name/photo, signs out, and sends the user to login. Google uses `signInWithPopup` directly in login/registration pages. No application user collection or role registration exists.

`authFetch` calls the current Firebase user's `getIdToken()` before each private request and attaches `Authorization: Bearer …`. Token caching/refresh is delegated to Firebase SDK; no stored application JWT or custom refresh endpoint exists. There is no explicit retry after a 401 or token-change subscription. Public reads use plain fetch.

Server `verifyToken` uses Firebase Admin `verifyIdToken`, then stores decoded email. Service ownership and booking list/status authorization compare emails to that identity. This is a useful baseline, but booking creation still trusts provider identity supplied by a customer. Verification does not explicitly enforce verified email, check revocation, assign roles, or use UID ownership. See the API map for exact checks; these limitations were not penetration-tested live.

## Configuration, assets, and deployment

Only environment variable **names** were inventoried; values are deliberately omitted. Client `.env.example` and source reference `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. Local `.env`, `.env.local`, `.env.production` are present; local and production override files contain the API-base key. Vite embeds `VITE_*` into browser output; privileged secrets must never be put there. Presence does not prove correctness of any value.

Server references `DB_USER`, `DB_PASSWORD`, `FB_PROJECT_ID`, `FB_CLIENT_EMAIL`, `FB_PRIVATE_KEY`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`. Local `.env` and tracked `.env.example` are present. Root and app ignore rules cover current env files and dependencies. Git index lists only env examples, not actual env files. Git history was not scanned for historical exposure.

Firebase Hosting serves client `dist/` with SPA fallback, and `.firebaserc` supplies project selection. Server `vercel.json` routes all requests to exported `index.js`; local listen is conditional on `NODE_ENV !== production`. Deployment dashboard settings and the deployed revision are unverified. Server CORS defaults to localhost and requires the production origin to be configured. Root server response is a liveness message, not a database-readiness probe. Mongo connection is asynchronous while routes become available immediately.

Image handling uses URLs, not uploads: add-service accepts a required image URL; registration accepts a photo string. No Firebase Storage use or secure file upload path exists despite storage bucket configuration. Navbar/footer import the local logo; banner imports local banner; AboutUs uses a remote image although a local about image exists. Error uses existing `/404.png`. Favicon points to existing `/logo.png` with an SVG MIME declaration. No consistent image fallback or lazy loading exists.

Current themes are `gadgetlight`/`gadgetdark` with centralized DaisyUI color/radius tokens. HTML and toggle default to light; the desired dark navy/cyan default is future Phase 1 work. Browser live appearance was dark during inspection; its selection mechanism was not established. No custom font, full spacing/type/motion system, reduced-motion handling, or dialog primitives exist. Containers/radii vary by component.

## Recommended sequence and unresolved decisions

1. Review this audit and the proposed booking-integrity fix. Because it affects private data correctness, approve a bounded reliability task before launching new booking functionality; do not quietly combine it with visual work.
2. Proceed to the plan's design proposal and Phase 1 only after review: reuse DaisyUI tokens and existing assets, decide whether to retain complete light mode, define component variants and accessible states. Do not add a role selector without backend role support.
3. Continue global shell and public-page tasks independently, preserving the contracts in these maps until deliberately changed.

Outstanding inputs for later implementation: safe development database/test accounts for customer and provider, deployed revision/API configuration, actual historical field variants, real support contacts, service currency policy (UI currently uses dollars), duplicate/self-booking/cancellation rules, and substantiation for marketing claims. No production credentials are needed in these documents.
