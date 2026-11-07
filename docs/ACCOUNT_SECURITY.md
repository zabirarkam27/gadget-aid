# Firebase account security

Real accounts use Firebase on the normal frontend; public demo credentials are synthetic and separate. Real operator passwords, reset links, tokens and service credentials must never be added to Git or README. Accounts are resolved by exact Firebase UID; role setup uses verified, enabled identities and audited server grants. Existing accounts are reused rather than resetting their password through Admin SDK.

## Password and provider controls

- `/account-security` is available to every signed-in member, including restricted members. Passwords go directly to Firebase client SDK calls, never the Express server, MongoDB, audit entries or browser storage.
- A password update checks local strength/confirmation, the actual Firebase project policy, current-password reauthentication and unchanged caller UID. Google-only users reauthenticate with their existing Google provider, then link a password credential to that same verified UID. No anonymous account or second identity is created.
- Google connection requires reauthentication and Firebase account linking. An already-used credential is rejected with guidance; there is no automatic role or account merge. Popup cancellation and failure remain visible. The Google provider must be enabled and the app origin authorized in Firebase.
- Passwords are 12–128 characters with uppercase, lowercase, digits and a symbol. Registration uses the same local checks plus Firebase policy validation. Firebase project policy is enforced for password creation/reset/change. Existing logins are not forced to upgrade. Email enumeration protection stays enabled.
- On successful password update, the app signs out and redirects to login. Firebase revokes password-session refresh tokens on password changes/resets. Every private API now calls `verifyIdToken(token, true)` so revoked/disabled sessions fail on the next request; frontend token refresh cannot bypass this. Revocation checks add Firebase network dependency to private API authentication.
- The existing Firebase-hosted reset flow remains available from `/forgot-password`. It uses the Firebase email action's validity and single-use enforcement, and presents generic feedback rather than confirming whether an email exists. Email verification remains required before privileged grants become usable.

Real account passwords are not stored in the application or repository; the published demo passwords belong only to synthetic browser previews. Users set passwords privately through Firebase reset links. Project security settings and real grants are external configuration, separate from a Git push; deploy the matching updated client/server to apply code behavior outside localhost.

## References

Firebase guidance: [reauthentication](https://firebase.google.com/docs/auth/web/manage-users), [provider linking](https://firebase.google.com/docs/auth/web/account-linking), [password policy](https://firebase.google.com/docs/auth/web/password-auth), [session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).
