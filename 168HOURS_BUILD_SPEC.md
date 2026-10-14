# 168Hours — Core-First Build Specification

**Version:** 2.1\
**Date:** October 14, 2026\
**Repository:** `168hours`  
**Status:** Authoritative implementation brief  
**Primary objective:** Build a small, complete, genuinely usable 168Hours core quickly. Stop. Use it. Then expand it without rebuilding the foundation.

**Owner-approved product scope revision (October 14, 2026):** Calendar is the shared overview of planned, ongoing and recorded activity across specialized domains. The intended built-in workspaces are Fitness, Food, and Tasks. Tasks covers commitments, to-dos, projects and progress; detailed workflows remain to be scoped. Tasks represent things to complete, while Calendar blocks allocate time; scheduling does not automatically complete a task. Domains may grow into specialized workspaces with deeper navigation, progressive complexity and shared interaction patterns while Calendar remains the common overview. Shared records stay canonical across surfaces; specialized tools do not all need Calendar entries. Fitness is a future product direction, not a rename of the existing Exercise implementation. Detailed workflows include logging workouts as they happen. Future cross-domain AI asks clarifying questions and uses relevant preferences, accepted plans, activity and prior decisions; suggestions, plans and completed records remain distinct. Dedicated mobile and desktop apps will use the same platform with device-appropriate interfaces. Custom domains are a later feature, before the stretch-goal watch app. The planned order is platform/Calendar → built-in domains → AI → mobile/desktop apps → custom domains → watch. See [Product scope](docs/SCOPE.md) for the current direction and boundaries. This revision supersedes older product framing and expansion ordering; it is roadmap documentation, not authorization to implement future phases now. Existing Core completion gates and domain/service/ownership boundaries remain in force.

**Owner-approved workspace reset:** Calendar is the only current main-navigation destination. Remove the old Food and Exercise pages and domain-specific UI while retaining backend capabilities and data. Preserve Unscheduled and Routines for later Tasks decisions outside main navigation; Goals are deferred. Remove Food/workout quick-entry UI and links to retired source pages; retained Calendar activity remains visible. Future Fitness, Food and Tasks implementations require separate scope. This revision supersedes older navigation and Food/Exercise UI requirements below.

**Owner-approved Core UI revision:** Calendar is the central general planner and occupies the main workspace. Its top toolbar uses Day, Week, Month in that order, with Week as the default on every screen. Previous/next arrows sit on either side of Today. Plans and actual entries share the calendar with explicit visual labels. Remove Calendar details and the entire settings/summary/Today section beneath it. Domain-specific reporting, hydration/weight UI, and health/goal context will be redesigned within their domains; selected-date quick actions are authorized by the Calendar expansion below. Keep the existing backend capabilities and exact palette. Main navigation remains Calendar, Food, Exercise, Goals, with Settings and sign out in the account menu. This owner revision supersedes the original dashboard, summary/filter, and health-logging placement requirements below; do not restore them to Calendar to satisfy the earlier completion checklist.

**Owner-approved Calendar follow-up:** Improve busy-day readability and overflow access, responsive Month previews with a day-record list, 15-minute creation and duration choices, duration-preserving rescheduling, reviewable duplication of a single planned block, and date/current-time/scroll navigation. Duplication copies plan details only; it never infers or copies actual activity. The larger Calendar additions are authorized by the expansion below.

**Owner-approved plan creation revision:** Day/Week empty-range drag creation uses five-minute increments and a live block showing the selected range while dragging. A single click on empty Day/Week space selects a five-minute slot without creating a draft; double-clicking opens a draft there. Toolbar Add uses the selected date/time, or the current hour in the account timezone on the viewed date when no slot is selected. The initial duration is one hour, including across midnight. Clear time selection on Escape, navigation and choosing another calendar target. Do not use a fixed morning default or search for a free slot. Release keeps the draft visible and opens a compact, nonmodal editor beside the block for its title, times and Save, with optional fields under More details. Toolbar Add also shows an unsaved draft alongside the compact tab, updates its title/time range live, brings it into view in Day/Week and shows it in the matching Month cell. Cancelling removes the draft without writing a plan. New plans use the same compact plan composer, More details and Other plans controls in every view, including grid double-click and drag release. Switching plan type retains the draft date. Grid double-clicks, toolbar creation, existing-block editing and duplication use the same compact tab; date-only and repeating-plan editors also use nonmodal tabs. Keep the default tab small with inline labels and collapsed optional details/actions. This supersedes the earlier quarter-hour creation requirement; creation, moving and resizing all use five-minute increments.

**Owner-approved Calendar recorded-time simplification:** Calendar block creation is plan-only for now. Remove the Record choice from the new-block composer and Log actual from planned-block actions. Keep previously recorded time and domain activity visible and editable; keep domain logging through Quick actions and domain pages. Do not remove recorded data or its API capabilities.

**Owner-approved repeating-plan editor refinement:** Offer Repeat on the ordinary new-plan editor with Never, Daily, Weekly and Custom choices. Weekly supports selected weekdays; Custom supports an interval in days or weeks. Require a visible finite Repeat through date, show the resulting count and first dates before saving, and use the same editor when Add repeating plan is chosen from Calendar tools. The selected plan date and time carry into repetition. Editing an occurrence versus the entire series must state the scope clearly; whole-series edits continue to replace individual edits. Keep timezone-correct recurrence rules and the one-year bound.

**Owner-approved all-day plan editor refinement:** Offer All day in the ordinary new-plan editor. Selecting it replaces Start and End times with a Date field; an optional Spans multiple days choice reveals Last day. The Calendar tools shortcut opens this same editor with All day selected. Switching an unsaved timed draft to All day preserves its title, notes and start date. Existing all-day plans use the same single-date default and optional last date. Their Add a time action creates a separate timed plan, retaining the all-day plan, including multi-day plans. Keep the 31-day limit and all-day plans outside allocated hours.

**Owner-approved Copy, Templates and Routines split:** Calendar Copy duplicates a selected plan, a day, a week or a chosen inclusive date range once, preserving relative local days and times while excluding recorded activity and recurrence rules. Templates are separately named calendar patterns captured from a day, week or up to 31-day range; applying a template can place multiple cycles after a review of all resulting plans, within the existing 100-plan and one-year bounds. Copy and Templates appear as separate Calendar tools. Routines are a separate sidebar feature: user-owned, ordered checklists that can be edited, checked off and completed repeatedly. Routine steps do not create calendar blocks. Preserve revision, idempotency and ownership checks.

**Owner-approved Month controls:** Remove each day's creation (+) button. Clicking a Month day selects/highlights that date without navigating or opening an editor; toolbar Add opens a one-hour draft on the selected date at the current account-local hour. Double-clicking a day opens that draft directly. Preserve overflow access, keyboard controls and existing block selection/editing/dragging. Month block rows show the title on the left and only the start time on the right; truncate long titles with an ellipsis on one line. Put the date close to the top-right corner and use thin event rows on all screen sizes. Show all events for days with up to four; for five or more, show three rows followed by +N more navigating directly to Day view for that date.

**Owner-approved block controls:** A single click selects a planned block using the primary selected color; a double click opens its compact editor. Keyboard activation still opens the editor. Delete or Backspace and the block editor delete planned blocks without a confirmation alert. Use Cmd+Z/Ctrl+Z without a visible undo bar, action description, button, shortcut hint or count for a stack of timed planned-block actions during the current Calendar visit: creation/duplication, saved title/details/time edits, dragging/resizing and deletion. Repeated Undo reverses successful actions in order, including several changes to the same block; preserve identity, recurrence and recorded links through safe writes. Protect changes made elsewhere with revision/content checks and keep uncertain retries on the same request key. History lasts while Calendar is mounted; date-only plans, whole-series operations, bulk reuse and recorded/domain activity are outside this first action-history slice. This supersedes earlier confirmation requirements for planned-block deletion only; text editing remains unaffected. Moving a block shows a preview snapped to the destination day/time and a ghost at its original position until release or cancellation. Resizing updates block geometry and displayed times live, restoring the original on cancellation and saving on release. Drag feedback stays inside the block, with its time/date and a small bottom Escape to cancel hint; no floating drag tab. Existing safe writes remain; creation, moving and resizing all use five-minute increments.

**Owner-approved Calendar category/goal separation:** Focus Calendar on planning before adding domain links. Remove Category and Goal selectors from timed, recorded-time, date-only and repeating-plan forms, along with category search/filter controls, category labels/colors on calendar blocks and the Calendar create-goal shortcut. More details retains notes and relevant scheduling options. Calendar must not fetch category/goal selector lists. Keep the separate Goals/Settings experiences and canonical API capabilities; normal edits retain existing stored references. This supersedes earlier Calendar UI category/goal-link requirements.

