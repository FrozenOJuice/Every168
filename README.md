# 168Hours

A personal weekly planner and logbook. Plan the week, record selected actual time, and keep goals, food, exercise, water, and weight in one private account.

Core MVP with the owner-approved Calendar expansion. No AI, integrations, native app, social features, or external food services.

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

Open **http://localhost:3000** and create an account. Open the account menu → Settings to select your timezone and units and create categories. Calendar is your home: choose Day, Week, or Month in its top toolbar. Week is the default on desktop and phone; the phone grid scrolls within the calendar. Previous/next arrows surround Today. Use Calendar tools (•••) for repeating plans, all-day/unscheduled plans, copying/templates, and selected-date quick actions. The search control filters the visible calendar or searches all dates.

`setup:env` creates `apps/api/.env` with a random authentication secret and `apps/web/.env.local`. It keeps existing files unchanged. Example files document the configuration. Do not commit the generated files. Use the same configured browser origin (`http://localhost:3000` by default) for cookies and write requests.

`db:provision` creates the restricted local `hours_app` login and updates `apps/api/.env`, keeping the admin connection in `MIGRATION_DATABASE_URL`. It preserves existing data. Run it once after initial migrations (or when upgrading an existing local setup), then restart the API. Subsequent migrations use the admin connection and refresh runtime grants.

The browser calls `/api/*`; Next.js proxies it to the independent Express API at **http://127.0.0.1:3001**. Readiness is available through **http://localhost:3000/api/ready**. Development PostgreSQL is `hours_dev` on port 54320. Tests use `hours_test` on port 54321.

Optional synthetic demo (never runs automatically):

```bash
SEED_PASSWORD='local-demo-password-123' pnpm db:seed
```

Sign in as `demo@example.com` with the password you supplied. The seed is limited to the local `hours_dev` database and leaves an existing demo account unchanged.

## Admin setup

Account types are fixed: public signup creates a User; the local operator command creates a new Admin. Existing accounts cannot be promoted or demoted.

After applying migrations, run:

```bash
pnpm admin:create
```

Enter a new name/email and a password when prompted (password input is hidden). Sign in normally, then open **Account menu → Admin**. The command works only against local development/test databases and refuses production. It never converts an existing account.

Admins can search account metadata, suspend/reactivate regular users and revoke their sessions. The Admin area includes aggregate usage statistics, system health and an immutable action history. Admins retain access only to their own personal plans, food, exercise and goals. Suspension keeps records and requires a new login after reactivation. Admin accounts cannot be suspended through the application.

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
| `pnpm admin:create`                 | Interactively create a new fixed-type Admin in a local database             |
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

CI has been removed at the owner’s request. All checks run locally with `pnpm verify`.

Before the first browser verification:

```bash
pnpm exec playwright install chromium
pnpm verify
```

On Linux, use `pnpm exec playwright install --with-deps chromium`. Browser tests start isolated servers on **3100/3101**, use `.next-e2e`, and require the test PostgreSQL container. They never use the development database. `TEST_DATABASE_URL` may override the test connection; the database name must end in `_test` and the URL must differ from `DATABASE_URL`.

To run built applications locally, use two terminals after `pnpm build`:

```bash
pnpm --filter @168hours/api start
pnpm --filter @168hours/web start
```

## Capabilities and deliberate limits

- Calendar-first home with Day, Week, and Month views and a full-height planning workspace. Four main destinations: Calendar, Food, Exercise, Goals; account controls live in the account menu.
- Timezone-aware seven-day planner, overlapping blocks, category labels and manual actual time linked to blocks. Canonical allocation and planned-versus-recorded totals remain available through the API. Sunday/Monday week starts. DST weeks show their actual 167/169-hour calendar coverage.
- Goals with category/date links and active, completed, paused, archived states.
- Manual food library with archive/restore, immutable log snapshots, daily and meal nutrition, unknown-nutrient indicators, and searchable recent entries for repeat logging. Create a missing food without leaving the logging flow.
- Strength exercise library with archive/restore, saved sessions, multiple exercises, editable/reorderable and repeatable sets, explicit finish times, and exercise progress. Search/filter workout and cardio histories; cardio supports optional distance and derived pace.
- Food's daily page includes water quick-add buttons, editable water/weight records and histories, and a 30-day weight chart using actual measurements. Select a date to review meals and measurements together. Calendar quick actions reuse these forms alongside Exercise and Goals.
- Separate user accounts with protected sessions, owner-scoped queries, and reference-ownership checks.

Save a workout before leaving; unsaved navigation warns you. Completing a strength workout or logging cardio records its actual time once, including when no planned block is linked. Linking supplies the block's category. Delete activity records from Exercise to remove their source time entry. Deleting a plan keeps recorded activity.

Calendar dates and Day/Week/Month views are addressable in the URL. Click the date heading to jump, or Today to return to the current time. Grid taps select 15-minute starts; the editor supports duration shortcuts, rescheduling and reviewable planned-block duplication. Busy weeks keep their grid with extra records in a day list; Month adapts its previews to available space and opens the same list. Overnight continuations and clock-change dates retain explicit local times. Planned blocks and recorded entries appear together; their accounting remains separate, and duplication never copies recorded time. Food and Exercise sections also support direct links. See [UI standards](docs/ui-standards.md).

Drag planned blocks in Day/Week to move them; drag their edges to resize, or drag empty space to open a draft. On touch screens, open a block and choose **Move or resize on calendar**, then select Move, Resize start, or Resize end and drag the selected block. The form remains available for precise and keyboard editing. Month previews can be dragged to another date on desktop. Recorded activity is edited in its source domain. See [Calendar behavior and limits](docs/decisions/004-calendar-expansion.md) for recurrence, copying, templates and daylight saving rules.

Histories page through newly recorded rows; displayed event times and weight chart points use measurement/activity dates. Local date/time forms reject nonexistent or ambiguous DST times with a clear error. Complex recurrence, external synchronization, offline writes, account recovery/verification emails, and public deployment remain outside this scope.

Direct package versions and the lockfile are pinned. ESLint 9.39.5 is retained for compatibility with Next.js's current plugins despite its upstream deprecation. See [architecture](docs/architecture.md), [verification](docs/verification.md), and [implementation status](docs/IMPLEMENTATION.md).

## Backend foundation

The API verifies database connectivity/schema and runtime permissions before listening. Readiness returns 503 on database failure; shutdown drains active requests with a ten-second deadline. Connection acquisition, statements, locks, idle transactions, and HTTP sockets have bounded waits. See [foundation operations](docs/foundation.md) for settings and deployment requirements.

Forwarded IP headers are ignored by default. Local requests through Next.js share the loopback rate-limit bucket: 600 API requests/minute, and 10 signup or signin requests/minute per auth endpoint. For deployment, configure explicit trusted proxy addresses only after ensuring the edge overwrites untrusted forwarding headers. Limits live in the single API process and reset on restart.

Authentication policy, session renewal/revocation, password storage, supported endpoints and the public-release boundary are documented in [docs/security.md](docs/security.md).

Core writes use required revisions and durable retry receipts. After updating this checkout, run `pnpm db:migrate` and restart the API/web processes. See [write integrity](docs/decisions/003-write-integrity.md) for API headers, concurrency behavior and retry limits.

Admins can permanently delete regular User accounts from **Admin → Users → Delete account**, after typing the account email. This removes its private records and sessions; audit history remains. Admin accounts are protected.
