# GadgetAid --- Product Redesign & Development Master Plan

> **Project:** GadgetAid\
> **Live Website:** https://gadget-aid.web.app/\
> **Repository:** https://github.com/zabirarkam27/gadget-aid\
> **Primary Design Direction:** Premium Tech --- Dark Navy + Cyan\
> **Execution Strategy:** Complete UI/UX redesign first, then phased
> product improvements and feature development.\
> **Document Purpose:** This is the source-of-truth execution plan for
> Codex. Follow it phase by phase. Do not attempt to implement the
> entire roadmap in one pass.

------------------------------------------------------------------------

## 0. How Codex Must Use This Plan

You are working on an existing product, not building a new application
from scratch. Your first responsibility is to understand and preserve
the current product, its routes, data model, authentication, API
contracts, and working features.

### Mandatory working rules

1.  **Inspect before changing.** Read the repository structure, package
    files, routes, pages, shared components, styles, API calls, backend
    routes, database schema, authentication flow, and deployment
    configuration before proposing code changes.
2.  **Do not assume.** Confirm how a feature currently works by reading
    the implementation. If something is unclear, report the uncertainty
    instead of inventing an architecture.
3.  **Do not rewrite the whole application.** Prefer focused,
    incremental changes. Preserve existing working behavior unless a
    change is explicitly approved.
4.  **Work phase by phase.** Complete only the phase requested by the
    user. Do not silently start later phases.
5.  **Plan before implementation.** For each phase, first return: files
    to inspect, proposed changes, risks, dependencies, and test plan.
    Wait for approval if the change is broad or affects data/API
    contracts.
6.  **Keep changes reviewable.** Avoid unrelated formatting, dependency
    upgrades, renaming, and refactoring in the same task.
7.  **Do not remove existing functionality** simply because it is not
    visible in the current design.
8.  **Use existing libraries where sensible.** Do not add a dependency
    for a trivial feature. Explain the value of every new dependency.
9.  **Protect secrets.** Never expose Firebase credentials, API keys,
    MongoDB connection strings, tokens, or environment values in
    frontend code, logs, screenshots, or commits.
10. **Do not claim tests passed unless they were actually run.** Report
    commands executed, results, and any tests that could not be run.
11. **Do not invent backend capabilities.** A UI control must be
    connected to a real supported API or clearly marked as not yet
    available.
12. **Keep the live site safe.** Do not deploy, migrate production data,
    or change production environment variables without explicit
    approval.
13. **

### Required response format after every Codex task

At the end of each task, provide:

-   **What changed:** concise summary.
-   **Files changed:** exact paths and purpose.
-   **Existing behavior preserved:** list important flows checked.
-   **Validation:** commands/tests actually run and their results.
-   **Known issues:** remaining bugs, incomplete work, or assumptions.
-   **Next recommended task:** one small, logical next step.
-   **Git checkpoint:** suggested commit message.

### Definition of Done

A task is not complete merely because the page looks different. It is
complete only when:

-   The requested UI is implemented consistently with the design system.
-   Existing relevant functionality still works.
-   Responsive layouts are checked at mobile, tablet, and desktop
    widths.
-   Loading, empty, error, and success states are considered.
-   Forms have validation and useful feedback.
-   Keyboard focus and accessible labels are present for interactive
    controls.
-   No obvious console errors, broken routes, or failed network requests
    remain.
-   Build/lint/tests are run where available, and failures are reported
    honestly.

------------------------------------------------------------------------

# 1. Product Vision and Positioning

## 1.1 Product vision

GadgetAid should evolve into a trustworthy, modern gadget repair and
service platform where customers can discover repair services, book a
technician, understand the repair process, approve quotations, track
progress, and retain a digital history of their devices.

The experience should feel like a polished technology service platform,
not a generic service-listing template.

## 1.2 Primary user groups

### Customer

A person who needs a phone, laptop, desktop, tablet, smartwatch, or
other gadget repaired.

Primary needs: - Find the right service quickly. - Understand the
technician's credibility and estimated cost. - Book without confusion. -
Know what is happening to their device. - Approve or reject a repair
quotation. - Access invoices, warranty details, and repair history.

### Technician / Service Provider

A person or business offering gadget repair services.

Primary needs: - Publish and manage services. - Receive and organize
booking requests. - Diagnose devices and submit quotations. - Update
repair progress. - Communicate with customers. - Manage availability and
build trust through reviews.

### Admin (future role)

A platform operator responsible for users, providers, services,
bookings, disputes, and platform quality.

Primary needs: - Monitor platform activity. - Review providers and
services. - Resolve booking or payment disputes. - Moderate reviews and
content. - Access operational reports.

**Important:** Do not assume an Admin role already exists. Inspect the
current authorization model before designing or implementing admin-only
functionality.

## 1.3 Product experience principles

1.  **Trust before decoration:** show clear provider information,
    pricing context, process steps, policies, and status.
2.  **Clarity over cleverness:** users should always understand what to
    do next.
3.  **Progress visibility:** booking and repair status should be easy to
    understand.
4.  **Mobile-first usability:** customers may book from a phone while
    dealing with a broken device.
5.  **Consistent interaction:** buttons, forms, cards, navigation, and
    feedback should behave consistently.
6.  **Honest functionality:** never display fake ratings, fake
    availability, fake popularity, fake live status, or placeholder
    statistics as real data.
7.  **Performance matters:** animation and visual effects must not make
    the website slow.