**Owner-approved Calendar day experience:** Calendar now provides a daily overview of plans, recorded sessions and point-in-time domain moments. Add a chronological day feed, compact moment markers/counts, explicit planned/recorded labels and a compact plan composer. Existing domains supply a shared presentation envelope through their public services; personal records stay in their owning domains. Moment logs never occupy duration or contribute hours. Occurrence time controls placement, and corrections/deletions remain reflected. This supersedes the earlier exclusion of daily activity context from Calendar. Custom/public domains and new domains remain future work.

**Owner-approved Month fit revision:** The complete Month view must fit the available viewport without horizontal or vertical scrolling. Seven columns and four to six week rows remain visible together. Use available cell space for up to four thin event previews; reserve an overflow link when records do not fit and keep five-plus days at no more than three previews. Narrow cells use compact counts linked to Day view, and very short cells place the count beside the date. Keep selection, double-click/keyboard creation, drafts and existing block controls. This supersedes fixed minimum Month grid widths/heights, always-four-row capacity and Month scrolling.

**Owner-approved Calendar toolbar/sidebar revision:** Put Today on the left with mirrored actions in Add, tools, search order; center Day/Week/Month in the toolbar and keep date navigation on the right. Previous/next arrows flank the date title in fixed positions within a compact date group. Give the title button a generous minimum width that leaves only a small gap to each arrow; longer dates may use more of the center space without moving the arrows. Constrain the button on narrow screens so the full Day date remains visible. The date title has hover/focus feedback without a dropdown chevron and opens an anchored nonmodal dropdown: a small calendar for Day/Week (highlighting the selected week) and a month list with year navigation for Month. Center one date line vertically between the arrows in all views: Month/Week show the full month and year; Day shows the full month, day and year at exactly the same font size. Keep the date center position consistent when switching views. Show the full Day weekday as a small label at the top of the activity sidebar, outside the date control. In wide Day view, align the date area with the activity sidebar and continue its left divider through the toolbar. Remove the Your day heading and Day grid weekday/date header, giving both panes more room. Keep Week day headers, date jumping, responsive controls and existing navigation behavior. This supersedes the earlier left date controls and Previous → Today → Next order.

**Owner-approved Today placement revision:** Move Today immediately left of the previous-date arrow on the right side of the Calendar toolbar. Keep the date arrows fixed and the Day date area aligned with its sidebar. The left action order is Add, Search, then More (three dots). Adapt narrow layouts without squeezing the full date or month picker. This supersedes the earlier left-side Today and Add/tools/search ordering.

**Owner-approved Calendar search refinement:** Replace the large Search modal with a compact, nonmodal panel anchored below the toolbar Search control. Keep title/type search, visible-calendar filtering, optional date bounds and paginated results, with date bounds collapsed until needed. Clicking outside or pressing Escape dismisses it; Escape returns focus to Search. Fit the panel within the viewport at every supported width.

**Owner-approved Week picker refinement:** Treat each week in the Week date dropdown as one selectable row. Show the selected week as a continuous selection, and outline an entire different week on hover or keyboard focus.

**Owner-approved date picker hover consistency:** Use the same outlined hover treatment for an unselected Day, Week or Month option. Keep the selected option filled with the primary color.

**Owner-approved date dropdown simplification:** Remove the close X from the Day, Week and Month date dropdowns. Selection, outside click and Escape dismiss the dropdown.

**Owner-approved Month picker layout:** Show all twelve months in a three-column, four-row grid in the Month date dropdown, retaining year navigation and selected-month styling. Give the month buttons generous vertical space (at least 48px) while keeping all four rows visible on narrow screens.

**Owner-approved date dropdown alignment:** Center the Day, Week and Month dropdowns below their date-title buttons. On narrow screens, reduce dropdown width as needed to keep the popup centered and fully inside the viewport.

**Owner-approved Calendar view-switch targeting:** View tabs use the currently selected calendar date when one exists. A selected Month day opens its containing Week or that Day; a selected five-minute Week slot opens its Day. Without a selection, view tabs use the viewed date. Clear the selection after navigation as before.

**Owner-approved Day/Week density:** Use 60px per hour in the Day and Week time grids so more of each day is visible without changing five-minute time snapping, drag/resize behavior or accessible block controls.

**Owner-approved Day/Week time scaling:** Drag vertically on the time column to spread or compress the hours in Day and Week. Use 60px per hour as the default and reset value. Keep block placement, five-minute creation/move/resize snapping, scrolling and current-time placement aligned at every scale. Month remains unaffected.

**Owner-approved keyboard zoom reset:** In Day and Week, pressing R while using the Calendar resets hour spacing to the 60px default. Do not require focus on the time column, and do not intercept typing in fields or open editors.

**Owner-approved adaptive time marks:** Keep one-hour labels and lines at normal scale, show half-hour marks at expanded scales, and two-hour marks at highly compressed scales. Extend compression to 32px per hour so the two-hour marks are useful. Use a small transition buffer to avoid label flicker while dragging; the underlying five-minute interaction step remains unchanged.

**Owner-approved quarter-hour zoom:** Extend Day/Week expansion to 240px per hour and show 15-minute labels and gridlines at high zoom, with a buffered return to half-hour marks. Preserve the 60px reset, fitted full-day minimum, five-minute plan snapping and per-account zoom persistence. This supersedes the earlier 120px maximum.

**Owner-approved full-day zoom:** Extend Day/Week compression to 12px per hour so the full 24-hour grid can fit without internal vertical scrolling on desktop and common phone/tablet viewports. Add four-hour labels and grid lines at the deepest zoom, with a buffered return to two-hour marks. Keep the existing 60px default/reset and five-minute interaction step. This supersedes the earlier 32px minimum only.

**Owner-approved fitted zoom limit:** In Day and Week, the zoom-out limit follows the available grid height so 00:00 starts at the top and the end-of-day line reaches the bottom. Account for the Week header and date-only row. Keep the full-day setting fitted when switching views or resizing. This supersedes the fixed 12px visible minimum; 12px remains only the lowest stored scale preference.

**Owner-approved end-of-day label:** Show 24:00 inside the bottom edge of the Day and Week time axes, aligned with the closing gridline at every zoom level.

**Owner-approved time-label alignment:** Center ordinary Day and Week time labels vertically on their gridlines. Keep 00:00 and 24:00 inside the grid boundaries.

**Owner-approved zoom pivot refinement:** When dragging the time axis to compress the day from a scrolled position, reduce the scroll position smoothly toward the full-day fit. Avoid a sudden pivot shift when 00:00 reaches the top scroll boundary. Keep pointer-anchored expansion and the fitted minimum.

**Owner-approved Calendar workspace layout:** Let the Calendar fill the available workspace from the left sidebar to the browser's right edge and from the top of the desktop viewport to its bottom. Remove the outer card border, corner rounding and shell padding around Calendar while retaining internal toolbar padding and view dividers. On narrow screens, fill the space between the fixed top and bottom navigation bars.

**Owner-approved Calendar chrome removal:** Remove the Planned/Recorded/Moments legend and account-timezone caption below the Calendar toolbar. Routine action feedback, including Plan deleted, updated and restored, must not occupy visible Calendar space; keep screen-reader announcements and actionable error/retry controls.

**Owner-approved tooling revision:** No CI workflow. Keep all verification commands runnable locally; this supersedes CI scaffolding/hosting requirements below.

**Owner-approved Food slice:** Complete the manual Food experience end to end, including daily meals/nutrition, food library and repeat logging, hydration quick logs and history, and body-weight history/trends. These surfaces belong in Food and reuse the existing public domain services. Review backend ownership, validation, serving calculations, snapshots, date boundaries and safe writes before the responsive UI. Keep the exact palette and existing Calendar shortcuts. No barcode scanning, external food database, recipes/Kitchen, custom nutrition targets, or AI.

**Owner-approved Admin slice:** Implement permanent Admin/User account types, with public signup always creating a User and local operator-only creation of new Admin accounts. Add account metadata search, suspension/reactivation and session revocation and confirmed permanent account deletion for regular users, aggregate platform usage statistics, system health and an immutable administrative audit log. No promotion/demotion, impersonation, personal-record access, email delivery or public deployment. Admin metadata/aggregate reads are the explicitly authorized cross-account exceptions; all personal domain endpoints remain owner-scoped.

> **168Hours is a personal life-planning and tracking platform built around one simple fact: every week contains 168 hours.**
>
> The product helps a person decide how those hours should be spent, record selected parts of what actually happened, review the difference, and improve the next week.

---

# 0. Instructions to the coding agent

This file may be the only meaningful file in the repository when implementation begins.

Your job is to **build the working Core MVP**, not to return another architecture proposal.

