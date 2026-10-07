# Implementation status

Core C0–C6 and the owner-authorized foundation, authentication, data-integrity, UI, Calendar, Food, Exercise and Admin passes are complete. The owner-authorized Admin pass adds permanent account types, account management, aggregate statistics, operational health and an immutable action log. Remaining work in this authorized scope: none. Genuine blockers: none. CI remains removed; checks run locally. No AI, external integrations, native app, social features, notification delivery or background jobs were added.

## Architecture and completed foundation

The pnpm workspace contains a Next.js web app, an independent Express API, and shared contracts, API client and domain utilities. Backend requests follow routes → services → repositories → Drizzle/PostgreSQL. Only repositories and dedicated infrastructure access persistence; services compose writes through opaque transaction scopes. AST boundary checks enforce those rules. See [architecture](architecture.md) and [foundation decisions](decisions/001-foundation.md).

- Startup verifies database connectivity, schema and restricted runtime permissions before listening. Structured logging, redaction, consistent errors/404s, body limits, readiness, rate limiting, bounded database/HTTP waits and graceful shutdown are implemented. See [foundation operations](foundation.md).
- Authentication uses versioned asynchronous scrypt (N=65536, r=8, p=2), private session DTOs, renewal/revocation, strict endpoint/input controls, exact-origin/Fetch Metadata checks and production cookie protections. Owned reads, writes and references are enforced across domains. See [security](security.md).
- Writes require idempotency keys; edits/deletes require the last-seen revision. Effects and retry receipts commit together. Database checks, composite ownership foreign keys, immutable ownership/history and database-managed revisions reinforce service validation. Exercise/source-time updates are atomic and deduplicated. See [time/history](decisions/002-time-and-history.md) and [write integrity](decisions/003-write-integrity.md).
- Owner policy: application data is disposable. Earlier development/test data was cleared, and legacy password compatibility was removed. No preservation/backfill helpers were introduced. Normal domain operations still keep food snapshots and recorded activity correct.
- Planner, goals, manual food/nutrition, hydration/weight and strength/cardio are implemented. Calendar replaces the separate Dashboard/Week pages. Desktop sidebar and mobile bottom navigation have Calendar, Food, Exercise and Goals; Settings/signout live in the account menu. Exact specification colors are retained. See [UI standards](ui-standards.md).

## Calendar, complete

Day · Week · Month, Week by default, and Previous → Today → Next stay in the top toolbar. Calendar fills the workspace. Dense Week/Month records remain accessible through the day list; Day shows full overlapping records. Quarter-hour selection, duration shortcuts, overnight rescheduling, duplicate drafts, date jumping, current-time positioning and scroll memory remain implemented. The removed lower settings/reporting panel stays removed.

The six additions are:

1. Desktop Day/Week drag moves, edge resizing and empty-range draft creation; desktop Month date moves. Touch users enable Move/Resize through the block editor. Snapping, previews, edge scrolling, Escape/blur/pointer cancellation, revision conflicts and retrying an uncertain save are handled. Forms remain available for keyboard and precise editing.
2. Finite daily/weekly repeating plans, individual exceptions/deletions and whole-series edit/delete. Parent locking and revisions prevent competing series/occurrence writes from silently overwriting each other. Recorded activity remains intact when a plan is removed.
3. Day/week copying and reusable templates, with full previews before atomic application. Capture, rename, delete and apply are implemented. Source/preference revisions reject stale previews.
4. All-day and dated/undated unscheduled plans, separate from allocated hours. Scheduling an item creates a block and removes the original item atomically.
5. Visible title/type/category filters and owner-scoped, paginated history search with optional date bounds. Filters retain canonical accounting and source-link metadata.
6. Selected-date quick actions reuse Food, Cardio, Strength, Goals, water and weight forms. Every action requires explicit submission.

Focused planning services/repositories and four normalized tables extend the existing architecture. Browser presentation, geometry, interaction state, editors and data access remain separate modules. No dependencies were added. See [Calendar decisions and limits](decisions/004-calendar-expansion.md).

## Food slice, complete