------------------------------------------------------------------------

# 2. Design Direction --- Premium Tech

## 2.1 Visual identity

Create a premium, calm, confident technology aesthetic using deep navy
surfaces, cyan accents, clean typography, subtle borders, and restrained
motion.

Suggested starting palette (validate contrast and tune after inspecting
the existing brand assets):

  ----------------------------------------------------------------------------
  Token                        Suggested value         Usage
  ---------------------------- ----------------------- -----------------------
  `--color-bg`                 `#071827`               Main dark page
                                                       background

  `--color-surface`            `#0D2233`               Cards and panels

  `--color-surface-elevated`   `#123047`               Menus, dialogs,
                                                       elevated surfaces

  `--color-primary`            `#18A6C8`               Primary brand/action
                                                       accent

  `--color-primary-bright`     `#35C6E6`               Highlights and active
                                                       states

  `--color-text`               `#F3F8FC`               Main text

  `--color-text-muted`         `#A9BDCA`               Secondary text

  `--color-border`             `#244255`               Subtle borders

  `--color-success`            `#35B982`               Success states

  `--color-warning`            `#E9B44C`               Warning states

  `--color-danger`             `#E56B6F`               Error/destructive
                                                       states
  ----------------------------------------------------------------------------

These are design proposals, not a requirement to hardcode values in
every component. Implement them as centralized design tokens.

### Theme strategy

-   Default theme: Premium Dark Navy + Cyan.
-   If the existing light/dark theme switch is retained, create a
    complete light theme using the same brand identity.
-   Do not ship a partially themed light mode with unreadable surfaces
    or inconsistent components.
-   Persist the theme only through the project's existing supported
    mechanism, or introduce one deliberately and document it.

## 2.2 Typography

-   Preferred font: **Plus Jakarta Sans** or **Inter**.
-   Use a consistent type scale for display headings, page headings,
    section headings, body text, labels, and helper text.
-   Avoid excessively large headings on mobile.
-   Keep body copy readable and concise.
-   Use tabular numerals for prices, dates, counts, and dashboard
    metrics where appropriate.

## 2.3 Layout and visual language

-   Use a consistent max-width content container.
-   Use a predictable spacing scale, for example 4, 8, 12, 16, 24, 32,
    48, 64.
-   Use rounded corners consistently; avoid mixing many unrelated radii.
-   Use subtle cyan glow only for selected focal elements, not every
    card.
-   Prefer clear surface hierarchy over heavy glassmorphism.
-   Use restrained shadows and borders.
-   Use consistent icon style, preferably Lucide React if already
    installed or approved.
-   Use Framer Motion only where it improves hierarchy or feedback.
-   Respect `prefers-reduced-motion`.
-   Use real product/service imagery where available. Do not use random
    decorative images that make repair services look misleading.

## 2.4 Component design rules

Build or standardize reusable components for: - Buttons: primary,
secondary, outline, ghost, destructive. - Inputs: text, email, password,
select, textarea, date/time if supported. - Form field: label, helper
text, error message. - Cards: service, provider, statistic, booking,
dashboard. - Badges: booking status, service status, verification
state. - Dialog/modal and confirmation dialog. - Dropdown menu and
mobile navigation. - Tabs and segmented controls. - Skeleton loaders. -
Empty states. - Error states and retry actions. - Toast/inline
feedback. - Pagination or load-more control. - Avatar and image
fallback.

Do not create a large design-system abstraction before understanding the
current component architecture. Introduce reusable components where
repeated patterns justify them.

------------------------------------------------------------------------

# 3. Current Product Baseline --- Verify Before Editing

The following is the known repository baseline from the initial code
review. Re-check it against the current branch before implementation
because the code may have changed.

## 3.1 Known routes

  Route                Current purpose
  -------------------- --------------------------
  `/`                  Home
  `/services`          Service listing
  `/services/:id`      Service details
  `/login`             Login
  `/register`          Registration
  `/add-service`       Create service
  `/manage-services`   Manage provider services
  `/booked-services`   Customer bookings
  `/service-to-do`     Provider work queue
  `/contact-us`        Contact page
  Not-found route      Error page

Known gaps to verify: - A Forgot Password link appears to point to
`/forgot-password`, but a matching route/page was not found in the
earlier review. - Private-route redirect state may use `form` in one
place and `from` in another, potentially breaking post-login
navigation. - The service creation flow appears to use `providerImage`,
while some display components expect `providerPhoto`. - Booking data
appears to trust client-supplied provider and price fields. The backend
should derive authoritative service information from the database. -
"Popular services" may simply show the first few returned records rather
than a real popularity ranking. - Current booking status updates appear
request/response based. Do not call them live real-time updates unless a
push mechanism is implemented. - Contact Us may be a static information
page rather than a functioning support form. - API validation,
pagination, duplicate booking protection, centralized error handling,
and automated tests need a fresh review.

## 3.2 Known stack to verify

-   Frontend: React, Vite, React Router, Tailwind CSS, DaisyUI, Framer
    Motion, Firebase Authentication.
-   Backend: Node.js, Express, Firebase Admin, MongoDB.
-   Hosting: Firebase Hosting for frontend and Vercel for backend
    (verify current deployment setup).

## 3.3 Existing capabilities to preserve

Verify the exact implementation, but the earlier review found: -
Email/password authentication. - Google authentication. - Service
listing and service details. - Service creation, editing, and
deletion. - Customer booking creation and booking list. - Provider work
queue and status updates. - Theme toggle. - Contact page.

