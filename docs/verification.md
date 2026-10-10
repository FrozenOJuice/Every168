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

1. Create an account and choose your timezone/units. Open Calendar and create several overlapping/short blocks; confirm the grid stays usable and extra records open from the day header. Check Month previews and its day list on a phone. Drag an empty range in either direction and confirm the block grows in five-minute steps before release; Escape cancels without saving. Release to review the exact range in the compact editor beside the block. Confirm the draft stays visible, title/time edits update it, and outside click or Escape discards it. Pending/uncertain saves must retain the editor and retry key. Create at a five-minute interval, move Start across midnight, change duration and save. Duplicate a plan with linked actual time and verify only the plan is copied. Navigate Day/Week/Month using previous/date/next and Today, jump through the date heading, and check the current-time marker and remembered scrolling. Edit/delete a block and record actual time. Canonical category/coverage totals remain covered in API integration tests.
2. Create, edit, complete and reopen a goal in Goals. Manage categories in Settings. Confirm Calendar forms/search omit Category and Goal, while notes and plan editing remain usable. Existing stored reference integrity is covered through API fixtures.
3. Create a food with calories and some blank nutrients. Log multiple servings. Edit its definition and confirm the old entry/totals keep their snapshots. Edit/remove/repeat entries, change log dates and archive the definition.
   In Food, use a meal's Add action to create a missing food and return to logging. Restore an archived food, repeat an entry from another day, and confirm a corrected entry reveals its saved date. Log/edit/delete water and weight, review histories, and change the selected date to verify the latest weight and chart exclude later records.
4. Start a workout with multiple exercises. Add, reorder, edit and remove sets; include a timed set. Save, navigate away, reopen and finish. Edit history and inspect exercise progress. Repeat a save and confirm the week's source time appears once. Record cardio both with distance and with only duration.
5. From Calendar tools, open quick actions for a selected date. Log water or weight and verify that date is prefilled. Check Food, Cardio and Strength form dates; activity is created only after explicit submission.
6. Use keyboard Tab/Shift+Tab/Enter/Escape for navigation and dialogs. Repeat the logging flows at a narrow browser width. Check labels, validation, busy states and retained input after a recoverable API failure.
7. Sign into a second account. Lists/Calendar must be empty, and known IDs from the first account must return 404 for reads/mutations. Sign out and confirm protected routes redirect to sign in.

A public deployment, email delivery, device-native testing and backup operations are not part of this local Core verification.

Food slice tests cover literal food/snapshot search, cursor pagination, restoration/replay and ownership, fractional meal/entry totals, 23/25-hour daily bounds, backdated weight ordering, bounded chart reads and full history. Browser flows exercise the complete Food/water/weight day, definition snapshots, create-while-logging, stale edits, same-key retries after lost food and hydration responses, unit conversion, date navigation, recoverable reads, accessibility and 320px overflow.

Exercise tests cover stable child identity and pagination through corrections/reordering, duplicate/foreign set IDs, archive/restore revisions and snapshots, literal history filters and account isolation. Browser flows cover creating exercises within a workout draft, repeat/timed sets, explicit completion/correction, a lost successful generated-finish response, stale drafts, progress, restoration, unit conversion, preserved timestamp seconds/repeated DST hours, short cardio without distance, source-time deduplication/deletion, recoverable reads and desktop/phone/tablet/320px layouts.

Integrity browser checks deliberately lose a successful time-block creation response before retrying, verify that only one block exists, and simulate a competing planner edit while a form is open. All three viewport projects run these checks as part of the Core flow.

Calendar browser coverage includes Day/Week/Month order, arrows surrounding the date title, absent Calendar details, and weekly defaults on every viewport; responsive month previews/day lists; URL/reload state; overnight continuation and clock-change labels; linked activity navigation; five-minute creation and live draft geometry, duration changes and rescheduling; duplicate drafts, lost-response retries and unchanged original/actual records; deletion; date jumping, current time and scroll restoration; failed-month recovery; retained validation errors; and keyboard editing/focus restoration. Automated WCAG checks and screenshots cover views, lists and the planning form. Unit tests cover month-end/leap-year navigation, preferred week starts, spillover rows, clipping, bounded overlap lanes, target sizes, snapping and DST-safe draft durations. Local verification is retained; no CI workflow is configured.

