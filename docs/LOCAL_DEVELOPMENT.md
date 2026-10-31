# Every168 local development

The public-facing product name is Every168. Clone `FrozenOJuice/Every168` into `Every168`. Existing local checkout folders may keep their name; `@168hours/*` package filters, `hours_*` database roles/volumes and recovery keys remain technical identifiers, not alternate product names. No domain or sender address is implied by the rebrand. See [brand identity and compatibility](BRAND.md).

Current presentation scope: Calendar and Fitness. Public deployment is deferred. Use synthetic accounts and never point tests or capture tooling at personal or production data.

## Requirements and installation

Use Node.js 22.12+ and the pinned pnpm 9.15.9. Verification recorded in the remediation report used Node 26.0.0; repeat the checks on your chosen runtime. Docker Compose supplies PostgreSQL 18. Normal application ports are 3000/3001; PostgreSQL uses loopback ports 54320/54321. Browser tests/captures need free ports 3100/3101.

```bash
pnpm install --frozen-lockfile
pnpm setup:env
pnpm db:up
pnpm db:migrate
pnpm db:provision
```

`setup:env` creates missing `apps/api/.env` and `apps/web/.env.local` files, generates a random auth secret, and preserves existing files. Both files are ignored by Git; `.env.example` files are safe templates. Keep web/auth origins identical and browse using `http://localhost:3000`, not a mixture of localhost and 127.0.0.1.

`db:up` starts separate development and test services. Development data uses the `hours_pg` volume; test storage is ephemeral. `db:provision` is an explicit local operator command: it preserves records, creates the restricted runtime role, updates the local API environment and retains a separate migration connection. Later migrations refresh runtime grants. Restart the API after changing its environment.

## Normal development and account email

Email verification is temporarily not required when the API runs with `NODE_ENV=development`. Existing unverified accounts can sign in without changing their stored verification status. Signup still requires a separate sign-in, and normal password/session/suspension protections remain active. Test and production require verified email.

To exercise real verification or password-reset delivery, set `EMAIL_API_KEY` and a plain verified `EMAIL_FROM` address in `apps/api/.env` for Resend. The sender must be configured with the provider; messages display Every168 while retaining that configured address. No provider account or credentials are supplied by this repository. Email links use `WEB_ORIGIN`, so localhost links work for a local developer receiving their own verification email.

```bash
pnpm dev
```

Create an account, then sign in. No verification email is needed in development. Settings controls timezone, week start, units and categories. Password reset and authenticated password change use the same account-security implementation as the rest of the app. Without delivery configuration, the ordinary server cannot deliver verification/reset mail; generic success responses intentionally do not disclose delivery or account existence.

The browser calls `/api/*`; Next.js forwards requests to the independent Express API at `http://127.0.0.1:3001`. Check process liveness at `/api/health` and database readiness at `/api/ready` through the web origin. There is no automatic migration or seeding on ordinary API startup.

## Provider-free showcase

For reviewers or screenshot/video capture, reuse the isolated browser-test environment:

```bash
pnpm db:up
pnpm exec playwright install chromium
pnpm portfolio:capture
```

The capture config enforces a separate local database whose name ends in `_test`. It starts the existing test API on 3101 and Next.js on 3100 in core scope, creates a unique synthetic account, exercises real email verification with in-memory delivery, then populates Calendar/Fitness through the real API. No external email is sent. It writes genuine PNG captures to `docs/media/screenshots`; these files are intentionally versionable.

For an interactive session or recording:

```bash
PORTFOLIO_PAUSE=1 pnpm portfolio:capture --headed
```

After the gallery is captured, the synthetic clock resumes advancing and the populated authenticated browser stays open at Playwright's pause. Navigate normally; use Resume in the inspector to finish and stop its servers. The test API includes fixture-only registration/mail endpoints and must remain local. These endpoints are not part of the normal API application. Synthetic records remain in the ephemeral test database until its container stops; the development database is untouched.

Screenshots use a fixed October 2026 fixture date, account timezone America/Edmonton, the actual light theme and consistent desktop viewport. This fixed date is presentation/test data, not a claim about a real person's activity. See [capture provenance](media/README.md).