Before redesigning any route, write down its current user journey and
the APIs it uses. Preserve the working journey unless an intentional
improvement is specified.

------------------------------------------------------------------------

# 4. Execution Roadmap

## Phase 0 --- Repository Audit, Product Map, and Safety Baseline

**Goal:** Establish a reliable understanding of the current application
before visual or functional changes.

### Tasks

1.  Inspect the full repository tree, including client and server.
2.  Read package manifests and identify scripts, dependencies, and build
    commands.
3.  Map all routes and route guards.
4.  Map each page to its components, API calls, and authentication
    requirements.
5.  Map backend endpoints to MongoDB collections and document fields.
6.  Identify how Firebase tokens are created, sent, verified, and
    refreshed.
7.  Inspect environment-variable usage without exposing secret values.
8.  Inspect image upload/storage behavior, if any.
9.  Run the existing build, lint, and test scripts.
10. Open the live site and compare it with the current source where
    possible.
11. Record known bugs, accessibility issues, responsive issues, and
    missing states.
12. Create a feature inventory with three labels: Working, Partially
    Working, Not Implemented.

### Required deliverables

-   `docs/PRODUCT_AUDIT.md`
-   `docs/ROUTE_AND_FEATURE_MAP.md`
-   `docs/API_MAP.md`
-   `docs/KNOWN_ISSUES.md`
-   A baseline test/build report.

### Acceptance criteria

-   Every existing route is documented.
-   Every important user journey is documented.
-   Backend/API dependencies are mapped.
-   Existing build/test status is known.
-   No production code has been changed in this phase.

### Codex instruction

> Complete Phase 0 only. Audit the existing repository and live product.
> Do not modify application code. Produce the requested documentation,
> identify uncertainties, and report the exact commands you ran. Do not
> claim that browser interactions were tested unless you actually tested
> them.

------------------------------------------------------------------------

## Phase 1 --- UX Architecture and Design System

**Goal:** Establish the visual language and reusable UI foundation
before redesigning individual pages.

### Tasks

1.  Confirm the existing brand name, logo, and available assets.
2.  Define dark and, if retained, light theme tokens.
3.  Define typography, spacing, radii, borders, shadows, and motion
    rules.
4.  Define reusable button, input, card, badge, modal, dropdown, toast,
    skeleton, and empty-state patterns.
5.  Define responsive breakpoints and container behavior.
6.  Define navigation behavior for desktop and mobile.
7.  Define page-level layout templates.
8.  Define status colors and status-label rules.
9.  Check contrast for text, controls, and focus indicators.
10. Ensure reduced-motion support.

### Required deliverables

-   `docs/DESIGN_SYSTEM.md`
-   Centralized CSS variables/theme configuration.
-   Reusable component inventory.
-   A short design rationale explaining important decisions.

### Acceptance criteria

-   Colors and typography are centralized.
-   Components use consistent variants.
-   Focus, hover, active, disabled, loading, and error states are
    defined.
-   Dark theme is coherent across all shared components.
-   Existing app routes and behavior remain unchanged.

### Codex instruction

> Complete Phase 1 only. Build the Premium Tech design foundation using
> Dark Navy + Cyan. First inspect the current styling architecture and
> reuse it where practical. Do not redesign all pages yet. Centralize
> tokens and implement only the shared components needed for the next
> phases. Avoid unnecessary dependencies and avoid decorative
> over-animation.

------------------------------------------------------------------------

## Phase 2 --- Global Shell: Navbar, Footer, Navigation, and Responsive Foundation

**Goal:** Make the entire product feel consistent before page-specific
redesign.

### Tasks

1.  Redesign desktop navbar with clear brand, navigation, active route,
    and authentication actions.
2.  Create a compact, usable mobile navigation.
3.  Make authenticated and unauthenticated navigation states clear.
4.  Add clear user menu behavior if the current auth model supports it.
5.  Redesign the footer with useful navigation, contact details, and
    trust information.
6.  Standardize page container width and vertical spacing.
7.  Ensure page content does not hide under sticky navigation.
8.  Standardize buttons, links, icon sizing, and focus behavior.
9.  Ensure navigation works with keyboard and touch.
10. Check all existing routes from the navigation.

### Acceptance criteria

-   Navbar works at mobile, tablet, and desktop widths.
-   Active route is visually identifiable.
-   Login/logout state is correct.
-   No existing route is accidentally removed.
-   Footer links are valid.
-   No horizontal overflow at common viewport widths.

### Codex instruction

> Complete Phase 2 only. Redesign the global application shell: navbar,
> mobile navigation, footer, and shared page layout. Preserve all
> existing routes and authentication behavior. Test logged-out and
> logged-in navigation states. Do not begin the homepage or dashboard
> redesign in this task.

------------------------------------------------------------------------

## Phase 3 --- Public Website UI/UX Redesign

**Goal:** Redesign public-facing pages to communicate trust, quality,
and ease of booking.

### 3A. Homepage

Recommended structure:

1.  **Hero section**
    -   Strong headline explaining GadgetAid's value.
    -   Short supporting copy.
    -   Primary CTA: Find a Repair Service.
    -   Secondary CTA: Become a Service Provider, only if provider
        registration is supported.
    -   Premium visual showing a gadget/repair context.
    -   Optional interactive Repair Finder entry point, but keep the
        first version simple.
