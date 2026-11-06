# Public one-click demo login

6 November 2026 (Asia/Dhaka). Owner requested visible Admin/Super Admin demo credentials and one-click login, then explicitly chose editable sample data. Available at [live login](https://gadget-aid.web.app/login) and normal localhost login.

| Preview | Public synthetic email | Public synthetic password |
| --- | --- | --- |
| Demo Admin | admin@example.test | GadgetAidDemo123! |
| Demo Super Admin | superadmin@example.test | GadgetAidDemo123! |

The two buttons open `/demo` immediately. Typing these exact demo credentials in the normal login form also opens the preview; an incorrect demo password produces an explicit error. Normal Firebase email/Google login remains unchanged for actual accounts.

## Scope and isolation

This is a browser-only preview, not a production Firebase identity or server role. It never calls `setUser`, generates a Firebase token, modifies real roles, or sends demo actions to the live API. Only an allowlisted sample-role string is stored in this tab's session storage; passwords are not stored. A real signed-in account remains unchanged.

Synthetic listings, technician applications, customer restrictions and disputes can be edited with confirmation and a 10–300 character reason. Each change updates sample overview counts and creates an in-memory activity entry (latest 100). Sample bookings are view-only. Only Demo Super Admin sees sample Admin grant/revoke controls; the preview action reducer also enforces that distinction. These client-side limits describe demo behavior, not production authorization.

Reload resets all sample changes and activity while retaining the chosen demo role for the tab. Exit demo clears the sample role and returns to login. Real data cannot be read or changed through this preview. The developer QA app at port 5176 remains separate and is not deployed.

## Validation and release

- Frontend tests: 27 passed, including new synthetic-session storage, invalid password, immutable edits/audit/reset, role restrictions and invalid-action checks. Lint and production build passed; no new dependencies or server/data model changes.
- Source commit `34d7627` — Add demo login. [Node 22 CI](https://github.com/zabirarkam27/gadget-aid/actions/runs/42217933063) passed both application jobs, including 133 backend tests and the existing MongoDB transaction suites.
- Local browser: both one-click roles, invalid demo password, listing hide confirmation/audit, Super Admin sample grant, reset after reload, exit and Admin's missing Admin-access controls verified. Refreshed the existing local Vite server to clear stale pre-upgrade dependency optimization.
- Five states at widths 360, 390, 768, 1366 and 1440: 25 geometry checks without horizontal overflow. [Measurements](DEMO_RESPONSIVE.json).
- Live browser: both one-click roles succeeded, Admin had no Admin-access control, Super Admin granted sample access with confirmation/reason, and Exit returned to the live login page. Final live tab's error-log sample was empty. [Live login screenshot](screenshots/live-demo-login.png). Temporary viewport override reset.
- Published only Firebase Hosting to the existing gadget-aid site: version `5b7690565e39b645`, released 18:28:55 Bangladesh time. Production backend, Firebase accounts, server grants, credentials, encryption keys and actual customer records were not changed.
