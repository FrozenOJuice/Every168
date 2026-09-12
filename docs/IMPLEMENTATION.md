# Core implementation

- C0–C6 complete: workspace, strict configuration, PostgreSQL/Drizzle, auth/isolation, responsive shell, planner, goals/dashboard, food, hydration/weight, strength/cardio, and Core hardening.
- Core completion gate passed. Owner subsequently authorized foundation, authentication/authorization and data integrity hardening; those passes are complete. No post-Core features or scaffolds were added.

Decisions: see `decisions/001-foundation.md` and `002-time-and-history.md`. Exact semantic palette; system fonts; local same-origin proxy; canonical backend calculations. Food snapshots and unknown values are preserved. Exercise/source time updates are atomic and deduplicated. All Core edits/deletes require a last-seen integer revision; durable request receipts make retries safe. No post-Core scaffolds.

Checks actually run and passed:

- Final `pnpm verify`: lint with zero warnings and import-boundary checks, formatting, workspace typechecks, 8 unit tests, 12 real-PostgreSQL integration tests, both production builds, and all 6 browser tests.
- Browser flows and known-ID cross-account isolation on desktop, phone and tablet Chromium viewports. Dashboard and weight-dialog automated WCAG checks reported no violations. Responsive screenshots reviewed.
- `pnpm db:up`, `pnpm db:migrate`, and `pnpm db:generate`: healthy separate development/test databases; migrations 0000–0005 applied (18 tables); no remaining schema changes. Synthetic `pnpm db:seed` succeeded; repeating it left the demo account unchanged.
- Clean source copy: `pnpm install --frozen-lockfile --offline`, `pnpm setup:env`, migrations and all 12 integration tests against a fresh `hours_clean_test` database, and `pnpm build` passed. Environment setup also preserved existing files correctly.
- Built Express artifact: readiness, signup, session lookup and graceful shutdown passed against the isolated database.
- Final architecture/security review covered domain boundaries, owner-scoped access and references, cookie/origin controls, error/log redaction, body limits, immutable history, transactional source-time deduplication, stale workout saves, secrets/ignored files, and dead-code cleanup. No known critical data-loss, authorization or time-accounting defect remains.

Notable verification fixes: auth UUID defaults, shared-source bundling, blank optional numbers becoming zero, strict edit-form inputs, malformed/oversized request errors, unsaved workout navigation, readable form validation, and preserving completed-goal links while editing a block. The final verification includes these fixes.

Remaining Core work: none. Blockers: none. Local verification used Node 26.0.0; CI targets Node 24 and is configured but has not run remotely. Browser coverage uses Chromium viewports, not physical-device Safari. Workouts require explicit saves; ambiguous/nonexistent local DST inputs are rejected clearly. ESLint 9.39.5 is pinned for current Next.js plugin compatibility despite upstream deprecation. Account-recovery email and public deployment are outside Core. No commits or deployment were made.

Setup/run commands and optional demo credentials are in `../README.md`; detailed architecture and manual review flows are in `architecture.md` and `verification.md`.

## Phase 1: backend foundation (complete)

Implemented startup database/schema/role checks before listening; bounded HTTP and database waits; idempotent shutdown, keep-alive draining and fatal-error handling; safe structured diagnostics for requests, disconnects and connection failures; consistent auth 404/429/400/413 handling including chunked bodies; general API rate limiting with explicit proxy trust; separate local runtime/migration credentials; and enforced persistence boundaries using opaque transaction scopes. Operational settings and decisions are in `foundation.md`.

Checks actually run and passed:

- Final `pnpm verify`: zero-warning lint and AST import checks, formatting, workspace types, 11 unit tests, 6 architecture-boundary tests, 29 PostgreSQL integration tests, both production builds, and all 6 desktop/phone/tablet browser tests.
- `pnpm db:migrate`, `pnpm db:provision` (including repeat runs), and `pnpm db:generate`: six existing migrations applied, 18 tables, no schema drift or new migration needed. Local API confirmed connected as `hours_app`; CRUD is allowed and public schema CREATE is denied. No invalid indexes found.
- Built `dist/server.js` in production mode with a temporary restricted login and synthetic account in the test database: readiness, signup, Secure/HttpOnly cookie, session lookup and SIGTERM exit 0 passed. Temporary account/role removed.
- Failure tests cover unavailable/stalled database startup, port conflicts, in-flight and forced shutdown, client disconnects, pool/statement/lock/idle-transaction deadlines, transaction rollback/expired scopes, restricted-role DDL denial, header spoofing, retry guidance, error redaction and invalid/oversized bodies.

Verification caught and fixed a keep-alive drain delay, unchecked error events on checked-out database clients after idle-transaction termination, and oversized chunked auth bodies incorrectly returning 500. Final verification includes all three fixes.

Remaining phase 1 work/blockers: none. Auth/session/security audit remains phase 2; backup/restore and deployment exercises remain phase 3. Limiters use process memory and reset on restart. Proxy trust is empty by default, so local Next.js traffic shares a loopback bucket; a public deployment must configure and verify its trusted edge. No public deployment, remote CI run or commit was performed. The local app remains running with the updated runtime role.

## Phase 2: authentication and authorization (complete)

