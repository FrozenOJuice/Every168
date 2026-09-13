# Verification

## Automated commands

From the repository root, after following README setup:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
# Or run every check:
pnpm verify
```

`test:integration` and `test:e2e` apply migrations to a separate PostgreSQL test database, enforce its `_test` name, and create only synthetic users/data. Integration fixtures delete only their own users. The Compose test database uses ephemeral storage. Browser screenshots/traces go into ignored `test-results` and `playwright-report` folders. The integration/E2E suites require a running test database. No database reset or development-data truncation occurs.

Unit coverage: configuration failures, timezone/week starts and DST, interval clipping/union/overlap, unit round trips, meaningful cardio pace, nutrition aggregation with unknowns.

Integration coverage: live migrations/readiness; signup/signin/signout, invalid/expired sessions, preferences/origins/errors; planning, goals, snapshots, water/weight CRUD/pagination, nested workouts/progress/cardio; required revisions across every mutable Core resource; concurrent edit/delete rejection; durable request replay, receipt failure rollback, consistent aggregate reads and archive/link races; owner-scoped reads/updates/deletes and cross-owner references; dashboard composition.

Phase 2 adds password format/salt checks and rejection of legacy formats; signup rollback on credential/session insertion failures; signed-cookie production attributes, renewal headers, expiry, replay, secret rotation and database-failure logout; auth endpoint allowlisting, origin/content-type/input limits and safe response DTOs; every registered domain route's session guard; mass assignment across all create/update families; private lists/summaries and foreign nested workout IDs. Policy and scope are in [security.md](security.md).

Browser coverage: account → preferences → category → plan → actual → goal → food → strength → cardio → Calendar → signout. Selected-date quick actions expose the existing hydration/weight forms. Separate-browser account isolation uses known private IDs; same-browser account switching checks cookie privacy, logout replay and old-page navigation. Runs at desktop, iPhone-sized, and tablet-sized viewports using Chromium. Automated WCAG checks supplement explicit label/keyboard/dialog and no-horizontal-overflow assertions. These are browser viewport tests, not a claim of physical-device Safari testing.

Foundation failure coverage and operational settings are detailed in [foundation.md](foundation.md). Final run results and the original Core clean-source-copy evidence are recorded in `IMPLEMENTATION.md`.

## Manual review flows

1. Create an account and choose your timezone/units. Open Calendar and create several overlapping/short blocks; confirm the grid stays usable and extra records open from the day header. Check Month previews and its day list on a phone. Create at a quarter hour, move Start across midnight, change duration and save. Duplicate a plan with linked actual time and verify only the plan is copied. Navigate Day/Week/Month using Previous → Today → Next, jump through the date heading, and check the current-time marker and remembered scrolling. Edit/delete a block and record actual time. Canonical category/coverage totals remain covered in API integration tests.
2. Create, edit, complete and reopen a goal; link it and a category to a block. Archive a category and confirm historical records still render.
3. Create a food with calories and some blank nutrients. Log multiple servings. Edit its definition and confirm the old entry/totals keep their snapshots. Edit/remove/repeat entries, change log dates and archive the definition.
   In Food, use a meal's Add action to create a missing food and return to logging. Restore an archived food, repeat an entry from another day, and confirm a corrected entry reveals its saved date. Log/edit/delete water and weight, review histories, and change the selected date to verify the latest weight and chart exclude later records.
4. Start a workout with multiple exercises. Add, reorder, edit and remove sets; include a timed set. Save, navigate away, reopen and finish. Edit history and inspect exercise progress. Repeat a save and confirm the week's source time appears once. Record cardio both with distance and with only duration.
5. From Calendar tools, open quick actions for a selected date. Log water or weight and verify that date is prefilled. Check Food, Cardio, Strength and Goal form dates; activity is created only after explicit submission.
6. Use keyboard Tab/Shift+Tab/Enter/Escape for navigation and dialogs. Repeat the logging flows at a narrow browser width. Check labels, validation, busy states and retained input after a recoverable API failure.
7. Sign into a second account. Lists/Calendar must be empty, and known IDs from the first account must return 404 for reads/mutations. Sign out and confirm protected routes redirect to sign in.

A public deployment, email delivery, device-native testing and backup operations are not part of this local Core verification.

Food slice tests cover literal food/snapshot search, cursor pagination, restoration/replay and ownership, fractional meal/entry totals, 23/25-hour daily bounds, backdated weight ordering, bounded chart reads and full history. Browser flows exercise the complete Food/water/weight day, definition snapshots, create-while-logging, stale edits, same-key retries after lost food and hydration responses, unit conversion, date navigation, recoverable reads, accessibility and 320px overflow.

Exercise tests cover stable child identity and pagination through corrections/reordering, duplicate/foreign set IDs, archive/restore revisions and snapshots, literal history filters and account isolation. Browser flows cover creating exercises within a workout draft, repeat/timed sets, explicit completion/correction, a lost successful generated-finish response, stale drafts, progress, restoration, unit conversion, preserved timestamp seconds/repeated DST hours, short cardio without distance, source-time deduplication/deletion, recoverable reads and desktop/phone/tablet/320px layouts.

Integrity browser checks deliberately lose a successful time-block creation response before retrying, verify that only one block exists, and simulate a competing planner edit while a form is open. All three viewport projects run these checks as part of the Core flow.

Calendar browser coverage includes Day/Week/Month order, arrows surrounding Today, absent Calendar details, and weekly defaults on every viewport; responsive month previews/day lists; URL/reload state; overnight continuation and clock-change labels; linked activity navigation; quarter-hour creation, duration changes and rescheduling; duplicate drafts, lost-response retries and unchanged original/actual records; deletion; date jumping, current time and scroll restoration; failed-month recovery; retained validation errors; and keyboard editing/focus restoration. Automated WCAG checks and screenshots cover views, lists and the planning form. Unit tests cover month-end/leap-year navigation, preferred week starts, spillover rows, clipping, bounded overlap lanes, target sizes, snapping and DST-safe draft durations. Local verification is retained; no CI workflow is configured.

Calendar expansion coverage adds recurrence/exception revisions, deleted-occurrence exclusions, DST materialization, stale copy previews, normalized templates, atomic scheduling and rollback, literal history search and pagination, owner isolation and concurrent series/occurrence edits. Browser flows cover the six additions at desktop/phone/tablet sizes, real Chromium touch events for movement/resizing, lost successful adjustment responses with same-key retries, and contrast/viewport checks. Drag selection and recurrence arithmetic have focused pure tests. Test fixtures use the public API and normal security limits.