Calendar expansion coverage adds recurrence/exception revisions, deleted-occurrence exclusions, DST materialization, stale copy previews, normalized templates, atomic scheduling and rollback, literal history search and pagination, owner isolation and concurrent series/occurrence edits. Browser flows cover the six additions at desktop/phone/tablet sizes, real Chromium touch events for movement/resizing, lost successful adjustment responses with same-key retries, and contrast/viewport checks. Drag selection and recurrence arithmetic have focused pure tests. Test fixtures use the public API and normal security limits.

## Admin verification

`apps/api/tests/admin.integration.test.ts` covers authorization, forbidden role assignment/type changes, private-record isolation even for admins, literal search/pagination, real counts/health, suspension/login/session invalidation, reactivation, revocation, revisions, retries, audit immutability and rollback on audit failure. `tests/e2e/admin.spec.ts` exercises Overview/Users/Audit, confirmation cancellation, lost-response retry with the same key, suspension/reactivation/revocation, regular-user API denial, WCAG checks and responsive screenshots across all three Chromium projects. Test-only operator fixtures use the isolated `_test` database and remove their own accounts; immutable audit identifiers remain until the ephemeral database is discarded.

Manual check: run `pnpm admin:create` after migrations; sign in with the new account, open Account menu → Admin, search a synthetic regular user, suspend and reactivate it, and revoke its sessions. Check statistics and audit history. Public signup must show no role/type choice. The operator command should reject an existing email without modifying the original account.

Admin deletion coverage uses synthetic accounts only: exact email confirmation, cancellation, Admin/self protection, stale revisions, authentication/authorization, private-record cascades (including recurrence/templates and workout children/source time), isolation, audit retention, audit-failure rollback and identical retries after deletion. Browser flows exercise typed confirmation and a dropped successful DELETE response on desktop/phone/tablet.

Calendar activity verification covers occurrence-time placement, timezone/DST and half-open boundaries, ownership, source snapshots, edits moving between dates, deletion, bounded projections and a synthetic arbitrary-domain provider. Browser coverage checks Earlier/Now/Coming up, same-hour moment grouping, exercise session deduplication, selected-time recording, a dropped committed log response with same-key retry and locked composer dismissal, optional plan details, simple plan creation, Week/Month access, responsive layouts and WCAG. Existing Calendar/Core workflows expand More details when they need optional plan fields.

Calendar tab verification also covers toolbar creation, existing-block editing, duplicate drafts, date-only/repeating plans and source-time review without a modal backdrop. Check compact height, collapsed optional fields/actions, touch targets, linked records, stale edits and uncertain-write retries.

Block control coverage checks single-click selection without an editor, primary selection color, double-click and keyboard editing, day/time-snapped preview geometry and stable placement within a time slot, stationary source ghosts, save-on-release, and cleanup on cancellation. Touch move/resize and same-key adjustment retries remain covered.

Live resize checks inspect height before releasing the pointer, start-edge position, unchanged persisted revision, and restored size after Escape. Real touch events cover five-minute resize feedback.

Selected-block shortcut coverage checks Delete/Backspace without alerts, normal Backspace text editing, dropped committed DELETE responses, matching retry keys and suppression while uncertain. Cmd+Z/Ctrl+Z restores the original block, including retrying a lost successful undo response. The dedicated Calendar history browser flow creates, renames, adjusts and deletes one block, then undoes all four actions using shortcuts with no visible undo bar or button, including a lost successful edit-undo response and an external-change conflict. Unit checks cover revision advancement, independent blocks and external revision gaps. Planning undo integration checks cover ownership, original identity/details, manual/Cardio/Strength links, repeated edits/deletions, exact recurrence exception flags, independent occurrences, changed recurrence definitions, consumed receipts, retries and atomic conflicts after subsequent edits.