Read this file completely before changing the repository. Then inspect the working tree and implement the Core Build in order.

**Owner-approved Calendar expansion:** Implement moving/resizing planned blocks and drag-to-create drafts, finite daily/weekly repeating plans (one occurrence or whole series), copying days/weeks and reusable templates, all-day and unscheduled plans outside allocated hours, title/category/type/date search and filtering, and selected-date domain quick actions. Keep compact top controls, Week as default, shared ownership/revision/idempotency protections, and the exact palette. Copies never include actual activity or repeating rules. Recurrence has an explicit end within 366 dates; copies/templates handle up to 100 plans per action. This authorization supersedes the original exclusions for these six Calendar capabilities only. External calendar sync, reminders/notification delivery, complex recurrence, AI, native apps, social features, Kitchen and other post-Core work remain excluded.

## 0.1 Core-first rule

The project has two clearly separated stages:

1. **Core Build** — build this now.
2. **Expansion Roadmap** — do not build these features until the owner explicitly asks.

The Core Build should be implemented as one focused development pass. Use the milestones in this document as internal checkpoints, but **do not stop after every milestone to ask whether to continue**.

Stop only when:

- the Core Completion Gate passes,
- an external decision materially changes scope/cost/security,
- credentials or user-owned infrastructure are required,
- or a real blocker cannot be resolved safely.

When the Core Build is complete, stop and provide a concise handoff. Do **not** automatically continue into AI, mobile, integrations, social features, or other roadmap items.

## 0.2 Decision hierarchy

When instructions conflict, use this order:

1. The owner's latest explicit instruction.
2. This build specification.
3. Architecture Decision Records created during implementation.
4. Current official framework/library guidance.
5. Reasonable implementation discretion.

Older 168Hours / 7Hours concepts are useful historical context, but they are not binding architecture requirements.

## 0.3 Implementation behaviour

- Build working vertical slices, not piles of empty folders.
- Prefer simple, boring, maintainable solutions.
- Keep the application runnable after each milestone.
- Do not introduce infrastructure for a future feature merely because it might be useful later.
- Do not create microservices in the Core Build.
- Do not create an AI abstraction layer in the Core Build beyond preserving clean application-service boundaries.
- Do not install the OpenAI SDK until the AI expansion begins.
- Do not create the native/mobile app during the Core Build.
- Do not deploy publicly, purchase services, make paid API calls, register domains, or publish packages without authorization.
- Use synthetic development/test data. Never seed private information from previous chats or personal history.
- Do not hard-code dashboard statistics or fake successful functionality.
- Do not claim a test passed unless it was actually run.
- Preserve existing work and Git history.
- Do not commit, push, force-reset, or alter repository visibility unless explicitly authorized.

## 0.4 Supporting files to create

Create these as implementation proceeds:

```text
AGENTS.md
README.md
docs/IMPLEMENTATION.md
docs/architecture.md
docs/verification.md
docs/decisions/
```

Their purposes:

- `AGENTS.md` — short rules for future coding-agent sessions.
- `README.md` — setup, commands, local URLs, current capabilities.
- `docs/IMPLEMENTATION.md` — checklist of Core milestones, verified results, blockers, next step.
- `docs/architecture.md` — what was actually implemented, not speculative design.
- `docs/verification.md` — commands and manual verification flows.
- `docs/decisions/` — short ADRs only for meaningful technical decisions.

Do not duplicate this entire specification into those files.

---

# 1. Product definition

## 1.1 What 168Hours is

168Hours is a **personal planning and tracking platform** with Calendar as its shared overview, specialized domains for detailed workflows, and future AI that connects relevant context across them. The 168-hour week remains a planning and review frame.

The basic loop is:

```text
Decide what matters
        ↓
Plan the week
        ↓
Live the week
        ↓
Record useful information
        ↓
Review what happened
        ↓
Adjust the next week
```

Calendar is the organizing surface for dated plans and activity. Domains such as Exercise and Food provide their own detailed experiences; their relevant plans and records appear on Calendar. See [Product scope](docs/SCOPE.md) for the agreed direction and planned phases.

Examples of things a user may eventually track:

- work,
- school,
- job searching,
- sleep,
- exercise,
- meals,
- water,
- weight,
- chess,
- reading,
- finances,
- breath-hold practice,
- habits,
- projects,
- relationships,
- or any future measurable skill/domain.

The Core Build does not need all of these. It must establish an architecture where they can be added cleanly.

## 1.2 Product principles

1. **Calendar is the shared overview.** Domains provide useful detailed experiences and contribute relevant plans and activity to Calendar; the 168-hour week remains an important planning frame.
2. **One platform, modular domains.** One backend and one database initially, with strong internal boundaries.
3. **Personal-first, multi-user-ready.** Build for one person's real use while enforcing user ownership correctly from day one.
4. **Plans are not reality.** A planned workout is not automatically a completed workout. Planned food is not food eaten.
5. **Log once.** Reuse and link data rather than requiring duplicate entry.
6. **Useful without AI.** Planning and tracking must be fully usable before AI exists.
7. **Simple first, depth later.** A thin useful feature beats an elaborate unfinished subsystem.
8. **Missing data is unknown.** Do not interpret an absent record as zero.
9. **Unscheduled time is not failure.** The product should not shame leisure, rest, or empty calendar space.
10. **Calm and practical design.** No "AI app" aesthetic, neon gradients, glowing orbs, or fake optimization scores.

## 1.3 Product-family idea

The historical idea of names such as **7Hours: Kitchen** is still valid as optional branding for deeper domain experiences.

However:

- Kitchen does not need a separate backend.
- Exercise does not need a separate database.
- Every domain should not become a network service.
- A future domain may have its own interface while still using the same 168Hours platform.

The technical model is:

> **one platform, modular domains, potentially separate experiences later.**

---

# 2. Core Build — what must exist before expansion

The Core Build is intentionally bounded.

It should produce something the owner can start using immediately from a desktop or phone browser.

## 2.1 Required Core capabilities

### Platform foundation

- monorepo/workspace scaffolding,
- TypeScript strict mode,
- PostgreSQL,
- migrations,
- local Docker development database,
- configuration validation,
- structured logging,
- consistent error handling,
- authentication,
- user ownership/authorization,
- shared API contracts,
- responsive web application,
- automated tests,
- locally runnable verification commands.

### Core product

- Dashboard,
- weekly planner,
- categories,
- planned versus actual time,
- goals,
- food/nutrition logging,
- exercise logging,
- hydration logging,
- body-weight logging,
- basic history/trends,
- responsive phone-browser support.

### Explicitly NOT Core

Do not build these before the Core Completion Gate:

- AI coach,
- OpenAI API integration,
- native mobile app,
- Apple Health / HealthKit,
- Apple Watch app,
- Strava integration,
- wearable integrations,
- push notifications,
- reminder workers,
- barcode scanning,
- giant food database,
- recipe scraping,
- Kitchen recipe manager,
- pantry/shopping list,
- sleep tracking,
- journaling,
- habits/streaks,
- generic custom trackers,
- finance,
- social features,
- friends/follows,
- households,
- billing,
- public profiles,
- complex recurrence,
- full calendar-provider synchronization,
- advanced drag-and-drop calendar editing,
- GPS route capture,
- offline synchronization,
- microservices.

These belong to later expansion phases.

## 2.2 Core success scenario

A user can:

1. create/sign into an account,
2. configure timezone and preferred units,
3. create life categories such as Work, Sleep, Exercise, Food, Learning, and Free Time,
4. plan a week with time blocks,
5. see how much of the 168-hour week is allocated by category,
6. record actual time for selected blocks/activities,
7. create goals,
8. log food and see daily calorie/macronutrient totals,
9. log a strength workout or cardio activity,
10. log water and body weight,
11. open the dashboard and understand today + the current week,
12. review planned versus recorded time,
13. use the same application comfortably from a phone browser.

A second account must not be able to read or modify any of the first account's data.

If all of this works, the Core MVP is successful.

---

# 3. Architecture

## 3.1 Architecture style

Use a **modular monolith**.

```text
                      ┌─────────────────────┐
                      │   Next.js Web App   │
                      │ desktop + mobile web│
                      └──────────┬──────────┘
                                 │
                           /api/v1 REST
                                 │
                      ┌──────────▼──────────┐
                      │   Express API       │
                      │ modular monolith    │
                      └──────────┬──────────┘
                                 │
                      ┌──────────▼──────────┐
                      │     PostgreSQL      │
                      └─────────────────────┘
```

Later clients:

```text
Web ─────────────┐
Mobile ──────────┼──→ Same backend API ──→ Same database
Future clients ─┘
```

The backend is the platform. Interfaces are clients.

## 3.2 Why not microservices now

Do not create network boundaries simply to imitate future scale.

Microservices would add:

