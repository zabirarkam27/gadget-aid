# Live private receipt storage release

Production status: **READY**, verified 6 November 2026 (Asia/Dhaka).

| Component | Live target | Release |
| --- | --- | --- |
| Frontend | [GadgetAid](https://gadget-aid.web.app) | Firebase Hosting version `42daecc043b1c521`, finalized and released at 10:31 Bangladesh time |
| Backend | [GadgetAid API health](https://gadget-aid-server.vercel.app/health) | Vercel deployment `dpl_H3v7KVV2XQsxnAkCAb6q9NRX5Jy9`, production, READY |
| Application source | Git main | `ff16f8e` — Add private receipt uploads; follow-up changes record packaging exclusions and release evidence |
| Framework/runtime | React/Vite frontend; Express backend | Backend Node 22.x, native Sharp build verified; Vercel build completed in 9 seconds |

Use [My devices](https://gadget-aid.web.app/devices), sign in, open or add your device, then use **Private receipts**. Upload accepts JPEG/PNG photos up to 3 MiB with explicit storage-policy consent. PDF remains unsupported. Only the device owner can read/download/delete a receipt.

## Configuration applied

The existing Vercel project `gadget-aid-server` and Firebase Hosting site `gadget-aid` were reused. The backend production environment now has the existing receipt key, matching Firebase/Atlas server credentials, `APP_URL=https://gadget-aid.web.app`, production mode and CORS origins limited to the two live Firebase Hosting domains. Encryption/private credentials are stored as Vercel production secrets, not build arguments or frontend values. The previous-key map is preserved when configured; no new encryption key or database migration was introduced for deployment.

`.vercelignore` excludes environment files, local dependencies, tests, setup scripts and IDE files. The reviewed backend source upload contained 25 files and no actual encryption/Firebase/database secrets. The frontend build was checked for its production API URL and absence of private server key material before Firebase publication. Local environment and Vercel project-link files remain ignored by Git.

The live frontend JavaScript matched the reviewed local production build byte-for-byte and contained the receipt controls and correct API origin. No QA fixture server, synthetic login toolbar or local receipt encryption key is bundled in production.

## Live verification

- Backend `/health` returned 200 and the public catalogue returned its existing 13 records. Anonymous device and receipt requests returned 401.
- Upload CORS preflight accepted the live frontend origin and required authorization/upload-policy headers.
- A temporary baseline-only Firebase QA identity created a synthetic device, saw configured storage, uploaded the repository's fake invoice and downloaded its normalized JPEG (43,794 bytes). The existing local encryption key successfully decrypted the production-stored ciphertext to the exact downloaded bytes, confirming key continuity.
- Reusing the same upload reference returned the same receipt rather than duplicating it. A second temporary baseline-only identity received 404 when requesting the first identity's receipt.
- Deleting the synthetic device through the live API erased its device/receipt metadata and encrypted content. Both temporary Firebase identities and their remaining synthetic quota guards were then removed. No real customer's document or existing account was modified by this verification.
- The bounded error-level scan for this backend deployment over the preceding 30 minutes returned no logs. Health and smoke checks passed; this is not a claim of continuous monitoring. External drains were not inspected or changed.

## Operation and recovery

The previous backend deployment was `gadget-aid-server-cw2fq0582-zabirarkam27s-projects.vercel.app`; the previous Firebase Hosting version was `7d46c7a089a51d4e`. Those releases predate the new private APIs. Do not independently roll the backend back to older authorization behavior while retaining the new frontend; coordinate any rollback and retain all receipt key material.

The key is now present in the production secret store and the ignored local server environment. Keep a restricted operator backup as described in [receipt storage/key recovery](RECEIPT_STORAGE.md). A new random key does not recover existing encrypted receipts. No payment/email-delivery activation or unrelated Firebase resource deployment was performed.
