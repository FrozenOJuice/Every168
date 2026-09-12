# Backend foundation

The API is one process with domain services and repositories. This phase strengthens its existing architecture; it introduces no distributed infrastructure.

## Lifecycle and diagnostics

`server.ts` handles process signals/fatal errors. `infrastructure/lifecycle.ts` verifies the database before binding the loopback interface, configures HTTP timeouts, and drains requests before closing the pool. Repeated shutdown signals share one operation. A deadline or cleanup failure exits nonzero. Keep-alive connections that become idle during draining are closed. Unexpected fatal errors trigger shutdown rather than continuing in an unknown state.

`/api/health` is process liveness and is exempt from rate limits. `/api/ready` runs a bounded database probe, returns 503 on failure or draining, and is never cached. Startup checks required Core tables and runtime-role privileges; it does not automatically apply migrations. Migration history remains the deployment authority.

Every application request has a generated `x-request-id`. Completion/abort logs use route templates, status, duration, and the same ID. Error diagnostics retain an error class, safe code, source locations, and bounded causes. Raw messages, SQL, parameters, request bodies, cookies and credentials are excluded. Auth library diagnostics are bridged to Pino without serializing arbitrary library messages/objects. Error responses use the shared JSON envelope, including auth 404s/429s and retry headers. Known transient database failures return 503; integrity/concurrency conflicts return 409.

## Defaults

| Setting                          | Default    | Purpose                                                |
| -------------------------------- | ---------- | ------------------------------------------------------ |
| `DB_POOL_MAX`                    | 10         | Maximum runtime connections                            |
| `DB_CONNECT_TIMEOUT_MS`          | 3000       | Connection establishment and pool acquisition          |
| `DB_STATEMENT_TIMEOUT_MS`        | 5000       | PostgreSQL statement execution                         |
| `DB_LOCK_TIMEOUT_MS`             | 2000       | PostgreSQL lock acquisition                            |
| `DB_IDLE_TRANSACTION_TIMEOUT_MS` | 10000      | Abandoned idle transactions                            |
| `DB_QUERY_TIMEOUT_MS`            | 7000       | Driver response deadline; exceeds statement timeout    |
| `SHUTDOWN_TIMEOUT_MS`            | 10000      | HTTP/pool drain deadline                               |
| `API_RATE_LIMIT`                 | 600/minute | Per resolved client address, before auth/database work |
| `TRUSTED_PROXY_CIDRS`            | empty      | Forwarded addresses ignored                            |

HTTP limits: 256 KB bodies, 10-second headers, 15-second request receipt, 30-second socket inactivity, 5-second keep-alive. Database migrations use a separate 60-second statement deadline and 65-second driver deadline. There are no automatic retries of writes. A client disconnect is not evidence that a write rolled back. Domain request receipts now allow the same command to be retried safely; required revisions protect edits/deletes. See `decisions/003-write-integrity.md`.

## Proxy and rate-limit policy

The default uses the actual socket peer. Next.js locally proxies all browsers from loopback, so they share a bucket. Express limits signup/signin to 10 requests/minute per endpoint and all auth paths to 100/minute, including invalid requests, before auth validation or database work. Better Auth's duplicate limiter is disabled. Client-supplied `X-Forwarded-For` and `X-168hours-Client-IP` cannot choose auth limiter keys under the default policy. Rate-limit responses include `Retry-After` and the shared error format.

For a public deployment, configure `TRUSTED_PROXY_CIDRS` only for known proxy IPs/CIDRs, with an edge that overwrites incoming forwarding headers (or appends the verified socket peer consistently). Do not use hop-count trust or trust Next.js alone: its default proxy preserves incoming forwarded headers. Ensure the API cannot be reached through an alternate trusted path. Integration tests cover untrusted header spoofing and right-to-left resolution through an explicitly trusted proxy.

The in-memory limiters are appropriate for the current single API process. They reset on restart and are not shared across replicas. A multi-process deployment must supply a shared limiter or enforce the limit at its trusted edge before scaling.

## Database credentials and migrations

Local setup:

```bash
pnpm db:up
pnpm db:migrate
pnpm db:provision
pnpm dev
```

`db:provision` is limited to local development `hours_dev`. It creates `hours_app` with local-only credentials, grants CRUD on public application tables, and switches `.env` to that runtime login. It retains the original admin URL as `MIGRATION_DATABASE_URL`. It never resets/truncates application data or changes an existing role's password. Repeating it is safe with the provisioned credentials. Restart the API after provisioning.

Runtime receives schema usage, table SELECT/INSERT/UPDATE/DELETE and sequence access. It does not receive public schema CREATE, role creation, table ownership, or migration-schema access. Migrations refresh grants for existing and future tables. A production runtime role with elevated privileges or application-table ownership is rejected at startup.

Production provisioning uses deployment-specific strong credentials and a role created by an administrator; do not use the local provisioning command or local passwords. Run migrations using migration credentials and provide only runtime credentials to the running API. Migration/runtime URLs must address the same database. Backup/restore exercises and deployment automation are phase 3 work.

## Layer enforcement and tests

Routes call services. Services can coordinate transactions using `RunInTransaction` and pass opaque `TransactionContext` objects. Only repositories resolve these scopes; expired scopes and scopes from another database are rejected. Dashboard and cross-domain calls continue through public services. SQL pagination helpers live in database infrastructure. A TypeScript-AST import check covers direct/dynamic imports, re-exports and literal `require` calls; tests demonstrate rejection of forbidden dependencies. This enforces source architecture, not a runtime sandbox against malicious code.

Foundation integration tests cover auth error/limiter behavior, safe logs, readiness, startup/port failures, graceful and forced shutdown, client disconnects, database/pool/lock/idle-transaction deadlines, rollback, and restricted-role CRUD/DDL permissions. Existing domain/isolation and browser suites remain required regression checks.
