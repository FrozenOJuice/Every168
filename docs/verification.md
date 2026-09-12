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

Browser coverage: full account → preferences → category → plan → actual → goal → food → strength → cardio → water → weight → dashboard/week → signout. Separate-browser account isolation uses known private IDs; same-browser account switching checks cookie privacy, logout replay and old-page navigation. Runs at desktop, iPhone-sized, and tablet-sized viewports using Chromium. Automated WCAG checks supplement explicit label/keyboard/dialog and no-horizontal-overflow assertions. These are browser viewport tests, not a claim of physical-device Safari testing.

Foundation failure coverage and operational settings are detailed in [foundation.md](foundation.md). Final run results and the original Core clean-source-copy evidence are recorded in `IMPLEMENTATION.md`.

## Manual review flows

1. Create an account and choose your timezone/units. Open Week, create two overlapping blocks, and confirm allocated coverage counts the overlap once. Navigate previous/next weeks and reload the URL. Edit/delete a block; record actual time and compare category totals.
2. Create, edit, complete and reopen a goal; link it and a category to a block. Archive a category and confirm historical records still render.
3. Create a food with calories and some blank nutrients. Log multiple servings. Edit its definition and confirm the old entry/totals keep their snapshots. Edit/remove/repeat entries, change log dates and archive the definition.
4. Start a workout with multiple exercises. Add, reorder, edit and remove sets; include a timed set. Save, navigate away, reopen and finish. Edit history and inspect exercise progress. Repeat a save and confirm the week's source time appears once. Record cardio both with distance and with only duration.
5. Log water from quick buttons and a custom amount. Log weight in both preferred units. Inspect/edit/delete histories and the weight chart; missing dates remain unmeasured.
6. Use keyboard Tab/Shift+Tab/Enter/Escape for navigation and dialogs. Repeat the logging flows at a narrow browser width. Check labels, validation, busy states and retained input after a recoverable API failure.
7. Sign into a second account. Lists/dashboard must be empty, and known IDs from the first account must return 404 for reads/mutations. Sign out and confirm protected routes redirect to sign in.

A public deployment, email delivery, device-native testing and backup operations are not part of this local Core verification.

Integrity browser checks deliberately lose successful water/weight responses before retrying, verify that only one record exists, and simulate a competing planner edit while a form is open. All three viewport projects run these checks as part of the Core flow.
