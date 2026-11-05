# Baseline validation report

Date: 2026-11-05, Asia/Dhaka. Source: `main` at `97d1ec7`. Node `v24.15.0`, npm `11.12.1`; existing installed dependencies were used. No install, upgrade, deployment, migration or production mutation was run.

## Executed validation commands

Commands below are PowerShell; paths are relative to `D:\Programming Hero\gadget-aid` unless a working directory is stated.

| Working directory | Exact command | Result |
| --- | --- | --- |
| `gadget-aid-client` | `npm run build` | Passed; Vite 6.3.5; 477 modules; 3.31 seconds |
| `gadget-aid-client` | `npm run lint` | Failed, exit 1: five errors, one warning. Run twice to confirm independent exit code |
| `gadget-aid-client` | `npm run test --if-present` | Exit 0, no output: **no test script exists; no tests ran** |
| `gadget-aid-server` | `node --check index.js` | Passed, exit 0; syntax only. Run twice to confirm independent exit code |
| `gadget-aid-server` | `npm test` | Failed, exit 1: placeholder prints `Error: no test specified`. Run twice to confirm independent exit code |
| `gadget-aid-server` | `node --version` | `v24.15.0` |
| `gadget-aid-server` | `npm --version` | `11.12.1` |
| Root | `git status --short` | Initially clean; final change set should contain only audit documents |
| Root | `git branch --show-current` | `main` |
| Root | `git rev-parse --short HEAD` | `97d1ec7` |
| Root | `git ls-files` | Source/config inventory; no actual env files in index |

Some initial commands were grouped in one PowerShell invocation with semicolons. Its final process exit code does not establish the exit code of earlier commands; independent lint/server test/syntax reruns above establish those results. Client build completion and success were explicitly printed by Vite. No server build or lint script exists. There is no root package manifest/test runner.

Build measurements: CSS 76.35 kB / 12.91 kB gzip; JS 641.82 kB / 185.42 kB gzip; imported banner 85.63 kB; imported logo 125.08 kB. Vite warned about chunks over 500 kB. `dist/` is ignored generated output and was not committed.

Lint errors: `motion` flagged by `no-unused-vars` at AboutUs:1, Banner:1, FeaturedSection:1, HowItWorks:1, ServiceCard:2. Each file uses `<motion.*>` JSX; this needs a focused lint/config review. Warning: AuthProvider:12 `react-refresh/only-export-components` for exported context. None were altered in the audit.

## Inspection commands and coverage

The supplied plan was read with `Get-Content -LiteralPath 'C:\Users\Zabir\Downloads\plan.md'`; output initially exceeded the tool budget, so its middle was reread with `Get-Content -LiteralPath 'C:\Users\Zabir\Downloads\plan.md' | Select-Object -Skip 530 -First 420`. Route/phase sections and final stopping instruction were reviewed.

Repository discovery included these exact commands:

```powershell
Get-Location
rg --files -g AGENTS.md -g package.json -g '*lock*' -g README.md -g '!node_modules' -g '!dist'
rg --files -g '!node_modules' -g '!package-lock.json' -g '!dist' -g '!*.png' -g '!*.jpg' -g '!*.jpeg' -g '!*.webp'
Get-ChildItem -Force -Name
Get-ChildItem -Path .. -Filter AGENTS.md -Force
rg --files --hidden -g AGENTS.md -g '!node_modules' -g '!.git' 'D:\Programming Hero' 'C:\Users\Zabir\.agents'
Get-ChildItem -LiteralPath 'D:\','D:\Programming Hero','D:\Programming Hero\gadget-aid' -Filter AGENTS.md -Force
Get-ChildItem gadget-aid-client,gadget-aid-server -Force | Select-Object DirectoryName,Name
Get-ChildItem gadget-aid-client/src/assets,gadget-aid-client/public -Recurse -File | Select-Object FullName,Length
```

No AGENTS results were returned; the broader `rg` had exit 1 for no matches. File reads used `Get-Content` for both package manifests, both README files, server index, all client `pages/*.jsx`, `components/*.jsx`, `router/*.jsx`, `utils/*.js`, AuthProvider, firebase.config, main, MainLayout, index.css, index.html, vite.config, eslint.config, firebase.json, server vercel.json, public/_redirects, and root/client/server .gitignore. Initial grouped output was truncated; Registration, ServiceToDo, ManageService, Navbar, Footer, Banner, AboutUs, FeaturedSection, HowItWorks and Button were reread in smaller groups.

Source/config search:

```powershell
rg -n 'fetch\(|authFetch\(|import.meta.env|process.env|localStorage|upload|sendPasswordReset|WebSocket|EventSource' gadget-aid-client/src gadget-aid-server/index.js
```

Environment inventory printed names only using:

```powershell
$envFiles = Get-ChildItem gadget-aid-client,gadget-aid-server -Force -File -Filter '.env*'
foreach ($envFile in $envFiles) {
  $keys = Get-Content -LiteralPath $envFile.FullName | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') { $Matches[1] }
  }
  [pscustomobject]@{ File=$envFile.FullName; Keys=($keys -join ', ') }
}
```

Values were not printed or copied. The computer-use skill at `C:\Users\Zabir\.codex\plugins\cache\openai-bundled\computer-use\26.1029.61003\skills\computer-use\SKILL.md` was read for browser access. Browser actions used the supported CUA browser API, not shell-driven browser automation.

## Live browser checks actually performed

The web-fetch tool could not access the live URL; the in-app browser subsequently loaded it successfully. That initial tool failure is not evidence that the site was down.

| Action | Observed result |
| --- | --- |
| Open `https://gadget-aid.web.app/` | Home title, shell, hero, sections and footer rendered; screenshot inspected |
| Click Show All | Listing initially showed no-match text, later populated records |
| Type `Smartphone` into search | One matching Smartphone Screen Replacement card appeared |
| Click matching View Details as guest | Redirected to login; no credential entry |
| Open login, click Forgot password | `/forgot-password` rendered Oops/not-found and home recovery link |
| Use Go to Home | Returned to home |
| Click footer Contact Us | Static support email page rendered |
| Read captured error/warning logs | Empty sample at that time; no comprehensive console/network certification |
| Set viewport widths 360, 390, 768, 1366, 1440 at height 900 | Filtered listing geometry checks; see route map for widths and limitations |
| Reset viewport | Temporary override cleared |

One Contact Us Playwright click failed after viewport reset; fresh accessibility state and indexed click succeeded. One tablet measurement initially returned a stale mobile width after rapid changes, then passed at the actual requested width after reobservation. Screenshot capture during resizing was inconsistent; do not treat the matrix as full visual verification.

## Not executed

Authenticated flows, Google popup, registration, logout, password reset submission, create/edit/delete services, create booking, status updates, unauthorized cross-user API attempts, invalid-ID runtime cases, DB connection or schema inspection, production deployment/dashboard inspection, complete keyboard/contrast/theme checks, full responsive visual matrix, end-to-end tests, load/security audit, and external link/mail delivery verification.

## Checkpoint

Expected tracked scope: five Markdown files under `docs/` only. Suggested commit: `docs: audit GadgetAid product routes API and validation baseline`. No commit or branch switch is part of this audit. Next: review the audit and bounded booking-integrity recommendation, then approve the plan's design proposal/Phase 1 scope.
