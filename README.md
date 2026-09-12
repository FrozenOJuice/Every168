# 168Hours

A personal weekly planner and logbook. Plan the week, record selected actual time, and keep goals, food, exercise, water, and weight in one private account.

Core MVP only. No AI, integrations, native app, social features, or external food services.

## Run locally

Prerequisites: Node.js **22.12+** (Node 24 LTS recommended), **pnpm 9.15.9**, and Docker with Compose. Ports **3000**, **3001**, **54320**, and **54321** must be available. PostgreSQL ports bind to localhost.

```bash
pnpm install --frozen-lockfile
pnpm setup:env
pnpm db:up
pnpm db:migrate
pnpm db:provision
pnpm dev
```

Open **http://localhost:3000** and create an account. In Settings, select your timezone and units, then create your categories. Start planning from Week.

`setup:env` creates `apps/api/.env` with a random authentication secret and `apps/web/.env.local`. It keeps existing files unchanged. Example files document the configuration. Do not commit the generated files. Use the same configured browser origin (`http://localhost:3000` by default) for cookies and write requests.

`db:provision` creates the restricted local `hours_app` login and updates `apps/api/.env`, keeping the admin connection in `MIGRATION_DATABASE_URL`. It preserves existing data. Run it once after initial migrations (or when upgrading an existing local setup), then restart the API. Subsequent migrations use the admin connection and refresh runtime grants.

The browser calls `/api/*`; Next.js proxies it to the independent Express API at **http://127.0.0.1:3001**. Readiness is available through **http://localhost:3000/api/ready**. Development PostgreSQL is `hours_dev` on port 54320. Tests use `hours_test` on port 54321.

Optional synthetic demo (never runs automatically):

```bash
SEED_PASSWORD='local-demo-password-123' pnpm db:seed
```

Sign in as `demo@example.com` with the password you supplied. The seed is limited to the local `hours_dev` database and leaves an existing demo account unchanged.

## Commands

| Command                             | Purpose                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `pnpm install`                      | Install the workspace dependencies                                          |
| `pnpm setup:env`                    | Create missing local environment files safely                               |
| `pnpm db:up`                        | Start and wait for separate development/test PostgreSQL containers          |
| `pnpm db:down`                      | Stop containers; keep the development volume; test storage is ephemeral     |
| `pnpm db:generate`                  | Generate Drizzle SQL migrations from application schemas                    |
| `pnpm db:migrate`                   | Apply tracked migrations to the configured development database             |
| `pnpm db:provision`                 | Create restricted local runtime role and separate migration credentials     |
| `pnpm db:seed`                      | Seed synthetic local demo data; requires `SEED_PASSWORD`                    |
| `pnpm dev`                          | Run API and web together                                                    |
| `pnpm dev:api` / `pnpm dev:web`     | Run either app independently                                                |
| `pnpm lint`                         | ESLint and workspace/domain import-boundary checks                          |
| `pnpm format` / `pnpm format:check` | Apply/check Prettier formatting                                             |
| `pnpm typecheck`                    | Strict TypeScript and Next.js route types                                   |
| `pnpm test`                         | Pure calculation/configuration unit tests                                   |
| `pnpm test:integration`             | Real PostgreSQL integration tests; apply migrations to the test DB          |
| `pnpm test:e2e`                     | Complete Core + isolation browser flows at desktop, phone, and tablet sizes |
| `pnpm build`                        | Build Express and Next.js for production execution                          |
| `pnpm verify`                       | Lint, format, types, unit/integration tests, build, and browser tests       |

Before the first browser verification:

```bash
pnpm exec playwright install chromium
pnpm verify
```

On Linux CI, use `pnpm exec playwright install --with-deps chromium`. Browser tests start isolated servers on **3100/3101**, use `.next-e2e`, and require the test PostgreSQL container. They never use the development database. `TEST_DATABASE_URL` may override the test connection; the database name must end in `_test` and the URL must differ from `DATABASE_URL`.

To run built applications locally, use two terminals after `pnpm build`:

```bash
pnpm --filter @168hours/api start
pnpm --filter @168hours/web start
```

## Capabilities and deliberate limits

- Timezone-aware seven-day planner, overlapping blocks, category allocation, manual actual time, and planned-versus-recorded review. Sunday/Monday week starts. DST weeks show their actual 167/169-hour calendar coverage.
- Goals with category/date links and active, completed, paused, archived states.
- Manual food library, immutable log snapshots, daily calories/macros/fibre, missing-nutrient indicators, and repeat logging.
- Strength exercise library, saved workout sessions, multiple exercises, editable/reorderable sets, completion, and exercise progress. Cardio with optional distance and derived pace.
- Fast water and weight logs, editable histories, preferred units, and a chart of recorded weight measurements.
- Separate user accounts with protected sessions, owner-scoped queries, and reference-ownership checks.

Save a workout before leaving; unsaved navigation warns you. Completing a strength workout or logging cardio records its actual time once, including when no planned block is linked. Linking supplies the block's category. Delete activity records from Exercise to remove their source time entry. Deleting a plan keeps recorded activity.

Histories page through newly recorded rows; displayed event times and weight chart points use measurement/activity dates. Local date/time forms reject nonexistent or ambiguous DST times with a clear error. Advanced recurrence, drag/drop, offline synchronization, account recovery/verification emails, and public deployment are outside this Core.

Direct package versions and the lockfile are pinned. ESLint 9.39.5 is retained for compatibility with Next.js's current plugins despite its upstream deprecation. See [architecture](docs/architecture.md), [verification](docs/verification.md), and [implementation status](docs/IMPLEMENTATION.md).

## Backend foundation

The API verifies database connectivity/schema and runtime permissions before listening. Readiness returns 503 on database failure; shutdown drains active requests with a ten-second deadline. Connection acquisition, statements, locks, idle transactions, and HTTP sockets have bounded waits. See [foundation operations](docs/foundation.md) for settings and deployment requirements.

Forwarded IP headers are ignored by default. Local requests through Next.js share the loopback rate-limit bucket: 600 API requests/minute, and 10 signup or signin requests/minute per auth endpoint. For deployment, configure explicit trusted proxy addresses only after ensuring the edge overwrites untrusted forwarding headers. Limits live in the single API process and reset on restart.

Authentication policy, session renewal/revocation, password storage, supported endpoints and the public-release boundary are documented in [docs/security.md](docs/security.md).

Core writes use required revisions and durable retry receipts. After updating this checkout, run `pnpm db:migrate` and restart the API/web processes. See [write integrity](docs/decisions/003-write-integrity.md) for API headers, concurrency behavior and retry limits.