Toolbar Add coverage checks an unsaved draft in Day, Week and Month, live title/time/size updates, matching-date Month containment, removal on Record/cancel and no plan written on cancellation. Calendar creation checks also cover clock-change-day drafts with timezone labels.

Calendar placement coverage checks that a single click selects a five-minute slot without creating a plan, double-click opens its draft, and Add uses the selected time and day (including another day in Week). Escape and date/view changes clear selection. With no selection, creation uses the current account-local hour on the requested date in Day, Week, Month and clock-change views. Unit checks cover account timezones and overnight end dates.

Month interaction checks cover no per-day creation buttons, day selection without opening anything, selected-date toolbar creation, double-click/Enter creation, Space selection and cancellation. Tall Month previews verify a long title is visually truncated on one line, with its start time to the right; overflow navigation to Day, date dragging and responsive accessibility remain covered.

Dense Month coverage seeds days with four and five events. A tall desktop viewport checks four visible rows without overflow versus three rows plus “+2 more”; ordinary viewports check adaptive preview counts and overflow navigation to Day with all five records. Desktop, phone and tablet check no Month or document scrolling, all seven columns and the first/last days fully visible, including six-week months at 480px viewport height. Narrow cells use counts. Date placement, thin event rows, title truncation, selection, creation, source editing, date dragging and automated accessibility checks remain covered.

Calendar chrome checks assert the legend/timezone caption is absent and routine update/delete/undo feedback is screen-reader-only. Existing creation, deletion, repeated undo, external-change protection and same-key retry flows remain covered; failures/retry controls stay visible.

Creation consistency coverage expands More details and Other plans from Day grid, Week selected-time and Month creation, checking notes, absent Category/Goal selectors and all three plan types. Switching a Week draft to an all-day plan retains its chosen date and removes the timed preview. Desktop drag-release coverage retains Other plans access alongside exact range, live title preview and safe retry checks.

Outside-click cancellation coverage checks that clicking an empty time slot or Month day dismisses the new-plan tab and draft without selecting the underlying target, and that a separate subsequent click still selects normally. Drag-release creation must keep its editor open; pending/uncertain saves remain protected.

Calendar category/goal separation checks cover absent selectors across timed/date-only/repeating forms, absent category search controls and create-goal quick actions, notes and duplication. Core fixtures attach existing category/goal references through the public API and verify Calendar note edits retain those references after goal completion. Goals and category management remain independently covered in their own surfaces.

Toolbar/sidebar layout checks cover Today and mirrored Add/tools/search actions on the left, centered Day/Week/Month, previous/date/next order, wide Day date-area alignment with the activity sidebar, no Your day heading or duplicate Day grid header, and retained Week headings. Existing date navigation, jumping, Month fit, responsive controls, accessibility and drag/create/resize flows remain covered.

Date dropdown checks cover the title button's minimum width and narrow-screen limit, fixed arrow positions across Month/Week/Day, the same date-title font size and vertical alignment in all three views, full Month/Week month-year and Day month-day-year, the Day weekday label in the activity sidebar with the empty-state message beneath it, no title chevron, continuous selected-week fill and outlined hover without gray fill for unselected Day, Week and Month options, week-row navigation, month selection, mini-calendar navigation/selection, Escape focus return and nonmodal accessibility.
The Day, Week and Month dropdowns omit a close X; verify selection, outside click and Escape dismissal.
Month picker checks verify that all twelve months form a three-column, four-row grid with buttons at least 48px tall, the last row is visible on phone and at 320px, and month selection still navigates.
Date dropdown alignment checks compare each popup's center with its title button in Day, Week and Month and verify viewport containment and legible month labels at 320px.
View-switch checks select a Month day and open its Week and Day, select a five-minute Week slot and open its Day, verify the viewed-date fallback without a selection, and confirm the selection clears after navigation.
Day/Week density checks verify 60px hour rows, five-minute selection and live drag/resize geometry, preserved scroll positions, and readable blocks across desktop, phone and tablet.
