# Phase 2 — Global shell

Completed on main, 2026-11-05. The user's current instruction authorizes Phase 2 followed by Phase 3 and direct pushes to main.

Changes: responsive navbar, current-route styling, native disclosure menus with Escape/outside-click dismissal, authenticated account links, sign-out loading/error feedback, image fallback, accessible brand and skip link; footer links now point to actual application routes. All existing route definitions and Firebase auth operations are preserved. Generic social homepage placeholders were removed. Layout uses a flexible main landmark and consistent shared container.

Files: `src/components/Navbar.jsx`, `Footer.jsx`, `ui/Avatar.jsx`, `ui/Brand.jsx`, `src/layout/MainLayout.jsx`, and `src/index.css` under gadget-aid-client. No backend/dependency changes.

Validation: `npm run build` passed (483 modules); targeted ESLint for all changed JSX passed. Browser checked logged-out desktop navigation and 360px expanded/collapsed mobile navigation; Escape returned focus to the menu trigger. Document width345 at viewport360: no horizontal overflow. Account route visibility and existing sign-out implementation were source-reviewed; no account was signed out during this check. Full authenticated/manual logout verification remains deferred to a safe session. Existing five motion-import lint errors and bundle warning are outside this phase.

Next: Phase 3 homepage, services, details, authentication and contact, in that order and with separate checkpoints. Checkpoint: Improve site navigation.