2.  **Repair category discovery**
    -   Smartphone, Laptop, Desktop, Tablet, Smartwatch, Gaming Console,
        Other.
    -   Use categories only if they correspond to real service data or
        are clearly presented as discovery shortcuts.
3.  **Featured services**
    -   Use real service records.
    -   If popularity is not calculated from real booking/review data,
        label the section "Featured Services" rather than "Most
        Popular".
4.  **How it works**
    -   Find a service.
    -   Book a technician.
    -   Get diagnosis and quotation.
    -   Track the repair.
    -   Collect the device.
5.  **Why GadgetAid**
    -   Explain real platform benefits.
    -   Avoid unverifiable claims such as "100% trusted" or "fastest
        repairs".
6.  **Trust and transparency section**
    -   Explain how provider details, pricing, booking, and repair
        updates work.
    -   Show ratings or counts only when sourced from real data.
7.  **Provider CTA**
    -   Invite technicians to offer services if the product supports
        this flow.
8.  **FAQ preview**
    -   Answer common booking, pricing, repair, and warranty questions.
    -   Do not promise a warranty unless the service/provider policy
        supports it.
9.  **Footer**

### 3B. Services listing page

Recommended layout: - Page title and concise introduction. - Search
input. - Category filter. - Price range filter if prices are available
and comparable. - Rating filter only after real review data exists. -
Location filter only if location is part of the data model. - Sort:
newest, price low-to-high, price high-to-low; rating/popularity only
when supported by real data. - Service cards with image, title,
category, provider, price, and clear CTA. - Pagination or load more for
larger result sets. - Loading skeleton, empty state, error state, and
retry action.

Do not add filter controls that do not actually filter the results.

### 3C. Service details page

Recommended information hierarchy: - Service image/gallery. - Service
name, category, and short description. - Price or "Starting from" label
based on actual pricing semantics. - Provider name and profile
details. - Estimated duration only if supplied by the provider. -
Service coverage/location only if available. - What is included / not
included. - Booking CTA. - Related services if real related data can be
determined. - Reviews only when real review data exists. - Clear
cancellation, diagnosis, quotation, and warranty policy where supported.

Booking form improvements: - Device type. - Brand and model. - Problem
description. - Preferred date/time if scheduling is supported. -
Pickup/drop-off preference only if the platform can fulfill it. -
Optional image upload only after secure upload/storage is implemented. -
Clear price explanation and booking confirmation.

### 3D. Login and Registration

-   Premium split-screen or focused centered layout.
-   Clear distinction between customer and provider registration only if
    roles are supported.
-   Email/password and Google login where currently supported.
-   Password visibility toggle.
-   Inline validation.
-   Loading and error feedback.
-   Forgot Password route and working reset flow.
-   Correct post-login redirect behavior.
-   Do not expose raw Firebase errors to users.

### 3E. Contact Us

-   Clear contact channels.
-   Functional form only if a backend submission path exists.
-   Form fields: name, email, topic, message.
-   Validation, success state, error state, and spam protection.
-   If no backend exists yet, keep the page honest and show working
    contact channels rather than a fake submit button.

### Acceptance criteria for Phase 3

-   All public pages follow the same design system.
-   Existing service discovery and booking entry points still work.
-   No fake reviews, ratings, availability, or statistics.
-   Forms provide clear validation and feedback.
-   Responsive behavior is verified.
-   Loading, empty, and error states are present.

### Codex instruction

> Complete Phase 3 in small page-level tasks. Start with the homepage
> only. After it is reviewed and approved, proceed to Services, then
> Service Details, then Login/Register, then Contact Us. Do not redesign
> all public pages in a single giant change. Preserve current API
> contracts unless a separately approved backend task is required.

------------------------------------------------------------------------

## Phase 4 --- Authenticated Dashboard UI/UX Redesign

**Goal:** Make customer and provider workflows easier to understand and
manage.

### 4A. Customer dashboard

Potential navigation: - Overview - My Bookings - Repair Tracking - My
Devices (future, after device records exist) - Quotations (future) -
Invoices (future) - Messages (future) - Warranty (future) - Reviews
(future) - Profile Settings

First redesign the features that already exist. Mark future sections as
unavailable or do not show them until implemented. Do not create dead
navigation links.

Overview widgets: - Active bookings. - Completed bookings. - Pending
requests. - Recent activity. - Next action required.

### 4B. Provider dashboard

Potential navigation: - Overview - My Services - Incoming Requests -
Active Repairs - Completed Jobs - Availability (future) - Messages
(future) - Earnings (only if payment/earnings data exists) - Reviews
(future) - Profile Settings

Overview widgets: - Active jobs. - New requests. - Completed jobs. -
Services listed. - Pending customer actions.

### 4C. Existing provider pages

**Manage Services** - Summary cards. - Search and filter. - Table/list
with service image, title, price, status, and actions. - Clear
edit/delete confirmation. - Empty state and loading state.

**Service To Do** - Clear work queue. - Status badges. - Customer and
service details. - Date and priority only when supported by data. -
Status update control with confirmation and feedback. - Consider a
Kanban layout only if it improves real workflow and remains usable on
mobile.

**Booked Services** - Booking cards or table with service, provider,
date, status, and next action. - Clear detail view. -
Cancellation/reschedule only after backend rules are implemented.

### Acceptance criteria

-   Customer and provider can distinguish their roles and tasks.
-   Existing data and permissions are respected.
-   No user can access another user's private records by changing a URL
    or request.
