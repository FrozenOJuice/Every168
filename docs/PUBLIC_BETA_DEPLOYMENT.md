# Public beta deployment and acceptance

This is an operator runbook, not evidence that a deployment exists. Do not open registration until the acceptance checklist has passed on the actual host. Calendar and Fitness are the public scope; retain `RELEASE_SCOPE=core` during both build and runtime.

## Hosting

Use one small Linux VM running an HTTPS reverse proxy, one Next.js process and one Express process, with managed PostgreSQL in the same region. One API process keeps the existing in-memory rate limits effective. Do not add replicas without a shared rate-limit store. Bind both Node processes to loopback; expose only HTTPS and restricted operator SSH. Use provider-managed database backups plus a separately stored encrypted logical backup. No Kubernetes or separate domain services are needed.

Use a supported Node version satisfying package.json, and the pinned pnpm version. Run the application as an unprivileged OS user. Keep immutable release directories and a `current` symlink; install from the committed lockfile with `pnpm install --frozen-lockfile`. Build with `RELEASE_SCOPE=core pnpm build`. Keep secrets outside the checkout, readable only by the service account. Do not copy local `.env` files into releases.

The public hostname serves both UI and `/api`. Route `/api/*` directly to Express at `127.0.0.1:3001`; route everything else to Next at `127.0.0.1:3000`. The edge must replace client forwarding headers and set the actual client address and HTTPS scheme. Set `TRUSTED_PROXY_CIDRS=127.0.0.1/32,::1/128` only for this topology. Never trust arbitrary forwarding headers from the Internet. Keep API and Next ports inaccessible from outside the VM. Set an edge request-body limit and short header/request timeouts; do not log request bodies, authorization, cookies or query strings.

Provision TLS with automatic renewal and an HTTPS redirect. Verify HSTS and the application security headers through the public hostname. Do not enable HSTS preload until the hostname and all affected subdomains are ready.

## Configuration

API requires `NODE_ENV=production`, `RELEASE_SCOPE=core`, `PORT=3001`, `DATABASE_URL` for the restricted runtime role, a cryptographically random `BETTER_AUTH_SECRET` of at least 32 characters, identical `BETTER_AUTH_URL` and `WEB_ORIGIN` equal to the public HTTPS origin, `EMAIL_API_KEY`, and `EMAIL_FROM`. Generate secrets outside shell history and never paste them into issues/logs. Review pool/timeouts and `API_RATE_LIMIT` against the database connection allowance; defaults are documented in `apps/api/.env.example`.

Next requires `NODE_ENV=production`, `RELEASE_SCOPE=core`, and `API_URL=http://127.0.0.1:3001` at build time. Start on loopback, for example `pnpm --filter @168hours/web exec next start --hostname 127.0.0.1 --port 3000`. Rebuild when changing release scope; do not mix a preview web build with a core API.

Account email uses Resend's HTTPS send-email API. The owner must create the provider account/key, verify the sending domain and its DNS records, and select a plain sender address for `EMAIL_FROM`. Use a key restricted to sending. Configure SPF/DKIM and review DMARC/delivery reports. Email links use `WEB_ORIGIN`; their tokens are in URL fragments and are removed when the form opens. Production refuses to start without sender/key configuration. No credentials or email bodies are logged. Delivery runs independently of the generic request response so provider latency does not expose account existence. It has a ten-second provider timeout; there is no durable mail queue, so a restart or failed delivery can require an explicit resend after the one-minute cooldown. Test real inbox delivery, spam handling, expired links and resend behavior before opening registration. Rotate the provider key if exposed.

## Database and migrations

Use a private database endpoint and verified TLS according to the provider's connection instructions; never disable certificate verification. The runtime role needs application table DML and sequence use, with no database/schema/table ownership, DDL, superuser or role creation. Use a separate migration owner/credential with DDL permissions, available only to the deployment operation. The repository's local provisioning script is for local disposable databases and must not be run against production.

Use `MIGRATION_DATABASE_URL` for the same database as `DATABASE_URL`, with the migration owner. Apply `pnpm db:migrate` once per deployment before starting the new API, then remove migration credentials from the running service environment. Grant DML/sequence access and owner default privileges for future tables to the runtime role; verify the API can create/read/edit/delete synthetic owned records and cannot create or alter tables. Do not run seed scripts in production. Public registration never selects roles. `admin:create` currently enforces local/test-only provisioning; do not remove that guard to create a production operator. If an Admin account is required for beta operations, obtain explicit authorization for an audited production provisioning procedure after hosting is configured. No production Admin has been provisioned.