- Food owns a responsive daily log with meal add actions, canonical daily/meal/entry nutrition, and water/weight panels. Narrow layouts offer section links. Date and library selection remain in the URL; corrected entries reveal their saved date.
- Create a missing food from the logging form and return directly to logging. Search recent entries across dates, repeat their original snapshots, edit/delete logs, and archive/restore definitions. Required calories start blank; unknown nutrients stay distinguishable from zero.
- Water supports 250/500 ml shortcuts, custom amounts, daily totals and editable history. Quick logs capture the current instant for today or local noon for other dates; uncertain retries retain the exact payload/key.
- Weight supports preferred-unit input, selected-day records, the latest measurement through that day, a 30-day chart and editable history. Latest/day/chart reads share one database snapshot; later dates are excluded. The chart uses at most 200 actual measurements, explicitly reports truncation, and leaves all records accessible in paginated history.
- Nutrition, Hydration and Body retain separate routes/services/repositories. Reviewed ownership, snapshots, canonical units, daily bounds, revisions, transactions, retry behavior and caches. Corrected literal food search and aligned measurement form validation with API bounds. No dependencies or tables were added. See [Food decisions](decisions/005-food-slice.md).

## Exercise slice, complete

- Strength/Cardio histories now support literal title search and status/type filters. The library supports revision-protected archive/restore; progress shows completed sets from finished workouts and preserves unknown load.
- Workouts support creating an exercise inside the draft, preselected return, repeatable unchecked sets, explicit finish times for past sessions, corrections and confirmed reopening. The responsive save bar sits above mobile navigation; set controls retain keyboard/touch access.
- Saving retains validated set IDs/creation timestamps, keeping ordinary corrections stable across paginated progress. Maximum load and its history page share one read snapshot. Foreign/duplicated child IDs are rejected. Existing snapshots and atomic source-time lifecycle remain intact.
- Generated finish timestamps are captured with the retry key. Lost responses retry the identical command; stale drafts remain editable. Cardio preserves original timestamp precision and displays short durations in seconds. Unchanged saved timestamps remain editable in repeated DST hours; new ambiguous/missing times are rejected.
- Existing services/repositories and shared contracts remain the architecture. The exercise picker and styles are separated from the workout coordinator. Exercise writes invalidate all affected Calendar caches. No dependencies, tables or migration files were added. See [Exercise decisions](decisions/006-exercise-slice.md).

## Admin slice

- Account type is fixed at creation. Public signup creates User accounts; `pnpm admin:create` interactively creates a separate Admin locally, with hidden/confirmed password input and atomic credentials/audit persistence. Existing emails are never converted. PostgreSQL rejects account-type changes and suspended Admin accounts.
- Admin lives in the account menu and has responsive Overview, Users and Audit history sections. Name/email/exact-ID search, status filters and bounded pagination select account metadata only. Confirmed actions suspend/reactivate regular users or revoke all their sessions. Admin accounts cannot be managed through these actions.
- Suspension/session changes use revisions, transactional idempotency receipts and immutable audit entries. Session persistence and domain mutations share account locks with suspension. Login/private requests reject suspended accounts; reactivation requires a new login. Personal endpoints retain ownership checks even for Admin users.
- Statistics report real account/signup/activity counts and aggregate stored Calendar/Food/Exercise/Goals records through public domain services. Activity is updated at most hourly. Health reports database readiness, the API package version, uptime and process-local request/error/abort counters. No personal journal contents are exposed.
- Migration `0010_regular_thing.sql` adds the audit table, fixed account types/status/activity/revisions, indexes and integrity triggers. Local migration succeeded; `pnpm db:generate` reports no schema changes. There are now 24 application tables and eleven tracked migrations. No dependencies, external services, production setup, real Admin account, commit or deployment were added. See [Admin decisions](decisions/007-admin.md).
- Final results: zero-warning lint/import boundaries, formatting, strict workspace typechecks, **43 unit tests, six architecture tests, 68 real-PostgreSQL integration tests and both production builds passed**. The latest aggregate `pnpm verify` passed those stages and **20/21 browser flows**, including Admin on desktop/phone/tablet with WCAG checks. Calendar desktop stopped at a ten-second Month-loading assertion after a transient API 503. With a longer loading wait, the focused `pnpm exec playwright test tests/e2e/calendar-expansion.spec.ts tests/e2e/admin.spec.ts --project=desktop` rerun passed **2/2**. Thus every one of the 21 browser scenarios passed across the aggregate and focused runs; the aggregate command itself was not rerun after this test-only adjustment.
- Earlier browser verification exposed pre-hydration Admin-menu clicks and a Calendar resize starting before its successful retry settled. Tests now wait for loaded/saved state. A separate synthetic concurrency check passed 50 authenticated week reads in five batches of ten. Desktop/phone/tablet Admin screenshots were reviewed and WCAG checks passed. No personal-record access or role mutation was added to resolve testing issues.
- The interactive `pnpm admin:create` command was verified with hidden/confirmed password input against a synthetic test account; its Admin type and scrypt credential were checked, and the account was removed. Frozen offline dependency verification passed using the existing pnpm store; final `git diff --check`, lint and formatting checks passed. Admin setup for the owner remains manual: use a new email with `pnpm admin:create`, sign in normally, then Account menu → Admin. Physical-device Safari and production provisioning remain outside this pass.

