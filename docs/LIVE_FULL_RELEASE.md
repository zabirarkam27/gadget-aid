# Full-plan live release

6 November 2026 (Asia/Dhaka). The owner explicitly requested full-plan gap fixes, main-branch push and live deployment. Final status: **READY**. See [audit and configuration limits](FULL_PLAN_AUDIT.md).

| Component | Target | Verified release |
| --- | --- | --- |
| Frontend | https://gadget-aid.web.app | Firebase Hosting version `9656d1244380df8d`, finalized/released 15:25:35 Bangladesh time; source `68e8a81` |
| API | https://gadget-aid-server.vercel.app/health | Vercel `dpl_2ntyZkci3BH7nAvhhWcqBB1KaFEr`, production READY; source `cafd809`; Node 22, Express; remote build 9 seconds |
| Git | https://github.com/zabirarkam27/gadget-aid | main; fixes through `68e8a81`, followed by this documentation/evidence checkpoint |
| CI | https://github.com/zabirarkam27/gadget-aid/actions/runs/42194933449 | Both Node 22 application jobs passed, including clean installs, audits, tests, client build/lint and local replica-set integration |

## Verified behavior

- Live readiness, bounded catalogue, categories, gallery and estimate returned 200. Devices, wallet, saved technicians, admin gallery and assistant configuration rejected anonymous access with 401. Production CORS returned only the configured Hosting origin for the allowed-origin request.
- API responses use nosniff/referrer/CSP headers. Hosting page shell returns no-cache and DENY framing; hashed assets return one-year immutable caching. Firebase Auth/database/storage rules were not changed.
- Signed-out browser: homepage real listings and mobile navigation/Escape, calculator arithmetic (100 vs 500; 12 vs 36 months → 400 difference, 8.33 vs 13.89 per month), real screen-repair listing estimate (one matching listed price of $60), comparison, consent-gated empty gallery, recycling disclaimer, full points policy, honest contact page and protected saved-technician → login redirect.
- Final live source was verified by entry asset `/assets/index-Dyp5UfPz.js` and working dynamic titles. A tab with the prior `/assets/index-Dv3LCZoA.js` automatically reloaded onto the current artifact when its obsolete estimate chunk was unavailable. Old-bundle console errors during unload were observed; no claim is made that recovery suppresses every transient old-bundle console message.
- Eight live screen states at 360, 390, 768, 1366 and 1440 widths: 40 geometry checks, zero horizontal document overflow. [Measurements](LIVE_RELEASE_RESPONSIVE.json), [live calculator screenshot](screenshots/live-full-release.png). Viewport overrides were reset.
- Local backend restarted with release code and health=200. Automated verification: 133 backend tests, 24 frontend tests, two real local MongoDB transaction suites, client lint/build and zero production dependency audit vulnerabilities. CI separately verifies Node 22 on Linux. The disposable local release database was removed after checks.

Private mutation journeys remain covered by synthetic loopback and real disposable MongoDB tests, not production test bookings. No real Firebase registration/password/role change, customer upload, gallery publication, referral claim, reward debit, email or external model call was used for release QA. Encryption keys, user records and production environment values were preserved.

## Deployment recovery and operations

The first security-updated backend artifact `dpl_7oxKz4ize2jApM6Uj2gJC3RSqTTw` built successfully but failed initialization with `ERR_REQUIRE_ESM` in jwks-rsa/jose. Health caught this before frontend release. The prior working backend was restored, the scoped compatibility fix and runtime/RSA regression tests were added, and the replacement was tested through its protected deployment URL before promotion. The initial CI database image also failed to start; CI now uses MongoDB 7.0 and prints startup diagnostics, while local transaction verification used MongoDB 8. The final CI run passed.

Rollback checkpoints before this release: backend `dpl_H3v7KVV2XQsxnAkCAb6q9NRX5Jy9`, Hosting `42daecc043b1c521`. Coordinate both components if rolling back API contracts. Retain receipt/gallery keys; a replacement random key cannot recover existing ciphertext.

No always-on error monitoring, log drains, load capacity or inbox-delivery guarantee is claimed. Sampled final-deployment runtime logs and public smoke checks are release evidence, not continuous monitoring. The application request budget is per instance; shared upload/AI quotas have their existing independent controls.

## Outstanding configuration

Booking email still needs an operator-owned verified sender/domain, Resend key and protected scheduler secret. External AI still needs the owner's Gateway key and explicit enablement; guided suggestions work. General support email is intentionally unpublished until a real mailbox is verified. These are stated activation dependencies, not fabricated working integrations.
