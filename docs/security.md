# Authentication and authorization

Phase 2 keeps Better Auth responsible for credential authentication, signed cookies and session creation. Express owns the public HTTP boundary. Identity services handle application policy; their repository performs owner-scoped persistence. No JWT, bearer-token plugin, local-storage credentials, email provider or additional auth framework is introduced.

## HTTP contract

Only these exact endpoints and methods are public:

| Method | Path                      | Success body                                                      |
| ------ | ------------------------- | ----------------------------------------------------------------- |
| POST   | `/api/auth/sign-up/email` | `{ user: { id, name, email } }`                                   |
| POST   | `/api/auth/sign-in/email` | `{ user: { id, name, email } }`                                   |
| POST   | `/api/auth/sign-out`      | `{ success: true }`                                               |
| GET    | `/api/auth/get-session`   | `{ user: { id, name, email }, session: { expiresAt } }` or `null` |

All other auth paths/methods return 404. Query overrides, callback URLs, client-selected IDs, verification flags, and unknown body fields are rejected. Mutations accept bounded JSON and require the exact configured Origin, including signup/signin without cookies. `Sec-Fetch-Site: cross-site` is rejected. CORS is not enabled: browser requests use the same-origin Next proxy. Auth and private responses use `Cache-Control: no-store`; session tokens, IP addresses and user agents are absent from public auth JSON. Safe errors use the application's standard envelope.

Rate limits run before validation and password hashing: 10/minute for each signup/signin path, 100/minute across auth, and the general API limit. See `foundation.md` for proxy trust, IPv6 grouping, in-memory limits and deployment constraints.

## Passwords and signup

New passwords require 12–128 characters; long passphrases and password managers are supported without composition rules. Email input is trimmed and lowercased, name is trimmed and limited to 100 characters, and passwords are never trimmed. Existing email uniqueness is enforced by PostgreSQL. Invalid login credentials receive the same error for unknown users and wrong passwords. Signup with an existing email can disclose that it is registered; public onboarding policy must address this together with verification/recovery.

Node's asynchronous `crypto.scrypt` uses N=65536, r=8, p=2, 16 random salt bytes, a 64-byte result, and timing-safe comparison. This is one of the [OWASP scrypt parameter sets](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt). `scrypt-v1$` identifies this fixed configuration; unrecognized versions and malformed hashes fail closed. Passwords use NFKC normalization. Only the current versioned format is accepted; unversioned legacy hashes are rejected. Development/test data is disposable by owner instruction, so there is no legacy verification or login-upgrade path. No plaintext password or hash is logged or returned.

Signup uses the [Drizzle adapter's transaction option](https://better-auth.com/docs/adapters/drizzle), keeping the user, credential and initial session atomic. PostgreSQL fault-injection tests verify rollback and clean retry. The owner requested a clean slate; no credential backfill or compatibility migration is needed.

## Sessions and logout

Sessions are random opaque server-side tokens in PostgreSQL, transported in Better Auth's signed HttpOnly cookie. Production adds Secure with the `__Secure-` prefix; cookies are host-only, SameSite=Lax and Path=/. The database is authoritative on every protected request; cookie session caching is explicitly disabled. These database tokens and backups are sensitive even though public responses strip them.

The current policy is a seven-day sliding session, renewed at most daily during API activity, without an absolute lifetime limit. Session renewal forwards `Set-Cookie` to the browser. Next Server Components use `X-168hours-Session-Refresh: skip` for read-only authentication, leaving renewal to browser API calls; any caller may skip renewal, which cannot prolong or bypass expiry. There is no polling keepalive. Expired, invalid, deleted or incorrectly signed sessions are rejected. A fresh login creates a distinct session; signing out revokes the current session while other browser sessions remain valid.

Better Auth's built-in logout catches database deletion failures. The HTTP wrapper first validates the signed session without refreshing it and requires the identity service/repository deletion to succeed. Only then does the library clear its cookies. Failure therefore returns an error and the UI retains its signed-in state for retry. Tests inject a database delete failure and replay the old cookie after successful logout.

Rotating `BETTER_AUTH_SECRET` invalidates existing signed cookies; all users must sign in again. Provision a random secret per environment using the setup script/secret manager. Session rows can be revoked by an authorized database operator during incident response. No user-facing multi-device session manager is included. Account changes clear browser query state and reload the document. E2E covers same-browser logout/login and old-page navigation as well as separate-account access.

## Authorization and release boundary

Every domain route is behind session middleware. All private queries and writes use the authenticated user ID; supplied ownership fields are rejected. Services validate category, goal, food, exercise, nested workout and planned-block references. Missing and foreign record IDs share 404 behavior. Database foreign keys reinforce the service checks where specified. Import-boundary checks enforce repository-only application persistence, with database infrastructure and Better Auth's adapter as deliberate exceptions.

This is the local Core security boundary, not a public deployment approval. Email verification, password recovery delivery and 2FA remain excluded by the build spec. Do not offer public signup until verification/recovery policy and delivery, signup enumeration policy, trusted-edge abuse controls, TLS/headers/CSP, backup/restore, and deployment/incident procedures are reviewed. These are deployment or future feature decisions; they do not silently enable unused library endpoints. Dependency advisories and the existing integration/browser suite should be checked on upgrades.

## Fixed Admin accounts

The owner-approved Admin extension adds a permanent account type and operator-only local account creation. Public signup cannot select a type; PostgreSQL rejects type changes. Admin API access requires a fresh active admin check. Admins may manage regular account metadata/status/sessions and read aggregate counts, operational health and audit identifiers. Personal domain endpoints still enforce ordinary ownership, including for Admin accounts. There is no impersonation, promotion/demotion or personal-record inspection API.

Suspension revokes all sessions, rejects further protected requests/login and prevents session creation/update at the database boundary. Domain write transactions recheck active status under a shared account lock. Reactivation requires a new login. Management effects, revisions, append-only audit records and idempotency receipts commit together. Read requests already in progress may finish. Admin account creation is restricted to local development/test databases; production provisioning remains outside this pass. See [Admin decisions](decisions/007-admin.md).

Admin account deletion is limited to regular User accounts and requires exact target-email confirmation, the current account revision and an idempotency key. Account deletion cascades its private data and login sessions. Admin accounts are protected. Audit identifiers survive deletion without retaining personal content; audit failure rolls back the deletion. Retry receipts belong to the acting Admin and survive target deletion.