## Admin account deletion, complete

- The owner authorized Admin deletion of regular User accounts. Admin → Users now offers Delete account with exact email confirmation, a permanent-data warning and cancellation. Admin accounts, including the acting Admin, remain protected. Escape cannot dismiss a pending or uncertain command and discard its retry handle.
- A thin DELETE route uses shared input contracts, the canonical Identity Admin service and repository. Authorization, target locking, revision and email validation precede deletion. Existing foreign keys cascade private records, credentials and sessions. The immutable audit retains actor/target IDs and a deletion action. Deletion, audit and the acting Admin's idempotency receipt commit together; identical retries work after the target is gone. Audit failure rolls back deletion and cascades.
- Migration `0011_faithful_leper_queen.sql` adds the deletion audit action. Local development and isolated test migrations succeeded; generation reports no further schema changes. There are 24 application tables and twelve tracked migrations. No development accounts were deleted; all deletion verification used disposable synthetic test accounts.
- Verification: strict workspace typechecks, zero-warning lint/import boundaries, **43 unit tests, six architecture tests and all 70 PostgreSQL integration tests passed**. API production build passed; web production build passed using `pnpm --filter @168hours/web exec next build --webpack`. Default Turbopack builds failed because CSS worker processing could not bind a local socket in this environment, including an escalation attempt. No build configuration was changed.
- Admin browser flows passed on desktop, phone and tablet, including cancellation, incorrect/correct email confirmation, dropped committed DELETE responses, identical-key retries and retained audit history. WCAG checks passed, and the phone confirmation screenshot was reviewed. The final browser run passed all three flows with Escape/retry coverage.
- Initial checks caught an accidental extra route argument and a response-union type inference error; both were corrected. Expanded fixtures exceeded the ordinary login rate limit: deletion integration fixtures now use a separate test application, and browser tests omit duplicated login-failure checks retained in integration coverage. Production rate limits were preserved. A synthetic audit error now uses the established unavailable-error SQLSTATE. No commit, push, deployment or production data changes were made.

## Password visibility, complete

- Added an eye button to password fields on login and signup. Passwords start hidden; Show password / Hide password labels and keyboard operation are accessible. The 44px control uses the existing semantic palette, retains input/autocomplete and never submits the form.
- Zero-warning lint/import boundaries and web typecheck passed. Ad hoc Chromium checks passed login/signup at 1280px and 390px: initial masking, keyboard reveal, hiding, preserved value, no form submission, no horizontal overflow and WCAG A/AA checks. Broad axe inspection also reported existing authentication-page landmark best-practice findings (`landmark-one-main`, `region`); these are outside this password-control change. No permanent tests, dependencies, authentication API or database changes were added.

## Database status

Admin adds one table and migrations 0010–0011. The tracked schema now has 24 application tables and twelve migrations; local migration and test migration application succeeded. Final `pnpm db:generate` reported no changes. Earlier Exercise inspection found 23 tables and ten migrations with zero invalid constraints/indexes and the expected restricted runtime CRUD permissions.

- Development and test now have migrations 0000–0011 applied. Food adds `0009_exotic_the_hunter.sql`, an index on food-entry history's `(user_id, created_at, id)` columns.
- Development inspection: 23 application tables, ten migrations, zero invalid constraints and zero invalid indexes. The Food history index is present; runtime `hours_app` has required CRUD permissions and cannot create schema objects. Calendar's prior inspection verified its 23 integrity triggers and runtime grants.
- `pnpm db:migrate` succeeded. Final `pnpm db:generate` reported **no schema changes**. Test migrations from an empty schema were also verified during the preceding Calendar pass.
- Verification found an account-deletion cascade conflict in new parent-revision triggers. Migration 0008 fixes it; a PostgreSQL regression now deletes an account containing series/templates and checks that all owned rows disappear.
- Existing local API readiness on 3001 and web login on 3000 returned HTTP 200. No development-data reset was required for the Food pass.