-   Dashboard navigation works on mobile.
-   No placeholder metrics are presented as real data.

### Codex instruction

> Complete Phase 4 by redesigning existing customer/provider dashboard
> screens. Inspect role checks and API authorization before changing UI.
> First map the current booking and service ownership rules. Do not add
> admin pages or future dashboard sections as fake UI.

------------------------------------------------------------------------

## Phase 5 --- UX Reliability and Existing-Feature Bug Fixes

**Goal:** Make the redesigned product dependable before adding major new
functionality.

### Priority fixes to verify and address

1.  Forgot Password route and Firebase password reset flow.
2.  Post-login redirect state naming consistency (`from`/`form` or
    equivalent).
3.  Provider image field naming consistency
    (`providerImage`/`providerPhoto` or normalize to one canonical
    field).
4.  Booking creation must not trust client-supplied
    price/provider/service name.
5.  Service details must handle missing IDs, 404 responses, and API
    failures.
6.  All fetch requests must handle loading, error, empty, and success
    states.
7.  Form validation must be consistent on frontend and backend.
8.  Destructive actions need confirmation and useful feedback.
9.  Duplicate booking behavior must be defined and enforced where
    appropriate.
10. Contact form must not pretend to submit if no backend endpoint
    exists.
11. Correct accessibility labels, keyboard navigation, and contrast.
12. Remove dead links, unused controls, and misleading labels.

### Booking data integrity requirements

The client should submit only the minimum required identifiers and
customer-provided booking details. The backend should: - Verify the
authenticated user from the Firebase token. - Fetch the canonical
service record using the service ID. - Derive provider identity, service
name, and authoritative price from the database. - Validate that the
service exists and is bookable. - Validate required booking fields. -
Apply ownership and authorization checks. - Prevent or safely handle
duplicate submissions. - Return a structured response with a stable
booking ID.

Never rely on a price or provider email supplied by the browser as the
source of truth.

### Acceptance criteria

-   Existing booking flow is tested end to end.
-   Invalid or tampered client payloads are rejected.
-   Users cannot edit/delete services they do not own.
-   Users cannot read private bookings belonging to others.
-   Error messages are understandable and do not expose secrets or stack
    traces.

------------------------------------------------------------------------

# 5. Feature Development Roadmap

Do not start these features until the redesign and reliability phases
are stable. Prioritize by user value, complexity, and backend readiness.

## Phase 6 --- Repair Workflow v2: Diagnosis, Quotation, and Status Timeline

**Priority: Very High**

### Objective

Turn a simple booking into a transparent repair journey.

### Suggested status lifecycle

Use a controlled state machine, not arbitrary free-text status values:

1.  `pending` --- Booking submitted.
2.  `confirmed` --- Provider accepted the request.
3.  `device_received` --- Device received by provider, if applicable.
4.  `diagnosing` --- Technician is inspecting the device.
5.  `quotation_sent` --- Repair estimate sent to customer.
6.  `awaiting_approval` --- Waiting for customer decision.
7.  `repairing` --- Repair work started.
8.  `quality_check` --- Repair is being tested.
9.  `ready_for_collection` --- Device is ready.
10. `completed` --- Handover completed.
11. `cancelled` --- Booking cancelled.
12. `rejected` --- Request rejected, if the business rules allow it.

Define allowed transitions. For example, a technician should not mark a
booking completed before the required repair steps are complete unless
an authorized exception exists.

### Diagnosis and quotation

Technician can submit: - Diagnosis summary. - Identified issue. -
Recommended repair. - Parts/labor breakdown. - Estimated total. -
Estimated completion time. - Quotation expiry, if needed.

Customer can: - Approve. - Reject. - Ask for clarification (requires
messaging or a note mechanism).

Store quotation history and timestamps. Never silently overwrite an
already approved quotation.

### Repair timeline

For every status event, store: - Booking ID. - Previous status. - New
status. - Actor ID/role. - Timestamp. - Optional note. - Optional
customer-visible flag.

### Acceptance criteria

-   Valid status transitions are enforced by backend.
-   Customer sees a clear timeline.
-   Technician sees the next allowed action.
-   Every change is auditable.
-   Customer approval is required before work proceeds beyond quotation
    when that is the agreed workflow.

------------------------------------------------------------------------

## Phase 7 --- Notifications and Communication

**Priority: High**

### Features

-   In-app notification center.
-   Email notifications for important booking events.
-   Booking-specific conversation or message thread.
-   Unread message count.
-   Notification preferences (later).
-   Retry and failure handling for outbound email.

### Initial notification events

-   Booking received.
-   Booking accepted/rejected.
-   Device received.
-   Diagnosis completed.
-   Quotation sent.
-   Quotation approved/rejected.
-   Repair started.
-   Repair ready.
-   Booking completed/cancelled.

### Technical notes

-   Use a persistent notification record if the UI needs notification
    history.
-   Do not expose private email addresses unnecessarily.
-   If email sending is implemented, keep credentials on the backend.
-   Use a queue/retry approach only if scale or reliability needs
    justify it.
-   Do not label polling as instant real-time.
-   If genuine real-time updates are required, evaluate WebSocket/SSE
    infrastructure and hosting compatibility first.

### Acceptance criteria

-   Notifications are tied to authorized users.
-   Users can mark notifications read.
-   Duplicate notifications are controlled.
-   Email failures do not corrupt booking state.

------------------------------------------------------------------------