- multiple deployments,
- cross-service authentication,
- service discovery,
- distributed transactions,
- duplicated observability,
- versioned internal APIs,
- more difficult local development,
- more failure modes.

None are justified for the Core Build.

Instead, enforce domain boundaries in code. A module can be extracted later if actual scale/team/deployment needs justify it.

## 3.3 Backend request flow

Use the basic flow:

```text
HTTP route
   ↓
authentication
   ↓
request validation
   ↓
application service
   ↓
repository / persistence
   ↓
PostgreSQL
```

Business rules belong in application/domain services, not route handlers and not the frontend.

## 3.4 Frontend rule

The frontend does not own canonical business logic.

Do not:

- import Drizzle into the web app,
- query PostgreSQL from Next.js,
- duplicate weekly-hour calculations in several UI components,
- duplicate nutrition calculations in the browser,
- store authoritative state only in client state.

The backend returns canonical data; the frontend presents and edits it.

## 3.5 Same-origin API during web development

Prefer the browser to use `/api/*` and have Next.js/proxy infrastructure route those requests to the Express service in development and deployment.

This simplifies:

- cookie-based sessions,
- CORS,
- local development,
- later deployment behind one public origin.

The Express API remains an independent application and can still be called directly by a future native client.

---

# 4. Technology stack

Use these defaults unless a current compatibility issue is discovered.

| Layer | Choice |
|---|---|
| Language | TypeScript, strict mode |
| Workspace | pnpm workspaces |
| Backend | Node.js + Express 5, ESM |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| PostgreSQL driver | `pg` / node-postgres |
| Runtime validation | Zod |
| Authentication | Better Auth + Drizzle adapter |
| Web | Next.js App Router |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS + semantic CSS variables |
| UI primitives | accessible headless primitives / selectively customized shadcn-style primitives |
| Charts | Recharts or similarly small maintained chart library |
| Logging | Pino |
| Unit tests | Vitest |
| API integration tests | Vitest + Supertest + real test PostgreSQL |
| Browser E2E | Playwright |
| Local services | Docker Compose |

Do not pin versions in this document. At scaffold time, verify current stable compatible versions from official documentation and commit the lockfile.

## 4.1 Packages intentionally not included in Core

Do not add these during initial scaffolding:

- OpenAI SDK,
- LangChain or agent frameworks,
- Redis,
- Kafka,
- GraphQL,
- vector database,
- Kubernetes,
- Expo / React Native,
- calendar integration SDKs,
- wearable SDKs,
- barcode SDKs.

Add them only when the corresponding expansion feature is approved.

---

# 5. Repository structure

Use a pnpm workspace.

```text
168hours/
├── 168HOURS_BUILD_SPEC.md
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .gitignore
├── .editorconfig
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   ├── composition.ts
│   │   │   ├── modules/
│   │   │   │   ├── identity/
│   │   │   │   ├── categories/
│   │   │   │   ├── planning/
│   │   │   │   ├── goals/
│   │   │   │   ├── nutrition/
│   │   │   │   ├── exercise/
│   │   │   │   ├── hydration/
│   │   │   │   ├── body/
│   │   │   │   └── dashboard/
│   │   │   ├── infrastructure/
│   │   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   └── logging/
│   │   │   └── shared/
│   │   │       ├── auth/
│   │   │       ├── errors/
│   │   │       └── http/
│   │   ├── drizzle/
│   │   ├── tests/
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── features/
│       │   ├── components/
│       │   │   └── ui/
│       │   └── lib/
│       ├── .env.example
│       └── package.json
│
├── packages/
│   ├── contracts/
│   ├── api-client/
│   ├── domain-utils/
│   └── config/
│
├── infra/
│   └── compose.yaml
│
└── docs/
    ├── IMPLEMENTATION.md
    ├── architecture.md
    ├── verification.md
    └── decisions/
```

Create folders when the corresponding feature starts. Do not pre-populate the codebase with empty expansion modules.

## 5.1 Package boundaries

```text
contracts    → Zod schemas and transport-safe types
api-client   → contracts
utils        → pure date/unit/math helpers only
api          → contracts + utils
web          → api-client + contracts + utils when useful
```

Rules:

- `web` must never import `apps/api/src`.
- a module may not import another module's private repository implementation.
- cross-domain collaboration goes through exported application services.
- shared packages must not become dumping grounds.

## 5.2 Backend module shape

Use enough structure to separate responsibilities, but avoid ceremonial files.

A typical module may look like:

```text
planning/
├── planning.routes.ts
├── planning.service.ts
├── planning.repository.ts
├── planning.schemas.ts
└── planning.types.ts
```

If a controller file adds no value, a route handler may call a service directly.

Do not create interface/implementation pairs solely because "clean architecture" examples do so.

---

# 6. Scaffolding instructions

The coding agent should scaffold the repository in this order.

## 6.1 Workspace

1. Inspect existing files.
2. Create a private root `package.json`.
3. Configure pnpm workspaces for `apps/*` and `packages/*`.
4. Pin the selected pnpm version in `packageManager`.
5. Add shared TypeScript, lint, formatting, and test configuration.
6. Configure strict TypeScript.
7. Commit one lockfile only.

## 6.2 PostgreSQL

Create `infra/compose.yaml` with PostgreSQL.

Use separate databases or schemas/connection strings for:

- development,
- automated integration tests.

Never point automated tests at a personal development database.

Provide migrations through Drizzle.

Do not rely on ORM schema synchronization in production-like environments. Commit migration history.

## 6.3 API

Create Express manually in `apps/api`.

Separate:

```text
createApp(...)     # constructs Express app, no listen side effect
server.ts          # opens port, shutdown handling
```

This makes integration tests straightforward.

Create:

```text
GET /api/health
GET /api/ready
```

`health` proves the process is alive. `ready` may verify database connectivity.

## 6.4 Web

Scaffold Next.js inside `apps/web` using the current official generator with:

- TypeScript,
- App Router,
- Tailwind,
- `src/` directory,
- pnpm,
- linting.

Do not create a nested `.git` directory.

Create the basic authenticated application shell before domain pages.

## 6.5 Shared contracts and API client

Create a small `packages/contracts` package containing Zod schemas and inferred wire types.

Create `packages/api-client` with framework-neutral functions such as:

```text
getCurrentUser()
getWeek(...)
createTimeBlock(...)
getDashboard(...)
logFood(...)
createWorkout(...)
```

The client should accept a configurable base URL/fetch implementation where useful so it can later be reused by React Native.

## 6.6 Root commands

The completed Core scaffold should support:

```bash
pnpm install
pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm verify
```

`pnpm verify` should run the meaningful non-destructive verification suite.

Document all commands in `README.md`.

---

# 7. Configuration and logging

## 7.1 Environment configuration

Validate environment variables at startup using Zod.

Core variables will likely include equivalents of:

```text
NODE_ENV
PORT
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
WEB_ORIGIN
LOG_LEVEL
```

Exact names may follow library conventions.

Maintain `.env.example` files with safe placeholders.

Never commit secrets.

## 7.2 Logging

Use Pino structured logging.

Each request should have a request/correlation ID.

Useful fields:

```text
level
time
service
requestId
method
path
statusCode
durationMs
userId        # only when safe/appropriate
message
```

Never log:

- passwords,
- session tokens,
- cookies,
- authorization headers,
- complete food journals,
- detailed personal health records,
- database connection secrets.

Logs are operational tools, not another copy of the user's private data.

---

# 8. Authentication and authorization

## 8.1 Authentication

Use Better Auth with PostgreSQL/Drizzle.

Core authentication requirements:

- email/password account creation,
- sign in,
- sign out,
- current-session lookup,
- secure session cookie,
- expired/invalid session handling.

No social login, email verification, password reset email delivery, 2FA, organizations, or billing in Core unless required by the chosen library's basic setup.

## 8.2 Authorization

Authentication does not replace application authorization.

Every user-owned query must scope by authenticated `user_id`.

Never:

```text
SELECT ... WHERE id = suppliedId
```

when the record is user-owned.

Conceptually use:

```text
WHERE id = suppliedId
  AND user_id = authenticatedUserId
```

Test cross-account access for every major resource family.

## 8.3 User profile/preferences

Create a user profile/preferences record with at least:

- timezone,
- week start preference (default Monday unless owner changes it),
- weight display unit (`lb` or `kg`),
- distance display unit (`km` or `mi`).

Store canonical values in standard internal units; format according to preferences.

---

# 9. Database conventions

## 9.1 Shared conventions

Use UUID/UUIDv7-style identifiers or another well-supported non-sequential identifier consistently.

User-owned tables generally include:

```text
id
user_id
created_at
updated_at
```

Use UTC instants for real timestamps.

Store local-date semantics separately where a local date itself matters.

