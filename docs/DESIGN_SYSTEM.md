# GadgetAid — Premium Tech design system

Phase 1, 2026-11-05. Branch: `codex/phase-1-design-system`. Builds on the [Phase 0 audit](PRODUCT_AUDIT.md). This phase establishes tokens and shared primitives; global navigation and page redesign remain later tasks. No backend, route definitions, auth contracts or dependencies were changed.

## Rationale and theme strategy

Deep navy backgrounds, raised blue surfaces and cyan actions preserve the existing repair/technology identity while making action hierarchy predictable. Existing `public/logo.png` and `banner.png` remain in use. Color, typography and component rules live in `gadget-aid-client/src/index.css`, using the installed Tailwind 4/DaisyUI 5 architecture.

Dark is the default for a new or invalid theme preference. Existing `localStorage.theme` values `gadgetlight` and `gadgetdark` remain supported. The complete light palette is retained. `utils/theme.js` initializes the HTML theme before React renders; `ThemeChanger` subscribes to one external snapshot so desktop/mobile controls and storage changes from another tab stay synchronized. Storage errors do not prevent the page from rendering. HTML starts dark; a saved light preference is restored when the module initializes (no inline boot script or new storage key).

## Colors

| Purpose / CSS token | Dark | Light |
| --- | --- | --- |
| Page / `--color-base-200` | `#071827` | `#F0F7FA` |
| Surface / `--color-base-100` | `#0D2233` | `#FFFFFF` |
| Elevated / `--color-base-300` | `#123047` | `#DCEBF2` |
| Text / `--color-base-content` | `#F3F8FC` | `#102C3E` |
| Muted / `--ga-text-muted` | `#A9BDCA` | `#486577` |
| Primary / `--color-primary` | `#35C6E6` | `#006B85` |
| Secondary / `--color-secondary` | `#91DDEC` | `#155E75` |
| Accent / `--color-accent` | `#18A6C8` | `#006B85` |
| Control border / `--ga-border` | `#557B90` | `#7794A5` |
| Decorative border / `--ga-border-subtle` | `#244255` | `#C6DBE5` |
| Success / `--color-success` | `#35B982` | `#146C49` |
| Warning / `--color-warning` | `#E9B44C` | `#805600` |
| Danger / `--color-error` | `#E56B6F` | `#B52E42` |

Each semantic fill has its own `*-content` foreground. Dark buttons use navy text on cyan/semantic fills; light buttons use white on deeper fills. Do not put white small text on the dark theme's bright cyan. Decorative borders are not intended to identify an input. Use `ga-muted` for new secondary copy instead of arbitrary opacity. Existing legacy opacity utilities remain for page-specific review.

Contrast is checked using WCAG relative luminance `(L1 + .05)/(L2 + .05)`. Normal text and semantic filled-button pairs target at least 4.5:1; control borders/focus target 3:1 against their surface. See [Phase 1 validation](PHASE_1_VALIDATION.md) for measured values and limits; this does not certify every legacy page or soft badge blend.

## Typography, spacing, layout and motion

- Font stack: Inter **if installed**, Segoe UI, system UI, Apple system, sans-serif. No font download, external font request or new dependency. If a guaranteed Inter appearance is required, license and bundle an actual font in a later task.
- `text-display`: fluid 36–64px, line-height 1.1. `text-page`: 28–40px/1.2. `text-section`: 22–32px/1.3. Body defaults to 16px/1.6; labels/helper text use 14px. Use weight 600 for controls and 600–700 for headings. New forms must not use placeholders as labels.
- Retain Tailwind's 4px spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. `ga-section` uses 48–80px fluid vertical spacing.
- `ga-container`: maximum 1280px; 16px side gutters below 768px, 24px above. Breakpoints remain Tailwind defaults: 640, 768, 1024, 1280, 1536px. Do not duplicate media queries per page.
- Radii: 8px selectors/badges, 12px fields/buttons, 16px panels. Borders 1px. `ga-surface` supplies a restrained theme-aware border/shadow; no glow by default.
- Use `ga-numeric` for tabular prices, dates and counts. Status labels always accompany color.
- Motion: default transition 160ms with `--ga-ease`. CSS reduced-motion disables smooth scrolling and reduces animations/transitions. Root `MotionConfig reducedMotion="user"` disables Framer transform/layout motion for users requesting reduction; opacity fades may remain. No new decorative animation was added.

## Component inventory

