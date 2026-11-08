<p align="center">
  <img src="gadget-aid-client/public/logo.png" alt="GadgetAid logo" width="88" />
</p>

<h1 align="center">GadgetAid</h1>

<p align="center">A second life for your tech.<br />Discover repair services, approve quotations and follow every step of a repair.</p>

<p align="center">
  <a href="https://gadget-aid.web.app">Live website</a> ·
  <a href="https://gadget-aid.web.app/login">Try the demo</a> ·
  <a href="#quick-start">Run locally</a> ·
  <a href="#documentation">Documentation</a>
</p>

## Features

| Area | What you can do |
| --- | --- |
| Discovery | Search and filter services, browse technician profiles, save technicians and compare up to three listings. |
| Repair workflow | Request a booking, review diagnosis and versioned quotations, approve work and follow the status timeline. |
| Communication | Private booking conversations, unread counts and in-app notifications. |
| Device records | Private Gadget Passports, repair history, encrypted receipt photos, private QR links and provider warranty claims. |
| Repair decisions | Repair/replace calculator, nonbinding listing-price estimates, guided suggestions and consented, moderated before/after examples. |
| Rewards | Eligible completion/referral points, one-year expiry and technician-funded quotation discounts with customer consent. |
| Operations | Technician approvals, moderation, disputes, reviews, categories, protected role management and audit records. |

Includes dark/light themes, responsive layouts and keyboard-accessible forms and dialogs. Provider claims remain self-reported; review ratings come from eligible completed bookings.

## Try a demo

Visit the [login page](https://gadget-aid.web.app/login) and click **Log in as Demo Admin** or **Log in as Demo Super Admin**. Manual sample login also works:

| Account | Email | Password |
| --- | --- | --- |
| Demo Admin | `admin@example.test` | `GadgetAidDemo123!` |
| Demo Super Admin | `superadmin@example.test` | `GadgetAidDemo123!` |

These public synthetic credentials open a browser-only sample workspace. You can edit sample data; changes reset on reload. Super Admin can additionally manage sample Admin access. The demo does not grant access to live users, bookings or Firebase accounts.

## Technology

| Layer | Stack |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS, daisyUI |
| Authentication | Firebase Authentication and Firebase Admin |
| Backend | Node.js 22, Express, MongoDB transactions |
| Private images | Sharp normalization and AES-256-GCM encryption |
| Optional integrations | Resend email and Vercel AI Gateway |
| Hosting | Firebase Hosting frontend and Vercel API |

## Quick start

### Requirements

- Node.js **22.x** and npm.
- A transaction-capable MongoDB replica set or Atlas cluster.
- A Firebase project with Email/Password and Google sign-in configured, including authorized frontend domains.

```bash
git clone https://github.com/zabirarkam27/gadget-aid.git
cd gadget-aid
```

Create a `.env` in each application using the [client example](gadget-aid-client/.env.example) and [server example](gadget-aid-server/.env.example) as references. Preserve existing credentials when configuring an existing checkout.

| Application | Configuration |
| --- | --- |
| Server | `DB_USER`, `DB_PASSWORD`, `FB_PROJECT_ID`, `FB_CLIENT_EMAIL`, `FB_PRIVATE_KEY`; locally use `NODE_ENV=development`, `PORT=5000`, `CORS_ORIGINS=http://localhost:5173`. |
| Client | `VITE_API_URL=http://localhost:5000` and the `VITE_FIREBASE_*` web configuration fields. |

The server currently uses the project's Atlas cluster in `gadget-aid-server/index.js`; adapt the connection for your own cluster. Firebase web configuration is public. Server credentials and encryption/API keys must never use a `VITE_` prefix or be committed.

**Terminal 1 — backend**

```bash
cd gadget-aid-server
npm ci
npm start
```

**Terminal 2 — frontend**

```bash
cd gadget-aid-client
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). API readiness: [localhost:5000/health](http://localhost:5000/health).

### Optional configuration

- **Private receipt/gallery images:** configure the server vault and preserve existing encryption keys. [Storage guide](docs/RECEIPT_STORAGE.md).
- **Booking email:** requires a Resend key, verified sender, frontend URL and protected scheduler. [Email guide](docs/EMAIL_DELIVERY.md).
- **External AI:** requires a server Gateway key, enablement and user consent. Guided suggestions work without it. [Assistant guide](docs/AI_ASSISTANT.md).
- **Support mailbox:** set `VITE_SUPPORT_EMAIL` after verifying mailbox ownership and delivery.

Booking email and external AI are not currently activated on the live site. Payments, instant push notifications and recycling collection are not implemented.

## Access and security

| Role | Access |
| --- | --- |
| Public visitor | Public services and technician information. |
| Signed-in customer | Their own bookings, conversations, devices, reviews and points. |
| Technician | Approved access to their own services, schedules and repairs. |
| Admin | Platform operations and Technician approval; cannot create Admins or Super Admins. |
| Super Admin | Admin operations plus Admin access management. |

The backend derives booking prices and ownership from canonical records and checks authorization and token revocation. Sensitive operator actions require recent sign-in, a reason, confirmation and transactional audit records. Super Admin bootstrap is server-only; see [operations](docs/OPERATIONS.md).

## Development and checks

| Directory | Command | Purpose |
| --- | --- | --- |
| `gadget-aid-client` | `npm test` | Frontend behavior and utility tests |
| `gadget-aid-client` | `npm run lint` | ESLint |
| `gadget-aid-client` | `npm run build` | Production build |
| `gadget-aid-client` | `npm run qa` | Isolated browser QA at `127.0.0.1:5176`, memory API at port `5055` |
| `gadget-aid-server` | `npm test` | Authorization, validation and workflow tests |
| `gadget-aid-server` | `npm run test:mongo` | Disposable local replica-set transaction tests |
| `gadget-aid-server` | `npm run email:check` | Email configuration readiness |

Tests use synthetic identities and disposable data. The developer QA harness is separate from the public demo and must not be deployed. Run the checks above locally before releasing changes.

## Project structure

```text
gadget-aid/
├── gadget-aid-client/   # React app, assets and frontend tests
├── gadget-aid-server/   # Express API, operator scripts and backend tests
└── docs/               # API, security, configuration and product policies
```

## Deployment

Use the linked Vercel project for the backend and Firebase Hosting for the frontend:

```bash
# From gadget-aid-server
vercel deploy --prod

# From gadget-aid-client, with production frontend configuration
npm run build
firebase deploy --only hosting --project gadget-aid
```

A Git push alone does not publish Firebase Hosting. Release compatible backend/frontend versions together, verify `/health` and preserve private image keys. Never deploy the QA server or copy server secrets into frontend configuration.

## Documentation

- [API contract](docs/API_CONTRACT.md)
- [Roles, bootstrap and local integration tests](docs/OPERATIONS.md)
- [Account security](docs/ACCOUNT_SECURITY.md)
- [Receipt storage and key recovery](docs/RECEIPT_STORAGE.md)
- [Email delivery](docs/EMAIL_DELIVERY.md)
- [Repair assistant privacy and setup](docs/AI_ASSISTANT.md)
- [Gallery consent and discount-points policies](docs/PRODUCT_POLICIES.md)