Do not store formatted strings such as `"177 lb"` or `"5 km"` as canonical values.

## 9.2 Canonical units

Use canonical internal units:

```text
body weight      kilograms
strength load    kilograms
distance         metres
duration         seconds
hydration        millilitres
food mass        grams
energy           kcal
```

Convert only at input/output boundaries.

## 9.3 Deletion

For Core, permanent deletion is acceptable for ordinary user-created planning/log records when explicitly requested and confirmed.

Definitions that historical records depend on should be archived rather than destructively removed when deletion would corrupt history.

Examples:

- an exercise used in old workouts,
- a food used in old food logs,
- a category used in historical time blocks.

Historical logs should continue rendering even if their originating definition changes.

---

# 10. Core data model

This section defines intent rather than exact Drizzle syntax.

## 10.1 Categories

`categories`

```text
id
user_id
name
color?          # optional UI organizational hint
icon?           # optional
archived_at?
created_at
updated_at
```

Examples:

```text
Work
Sleep
Exercise
Cooking
Learning
Social
Free Time
```

Categories are primarily used to understand how the 168 hours are allocated.

## 10.2 Goals

`goals`

```text
id
user_id
title
description?
category_id?
target_date?
status          # active | completed | paused | archived
created_at
updated_at
completed_at?
```

Keep Core goals intentionally simple.

Do not build a universal formula engine for goals yet.

## 10.3 Planned time blocks

`time_blocks`

```text
id
user_id
category_id?
goal_id?
title
notes?
starts_at
ends_at
created_at
updated_at
```

Rules:

- `ends_at > starts_at`.
- Blocks may overlap; the UI should surface overlap rather than silently rejecting it.
- No recurrence engine in Core.
- No external calendar sync in Core.

## 10.4 Actual time entries

`time_entries`

```text
id
user_id
category_id?
time_block_id?
title
starts_at
ends_at
source_type?    # manual | strength_workout | cardio_activity | future domain
source_id?
created_at
updated_at
```

Purpose:

- capture selected actual time,
- compare plan vs reality,
- link completed domain activity back to the weekly time model.

When a domain record creates an actual time entry, prevent duplicate ledger entries for the same source.

A partial unique rule such as `(user_id, source_type, source_id)` for non-null sources is appropriate.

Do not automatically create actual time for every planned block merely because its scheduled end time passed.

## 10.5 Foods

`foods`

```text
id
user_id
name
serving_amount
serving_unit
calories
protein_g?
carbs_g?
fat_g?
fiber_g?
archived_at?
created_at
updated_at
```

Core foods are user-created/manual.

No barcode scanner or external nutrition database is required.

## 10.6 Food log entries

`food_entries`

```text
id
user_id
food_id?
consumed_at
quantity
meal_type?          # breakfast | lunch | dinner | snack | other
name_snapshot
serving_amount_snapshot
serving_unit_snapshot
calories_snapshot
protein_g_snapshot?
carbs_g_snapshot?
fat_g_snapshot?
fiber_g_snapshot?
created_at
updated_at
```

Snapshots are important. Editing a food definition tomorrow must not rewrite what the user ate last week.

Unknown nutrient values remain null/unknown; do not silently replace them with zero.

## 10.7 Strength exercises

`exercises`

```text
id
user_id
name
notes?
archived_at?
created_at
updated_at
```

No global exercise encyclopedia is required for Core.

The user can create exercises such as:

```text
Bench Press
Squat
Lat Pulldown
Dumbbell Curl
```

## 10.8 Strength workouts

`strength_workouts`

```text
id
user_id
title?
started_at
ended_at?
notes?
linked_time_block_id?
created_at
updated_at
```

`strength_workout_exercises`

```text
id
workout_id
exercise_id
exercise_name_snapshot
position
notes?
```

`strength_sets`

```text
id
workout_exercise_id
position
reps?
weight_kg?
duration_seconds?
completed
created_at
updated_at
```

Core requirements:

- start a workout,
- add exercises,
- add/edit/remove/reorder sets,
- finish workout,
- revisit history,
- inspect simple exercise progress.

A finished workout linked to a planned time block may create/update one actual `time_entry` using its real duration.

## 10.9 Cardio activities

`cardio_activities`

```text
id
user_id
activity_type       # run | walk | swim | cycle | skip | other
title?
started_at
duration_seconds
distance_meters?
notes?
linked_time_block_id?
created_at
updated_at
```

Distance is optional because activities such as skipping may only need duration.

Derived pace/speed values should be calculated, not redundantly stored unless a measured value is specifically needed later.

## 10.10 Hydration

`water_entries`

```text
id
user_id
amount_ml
consumed_at
created_at
```

Keep it intentionally simple.

## 10.11 Body weight

`weight_entries`

```text
id
user_id
weight_kg
measured_at
created_at
updated_at
```

Do not include body-fat estimates or medical interpretation in Core.

---

# 11. The 168-hour time model

This is the defining product behavior and deserves careful implementation.

## 11.1 Week boundaries

Compute the week in the user's timezone and week-start preference.

Do not calculate a local week by naively subtracting seven multiples of 24 hours from UTC timestamps.

Daylight-saving transitions mean a local calendar week is not always exactly 168 elapsed UTC hours.

The **product concept** is the familiar 168-hour week; calendar/date calculations must still be timezone-correct.

## 11.2 Planned allocation

For the selected local week, calculate:

- total planned block duration,
- planned duration by category,
- unallocated calendar coverage,
- overlaps.

Do not double-count overlapping blocks when showing overall coverage of the week.

Category totals may display raw scheduled durations, but if overlaps create a total above the available calendar coverage, clearly surface the overlap instead of pretending the user created extra time.

## 11.3 Actual time

Actual time is based only on recorded `time_entries` or explicitly linked completed domain records.

Do not infer actual activity simply because a plan existed.

## 11.4 Planned versus actual

Core review should support simple comparisons such as:

```text
Exercise
Planned: 4h 00m
Recorded: 3h 15m

Learning
Planned: 8h 00m
Recorded: 6h 30m
```

This is descriptive, not judgmental.

## 11.5 Planner UI — keep Core simple

The first weekly planner does **not** need a sophisticated drag-and-drop engine.

Required:

- seven-day week view,
- time blocks displayed by day/time,
- click/tap a day or "Add block" to create,
- edit form for start/end/category/title/goal/notes,
- delete with confirmation,
- clear overlap indication,
- keyboard-accessible editing,
- useful phone layout.

Drag, resize, recurrence, copy-week, and external calendar sync can be added later.

This deliberate simplification is meant to get the real product usable faster.

---

# 12. Core feature slices

Every slice should be implemented end-to-end:

```text
schema/migration
    ↓
repository
    ↓
service/business rules
    ↓
REST contract
    ↓
typed API client
    ↓
web UI
    ↓
tests
```

A feature is not complete because its database table exists.

## 12.1 Dashboard

Calendar is the first page after sign-in. The owner has removed the Calendar details/Today UI. The capabilities below remain implemented in backend services; their replacement domain surfaces and any future quick actions require a separate requested slice.

It should answer:

> What does today look like, how is this week allocated, and what have I recently recorded?

Core dashboard sections:

### Today

- current date,
- today's upcoming/current planned blocks,
- quick link to add a block,
- quick actions for water, weight, food, workout/cardio.

### This week

- total planned time,
- allocated time by category,
- overlap warning/count if applicable,
- unallocated time shown neutrally,
- planned versus recorded summary where actual data exists.

### Health snapshot

Keep this secondary to the planner.

Show concise data such as:

- today's calories/protein when food was logged,
- today's water total,
- latest weight,
- most recent workout/cardio activity.

Do not create fake "health scores".

### Goals

- active goals,
- target date when present,
- completion action.

The dashboard service should compose data from domain public services. Other modules must not depend on Dashboard.

## 12.2 Week planner

Pages/routes should support:

- current week,
- previous/next week,
- add/edit/remove time block,
- filter or visually group by category,
- planned totals,
- actual totals,
- overlap visibility.

Use a URL query or route state that allows direct navigation to a week without hiding the selected period only in local state.

## 12.3 Goals

Core UI:

- list active/completed goals,
- create goal,
- edit goal,
- complete/reopen goal,
- optional target date,
- optional category link.

No subgoal dependency graph yet.

## 12.4 Food

Core Food experience:

### Food library

- create a food,
- define serving amount/unit,
- calories,
- optional macros/fibre,
- edit/archive food.

### Daily log

- choose date,
- add saved food,
- choose quantity,
- choose meal type,
- edit/remove entry,
- daily totals.

### Reuse

Provide a fast way to repeat a commonly logged food.

Saved meals/recipes can be added later; do not overbuild Core.

## 12.5 Exercise