Fixed dropped renewal cookies, non-atomic signup and logout swallowing database revocation failures. Added explicit Core auth endpoint/method allowlisting, shared strict inputs, exact-origin/Fetch Metadata checks, private response DTOs and no-store headers. Password storage now uses versioned asynchronous scrypt (N=65536, r=8, p=2), timing-safe verification and successful-login upgrades of existing hashes. All auth attempts are rate-limited in Express before validation/database work. Existing accounts, layering and the Core UI remain compatible. Policy and tradeoffs are in `security.md`.

Checks actually run and passed:

- Final `pnpm verify`: zero-warning lint and architecture checks, formatting, workspace types, 14 unit tests, 6 import-boundary tests, 42 PostgreSQL integration tests, both production builds, and all 6 desktop/phone/tablet browser tests.
- New regressions cover credential/session insertion rollback, legacy password upgrades, cookie renewal with SSR reads, invalid/expired/revoked sessions, secret rotation, production cookie attributes, logout database failures, strict auth inputs/origins, all registered domain session guards, ownership mass assignment, private lists/summaries and foreign nested workout IDs. Browser tests cover same-browser account switching, cookie privacy, logout replay and navigation back to the previous account's page.
- `pnpm db:migrate` and `pnpm db:generate`: migrations 0000–0005 remain current, 18 tables, no schema drift or new migration. No bulk credential rewrite or user-data reset.
- `pnpm audit --prod --json` initially found one moderate esbuild advisory through Drizzle Kit. A targeted override to 0.25.12 removes it; install, migration generation and builds passed. Final production audit: zero advisories.
- `git diff --check` passed. Running local API readiness and web login returned success on 3001/3000.

Verification exposed intermittent test requests reaching the wrong listener. A local probe reproduced macOS permitting default/IPv4 listeners on the same port; Supertest always connects to IPv4. Fixtures now bind explicitly to 127.0.0.1 and reuse their server. The final suite passed with this fix. Browser isolation contexts now inherit each project's actual viewport/device settings.

Remaining phase 2 work/blockers: none within the authorized Core scope. Sessions retain the documented seven-day sliding policy without an absolute lifetime cap; rate limits remain process-local. Public verification/recovery delivery, signup enumeration policy and deployment controls remain separate release work, as specified in `security.md`. No commit, public deployment or post-Core feature expansion was performed.

## Clean slate (complete)

Owner instruction: development/test application data is disposable; prefer resets over legacy compatibility or preservation helpers. Recorded in `AGENTS.md`. Removed legacy password verification, automatic upgrades, their repository/service methods and upgrade-specific tests. This supersedes the phase 2 account-compatibility decision above.

Checks actually run: `pnpm verify` passed lint, formatting, workspace types, 14 unit tests, 6 boundary tests, 41 PostgreSQL integration tests, both builds and all 6 browser tests. Ran one-off transactional `TRUNCATE ... RESTART IDENTITY` through Docker Compose/psql on `hours_dev`, `hours_test` and `hours_clean_test`; verified all 18 application tables in each database empty. The main test database was cleared after browser verification. Schemas, six applied migrations per database and runtime permissions remain ready for new accounts. API readiness passed; development users/sessions both zero. No backup, reseed or reusable preservation/reset helper was added. Remaining work/blockers: none.

## Data integrity hardening (complete)

Implemented database bounds/status/type/source checks, immutable ownership/food snapshots, composite activity-plan ownership, unique child positions and database-managed revisions. All domain writes require an idempotency key; edits/archives/deletes also require the last-seen revision. Effects and replay receipts commit in one opaque transaction across services. Added consistent workout/planner reads, definition/reference locks, safe browser retry controls and retained stale drafts. Details and deliberate limits: [decision 003](decisions/003-write-integrity.md).

Checks actually run:

- `pnpm verify` passed lint/import boundaries, formatting, workspace types, 18 unit tests, 6 architecture tests, 51 PostgreSQL integration tests, both production builds and all 6 desktop/phone/tablet browser tests, including dropped successful responses and competing planner edits.
- `pnpm db:migrate`: migration 0006 applied in development/test; all seven migrations applied from scratch in the recreated disposable `hours_clean_test`. All 10 integrity tests passed against that fresh database. `pnpm db:generate` found no schema drift.
- Database inspection: 19 tables, seven migrations, 15 enabled integrity triggers, zero invalid constraints/indexes; restricted runtime receipt permissions and local API readiness passed.
- `pnpm db:seed` succeeded using the restricted development role; its synthetic demo user was removed afterward. Development users returned to zero. After the final verification, cleared synthetic test data and verified all 19 application tables empty in both test databases, retaining seven migrations. `git diff --check` passed.

Verification corrected fixtures using obsolete revisions, a race-test helper that missed indirect lock waiters, a browser selector that matched Next.js's route announcer, and request-key case normalization. No data migration/backfill helpers, dependencies or post-Core features were added.

Remaining scoped integrity work/blockers: none. Receipts grow until account deletion/reset; client retry handles last for the current form/action, so review history after leaving an uncertain save. Direct maintenance SQL must respect service-owned activity/source lifecycle rules. These limits are documented in decision 003. No commit or deployment.