## Phase 8 --- Technician Profiles, Reviews, and Availability

**Priority: High**

### Technician profile

Potential fields: - Display name/business name. - Profile photo/logo. -
Short bio. - Skills and supported device categories. - Service area, if
supported. - Years of experience (self-reported unless verified). -
Certifications (with verification process if displayed as verified). -
Services offered. - Average rating and review count from real reviews. -
Availability.

### Reviews

-   Only eligible customers should review a completed booking.
-   One review per eligible booking unless an edit policy is defined.
-   Rating and written feedback.
-   Provider response, if desired.
-   Report/moderation workflow.
-   Aggregate rating calculated from real review records.

### Availability

-   Weekly working hours.
-   Exceptions/holidays.
-   Booking slot validation on backend.
-   Time zone consistency.
-   Prevent double-booking where time slots are reserved.

### Acceptance criteria

-   Reviews cannot be fabricated by arbitrary users.
-   Ratings are calculated from verified review records.
-   Availability is checked server-side.
-   Provider claims are clearly distinguished from platform-verified
    facts.

------------------------------------------------------------------------

## Phase 9 --- Admin and Platform Operations

**Priority: Medium to High**

Only implement after the role model and authorization design are
approved.

### Admin capabilities

-   Platform overview and analytics.
-   Manage customers.
-   Review/approve technician profiles if required.
-   Manage services.
-   View all bookings.
-   Resolve disputes.
-   Moderate reviews.
-   Handle reports.
-   Manage categories.
-   View operational logs.

### Security requirements

-   Admin role must be granted securely, not by a client-side dropdown
    or editable profile field.
-   Enforce admin authorization on backend endpoints.
-   Audit sensitive actions.
-   Avoid exposing user personal data unnecessarily.
-   Add pagination and filters to large admin tables.

### Acceptance criteria

-   Admin-only APIs enforce server-side authorization.
-   Admin actions are logged.
-   Sensitive actions require confirmation.
-   Admin data views are paginated and access-controlled.

------------------------------------------------------------------------

## Phase 10 --- Gadget Passport, Device History, and Warranty

**Priority: Medium**

### Gadget Passport concept

A customer can maintain a digital profile for each device: - Device
type. - Brand and model. - Optional serial number (treat as sensitive;
do not display publicly). - Purchase date, if user chooses to add it. -
Repair history. - Uploaded invoices/receipts, if secure file storage is
available. - Warranty records. - QR code linking to a private or
permission-controlled device record.

### Privacy rules

-   Device records are private by default.
-   Do not expose serial numbers in public QR URLs.
-   Use authorization checks for every record.
-   Allow users to delete or export their data where appropriate.
-   Define file retention and access policy before accepting uploads.

### Warranty management

-   Warranty terms must be supplied by the provider or platform policy.
-   Track start date, end date, coverage, exclusions, and claim status.
-   Do not promise warranty coverage unless the service record supports
    it.

------------------------------------------------------------------------

## Phase 11 --- AI Repair Assistant

**Priority: Medium; only after reliable service and device data exists**

### Concept

A guided assistant helps a customer describe a device problem and
discover relevant services.

Possible inputs: - Device category. - Brand/model. - Symptoms. - When
the issue started. - Optional image of visible damage, after secure
image handling is implemented.

Possible outputs: - Clarifying questions. - Possible issue categories. -
Safe preliminary troubleshooting steps. - Relevant GadgetAid service
listings. - A suggested booking path.

### Safety and product limitations

-   The assistant must not claim to provide a definitive diagnosis.
-   Do not recommend opening devices, handling batteries, or performing
    hazardous electrical work.
-   For swollen batteries, smoke, burning smell, liquid damage with
    power connected, or overheating, advise the user to stop
    using/charging the device and seek qualified help.
-   Clearly label AI-generated suggestions as preliminary.
-   Do not send private user/device data to an external AI service
    without an explicit privacy and data-handling design.

### Acceptance criteria

-   Assistant responses are clearly non-authoritative.
-   High-risk symptoms trigger safe guidance.
-   Suggested services are drawn from actual GadgetAid records.
-   User can proceed without using the assistant.

------------------------------------------------------------------------

## Phase 12 --- Differentiating Product Features

These features can make GadgetAid more memorable, but they are not
launch blockers.

### 12.1 Repair vs Replace Calculator

Help users compare estimated repair cost against replacement cost. Make
assumptions visible and avoid pretending the result is financial
certainty.

### 12.2 Repair Cost Estimator

A guided estimate based on device category, model, and symptom. Use real
provider data where possible. Clearly label estimates as non-binding
until a technician confirms them.

### 12.3 Before/After Repair Gallery

Technicians can publish approved repair examples. Require moderation and
customer consent. Do not expose customer/device identifiers.

### 12.4 E-waste and Responsible Recycling

Offer information or partner-based collection for devices that should
not be repaired. Do not advertise a recycling service until a real
partner/process exists.

### 12.5 Saved Technicians and Service Comparison

Allow customers to bookmark providers and compare relevant service
details using consistent fields.

### 12.6 Referral and Loyalty Program

Introduce only after booking completion and fraud controls are reliable.
Define reward rules, expiry, abuse prevention, and accounting before
launch.

------------------------------------------------------------------------

# 6. Technical Quality and Architecture Requirements

## 6.1 API and backend reliability