Create one Exercise area with two primary modes:

### Strength

- exercise library,
- start workout,
- add exercises,
- add sets,
- reps + weight,
- optional timed sets,
- finish workout,
- workout history,
- simple per-exercise history.

### Cardio

- activity type,
- start date/time,
- duration,
- optional distance,
- notes,
- history,
- basic derived pace when meaningful.

No live GPS tracking is required.

## 12.6 Hydration and weight

These should be very fast to log.

Hydration:

- enter amount,
- sensible quick-add buttons,
- today total,
- recent history.

Weight:

- enter weight in preferred display unit,
- convert/store kilograms,
- recent history,
- simple trend chart/list.

Do not treat day-to-day weight movement as a success/failure signal.

---

# 13. API design

Use versioned REST routes under:

```text
/api/v1
```

Better Auth may use its own required route prefix for authentication.

## 13.1 Core route families

Representative routes:

```text
/api/v1/me
/api/v1/preferences

/api/v1/categories
/api/v1/goals

/api/v1/weeks/:localWeekStart
/api/v1/time-blocks
/api/v1/time-entries

/api/v1/dashboard

/api/v1/foods
/api/v1/food-entries
/api/v1/nutrition/daily

/api/v1/exercises
/api/v1/strength-workouts
/api/v1/strength-progress/:exerciseId
/api/v1/cardio-activities

/api/v1/water-entries
/api/v1/weight-entries
```

Exact REST shapes may be adjusted if the resulting contract is clearer.

## 13.2 Contract rules

- validate every external input,
- responses use transport-safe types,
- dates/timestamps are explicit ISO strings,
- units are explicit,
- paginated history endpoints use stable pagination,
- ownership is enforced server-side,
- not-found and forbidden behavior should not leak another user's record existence unnecessarily.

## 13.3 Error response

Use one consistent application error shape, for example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be saved.",
    "details": {},
    "requestId": "..."
  }
}
```

Do not send raw database errors to clients.

---

# 14. Web application and UX

## 14.1 Core navigation

Use a small navigation structure:

```text
Calendar
Food
Exercise
Goals
```

Settings and sign out live in the account menu. Calendar has no details or health panel. Food owns hydration/weight surfaces; Calendar offers selected-date quick actions.

Avoid a giant sidebar with every possible future domain.

## 14.2 Responsive web first

The Core app must be genuinely usable on an iPhone browser before a native app exists.

Test:

- narrow phone viewport,
- tablet-ish width,
- normal desktop.

Do not merely shrink desktop tables until they overflow.

For phone layouts:

- stack information intentionally,
- use 44px-ish touch targets,
- avoid hover-only interactions,
- use bottom sheets/dialogs only when accessible,
- make logging flows short.

## 14.3 Visual direction

The product should feel like a practical planner/logbook, not a futuristic AI startup.

Use:

- calm spacing,
- restrained typography,
- clean cards only where grouping is useful,
- strong hierarchy,
- visible labels,
- minimal decoration,
- no glassmorphism,
- no gradients unless specifically approved later,
- no glowing effects,
- no "AI" visual motif.

### Required color palette

Use these exact initial semantic tokens:

| Token | Color | Use |
|---|---|---|
| Background | `#f8f8f5` | Main page background |
| Foreground | `#1e2422` | Primary text |
| Card | `#ffffff` | Cards and panels |
| Primary | `#196b57` | Green brand color, buttons, links |
| Primary foreground | `#ffffff` | Text on primary surfaces |
| Muted | `#eef0eb` | Subtle backgrounds |
| Muted foreground | `#66706c` | Secondary text |
| Border | `#dfe3dc` | Borders and dividers |
| Input | `#cfd5cd` | Form field borders |
| Focus ring | `#2a806a` | Focus states |
| Destructive | `#b42318` | Errors and destructive actions |

Represent them as semantic CSS variables rather than scattering hex literals:

```css
:root {
  --background: #f8f8f5;
  --foreground: #1e2422;
  --card: #ffffff;
  --primary: #196b57;
  --primary-foreground: #ffffff;
  --muted: #eef0eb;
  --muted-foreground: #66706c;
  --border: #dfe3dc;
  --input: #cfd5cd;
  --focus-ring: #2a806a;
  --destructive: #b42318;
}
```

Dark mode is not required for Core.

Category colors may exist, but color must never be the only way categories are distinguished.

## 14.4 Forms and interactions

Forms must have:

- persistent labels,
- inline validation,
- visible units,
- loading/disabled states,
- retained input on recoverable failure,
- clear successful completion,
- confirmation for destructive operations.

Never use placeholder text as the only field label.

## 14.5 Empty/loading/error states

Every major page should intentionally support:

- first-use empty state,
- loading state,
- recoverable error state,
- populated state.

Do not fill empty dashboards with fake data.

---

# 15. Domain calculations

Canonical calculations should live in backend/domain utilities and be tested.

## 15.1 Time

Provide pure helpers for:

- duration,
- local week boundaries,
- interval overlap,
- union/coverage of intervals,
- duration grouped by category,
- planned versus actual aggregation.

## 15.2 Nutrition

Daily totals should sum only known values.

If one food has unknown protein, do not represent the full day's protein as confidently complete without indicating incomplete data.

The UI may show something such as:

```text
Protein: 96 g + unknown from 1 item
```

rather than silently treating missing protein as 0 g.

## 15.3 Exercise

Strength progress can initially show:

- recent sets,
- max recorded weight,
- best estimated/observed volume indicators only if clearly defined,
- history over time.

Do not implement arbitrary "fitness scores".

For cardio:

```text
pace = duration / distance
```

only when distance > 0 and the activity type makes pace meaningful.

## 15.4 Weight

Charts and summaries should show recorded measurements only.

Do not interpolate missing days as measured values.

---

# 16. Testing strategy

The Core Build needs enough testing to trust the foundation before AI or additional domains are layered on top.

## 16.1 Unit tests

Test pure business logic such as:

- unit conversion,
- week boundaries,
- interval overlaps,
- interval union/coverage,
- nutrition totals with missing nutrients,
- pace calculation,
- dashboard aggregation helpers.

## 16.2 Integration/API tests

Use a real isolated PostgreSQL test database.

Test:

- migrations,
- auth/session-protected routes,
- ownership isolation,
- CRUD for each Core module,
- food snapshots,
- workout persistence,
- linked workout → actual time deduplication,
- dashboard aggregation,
- validation/error shapes.

Do not mock PostgreSQL for repository integration tests.

## 16.3 E2E tests

Playwright should cover at least:

### Main Core flow

1. create/sign into test user,
2. create category,
3. add weekly time block,
4. create goal,
5. create/log food,
6. record strength workout,
7. record cardio activity,
8. log water,
9. log weight,
10. view dashboard,
11. view week summary,
12. sign out.

### Isolation flow

- create second user,
- verify it cannot access first user's records even when IDs are known.

### Responsive flow

Run at least one meaningful core flow in a phone viewport.

## 16.4 Test fixtures

Use synthetic data only.

Example fixture categories:

```text
Work
Exercise
Learning
Sleep
Free Time
```

Do not encode the owner's real personal data into tests or seed files.

---

# 17. Core implementation plan

This is the build sequence Codex should follow.

Implement **C0 through C6 continuously**, using each gate to verify quality internally. Do not ask for permission between milestones unless a real blocker requires owner input.

## C0 — Scaffold and prove the loop

### Build

- pnpm workspace,
- TypeScript/lint/format config,
- `apps/api`,
- `apps/web`,
- shared packages,
- PostgreSQL Compose,
- Drizzle,
- environment validation,
- Pino logging,
- `/api/health`,
- `/api/ready`,
- README commands.

### Gate

From a clean checkout:

```text
install → start DB → migrate → run API/web → readiness succeeds
```

`lint`, `typecheck`, basic tests, and builds work.

## C1 — Identity and application shell

### Build

- Better Auth,
- email/password sign up/sign in/sign out,
- protected API routes,
- protected web layout,
- profile/preferences,
- user isolation tests,
- application navigation,
- required visual theme.

### Gate

Two users can authenticate independently and cannot read each other's data.

Responsive authenticated shell works on desktop and phone viewport.

## C2 — Week planner: the defining slice

### Build

- categories,
- time blocks,
- time entries,
- current/previous/next week retrieval,
- week calculations,
- planner UI,
- planned totals by category,
- overlaps,
- actual totals,
- planned-vs-recorded summary.

### Gate

A user can plan a realistic week and record selected actual time.

Week boundaries behave correctly in the user's timezone.

Overlapping blocks do not create false total calendar coverage.

This is the first point where the application should visibly feel like **168Hours** rather than generic CRUD software.

## C3 — Goals + Dashboard

### Build

