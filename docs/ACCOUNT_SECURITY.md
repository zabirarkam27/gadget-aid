# Firebase account security

Real accounts use Firebase on the normal frontend; QA demo credentials are separate. Real operator passwords, reset links, tokens and service credentials must never be added to Git or README. Accounts are resolved by exact Firebase UID; role setup uses verified, enabled identities and audited server grants. Existing accounts are reused rather than resetting their password through Admin SDK.

## Password and provider controls

- `/account-security` is available to every signed-in member, including restricted members. Passwords go directly to Firebase client SDK calls, never the Express server, MongoDB, audit entries or browser storage.
- A password update checks local strength/confirmation, the actual Firebase project policy, current-password reauthentication and unchanged caller UID. Google-only users reauthenticate with their existing Google provider, then link a password credential to that same verified UID. No anonymous account or second identity is created.
- Google connection requires reauthentication and Firebase account linking. An already-used credential is rejected with guidance; there is no automatic role or account merge. Popup cancellation and failure remain visible. The Google provider must be enabled and the app origin authorized in Firebase.
- Passwords are 12–128 characters with uppercase, lowercase, digits and a symbol. Registration uses the same local checks plus Firebase policy validation. Firebase project policy is enforced for password creation/reset/change. Existing logins are not forced to upgrade. Email enumeration protection stays enabled.
- On successful password update, the app signs out and redirects to login. Firebase revokes password-session refresh tokens on password changes/resets. Every private API now calls `verifyIdToken(token, true)` so revoked/disabled sessions fail on the next request; frontend token refresh cannot bypass this. Revocation checks add Firebase network dependency to private API authentication.
- The existing Firebase-hosted reset flow remains available from `/forgot-password`. It uses the Firebase email action's validity and single-use enforcement, and presents generic feedback rather than confirming whether an email exists. Email verification remains required before privileged grants become usable.

The app does not collect passwords in chat, store plaintext passwords, send an operator-chosen shared password by email or write passwords to README. Users set passwords privately through Firebase reset links. Project security settings and real grants are external configuration, separate from a Git push; deploy the matching updated client/server to apply code behavior outside localhost.

## Verification

Client tests cover strength boundaries, confirmation/reuse rejection, policy failure, reauthentication failure, operation ordering, Google-only password linking, identity-switch rejection, failed Google linking and saved-password/sign-out-failure distinction. Backend tests require revocation checks across member reads and deny revoked sessions before loading private data. Existing authorization/workflow regressions still apply.

Validation: 18 client tests and 82 backend tests pass; client lint and production build pass (the existing large-bundle warning remains). The demo browser rejected mismatched new passwords and an incorrect current password. [Security form screenshot](screenshots/account-security.png) contains only synthetic data. Real project readback confirmed password/Google sign-in enabled, localhost authorized, enumeration protection enabled and the enforced password policy. Both requested real operator identities were enabled and email verified with their exact current UID grants; their emails/passwords are deliberately omitted from repository documentation. Provider linking remains an explicit user action through Account security and Google consent.

Browser verification uses only isolated fake identities for password form/rejection checks and synthetic actions. Real password entry and Google consent remain user-controlled; no real password was viewed or changed by the agent. Real Firebase account metadata, role grants and enforced project policy are checked through the server SDK without printing secrets. Setup/reset email requests returning success do not prove inbox delivery.

References: [Firebase user management and reauthentication](https://firebase.google.com/docs/auth/web/manage-users), [provider linking](https://firebase.google.com/docs/auth/web/account-linking), [password policy](https://firebase.google.com/docs/auth/web/password-auth), [session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).
