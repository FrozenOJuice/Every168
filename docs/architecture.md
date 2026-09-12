# Implemented architecture

168Hours is a pnpm modular monolith with two independently runnable applications and one PostgreSQL database per environment.

```mermaid
flowchart LR
  Browser -->|same-origin /api| Next[Next.js App Router]
  Next -->|REST /api/v1 and /api/auth| API[Express 5]
  API --> Auth[Better Auth]
  API --> Services[Domain application services]
  Services --> Repositories[Domain repositories]
  Auth --> DB[(PostgreSQL 18)]
  Repositories -->|Drizzle + pg| DB
```

## Workspace boundaries

- `apps/api`: Express composition, identity, categories, planning, goals, nutrition, exercise, hydration, body, dashboard. Routes validate Zod contracts and call services; repositories encapsulate Drizzle persistence.
- `apps/web`: Next.js routes and responsive feature components. TanStack Query owns server-state caching; React Hook Form and Zod handle forms. Native dialogs provide focus trapping and Escape handling. Recharts displays measured weight points. CSS semantic variables use the specification's exact palette.
- `packages/contracts`: Zod inputs, response shapes, and inferred transport types, grouped by domain.
- `packages/api-client`: framework-neutral typed fetch functions, configurable base URL/fetch/headers, common errors. No React or database dependency.
- `packages/domain-utils`: pure Temporal calendar/interval and unit helpers.
- `packages/config`: shared strict TypeScript configuration.

Dashboard composes public services and never reads repositories. Exercise calls Planning's public source-entry methods inside the existing database transaction. Other modules do not depend on Dashboard. Module table imports are allowed for relational foreign keys; private repositories are not imported across domains. The lint command checks these boundaries.

## Identity, requests, and isolation

Better Auth uses its Drizzle adapter and database-generated UUIDs. It owns users, sessions, credential accounts, and verification records required by the library. Core exposes email/password signup/signin/signout and session lookup only. Preferences are created lazily and scoped to the authenticated user.

Every user-owned repository operation includes `user_id`. Supplied category, goal, food, exercise, workout-child, and planned-block references are checked against the same owner. Composite foreign keys reinforce ownership for categories/goals/foods and workout children. Exercise planned-block links have nullable foreign keys plus explicit service checks, allowing plan deletion to retain activity history. Unauthorized resource IDs return the same 404 as missing IDs.

Application mutations require the configured exact Origin. Better Auth retains its own CSRF checks. Cookies are HttpOnly and SameSite=Lax; production configuration requires HTTPS and Secure cookies. Session responses are never cached. Account transitions reload the document and clear query state so another account cannot inherit the previous account's router/query cache.

Both auth and application payloads are limited to 256 KB. The auth HTTP adapter reads the raw stream before Express body parsing, using Better Call's bounded Request conversion. Application/auth failures share the error envelope. Pino request logs include generated request IDs, method, path, status and timing; bodies, credentials, cookies and health records are excluded. Unexpected errors expose no SQL or internal stack to clients. API Helmet and web response headers provide baseline security headers.

## Calendar and accounting

Temporal computes local calendar dates, preferred week starts, and UTC day/week bounds. Every interval is clipped to the selected week. Overall allocation is an interval union; category planned totals remain raw durations. Overlap pairs and duplicate duration are explicit. Unknown actual time is null until a record exists.

Manual actual entries remain separate from plans. Explicitly recorded cardio and finished strength workouts each own one unique `(user_id, source_type, source_id)` time entry. Activity updates, completion/reopening, deletion and source accounting share a transaction. Workout writes lock the parent; the web supplies `expectedUpdatedAt` to reject stale saves. Removing a plan detaches links and preserves historical activity/time.

## Historical data and units

All owned records use UUIDs, UTC timestamps, and owner/time indexes. Local dates (goal targets) remain SQL dates. Food entries snapshot names, servings and nutrients. Workout exercises snapshot names. Definitions are archived instead of deleted. Ordinary logs require confirmation before permanent deletion.

Canonical units are kg, metres, seconds, ml, g and kcal. Conversion happens at input/display boundaries. Unknown nutrient/load/distance values remain null. Nutrition totals carry known sums and unknown-item counts. Weight charts plot only measured points; no synthetic days or health scores exist.

History endpoints use descending `(created_at, id)` keyset pagination with millisecond-precision timestamps. Calendar/daily endpoints are bounded by the selected local period. Dashboard queries are bounded to today/current week and small recent/active summaries.

## Development and verification

Compose separates durable `hours_dev` from ephemeral `hours_test`. Drizzle SQL history is kept in the repository as migration files; no schema push/synchronization is used. Configuration is validated before startup. `createApp` has no listening side effect, making Supertest integration tests straightforward. Playwright uses dedicated 3100/3101 servers and the isolated test database.

No services, SDKs, scaffolds or adapters for post-Core functionality are present.