Review and implement where appropriate: - Server-side input
validation. - Consistent response format. - Centralized error
handling. - Authentication and authorization middleware. - Ownership
checks on all private resources. - Rate limiting on sensitive/public
endpoints. - Pagination and server-side filtering. - Duplicate request
protection for booking creation. - Structured logs without secrets. -
Health-check endpoint. - Safe CORS configuration. - Request size
limits. - Secure file upload validation if uploads are introduced.

Do not add every infrastructure feature automatically. Prioritize based
on actual risk and deployment constraints.

## 6.2 Data model discipline

Before changing MongoDB documents: 1. Inspect existing records and field
names. 2. Document current schema assumptions. 3. Decide canonical field
names. 4. Plan backward compatibility for existing records. 5. Add
migration/backfill scripts if required. 6. Test with a safe development
dataset. 7. Never run destructive production migrations without explicit
approval and backup.

## 6.3 Frontend quality

-   Avoid duplicating API request logic across many components.
-   Use a consistent API client/auth token strategy.
-   Keep form state and validation predictable.
-   Avoid deeply nested conditional rendering.
-   Keep components focused.
-   Use stable keys in lists.
-   Add error boundaries where appropriate.
-   Avoid unnecessary global state.
-   Lazy-load routes or heavy modules when useful.
-   Optimize images and avoid layout shifts.

## 6.4 Accessibility

-   Semantic HTML.
-   Labels for every form control.
-   Keyboard-accessible menus and dialogs.
-   Visible focus states.
-   Sufficient color contrast.
-   Alt text for meaningful images.
-   Do not rely on color alone for status.
-   Reduced-motion support.
-   Useful error announcements.

## 6.5 Performance

Measure before optimizing. Review: - Bundle size. - Image dimensions and
formats. - Lazy loading. - Unnecessary re-renders. - API payload size. -
Pagination. - Font loading. - Layout shift. - Mobile network behavior.

Do not add complex caching or state libraries without evidence that they
solve a real problem.

------------------------------------------------------------------------

# 7. Testing and QA Strategy

## 7.1 Manual user journeys

Test these journeys after relevant phases:

### Customer journey

1.  Open homepage.
2.  Find a service.
3.  Open service details.
4.  Register/login.
5.  Book a service.
6.  View booking.
7.  Receive/update status.
8.  Review quotation when implemented.
9.  Track repair.
10. Complete booking.

### Provider journey

1.  Register/login as provider, if role flow exists.
2.  Add a service.
3.  Edit service.
4.  Delete service with confirmation.
5.  Receive booking.
6.  Update status.
7.  Submit diagnosis/quotation when implemented.
8.  Complete job.

### Authentication journey

-   Email registration.
-   Email login.
-   Google login.
-   Logout.
-   Forgot password.
-   Protected route redirect.
-   Unauthorized access attempt.

### Failure journey

-   API unavailable.
-   Invalid service ID.
-   Missing required field.
-   Expired/invalid token.
-   Duplicate booking attempt.
-   User tries to access another user's data.
-   Image upload failure, if uploads exist.

## 7.2 Responsive checks

At minimum inspect: - Small mobile: 360px wide. - Typical mobile: 390px
wide. - Tablet: 768px wide. - Laptop: 1366px wide. - Large desktop:
1440px or wider.

Check: - No horizontal overflow. - Navigation usability. - Text
wrapping. - Card stacking. - Form usability. - Modal sizing. - Table
overflow/alternative mobile layout. - Touch target size.

## 7.3 Automated checks

Use the repository's existing scripts first. Add tests where they
provide value: - Unit tests for utilities and validation. - Component
tests for critical forms/controls. - API tests for authorization and
booking integrity. - End-to-end tests for core customer/provider
journeys.

Do not add a testing framework without checking current dependencies and
project conventions.

## 7.4 Release checklist

Before any production deployment: - Build passes. - Relevant tests
pass. - No known critical authorization issue. - Environment variables
verified in deployment settings. - No secrets committed. - Database
changes are backward compatible or migration plan is approved. - Core
customer/provider journeys tested. - Mobile and desktop smoke tests
complete. - Rollback approach understood. - User explicitly approves
deployment.

------------------------------------------------------------------------

# 8. Git and Codex Collaboration Workflow

## 8.1 Branch strategy

Use a feature branch for each meaningful phase or isolated task.
Suggested names: - `feature/design-system` - `feature/global-shell` -
`feature/homepage-redesign` - `feature/services-redesign` -
`feature/service-details-redesign` - `feature/dashboard-redesign` -
`fix/booking-data-integrity` - `feature/repair-workflow-v2`

Do not work directly on the production branch for broad redesign work.

## 8.2 Commit strategy

Commit after a coherent, verified unit of work. Example messages: -
`feat(ui): add premium tech design tokens` -
`feat(ui): redesign responsive navigation` -
`feat(home): redesign homepage layout` -
`feat(services): add service filters and empty states` -
`fix(auth): correct protected route redirect` -
`fix(bookings): derive service price from database`

## 8.3 Recommended Codex task size

Good task: - "Redesign only the homepage using the approved design
system. Preserve API behavior. Run build and report changed files."

Bad task: - "Make the whole site modern, add AI, fix backend, redesign
dashboards, and deploy."

Aim for one page, one workflow, or one bounded backend concern per task.

## 8.4 Before asking Codex to implement

Paste this short instruction:

> Read `plan.md` first. Identify the current phase and the exact task I
> am requesting. Inspect the relevant source files before editing. Do
> not implement future phases. Return a concise implementation plan and
> list of files likely to change. Preserve existing behavior and API
> contracts unless I explicitly approve a change.

