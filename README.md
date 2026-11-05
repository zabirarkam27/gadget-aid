# GadgetAid

A gadget repair service marketplace built with React/Vite, Firebase Authentication, Express and MongoDB. Customers discover services and request repairs; providers manage listings and update repair status.

## Current features

- Email/password and Google sign-in, password-reset page and protected-route return navigation.
- Service catalogue with name, area and price filters over the loaded records.
- Customer booking history, provider work queue, service creation/edit/removal.
- Controlled repair stages, versioned diagnosis/quotations, customer approval/rejection, quotation questions and a shared audit timeline; refreshed on demand.
- Dark/light themes, responsive navigation, accessible forms and confirmation dialogs.
- Server-derived booking price/provider snapshots, ownership checks and duplicate protection.
- Private booking conversations, unread message counts and persistent in-app notifications with explicit read actions.
- Server-side transactional email adapter, durable delivery records and a protected retry job; requires email provider and scheduler configuration.

There is one account model: an authenticated user can book and offer services. Admin roles, payments, instant push notifications, reviews and reserved appointment slots are not implemented. A selected booking date is a preference.

## Run locally

Use the existing `.env.example` files to configure each application. Keep actual environment files out of Git. `VITE_*` values are bundled into the browser and must not contain privileged secrets.

Backend, from `gadget-aid-server`:

```powershell
npm ci
npm start
```

For local development use `NODE_ENV=development`, `PORT=5000` and include `http://localhost:5173` in `CORS_ORIGINS`. Configure Firebase Admin and MongoDB with your own environment values. GET `/health` checks database readiness; GET `/` is liveness only.

Frontend, from `gadget-aid-client`:

```powershell
npm ci --legacy-peer-deps
npm run dev
```

Set `VITE_API_URL=http://localhost:5000` in the local client environment. Open the URL printed by Vite, normally `http://localhost:5173`. The legacy-peer flag accommodates the existing React 19 / react-helmet-async 2 peer declaration; no dependency versions were changed in these phases.

## Verification

From the client: `npm run build`, `npm run lint`, `npm test`.

From the server: `npm test`. Backend tests start temporary local HTTP servers with fake identities and a fresh in-memory collection fixture. They do not import the environment-backed server entry or connect to MongoDB/Firebase.

For browser QA, run `npm run qa` from the client and open `http://127.0.0.1:5176/booked-services`. This is a separate test root/API using demo customer/provider identities and memory records. Its toolbar labels the environment, permits switching test identity and simulating offline requests. It never uses real authentication or a real database. Restart it to reset demo data. It is not a production build entry; do not deploy the QA server. Ports 5055 and 5176 must be free.

## Data and API policy

New booking requests send only `serviceId`, `date` and optional `instruction`. The server loads the service, derives the price/provider/service information, attaches the authenticated customer and starts the request as pending. One customer/service/date is allowed; duplicates return HTTP409 with the existing booking reference. Existing records are not bulk migrated; repair tracking initializes on the first authorized workflow change.

Removing a service hides it from the catalogue and preserves its ownership record so existing repairs remain manageable. Legacy bookings whose service was physically deleted before this change remain visible to their customer; they are withheld from provider queues when ownership cannot be verified. Recovery requires a separately reviewed reconciliation, not trusting the old client-supplied provider field.

See [current API contract](docs/API_CONTRACT.md), [product plan](plan.md) and [Phase 5 validation](docs/PHASE_5_VALIDATION.md), [Phase 6 validation](docs/PHASE_6_VALIDATION.md) and [Phase 7 validation](docs/PHASE_7_VALIDATION.md).

## Deployment

Firebase Hosting serves the frontend; `gadget-aid-server/vercel.json` points to the exported Express app. Git pushes are not a Firebase Hosting deployment. Release matching backend/frontend together: Phase 6 replaces the old status dropdown with revision-protected workflow actions. Matching legacy booking requests remain supported, but old clients cannot bypass approval using status updates. Avoid a backend-only rollback that would reintroduce arbitrary status writes. No production deployment or migration was performed in Phases 6–7.

## Communication and email

Notifications and conversations refresh every 30 seconds while visible; manual refresh is available. Only the customer and canonical provider can read a booking conversation. Alerts and messages have separate unread counts. Messages do not authorize repairs; quotation approval remains an explicit workflow action.

Email is disabled until the server has a Resend key, verified sender, frontend APP_URL and CRON_SECRET, and a trusted scheduler invokes the delivery job. No secret belongs in VITE variables. See [email setup and recovery](docs/EMAIL_DELIVERY.md) for exact configuration, batch limits and failure handling. Production email delivery has not been activated by this change.
