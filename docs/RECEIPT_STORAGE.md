# Private receipt image storage

Receipt upload is enabled for device owners on the matched frontend/backend. It uses the existing MongoDB Atlas deployment with application-encrypted content; no public bucket, Firebase Storage download token or new cloud billing account is created. This supersedes Phase 10's initial upload-unavailable limitation for JPEG/PNG photos only.

## Owner workflow and access policy

Open **My devices → a device → Private receipts**. Enter a label, select a JPEG/PNG photo up to 3 MiB and accept the displayed storage/deletion policy. Upload is explicit. Each saved photo can be downloaded as a normalized JPEG or permanently deleted after confirming the exact receipt.

Every list/upload/download/delete request checks the current Firebase token, its revocation status and the device's owning UID. Admin/Super Admin/provider status grants no receipt override. Only an authenticated owner can download; there are no public object URLs or transferable signed links. Restricted owners can read/download/delete existing receipts but cannot upload. A receipt is user supplied and does not prove purchase, repair completion or warranty eligibility.

## Validation and storage

- Accepted source formats: actual JPEG and PNG bytes, with matching MIME type. PDF, SVG, GIF, archives and other formats are rejected. File size is capped at 3 MiB before image processing; private parsing happens after authentication/ownership/consent admission.
- Sharp validates/decompresses bounded images: at most 20 million input pixels, dimensions 32–10,000, a single frame/page, strict corrupt-data rejection and a five-second processing timeout. Accepted input is oriented, flattened onto white, resized within 3,000×3,000 and re-encoded as JPEG. Original compressed bytes, metadata, EXIF and original filenames are not stored. This is image content normalization, not an antivirus-scanning claim. PDF support requires a separate reviewed scanning/quarantine workflow.
- Saved JPEG content is encrypted with AES-256-GCM and a fresh random 96-bit nonce. Authenticated additional data binds the ciphertext to owner UID, device ID and receipt ID. Authentication tags and a private content digest are checked before download. Plain receipt bytes are not written to server disk or MongoDB. Metadata (label/dimensions/size/owner references) is private database data, separate from encrypted file content.
- `deviceReceipts` stores metadata, while `privateReceiptFiles` stores ciphertext/key ID/nonce/tag. Both are committed in one MongoDB transaction, together with a device guard and serialized owner quota. Failure does not leave a committed orphan file. Device deletion atomically erases all receipt metadata/content along with its existing passport deletion work.
- Quotas: 10 receipts/device, 50 receipts/account and 30 MiB of saved JPEG bytes/account. Successful uploads are limited to 10/minute/account. At most two receipt upload requests are admitted concurrently per server process. These limits do not replace deployment-wide traffic protection. A UUID upload reference supports exact retry without duplicate storage; changed content/label cannot reuse the same reference.
- Downloads are served as JPEG attachments, with `no-store`, `nosniff` and a restrictive content-security policy. JSON passport export includes a receipt manifest; the image files are downloaded separately.

## Retention and erasure

Keep receipts until the owner deletes the receipt or its device; there is no automatic age-based deletion. Confirmed deletion removes metadata and encrypted content from the primary database in the same transaction. Original independent booking/warranty records remain. The app makes no receipt backup copies. Files a customer downloaded remain under their control; separately managed infrastructure backups may retain encrypted deleted content according to the database operator's backup policy. This change does not alter Atlas backup settings or promise erasure from already retained backups.

## Server configuration and key recovery

The local server key has been generated in the ignored `gadget-aid-server/.env`, and private lookup indexes have been provisioned. No key is printed, committed or sent to the client. For a new environment with no stored encrypted receipts:

```powershell
# From gadget-aid-server with the existing server database configuration:
npm run receipts:configure
npm start
```

The configure command validates an existing key without replacing it. If the key is missing but encrypted files already exist, it refuses to generate a replacement and requires key recovery. It provisions `{ownerUid:1,deviceId:1,_id:-1}` indexes on both receipt collections and writes a new key only when the encrypted store is empty.

Back up the key in a restricted secret manager or encrypted operator backup before relying on receipt retention. Losing the encryption key makes existing content unrecoverable; replacing it with a random key cannot recover files. Never put keys in `VITE_*`, README, chat, public logs or a committed file.

For deployed hosting, configure the **same** server secret used by the files, then deploy the matched client/server. A Git push does not copy local `.env` values. `RECEIPT_KEY_ID` identifies the active key; `RECEIPT_ENCRYPTION_KEY` is a base64-encoded random 32-byte key. `RECEIPT_PREVIOUS_KEYS` optionally maps old key IDs to their base64 keys for continued reads. Rotation writes with the new active key but does not automatically re-encrypt old files; retain the old key material until all dependent files and retained backups are retired. Do not paste example or demo keys into production.

Without a valid configured vault, uploads fail closed and the UI reports unavailable storage. Missing old keys or failed authentication tags block content download; confirmed owner deletion remains available. The server needs Node >=20.9 and a supported Sharp native runtime (verified locally on Node 24). Receipt parsing stays below the common 4.5 MB serverless request limit, but deployment/platform permissions, native-package installation and capacity still require verification on that host. No external hosting deployment was performed here.

## API

| Endpoint | Contract |
| --- | --- |
| `GET /devices/:id/receipts` | Owner only. Returns policy/version, configured availability, limits and up to 10 receipt metadata rows. No ciphertext/keys. |
| `POST /devices/:id/receipts` | Owner only. Raw JPEG/PNG body, `Content-Type`, UUIDv4 `X-Upload-Id`, `X-Receipt-Policy: private-receipts-v1`, URI-encoded `X-Receipt-Label` (2–100 characters). Returns 201 for a new receipt or 200 for an exact retry. |
| `GET /devices/:id/receipts/:receiptId/content` | Authenticated owner download; decrypted normalized JPEG attachment. Never a public link. |
| `DELETE /devices/:id/receipts/:receiptId` | Owner only; JSON `{confirmed:true}`. Receipt records are immutable; exact receipt ID and confirmation identify deletion. |

Errors include `RECEIPT_UNAVAILABLE`, `RECEIPT_TYPE`, `RECEIPT_INVALID_IMAGE`, `RECEIPT_TOO_LARGE`, `RECEIPT_POLICY_REQUIRED`, `RECEIPT_QUOTA`, `RECEIPT_RATE_LIMIT`, `RECEIPT_BUSY` and `UPLOAD_REFERENCE_CONFLICT`.

## Verification

98 backend tests pass, including seven receipt tests covering AES authentication/rotation/tampering, owner privacy, EXIF stripping, invalid/corrupt/oversized files, quotas, exact-retry semantics, missing keys, restricted-owner rights and rollback. The real local MongoDB integration suite confirms encrypted content round-trip, metadata-write rollback, exact retry and atomic device/receipt cascade deletion. Client lint, 18 tests and build pass; the existing main-bundle size warning remains.

Browser QA uploaded the synthetic [demo receipt](../gadget-aid-client/tests/qa/demo-receipt.png), displayed the normalized JPEG metadata/success message and verified the disabled-until-confirmed deletion dialog. Download content/integrity and access checks were verified through API/integration tests. No real invoice, personal file or payment detail was used. [Upload screenshot](screenshots/private-receipt-upload.png).

References: [Sharp constructor limits](https://sharp.pixelplumbing.com/api-constructor/), [metadata removal](https://sharp.pixelplumbing.com/api-output/), [MongoDB transactions](https://www.mongodb.com/docs/drivers/node/v6.x/crud/transactions/).