- simple goals,
- dashboard API composition,
- Today section,
- weekly allocation summary,
- active goals,
- quick-action framework.

### Gate

The dashboard is useful with only planning/goals data and never shows invented statistics.

## C4 — Food + hydration + weight

### Build

- food definitions,
- food snapshots/log entries,
- daily calorie/macronutrient/fibre totals,
- food UI,
- water quick logs,
- weight logs,
- recent histories,
- dashboard snapshot integration.

### Gate

A user can log a normal day of eating without needing an external food API.

Editing a saved food does not rewrite old food logs.

Water and weight quick logs are comfortable on a phone viewport.

## C5 — Exercise

### Build

- exercise definitions,
- strength workout/session flow,
- workout exercises and sets,
- workout history,
- simple per-exercise progress,
- cardio activities,
- optional planned-block linkage,
- actual-time deduplication,
- dashboard snapshot integration.

### Gate

A user can record a real strength workout with several exercises/sets, close it, reopen history, and see what was done.

A run/swim/cycle/skipping session can be recorded without forcing irrelevant fields.

Linked exercise time appears once in actual-time accounting.

## C6 — Core hardening and completion

### Build

- responsive/accessibility pass,
- empty/loading/error states,
- navigation cleanup,
- validation cleanup,
- cross-account authorization audit,
- migration/seed verification,
- main E2E flows,
- phone viewport E2E,
- docs cleanup,
- remove dead code,
- clean-clone verification.

### Gate

All Core success-scenario steps work with real persistence.

`pnpm verify` passes.

No known critical data-loss, authorization, or time-accounting bug remains.

The owner can begin using the app.

---

# 18. CORE COMPLETION GATE — STOP HERE

When C0-C6 pass, **stop development**.

Do not automatically implement AI or another domain.

Provide the owner a handoff containing:

1. what was built,
2. exact setup/run commands,
3. tests actually run and results,
4. known limitations,
5. any manual setup still required,
6. screenshots/manual test suggestions if useful,
7. recommended next expansion based on the current state.

The desired state at this point is:

> **A small, solid, usable 168Hours application with a backend foundation that can support years of additional features.**

The owner should use/review the Core before major expansion.

---

# 19. Expansion architecture rules

Everything below is future work.

The Core architecture must allow it, but Core should not implement it preemptively.

## 19.1 Adding a new domain

A richer new domain gets a module such as:

```text
apps/api/src/modules/sleep/
apps/web/src/features/sleep/
```

It should expose a small public application interface to consumers such as Dashboard and future Coach.

Example:

```text
getSleepSummary(userId, range)
recordSleep(...)
```

Do not let Dashboard query the sleep repository directly.

## 19.2 Generic versus specialized tracking

Future 168Hours will need both.

### Generic trackers

Useful for simple measurements:

- breath hold seconds,
- plank duration,
- books/pages,
- mood rating,
- cups of coffee,
- pull-up count,
- flexibility measurement.

A generic tracker system can support:

```text
number
count
duration
rating
boolean
```

### Specialized domains

Use purpose-built models where behavior is richer:

- nutrition,
- strength training,
- finance,
- recipes/kitchen,
- sleep,
- projects.

Do not distort a rich domain into a generic key/value table merely to claim extensibility.

## 19.3 Microservice extraction

Remain a modular monolith until there is evidence for extraction.

Possible future reasons:

- a domain has very different scaling needs,
- a separate team owns/deploys it,
- security/isolation requirements demand it,
- its workload requires different infrastructure,
- independent availability is valuable.

If a module is extracted later, its current application-service boundary becomes the starting point for the network contract.

Do not architect the Core around hypothetical distributed systems.

---

# 20. Expansion A — AI Coach

The current [product scope](docs/SCOPE.md) governs roadmap priorities. Sections 20–25 retain earlier expansion guidance and ideas, not an automatic implementation sequence or a commitment to every listed feature. Custom domains precede the stretch-goal watch app; dedicated desktop clients are also part of the later client direction.

AI is intentionally **after** the Core.

The Core must be valuable without it.

## 20.1 Role

The future coach is a conversational interface across the user's 168Hours data.

Examples:

```text
"How did I spend my week?"
"Help me fit three workouts into next week."
"What should I eat tonight based on what I've logged today?"
"I haven't exercised much this week. Where could I fit something in?"
"Compare what I planned with what I actually did."
```

## 20.2 Technical shape

Add the OpenAI integration only in this phase.

```text
User
  ↓
Coach endpoint
  ↓
OpenAI Responses API
  ↓
function/tool request
  ↓
168Hours application service
  ↓
repositories/database
```

The model must **never directly query PostgreSQL**.

The model uses application tools that enforce the same authorization and business rules as ordinary API endpoints.

## 20.3 Initial read tools

Examples:

```text
get_today_plan
get_week_plan
get_week_time_summary
get_active_goals
get_today_nutrition
get_recent_food_entries
get_recent_strength_workouts
get_exercise_progress
get_recent_cardio
get_hydration_status
get_weight_trend
```

Tool responses should be bounded to relevant ranges instead of dumping the user's full database into prompts.

## 20.4 Write actions

AI writes should use **proposal → approval → execution**.

Example:

```text
User: Plan three workouts next week.
Coach: proposes three time blocks.
UI: shows proposed changes.
User: approves/rejects/edits.
Backend: applies approved changes.
```

Do not let the model silently modify:

- historical logs,
- goals,
- food records,
- planned time,
- workouts,
- account settings.

## 20.5 Model/cost strategy

Use a configurable model name rather than hard-coding product logic around one model.

Keep costs controlled by:

- retrieving only needed data,
- deterministic summaries before model calls,
- bounded conversation history,
- smaller models for ordinary coaching when appropriate,
- stronger models only when the request benefits from them.

Do not duplicate calculations with the model when the backend can calculate them exactly.

---

# 21. Expansion B — deeper life domains

Add these based on actual use, not all at once.

## 21.1 Kitchen / optional 7Hours: Kitchen surface

Possible features:

- recipes,
- ingredients,
- serving scaling,
- meal plans,
- shopping lists,
- pantry,
- recipe URL import,
- recipe AI transformations.

This remains a module of the same 168Hours platform unless real evidence justifies service extraction.

The display label **7Hours: Kitchen** may be used without forcing the entire architecture into `[Number]Hours` microservices.

## 21.2 Nutrition depth

Possible features:

- saved meals,
- recipes linked to food logs,
- barcode scanning,
- external nutrition database,
- micronutrients,
- custom targets,
- grocery planning.

## 21.3 Training depth

Possible features:

- routines/programs,
- supersets,
- PR detection,
- progression schemes,
- richer charts,
- exercise metadata,
- swim/run structured sessions.

## 21.4 Sleep

Possible features:

- manual sleep,
- sleep windows,
- sleep targets,
- later wearable imports,
- week summaries.

Avoid medical diagnosis or unsupported sleep-quality claims.

## 21.5 Habits and journal

Possible features:

- recurring habits,
- completions,
- reflections,
- daily journal,
- weekly review.

Avoid turning the product into a gamified shame system based on streaks.

## 21.6 Generic skills/trackers

Build the generic tracker system described earlier so the user can add arbitrary measurable activities without requiring a new code module.

---

# 22. Expansion C — mobile application

After the web/Core data model and workflows are proven, build:

```text
apps/mobile/
```

using React Native + Expo.

The native app must use:

- the same API,
- the same auth/account,
- the same database,
- the same contracts/api-client where compatible,
- the same canonical calculations.

Do not reimplement nutrition, planning, or exercise business rules in React Native.

Initial native priorities:

- Today,
- Week/day agenda,
- quick food/water/weight logs,
- active workout logging,
- cardio logging,
- goals,
- AI coach after AI phase exists,
- native reminders.

Complex planner editing may remain web-first initially.

---

# 23. Expansion D — integrations

Possible integrations include:

- Apple Health / HealthKit,
- Apple Watch,
- Strava,
- Garmin,
- smart scales,
- nutrition providers,
- barcode databases,
- external calendars,
- recipe providers.

Every integration must be treated as an adapter into 168Hours' internal model.

```text
External provider
       ↓
Adapter
       ↓
Validated/normalized domain command
       ↓
168Hours domain service
       ↓
Database
```

Do not let external provider shapes become the internal domain model.

Track source IDs and timestamps so imports can be idempotent and updates/deletions reconciled.

---

# 24. Expansion E — reminders and automation

Possible later capabilities:

- water reminders,
- planned-workout reminders,
- meal-prep reminders,
- goal check-ins,
- weekly review prompts,
- native push notifications,
- scheduled AI reviews,
- condition-based suggestions.

When built, reminders require durable server-side definitions and occurrence/deduplication rules.

A notification is not proof an activity was completed.