Before each schema change take a backup and review migration SQL, lock impact and compatibility with the previous release. Current migrations are forward-only. Never assume switching application code back also reverses schema/data changes.

## Backup and restore

Set a documented recovery target before inviting users: initially at most 24 hours of lost changes and restoration within one working day is a reasonable beta starting point. Enable managed daily backups with at least 14-day retention; enable point-in-time recovery if available. Monitor successful backup completion and retention, not just scheduled jobs.

Create an additional encrypted backup with the matching supported PostgreSQL client, for example `pg_dump --format=custom --file=hours.dump "$BACKUP_DATABASE_URL"`, using a dedicated read-only backup credential and secret injection. Store it encrypted outside the application VM with restricted access and a retention policy; never commit dumps or upload them to public build artifacts. Protect authentication tables and personal workout/Calendar data equally. Delete temporary plaintext dumps after verified encryption/upload.

Before launch, restore into a separate empty isolated database with `pg_restore --exit-on-error --no-owner --dbname="$RESTORE_DATABASE_URL" hours.dump`. Never point restore at production. Apply the restricted test runtime role, run migrations as appropriate for that backup release, inspect table counts/foreign-key validity and run synthetic login, Calendar editing and Fitness history workflows. Record backup timestamp, restored release, restore duration and results without personal data. Rehearse again after schema/backup changes and at least monthly. A dump command exiting successfully is not a restore test.

## Deployment and rollback

1. Prepare hostname/TLS, private PostgreSQL, sender DNS and secrets. Record the current release and backup reference.
2. Run the repository release checks in CI on a clean checkout; install and build an immutable release. Keep production data and credentials out of CI.
3. Back up and review/apply migrations with the migration identity. Do not allow concurrent migration runners.
4. Start/restart API and Next under the OS service manager with automatic restart, bounded logs, graceful SIGTERM and sufficient shutdown grace. Probe loopback `/api/ready`, then public `/api/ready` and `/login`.
5. Run the acceptance tests below with synthetic accounts. Open registration only after recording their results.
6. On a regression, stop admission/new writes if integrity is uncertain. Switch to the prior release only if its code is compatible with the migrated schema; otherwise roll forward with a tested fix. For data corruption, preserve a forensic backup, restore into a separate database, verify it, then switch deliberately. Document the lost-write interval and notify affected users. Never blindly run reverse SQL.

## Operations and public acceptance

Monitor external HTTPS availability, `/api/health` (process) and `/api/ready` (database), certificate expiry, disk/memory, database connections/storage, elevated 5xx, email delivery failures and backup age. Route alerts to the owner's chosen channel; no monitoring service has been provisioned. Structured API logs contain safe diagnostics; keep access restricted and retention bounded. Verify proxy logs also redact query strings and sensitive headers. Keep support/privacy contact and beta expectations visible in the release communication; describe actual data retention/deletion behavior accurately.

Record actual date, release and result for every item:

- Public HTTPS redirects, certificates, security headers, correct secure/HttpOnly/SameSite cookies, origin rejection and real client-IP rate limiting.
- Real signup email, ownership verification, sign-in/out, password change, password reset, expired/single-use links and old-session revocation.
- Two-account isolation, core-only page/API/search boundaries, inaccessible deferred features and admin denial to ordinary users.
- Calendar create/edit/repeat, DST display/editing, copy/undo/redo and lost-response refresh retry; responsive keyboard/mobile controls.
- Fitness create/schedule/start/pause/resume/finish, history, correction, comparison and contextual return navigation.
- Restart while a session is paused and while a write response is uncertain; verify retained results and exact retry behavior.
- Runtime database permissions, clean migrations, encrypted off-host backup and a timed isolated restore with post-restore workflows.
- Owner monitoring alerts, support process, account/data deletion process, deployment rollback rehearsal and privacy expectations.

Infrastructure, provider credentials, real delivery, public TLS/proxy behavior, backups, restores and public-host acceptance require owner setup and are not verified by local browser tests.
