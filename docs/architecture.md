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
- `apps/web`: Next.js routes and responsive feature components. TanStack Query owns server-state caching; React Hook Form and Zod handle forms. Native dialogs provide focus trapping and Escape handling. Calendar quick actions reuse existing domain and measurement forms; domain history/reporting surfaces remain separate. CSS semantic variables use the specification's exact palette.
- `packages/contracts`: Zod inputs, response shapes, and inferred transport types, grouped by domain.
- `packages/api-client`: framework-neutral typed fetch functions, configurable base URL/fetch/headers, common errors. No React or database dependency.
- `packages/domain-utils`: pure Temporal calendar/interval and unit helpers.
- `packages/config`: shared strict TypeScript configuration.

Dashboard composes public services and never reads repositories. Exercise calls Planning's public source-entry methods inside the existing database transaction. Other modules do not depend on Dashboard. Module table imports are allowed for relational foreign keys; private repositories are not imported across domains. The lint command parses imports and enforces domain, route/service/repository, and persistence boundaries. Services receive an opaque transaction scope, which only repositories can resolve to a database transaction. Infrastructure database code and Better Auth’s adapter are explicit persistence exceptions.

## Identity, requests, and isolation

Better Auth uses its transactional Drizzle adapter and UUIDs. It owns users, sessions, credential accounts, and verification records required by the library. An explicit HTTP allowlist exposes email/password signup/signin/signout and session lookup only. The auth boundary validates shared contracts, strips private response fields, and delegates reliable logout to the identity service/repository. Preferences are created lazily and scoped to the authenticated user. See `security.md` for password and session policy.

Every user-owned repository operation includes `user_id`. Supplied category, goal, food, exercise, workout-child, and planned-block references are checked against the same owner. Composite foreign keys reinforce ownership for categories/goals/foods and workout children. Exercise planned-block links have composite owner foreign keys, nullable detach behavior and service checks, allowing plan deletion to retain activity history. Unauthorized resource IDs return the same 404 as missing IDs.

Application and auth mutations require the configured exact Origin and reject cross-site Fetch Metadata. Better Auth retains its own CSRF checks. Cookies are HttpOnly and SameSite=Lax; production configuration requires matching HTTPS web/auth origins and Secure cookies. Auth/private responses are never cached. Protected requests validate sessions against PostgreSQL and forward renewed cookies. Server Components explicitly skip renewal because they cannot write browser cookies. Account transitions reload the document and clear query state so another account cannot inherit the previous account's router/query cache.

Both auth and application payloads are limited to 256 KB. Express bounds raw auth bodies before converting them to a Fetch Request, including chunked transfers; malformed JSON is rejected before invoking the auth library. Application/auth failures share the error envelope. Pino request logs include generated request IDs, method, route template, status, timing, and aborted requests; bodies, credentials, cookies and health records are excluded. Unexpected errors expose no SQL or internal stack to clients. Internal diagnostics retain safe error codes, source locations and causes without raw error messages or database values. Authentication errors preserve 404/429 status and retry guidance. API Helmet and web response headers provide baseline security headers.

Domain mutations pass through a small command service before the domain service. It shares one opaque transaction with persistence and records an owner-scoped idempotency receipt. Required revisions prevent stale edits; successful retries replay the original result. See [write integrity decisions](decisions/003-write-integrity.md) for the HTTP contract, database enforcement and limits.

## Calendar and accounting

The web landing route is Calendar, with Day, Week (default), and Month views. The feature coordinator delegates bounded data loading to a calendar hook, controls to the toolbar, presentation to month/time grids, and writes to the existing editor. Month composes four to six existing owner-scoped week reads, each under the shared week cache prefix; it never sums them into invented month totals or treats a failed row as empty. Date helpers calculate only navigation/visible rows; grid geometry is presentation-only. Canonical totals remain in the API. Calendar is a general planning surface; it no longer mounts domain panels or fetches Dashboard. Reporting remains in domain slices; compact selected-date quick actions reuse the existing domain forms. The removed cross-domain panel components and styles are deleted; backend services and the shared API remain intact. AppShell owns four primary destinations and the account disclosure. URL state identifies calendar dates/views and Food/Exercise sections. See [UI standards](ui-standards.md).