## 8.5 After implementation

Paste:

> Review your own changes as a senior engineer. Check for regressions,
> broken routes, incorrect API assumptions, responsive issues,
> accessibility problems, console errors, and unused code. Run the
> relevant build/lint/tests. Fix issues caused by your changes. Then
> report exactly what you verified and what remains unverified. Do not
> claim browser testing if it was not performed.

------------------------------------------------------------------------

# 9. Suggested Phase Order and Priority

  ------------------------------------------------------------------------------------------
                  Order Phase                           Priority         Main outcome
  --------------------- ------------------------------- ---------------- -------------------
                      0 Repository audit                Critical         Reliable product
                                                                         map

                      1 Design system                   Critical         Consistent Premium
                                                                         Tech foundation

                      2 Global shell                    High             Navigation and
                                                                         layout consistency

                      3 Public pages redesign           Critical         Strong
                                                                         customer-facing
                                                                         experience

                      4 Dashboard redesign              High             Clear
                                                                         customer/provider
                                                                         workflows

                      5 Reliability and bug fixes       Critical         Safe, dependable
                                                                         existing features

                      6 Repair workflow v2              Very High        Diagnosis,
                                                                         quotation, status
                                                                         timeline

                      7 Notifications and communication High             Better
                                                                         customer-provider
                                                                         coordination

                      8 Technician                      High             Trust and
                        profiles/reviews/availability                    marketplace quality

                      9 Admin operations                Medium-High      Platform management

                     10 Gadget Passport and warranty    Medium           Device history and
                                                                         retention

                     11 AI Repair Assistant             Medium           Guided service
                                                                         discovery

                     12 Differentiating features        Later            Product identity
                                                                         and retention
  ------------------------------------------------------------------------------------------

**Important sequencing note:** If Phase 5 uncovers a serious security or
data-integrity issue, fix it before launching more booking-related
features. Visual polish must never take priority over protecting
customer and booking data.

------------------------------------------------------------------------

# 10. First Implementation Sprint

Start with the following sequence. Do not skip the audit.

### Task 1 --- Audit only

Ask Codex to complete Phase 0 and produce the documentation.

### Task 2 --- Design proposal

Ask Codex to present: - Homepage wireframe description. - Global
navigation proposal. - Service card design. - Service details layout. -
Customer/provider dashboard layout. - Design tokens and typography.

No implementation yet if the proposal still contains unresolved product
assumptions.

### Task 3 --- Design system implementation

Implement Phase 1 and verify shared components.

### Task 4 --- Global shell

Implement Phase 2.

### Task 5 --- Homepage only

Redesign homepage, inspect screenshots at mobile/tablet/desktop, review,
then commit.

### Task 6 --- Services page only

Implement filters only when the backend supports them. Otherwise
separate UI work from the required API work.

### Task 7 --- Service details only

Improve service information and booking UX while preserving the current
booking contract until the backend integrity fix is approved.

### Task 8 --- Authentication pages

Fix forgot password and redirect behavior alongside the visual redesign.

### Task 9 --- Dashboards

Redesign customer and provider experiences using actual current data.

### Task 10 --- Reliability sprint

Fix data integrity, validation, authorization, and missing states before
adding major features.

------------------------------------------------------------------------

# 11. Master Prompt for Codex

Use this as the first prompt after placing this document in the
repository as `plan.md`:

> You are the Senior Product Engineer responsible for improving
> GadgetAid.
>
> Read the complete `plan.md` before doing anything. The project already
> exists and is deployed. Do not rebuild it from scratch.
>
> Our chosen direction is **Premium Tech: Dark Navy + Cyan**. Our chosen
> strategy is **complete UI/UX redesign first, followed by incremental
> feature development**.
>
> Follow the phases in `plan.md` in order. Start with Phase 0 only.
> Inspect the entire repository, map routes and user journeys, inspect
> backend/API/authentication/data models, and evaluate the current live
> product where browser access is available.
>
> Do not modify application code during Phase 0. Create the audit
> documents requested in the plan and report: 1. What currently works.
> 2. What partially works. 3. What is missing. 4. What is broken or
> risky. 5. Which files are responsible for each important feature. 6.
> Which changes should happen first and why. 7. What you could not
> verify.
>
> After Phase 0, stop and wait for my approval. Do not start Phase 1
> automatically.
>
> Throughout the project, preserve working features, protect user data,
> avoid fake UI functionality, keep changes small and reviewable, and
> run relevant checks after each implementation task.

------------------------------------------------------------------------

# 12. Final Product Quality Bar

GadgetAid is ready for a public-facing release when:

-   The website has a coherent Premium Tech visual identity.
-   Public pages explain the product clearly and make service discovery
    easy.
-   Customer and provider workflows are intuitive.
-   Booking data is validated and protected on the backend.
-   Service ownership and private booking access are enforced
    server-side.
-   Repair progress is transparent and auditable.
-   Pricing and quotation behavior is clear.
-   Important actions provide feedback.
-   Mobile experience is genuinely usable.
-   No fake metrics, fake ratings, or dead controls remain.
-   Core user journeys have been tested.
-   Deployment and rollback procedures are understood.

**The guiding principle:** Build trust first, polish the experience
second, and add ambitious features on top of a reliable foundation. A
smaller set of fully working features is better than a large collection
of impressive-looking but disconnected screens.