---

# 25. Expansion F — social and public product

The product may eventually be published for other users.

The Core is therefore multi-user-ready, but public release is **not** assumed.

Before public launch, separately address:

- account recovery/verification,
- privacy policy,
- terms,
- consent,
- data export/deletion,
- security review,
- rate limiting/abuse prevention,
- backups and incident response,
- monitoring,
- billing if applicable,
- support expectations,
- moderation/reporting for social features,
- jurisdiction-specific handling of health-related data/claims,
- age/audience policy.

Potential social features:

- friends,
- shared goals,
- optional public progress,
- households,
- shared meal planning,
- workout sharing,
- challenges.

Privacy must be explicit. Never make existing private records social by default.

---

# 26. Security rules

Even for a private personal app, follow these rules from the start.

- validate external input,
- parameterized SQL through Drizzle,
- user ownership on every private record,
- secure session cookies,
- CSRF protection according to the auth architecture,
- sensible request-body limits,
- strict CORS/origin policy if cross-origin access is introduced,
- security headers,
- secrets only in environment configuration,
- no secrets in client bundles,
- no sensitive log payloads,
- confirmation for destructive actions,
- database migrations backed up before risky production changes later.

Do not claim medical compliance, HIPAA compliance, or medical-device status simply because security practices are used.

---

# 27. Coding standards

## 27.1 TypeScript

- strict mode,
- avoid `any`,
- prefer inferred types where obvious,
- validate at runtime boundaries,
- do not create duplicate hand-written types when they can be inferred from validated contracts.

## 27.2 Services

Services should express use cases clearly:

```text
createTimeBlock(...)
recordActualTime(...)
logFood(...)
startStrengthWorkout(...)
finishStrengthWorkout(...)
getWeeklyDashboard(...)
```

Avoid giant "Manager" or "Utils" classes/files.

## 27.3 Repositories

Repositories encapsulate persistence details.

Do not put business decisions into repositories beyond data-integrity concerns.

## 27.4 Errors

Use a small application error hierarchy or tagged error system for cases such as:

```text
Validation
NotFound
Unauthorized
Forbidden
Conflict
BusinessRule
Internal
```

Map them in one global API error handler.

## 27.5 Comments

Comments explain **why** something surprising exists.

Do not narrate obvious code.

## 27.6 File size

There is no arbitrary hard file-length rule.

Split files when they contain multiple responsibilities or become difficult to understand/test, not to satisfy a line-count target.

---

# 28. Performance and data loading

Core does not require sophisticated optimization.

Still:

- paginate long histories,
- index common user/time queries,
- avoid N+1 queries,
- keep dashboard queries bounded to relevant periods,
- use database aggregation where appropriate,
- invalidate TanStack Query caches deliberately after mutations.

Likely useful indexes include combinations such as:

```text
(user_id, starts_at)
(user_id, consumed_at)
(user_id, measured_at)
(user_id, created_at)
```

Measure before adding complex caching infrastructure.

No Redis in Core.

---

# 29. Local development and verification

## 29.1 Local verification

The owner requested removal of CI. Do not scaffold or configure GitHub Actions. Keep the complete local verification command (`pnpm verify`):

```text
lint
format check
typecheck
unit tests
integration tests
build
browser tests
```

Install dependencies with the frozen lockfile before running these commands.

## 29.2 Local seed

Provide an explicit development seed command with synthetic data.

It may create:

- demo categories,
- a demo week,
- demo foods,
- demo workout history,
- demo goals.

Never run seeding automatically against a production database.

## 29.3 Deployment

Core should be deployable later as:

```text
Web host
API host/runtime
Managed PostgreSQL
```

But do not require deployment to finish Core locally.

Do not choose complicated infrastructure merely to demonstrate DevOps knowledge.

---

# 30. Core acceptance checklist

The coding agent must not mark Core complete until these are satisfied or explicitly documented as blocked.

## Foundation

- [ ] pnpm workspace works from clean checkout.
- [ ] TypeScript strict mode is enforced.
- [ ] PostgreSQL starts through documented local setup.
- [ ] migrations apply cleanly.
- [ ] configuration validation fails clearly when required values are missing.
- [ ] structured logging and global errors exist.
- [ ] root verification commands are documented.

## Auth

- [ ] account can be created.
- [ ] user can sign in/out.
- [ ] protected pages/routes reject unauthenticated access.
- [ ] second user cannot read/update/delete first user's records.

## 168Hours planning

- [ ] categories work.
- [ ] weekly view works.
- [ ] time block CRUD works.
- [ ] week navigation works.
- [ ] timezone-aware boundaries work.
- [ ] overlap is visible.
- [ ] weekly allocated totals work.
- [ ] actual time can be recorded.
- [ ] planned-vs-actual summary works.

## Dashboard

- [ ] Today shows useful real data.
- [ ] weekly allocation summary works.
- [ ] goals appear correctly.
- [ ] health snapshot shows only recorded data.
- [ ] no fake scores/statistics exist.

## Goals

- [ ] create/edit/complete/reopen works.
- [ ] optional category/target-date links work.

## Food

- [ ] create/edit/archive food works.
- [ ] food entries work.
- [ ] daily totals work.
- [ ] unknown nutrients remain distinguishable from zero.
- [ ] old entries survive food-definition changes through snapshots.

## Exercise

- [ ] exercises can be created/archived.
- [ ] strength workout can be started/completed.
- [ ] exercises/sets persist correctly.
- [ ] workout history works.
- [ ] simple exercise progress works.
- [ ] cardio activity works with and without distance.
- [ ] linked actual-time record is not duplicated.

## Water and weight

- [ ] water quick log works.
- [ ] daily total works.
- [ ] weight conversion/display works.
- [ ] weight history/trend renders recorded data correctly.

## Web quality

- [ ] required color palette is implemented through semantic tokens.
- [ ] desktop layout works.
- [ ] phone layout works.
- [ ] keyboard navigation is usable.
- [ ] forms have labels/errors/loading states.
- [ ] empty/error states exist.

## Verification

- [ ] lint passes.
- [ ] format check passes.
- [ ] typecheck passes.
- [ ] unit tests pass.
- [ ] integration tests pass.
- [ ] build passes.
- [ ] core E2E flow passes.
- [ ] isolation E2E/integration coverage passes.
- [ ] clean-clone instructions are accurate.

---

# 31. What not to do

Do not:

- start with microservices,
- build AI before the Core works,
- build a native app before the responsive web workflows are proven,
- add Redis "for later",
- invent an event bus,
- build a plugin marketplace,
- create dozens of empty future-domain modules,
- force all life tracking into one generic EAV table,
- duplicate backend calculations in UI components,
- store user health records in logs,
- infer completion from planned calendar blocks,
- interpret missing nutrition as zero,
- require dragging as the only planner interaction,
- use default template styling without applying the specified design direction,
- create endless refactors for hypothetical scale,
- suggest fixes simply for the sake of suggesting fixes.

The standard is not "maximum architecture." The standard is **a strong foundation with the least complexity necessary**.

---

# 32. Starting prompt for Codex / ChatGPT coding agent

After cloning the repository, the owner should be able to give the coding agent this instruction:

> Read `168HOURS_BUILD_SPEC.md` completely and inspect the repository. This document is the authoritative implementation brief. Build the **Core Build only**, implementing C0 through C6 continuously in the specified order. Do not stop after each milestone to ask for permission unless a genuine blocker requires owner input. Build working vertical slices, keep `docs/IMPLEMENTATION.md` current, run the relevant checks, and preserve existing work. Do not implement AI, native mobile, integrations, Kitchen, barcode scanning, social features, or other expansion items yet. When the Core Completion Gate passes, stop and give me a concise handoff with what is built, tests actually run, known limitations, and how to run it.

For future sessions after Core work has begun:

> Read `AGENTS.md`, `168HOURS_BUILD_SPEC.md`, and `docs/IMPLEMENTATION.md`. Inspect the current working tree and tests. Continue from the first unfinished Core milestone without re-scaffolding or redesigning completed work unless a concrete defect requires it. Preserve user changes and verify your work before claiming completion.

For expansion after the owner has used/reviewed Core:

> The 168Hours Core is now the foundation. Read the build spec and current architecture. Implement only the expansion feature I request, integrating it through existing module/service/API boundaries. Do not redesign unrelated Core functionality or introduce distributed architecture unless the requested feature provides a concrete reason.

---

# 33. Final intent

The first version of 168Hours should not try to prove every idea the project may ever contain.

It should prove three things:

1. **The weekly 168Hours planning concept is useful.**
2. **Different life domains can live cleanly on one platform.**
3. **The backend is strong enough that AI, mobile, integrations, and new domains can be added later without a rewrite.**

Build that first.

Then expand based on actual use.