Calendar's shared day-record list serves Week overflow and Month. Small presentation helpers handle clipping, quarter-hour selection, local draft times and elapsed-duration moves; the page owns ephemeral scroll memory. Duplication reuses the existing block-create contract and copies only editable plan fields into a draft. Shared forms retain request keys and captured revisions, and native dialogs restore keyboard focus. A pointer interaction provider owns drag previews, cancellation, auto-scroll and retry-safe adjustments; forms remain the keyboard and precise-time alternative. No drag library or background worker is required.

The Planning module now has focused services/repositories for date-only items, finite repeating series, copy/templates, and history search. Four owned tables extend PostgreSQL: `calendar_items`, `calendar_series`, `calendar_templates`, and normalized `calendar_template_entries`. Materialized recurring blocks remain ordinary time blocks with stable occurrence identity. Parent revisions advance with child changes. All new endpoints use the existing shared contracts, write receipts, owner checks and transaction scopes. Calendar reads date-only items alongside bounded week queries; filters do not change canonical accounting or linked-record metadata. Search merges bounded owner-scoped reads with a `(created_at, id, kind)` cursor. See [Calendar decisions](decisions/004-calendar-expansion.md).

Temporal computes local calendar dates, preferred week starts, and UTC day/week bounds. Every interval is clipped to the selected week. Overall allocation is an interval union; category planned totals remain raw durations. Overlap pairs and duplicate duration are explicit. Unknown actual time is null until a record exists.

Manual actual entries remain separate from plans. Explicitly recorded cardio and finished strength workouts each own one unique `(user_id, source_type, source_id)` time entry. Activity updates, completion/reopening, deletion and source accounting share a transaction. Workout writes lock the parent; all Core edits/deletes require the last-seen integer revision. Removing a plan detaches links and preserves historical activity/time.

Workout corrections retain validated child IDs and creation timestamps, keeping ordinary edits stable in paginated progress history. Completed-set progress and its maximum load share one read snapshot. Exercise restoration and history filters use the same owner/revision/contract boundaries. The browser captures generated finish timestamps per request key and invalidates all affected Calendar caches. See [Exercise decisions](decisions/006-exercise-slice.md).

## Historical data and units

Food's daily page composes Nutrition, Hydration and Body through their typed public APIs; these remain separate backend domains. Nutrition provides entry, meal and daily values from the same immutable snapshots, plus literal-name history search and versioned food restoration. Hydration returns daily records and totals from one read. Body provides a consistent selected-day/latest/30-day review under a read-only repeatable-read transaction, with a 200-point chart limit and paginated full history. Only presentation and unit formatting live in the web. See [Food decisions](decisions/005-food-slice.md).

All owned records use UUIDs, UTC timestamps, and owner/time indexes. Local dates (goal targets) remain SQL dates. Food entries snapshot names, servings and nutrients. Workout exercises snapshot names. Definitions are archived instead of deleted. Ordinary logs require confirmation before permanent deletion.

Canonical units are kg, metres, seconds, ml, g and kcal. Conversion happens at input/display boundaries. Unknown nutrient/load/distance values remain null. Nutrition totals carry known sums and unknown-item counts. Weight charts plot only measured points; no synthetic days or health scores exist.

History endpoints use descending `(created_at, id)` keyset pagination with millisecond-precision timestamps. Calendar/daily endpoints are bounded by the selected local period. Dashboard queries are bounded to today/current week and small recent/active summaries.

## Development and verification

Verification runs locally through `pnpm verify`. The owner requested removal of the GitHub Actions workflow; no CI is configured.

Compose separates durable `hours_dev` from ephemeral `hours_test`. Drizzle SQL history is kept in the repository as migration files; no schema push/synchronization is used. Configuration is validated before startup. The API checks schema/connectivity before listening, rejects elevated database roles in production, and uses bounded database waits. Local runtime credentials are separated from migration credentials using `db:provision`. Startup and shutdown failures are logged; draining is idempotent and bounded. `createApp` has no listening side effect, making Supertest integration tests straightforward. Playwright uses dedicated 3100/3101 servers and the isolated test database.

No services, SDKs, scaffolds or adapters for post-Core functionality are present.

General API rate limiting runs before session/database work; health remains available. Express trusts no forwarded IPs by default. Better Auth receives only the address resolved by the API’s configured proxy policy, overriding any supplied internal address header. See `foundation.md` for operational settings and limitations.