## Checks actually run

Final Exercise `pnpm verify` passed in one aggregate run, including the DST correction:

- Zero-warning lint and persistence/domain import boundaries; formatting; strict workspace typechecks.
- **43 unit tests, six architecture tests and 63 real-PostgreSQL integration tests.**
- Both production builds and **18 browser flows** across desktop, phone and tablet Chromium.
- Browser coverage includes Calendar expansion, prior planning behavior, full Core workflows and known-ID cross-account isolation. Expansion checks include real touch move/resize, exact drag durations, cancellation, Month moves, reviewable range drafts, recurrence, copy/templates, search/filters, quick actions, and a dropped successful response retried with the same key.
- Automated WCAG checks passed. Final desktop/phone/tablet screenshots and the extra 320px layout screenshot were reviewed. Toolbar controls fit without horizontal page overflow.
- Food coverage includes literal search/pagination, restoration and snapshot reuse, fractional portions and unknowns, 23/25-hour daily boundaries, bounded weight reads and ownership. Browser tests cover create-while-logging, food/water/weight logging and corrections, food/weight deletion, lost successful food/water responses with same-key retries, retained stale drafts, unit conversion, date navigation, mobile section links and recoverable read failures. Prior Calendar/Core/isolation flows still pass.
- Exercise coverage includes child-ID validation/stable pagination, restoration, snapshots, filtered ownership, repeat/timed sets, generated-finish retries, stale drafts, explicit past-time corrections, unit conversion, timestamp precision/repeated DST hours, short cardio, recovery and source-time deletion. Exercise desktop/phone/tablet and 320px screenshots were reviewed. A broader run caught a pre-hydration Goals click after a hard reload; the existing Core test now waits for client-loaded records before interacting.

Also ran frozen offline dependency verification using the existing pnpm store (already up to date), focused type/lint/integration/browser checks, `pnpm db:migrate`, `pnpm db:generate`, database health/permission queries and `git diff --check`. Food verification corrected fixture preference initialization, a dialog selector and measurement-history query compatibility. Earlier Calendar fixes for cascades, concurrency and drag/layout behavior remain covered. No manifests or lockfile changes.

Earlier foundation verification also exercised a clean source install/build, migrations against a fresh database, restricted-role provisioning, built-server production cookies/readiness and graceful shutdown. The current integration suite retains startup/failure/shutdown, auth, ownership, transaction and source-history regressions. Local verification used Node 26.0.0. Detailed procedures: [verification](verification.md).

## Deliberate limits and local commands

- Recurrence requires an end within 366 local dates and supports daily/weekly rules. Missing clock times are skipped; repeated clock times use the first occurrence. Clock-change Day views retain exact ordered times and form editing.
- Copy/template operations include at most 100 plans starting in the source day/week. They copy independent plans, not actual entries or recurrence rules. Revise template contents by editing a calendar day/week and capturing a new template.
- Physical-device Safari remains unverified. Workouts require explicit saves. New ambiguous/missing local times are rejected; unchanged saved Exercise instants are preserved. Retry state lasts for the current form/action; durable receipts remain until account deletion/reset.
- Food remains manual: no recipes, barcode/provider lookup or custom targets. Weight charts show up to 200 points across 30 days; full history remains paginated.
- Rate limits are process-local; proxy trust is empty by default. Public deployment, recovery/verification email delivery and further feature-slice passes remain separate work. No commit or deployment was performed.

Fresh local setup, with Node 22.12+, pnpm 9.15.9 and Docker Compose:

```bash
pnpm install --frozen-lockfile
pnpm setup:env
pnpm db:up
pnpm db:migrate
pnpm db:provision
pnpm dev
```

For this configured checkout: `pnpm db:up`, `pnpm db:migrate`, then `pnpm dev`. Open http://localhost:3000. To verify, install Chromium once with `pnpm exec playwright install chromium`, then run `pnpm verify`. Ports and configuration details are in [README](../README.md).