The older `db:seed` command is retained but predates the current workout showcase. Its `demo@example.com` account is not email-verified; it can sign in under the temporary development policy but not under test/production verification requirements. Prefer the isolated showcase for the complete synthetic portfolio dataset.

To regenerate the checked-in SVG/ICO/Apple icons after an intentional mark change, run `pnpm brand:assets` (requires the installed Chromium above). The canonical source is `apps/web/public/brand/mark.svg`; review the separate wordmark alongside it. This command changes assets only and never queries application data.

## Commands

| Command                         | Purpose                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev:api` / `pnpm dev:web` | Run one application independently                                                  |
| `pnpm db:down`                  | Stop both containers; retain development volume, discard ephemeral test data       |
| `pnpm db:migrate`               | Apply checked-in SQL migrations with the migration connection                      |
| `pnpm db:generate`              | Generate a migration for an intentional schema change; not needed to run the app   |
| `pnpm admin:create`             | Interactively create a new fixed Admin account in a local dev/test database        |
| `pnpm lint`                     | ESLint and domain/persistence import boundaries                                    |
| `pnpm format:check`             | Check formatting without modifying files                                           |
| `pnpm typecheck`                | Strict workspace TypeScript and Next route types                                   |
| `pnpm test`                     | Unit tests and architecture boundary regressions                                   |
| `pnpm test:integration`         | Real PostgreSQL integration tests, including retained preview modules              |
| `pnpm test:e2e:beta`            | Focused core Calendar/Fitness browser gate                                         |
| `pnpm test:e2e:release`         | Smaller core feature-boundary browser check                                        |
| `pnpm test:e2e`                 | Full retained-feature browser suite in preview scope                               |
| `pnpm portfolio:capture`        | Recreate the genuine synthetic-data screenshot gallery                             |
| `pnpm build`                    | Build API and web for local production-mode execution                              |
| `pnpm verify:beta`              | Ordered core lint/format/types/unit/integration/audit/build/browser gate           |
| `pnpm verify`                   | Older full preview verification command; includes the broad retained-feature suite |

On Linux, install browser system dependencies with `pnpm exec playwright install --with-deps chromium`. Do not overlap integration, browser or capture runs against the same test database. The isolated API validates `_test` naming and separation from `DATABASE_URL`; the portfolio config additionally requires a loopback host. Existing local-only Compose passwords are disposable examples, not credentials for any public service.

Keep `RELEASE_SCOPE=core` in both applications for this showcase. To inspect retained features, explicitly choose `preview` in both environment files and restart/rebuild both applications. This changes local feature visibility; it is not authorization to publish those features.

## Troubleshooting

- **Missing Next.js runtime method after dependency updates:** stop and restart the existing web dev server with `pnpm dev:web` (or restart `pnpm dev` if it owns both processes). A long-running process can retain an older Next.js runtime while compiling against newly installed packages, producing errors such as `routeModule.ensureInstrumentation is not a function`. Confirm the startup banner matches `apps/web/package.json`; a browser refresh alone does not reload server dependencies.
- **Could not connect to PostgreSQL:** run `pnpm db:up`, check Docker and ports 54320/54321. Do not reset a development volume to fix a connection problem.
- **Schema missing:** run `pnpm db:migrate` before ordinary API startup; do not use schema push in place of migration history.
- **Verification email does not arrive:** confirm the provider key/sender and origin, check spam, then request a fresh link after the cooldown. For a provider-free review, use the isolated showcase.
- **Browser server port already in use:** stop your previous test/capture run before starting another; do not reuse an unknown server against the wrong database/scope.
- **Preview links unavailable:** confirm matching build/runtime `RELEASE_SCOPE`; core deliberately returns unavailable/404 for deferred features.

For the built-web security smoke, follow [verification](verification.md). Its test-origin build is for local testing, not a deployment. The [earlier deployment runbook](PUBLIC_BETA_DEPLOYMENT.md) is preserved as deferred operational reference.
