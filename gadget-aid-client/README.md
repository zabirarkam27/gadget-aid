# GadgetAid client

React/Vite frontend. See the [repository README](../README.md) for environment setup, backend setup, data policy and deployment order.

```powershell
npm ci --legacy-peer-deps
npm run dev
npm run build
npm run lint
npm test
```

`npm run qa` starts the isolated demo environment on port5176 with a memory-backed test API on port5055. This is separate from the actual app; its fake identities are never accepted by the real Firebase-backed API. The optional `design-system.html` entry is a development-only component gallery.

Current product routes: `/`, `/services`, `/services/:id`, `/login`, `/register`, `/forgot-password`, `/contact-us`, `/booked-services`, `/service-to-do`, `/manage-services`, `/add-service`. Authenticated workspaces share navigation and show real fetched counts; all four existing customer/provider features remain available from one account. Status refresh is request/response based.
