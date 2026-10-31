# Authentication and authorization

Every168 retains existing session cookies, security headers and stored account data. The [brand guide](BRAND.md#compatibility-and-naming-audit) explains the deliberately unchanged internal names. Account emails use the Every168 display name and subjects with the operator-configured sender address and origin.

Phase 2 keeps Better Auth responsible for credential authentication, signed cookies and session creation. Express owns the public HTTP boundary. Identity services handle application policy; their repository performs owner-scoped persistence. No JWT, bearer-token plugin or local-storage credentials are introduced. Account ownership and password recovery use the Identity service and Resend HTTPS delivery.

## Development verification exception

The owner temporarily disabled the email-verification requirement for `NODE_ENV=development` so local accounts can sign in without a configured delivery provider. Signup does not auto-sign-in, does not send a verification email automatically in development, and reports the requirement through the shared signup response contract. Existing unverified accounts also work; their persisted `emailVerified` value stays false. Private session access and authenticated password changes follow the same policy. Suspensions, ownership, password validation and session revocation remain enforced. Test and production always require verified email; production still requires delivery configuration. Explicit verification/reset requests retain their real token/delivery flow.

## HTTP contract

Only these exact endpoints and methods are public:

| Method | Path                      | Success body                                                      |
| ------ | ------------------------- | ----------------------------------------------------------------- |
| POST   | `/api/auth/sign-up/email` | `{ status: true, verificationRequired: boolean }` (generic)       |
| POST   | `/api/auth/sign-in/email` | `{ user: { id, name, email } }`                                   |
| POST   | `/api/auth/sign-out`      | `{ success: true }`                                               |
| GET    | `/api/auth/get-session`   | `{ user: { id, name, email }, session: { expiresAt } }` or `null` |

Additional POST-only endpoints are `/api/auth/send-verification-email`, `/api/auth/verify-email`, `/api/auth/request-password-reset`, `/api/auth/reset-password`, and authenticated `/api/auth/change-password`. Email requests and signup return generic success; token and password bodies use strict shared contracts.

All other auth paths/methods return 404. Query overrides, callback URLs, client-selected IDs, verification flags, and unknown body fields are rejected. Mutations accept bounded JSON and require the exact configured Origin, including signup/signin without cookies. `Sec-Fetch-Site: cross-site` is rejected. CORS is not enabled: browser requests use the same-origin Next proxy. Auth and private responses use `Cache-Control: no-store`; session tokens, IP addresses and user agents are absent from public auth JSON. Safe errors use the application's standard envelope.

Rate limits run before validation and password hashing: 10/minute for each signup/signin path, 5/minute per account-security endpoint, 100/minute across auth, and the general API limit. See `foundation.md` for proxy trust, IPv6 grouping, in-memory limits and deployment constraints.

## Passwords and signup

New passwords require 12–128 characters; long passphrases and password managers are supported without composition rules. Email input is trimmed and lowercased, name is trimmed and limited to 100 characters, and passwords are never trimmed. Existing email uniqueness is enforced by PostgreSQL. Invalid login credentials receive the same error for unknown users and wrong passwords. Signup and email requests use generic responses. Verification and reset tokens contain 256 random bits, are stored only by hash, expire after 24 hours and 30 minutes respectively, and are consumed once under a user/token transaction lock. A per-account one-minute resend cooldown complements IP limits. Email links carry tokens in fragments, removed on opening and retained only in mounted memory.

Node's asynchronous `crypto.scrypt` uses N=65536, r=8, p=2, 16 random salt bytes, a 64-byte result, and timing-safe comparison. This is one of the [OWASP scrypt parameter sets](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt). `scrypt-v1$` identifies this fixed configuration; unrecognized versions and malformed hashes fail closed. Passwords use NFKC normalization. Only the current versioned format is accepted; unversioned legacy hashes are rejected. Development/test data is disposable by owner instruction, so there is no legacy verification or login-upgrade path. No plaintext password or hash is logged or returned.

Signup uses the [Drizzle adapter's transaction option](https://better-auth.com/docs/adapters/drizzle), keeping user and credential creation atomic. Public signup does not create a session; sign-in creates it separately under the environment verification policy above. PostgreSQL fault-injection tests verify rollback and clean retry. The owner requested a clean slate; no credential backfill or compatibility migration is needed.

## Sessions and logout

Sessions are random opaque server-side tokens in PostgreSQL, transported in Better Auth's signed HttpOnly cookie. Production adds Secure with the `__Secure-` prefix; cookies are host-only, SameSite=Lax and Path=/. The database is authoritative on every protected request; cookie session caching is explicitly disabled. These database tokens and backups are sensitive even though public responses strip them.

The current policy is a seven-day sliding session, renewed at most daily during API activity, without an absolute lifetime limit. Session renewal forwards `Set-Cookie` to the browser. Next Server Components use `X-168hours-Session-Refresh: skip` for read-only authentication, leaving renewal to browser API calls; any caller may skip renewal, which cannot prolong or bypass expiry. There is no polling keepalive. Expired, invalid, deleted or incorrectly signed sessions are rejected. A fresh login creates a distinct session; signing out revokes the current session while other browser sessions remain valid.

Better Auth's built-in logout catches database deletion failures. The HTTP wrapper first validates the signed session without refreshing it and requires the identity service/repository deletion to succeed. Only then does the library clear its cookies. Failure therefore returns an error and the UI retains its signed-in state for retry. Tests inject a database delete failure and replay the old cookie after successful logout.

Rotating `BETTER_AUTH_SECRET` invalidates existing signed cookies; all users must sign in again. Provision a random secret per environment using the setup script/secret manager. Session rows can be revoked by an authorized database operator during incident response. No user-facing multi-device session manager is included. Account changes clear browser query state and reload the document. E2E covers same-browser logout/login and old-page navigation as well as separate-account access.

## Authorization and release boundary

Every domain route is behind session middleware. All private queries and writes use the authenticated user ID; supplied ownership fields are rejected. Services validate category, goal, food, exercise, nested workout and planned-block references. Missing and foreign record IDs share 404 behavior. Database foreign keys reinforce the service checks where specified. Import-boundary checks enforce repository-only application persistence, with database infrastructure and Better Auth's adapter as deliberate exceptions.

The owner has authorized public email verification/reset/change for beta. Password reset and password change revoke all sessions and outstanding recovery links; a successful reset also proves ownership of the mailbox. Require the current password for authenticated changes. Delivery failures log only a safe diagnostic code and remain generic to the requester. 2FA remains outside the release. This is not public deployment approval. Do not offer public signup until verification/recovery policy and delivery, signup enumeration policy, trusted-edge abuse controls, TLS/headers/CSP, backup/restore, and deployment/incident procedures are reviewed. These are deployment or future feature decisions; they do not silently enable unused library endpoints. Dependency advisories and the existing integration/browser suite should be checked on upgrades.

## Fixed Admin accounts

The owner-approved Admin extension adds a permanent account type and operator-only local account creation. Public signup cannot select a type; PostgreSQL rejects type changes. Admin API access requires a fresh active admin check. Admins may manage regular account metadata/status/sessions and read aggregate counts, operational health and audit identifiers. Personal domain endpoints still enforce ordinary ownership, including for Admin accounts. There is no impersonation, promotion/demotion or personal-record inspection API.

Suspension revokes all sessions, rejects further protected requests/login and prevents session creation/update at the database boundary. Domain write transactions recheck active status under a shared account lock. Reactivation requires a new login. Management effects, revisions, append-only audit records and idempotency receipts commit together. Read requests already in progress may finish. Admin account creation is restricted to local development/test databases; production provisioning remains outside this pass. See [Admin decisions](decisions/007-admin.md).

Admin account deletion is limited to regular User accounts and requires exact target-email confirmation, the current account revision and an idempotency key. Account deletion cascades its private data and login sessions. Admin accounts are protected. Audit identifiers survive deletion without retaining personal content; audit failure rolls back the deletion. Retry receipts belong to the acting Admin and survive target deletion.

## Browser security policy

HTML is rendered per request with fresh script nonces and private/no-store responses. The enforced CSP permits nonce-authorized scripts and trusted descendants, denies eval in production, blocks framing/objects and restricts connections/resources to the application. Inline styles remain allowed for Calendar positioning and measurement geometry. Browser Zod validation initializes without JIT before application schemas, avoiding even a caught eval probe. Production smoke tests assert fresh matching nonces, successful interaction, no uncaught errors and no CSP violations; the full account and workout journeys also run against the built web server. HTTPS/HSTS and forwarding behavior through the actual public edge remain deployment acceptance requirements.

## Portfolio repository review (2026-10-30)

This is a repository-hygiene review, separate from the earlier application audit. Public deployment is deferred. No repository visibility, remote history, credentials or publishing settings were changed.

- Pattern checks of versionable working-tree files and 2,104 locally reachable Git blobs across 22 commits found no matching private-key armor, supported provider-token patterns, non-placeholder environment secrets or non-local credential-bearing database URLs. No non-example environment file is tracked. The local `.env` and `.env.local` remain ignored and were not copied into presentation materials.
- This was a local heuristic scan, not a comprehensive secret-detection guarantee: it did not fetch remote refs, inspect unreachable/reflog objects, validate tokens with providers or inspect external infrastructure. A fresh independent secret scan before public visibility is still appropriate.
- One non-noreply email identity is present in existing commit author/committer metadata. The owner must decide whether that exposure is acceptable before publication. No email address is reproduced here and no history rewrite was performed.
- Ignore rules now cover environment variants while permitting safe `.env.example` templates, plus common private key/export/log files and Next build caches. The web template was previously hidden by its nested ignore rule; making it versionable fixes a clean-checkout onboarding gap without exposing the real environment.
- No compiled app/vendor bundle, dependency tree, database dump, real account export or private screenshot was found among tracked presentation assets. Portfolio screenshots use a unique synthetic account through the isolated local test API. They do not query development data or send external email.
- The existing MIT project license is retained. Current visual assets are a text-based project icon, UI placeholders and actual screenshots. Lucide/Feather notices are retained beside the screenshots; no rights are assumed for future illustrations. See [media provenance](media/README.md#provenance-and-licensing).
- The legacy local `db:seed` fixture does not establish email verification. It now works under the temporary development exception; the isolated capture harness remains the supported full synthetic showcase and uses verified sessions.

These findings support review of the local repository; they are not approval of public application hosting or a guarantee that every historical secret pattern has been detected.

The pnpm license-list command did not complete because local package-index metadata was missing. The fallback metadata review and its redistribution limits are recorded with the media provenance; it is not a blanket license-clearance claim.
