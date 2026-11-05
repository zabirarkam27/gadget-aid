# Routes, components, and user journeys

Phase 0, 2026-11-05. Paths below are repository-relative. All routes originate in `gadget-aid-client/src/router/router.jsx`; normal pages share `layout/MainLayout.jsx` (HelmetProvider, Navbar, Outlet, Footer). Root `errorElement` renders `pages/Error.jsx` outside that shell for unmatched routes/errors.

## Route inventory

| Route | Screen/components under client `src/` | Access | Data and behavior |
| --- | --- | --- | --- |
| `/` | `pages/Home.jsx`; `components/Banner`, `PopularServices`, `FeaturedSection`, `AboutUs`, `HowItWorks` | Public | GET `/services`; first six → ServiceCard; CTA → listing |
| `/services` | `components/Services.jsx`, `ServiceCard.jsx` | Public | GET `/services`; case-insensitive name substring filter in memory; details link |
| `/services/:id` | `components/ServiceDetails.jsx` | Login required in UI | Public GET `/services/:id`; modal date/instruction; private POST `/bookings`; success → bookings |
| `/login` | `pages/Login.jsx` | Public | Firebase email/password or Google popup; reads `state.from.pathname`, defaults home |
| `/register` | `pages/Registration.jsx` | Public | Firebase create + updateProfile + signOut → login; Google popup → home |
| `/add-service` | `pages/AddService.jsx` | Login required | POST `/services`; image/name/price/area/description and profile data; success toast, reset, delayed listing navigation |
| `/manage-services` | `pages/ManageService.jsx` | Login required | GET `/my-services`; edit modal PUT `/services/:id`; browser-confirmed DELETE `/services/:id` |
| `/booked-services` | `pages/BookedServices.jsx` | Login required | GET `/bookings`; own booking cards, date/provider/price/instruction/status; read only |
| `/service-to-do` | `pages/ServiceToDo.jsx` | Login required | GET `/all-bookings`; provider queue; PATCH `/all-bookings/:id` with status |
| `/contact-us` | `pages/ContactUs.jsx` | Public | Static support email text; no API, form or mailto |
| Unmatched/error | `pages/Error.jsx` root error element | Public | Existing 404 image and home link; no separate wildcard route; no distinction between route failure and missing path |
| `/forgot-password` | No page/route | Missing | Login links here with email state; live not-found confirmed |

No `/dashboard`, `/profile`, admin, quotation, device, notification, review or messaging routes exist. “Dashboard” is a navigation group for four existing private pages, not a role-protected screen. API details are in [API_MAP.md](API_MAP.md).

## User journeys and states to preserve

### Customer discovery and booking

Home → Show All/Book a Repair → listing → search by name → View Details. Guests are redirected to login, because service details are private in this UI even though the read endpoint is public. The guard writes `state.form`; login reads `state.from`, so the intended return path is lost. Search/query/hash preservation is also absent from login's pathname-only navigation.

Once signed in, details fetches service → Book Now opens overlay → select date and optional instruction → Purchase POSTs service snapshot and status → insertedId triggers toast and `/booked-services`. Purchase is a booking action: no payment API or checkout exists. No submit lock, duplicate protection, valid date policy or form-submit validation exists. A rejected detail fetch leaves a spinner; non-2xx JSON is accepted as a service. Booking list fetches once per user change, with spinner, empty text and cards; status changes are not pushed or periodically refreshed.

Live-tested portion: populated listing, `Smartphone` search, guest details-to-login guard. Signed-in details, booking, list visibility and changing status were source-reviewed only.

### Authentication

Registration requires name, email, password, photo; password must have six characters, uppercase and lowercase. On success profile is updated then user signs out and navigates to login. Profile failure after account creation has no recovery path. Errors expose Firebase's message during registration. Login applies the same password composition checks (potentially blocking existing valid Firebase passwords), then navigates home/intended path. Google flows use a popup; registration Google path goes home. Auth submissions have no in-flight disable/loading state. Visibility icon buttons lack accessible names and labels are generally not associated to inputs.

Navbar logout calls Firebase signOut then goes home; logout error is console-only. PrivateRoutes waits for auth then redirects guests. No admin/provider/customer role distinction. Neither account creation, credential entry, Google popup, password reset nor logout was executed during this audit.

### Provider services

Authenticated Dashboard → Add Service → enter image URL, name, dollar price, area, description → POST → toast/reset → listing. New record uses `providerImage`; display components use `providerPhoto`.

Manage Service → token-scoped own records → Edit opens overlay → PUT five editable fields → modifiedCount updates local list/closes modal. Unchanged successful saves are reported as failure. Delete → native confirmation → DELETE → deletedCount removes local card. Initial fetch failure appears empty; JSON HTTP errors can cause rendering failures. No live services were created, changed or deleted.

### Provider work queue

Dashboard → Service-To-Do → token-scoped bookings → select pending/working/completed → PATCH → modifiedCount updates local item. There is no confirmation, pending state, visible success/error message, timeline or enforced order of transitions. Existing booking records may use `serviceStatus`; customer display has a fallback, provider display uses only `status` (default pending). Actual legacy records were not inspected.

### Shared shell and contact

Desktop shows Home/Services plus authenticated Dashboard, theme control, auth links or avatar/logout. Mobile uses dropdown navigation; hamburger and avatar controls lack explicit names. Contact is linked from footer. Social links point to generic Facebook/LinkedIn homepages. Two ThemeChanger instances independently read the same storage key but do not synchronize state. Modal overlays sit at the same z-index as sticky navbar and lack semantic dialog, focus trap, Escape dismissal and reliable small-screen scrolling.

## Responsive/accessibility coverage

Tailwind responsive grids are present; listing goes 1/2/3 columns, home popular services 1/2. Forms use max-width containers; dialogs use fixed full-screen overlays without explicit padding/overflow management. Keyboard focus styling mostly relies on DaisyUI/browser defaults; form label associations and announced errors are incomplete. Banner nests a link in a button. Smooth scroll and Framer animations have no explicit reduced-motion support.

Live geometry checks on the **filtered listing only** returned viewport/document widths 360/345, 390/375, 768/753, 1366/1351 and 1440/1425: no document horizontal overflow at those observations. One rapid viewport update initially returned a stale 360 width for the tablet request; tablet was rerun after a state observation and returned 768. Screenshot capture following rapid resizing was inconsistent and does not establish a visual pass. This is not a complete responsive, contrast, keyboard or authenticated journey audit. Recheck every redesigned page at all five widths later.