All paths are under `gadget-aid-client/src/`.

| Component/pattern | Contract / states | Adoption |
| --- | --- | --- |
| `components/Button.jsx` | `variant`: primary, secondary, outline, ghost, destructive; `size`: sm/md/lg; `loading` disables + spinner + aria-busy; forwards native props. `to` renders Router Link with disabled-link semantics | Banner CTA now a single link; preserves `/services` target |
| `components/ui/FormField.jsx` | Required visible `label`; stable useId; optional helper/error; `as` input/textarea/select; native props/ref; description/error associations, aria-invalid, polite note | Existing service search; later forms adopt individually |
| `components/ui/StatusBadge.jsx` | Exact supported statuses pending/working/completed; human text + warning/info/success; unknown values get neutral “Unknown status” | Customer cards retain `status || serviceStatus`; provider retains pending fallback |
| `components/ui/Skeleton.jsx` | Caller sets shape with className; accessible loading label; decorative shape hidden from AX | Development preview; available for next page phase |
| `components/ui/EmptyState.jsx` | Title, description, optional real action; shared surface | Development preview; no fake buttons or new API capability |
| `components/ui/Dialog.jsx` | Controlled open/onClose/title; native showModal, Escape, top-layer backdrop, browser focus containment/return; portal avoids parent spacing/styles; 32rem maximum, viewport gutters and scroll | Development preview; existing booking/edit overlays migrate in their page phase |
| `.ga-surface`, `.ga-container`, `.ga-section` | Card/container/section primitives | Preview, available to shell/page work; existing service-card content preserved |
| Existing DaisyUI dropdown/menu/details | Theme tokens, subtle border, global focus-visible | Existing Navbar; no new menu architecture until Phase 2 |
| Existing React Toastify | Theme-aware surface/text/icon/progress/close styles | Existing toast container and preview success feedback |
| Existing input/select/textarea | Theme surfaces, visible border, placeholder, disabled and aria-invalid styling | Applies to existing forms; semantic associations need progressive migration |

Button hover uses DaisyUI variants, active press reduces brightness, focus uses a 2px primary outline with 4px offset. Disabled/loading controls are unavailable; callers must provide descriptive text (especially icon-only buttons). Small buttons are 36px, default 44px, large 52px high; prefer default for touch. For loading buttons retain visible descriptive text and change it to “Saving…” where appropriate.

FormField is for text-like inputs/select/textarea, not checkbox/radio composition. Validation remains the caller's responsibility. Error text should explain recovery; do not expose raw service errors. Retry UI can compose EmptyState with a real Button and an appropriate alert/live region; no new error/network abstraction was introduced here.

Native dialog does not dismiss on backdrop click by default, avoiding accidental form loss. Destructive dialogs should explain the consequence, offer Cancel, use a destructive Button and handle request failures before closing. Existing forms/overlays are not silently migrated.

## Navigation and page templates for the next phases

Phase 2 should adopt `ga-container` for navbar/footer, retain Home/Services and existing authenticated dashboard links, use an explicitly named mobile menu control, and preserve sticky-header offsets. Active routes need both semantic current-page indication and a visible treatment. Authentication state remains Firebase user state; do not invent separate provider/admin roles.

Public information pages: `ga-container ga-section` with a page heading, concise intro and content surfaces. Listings: labelled search/filter controls, responsive grid, explicit loading/error/empty states. Auth forms: a narrow surface with labelled fields and clear feedback. Dashboards: title/action row, actual-data summary and responsive cards/tables. These are templates for later implementation, not new routes or finished page designs.

## Development preview

Run `npm run dev` from `gadget-aid-client`, then open `/design-system.html` on the server's printed URL. The separate HTML/React development entry showcases controls in both themes without authentication or API traffic. It is not linked from product navigation, not registered in React Router, and not an input to the default production build. Its UI mounts only in `import.meta.env.DEV`.

Preview actions are labelled examples. “Show feedback” emits a local toast; “Open dialog” opens an example dialog. “Browse services” performs full navigation from the standalone preview to the real app. No preview data is presented as actual bookings, provider availability, or statistics.

## Remaining work

Phase 2 shell redesign and page-by-page adoption are next. Existing backend integrity issues, password reset, login redirect mismatch, provider-image normalization, legacy form labels and overlay replacements remain tracked in the audit. Phase 1 does not resolve those contracts or claim end-to-end booking verification. No deployment was performed.
