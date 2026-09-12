# Core implementation

- C0–C6 complete: workspace, strict configuration, PostgreSQL/Drizzle, auth/isolation, responsive shell, planner, goals/dashboard, food, hydration/weight, strength/cardio, and Core hardening.
- Core completion gate passed. Development stops here for owner review. No post-Core features or scaffolds were added.

Decisions: see `decisions/001-foundation.md` and `002-time-and-history.md`. Exact semantic palette; system fonts; local same-origin proxy; canonical backend calculations. Food snapshots and unknown values are preserved. Exercise/source time updates are atomic and deduplicated. Workout stale saves are rejected when the web sends its last-seen timestamp. No post-Core scaffolds.

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
