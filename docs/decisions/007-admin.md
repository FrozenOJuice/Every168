# Fixed Admin accounts

The owner authorized a first Admin slice: user management, aggregate statistics, operational health and an audit log. Account type is fixed at creation; no promotion/demotion, role editor, personal-record access, impersonation is included.

## Identity and authorization

`users.account_type` defaults to `user`. Public signup's strict contract rejects extra fields. The local interactive `pnpm admin:create` command creates a separate admin user and scrypt credential in one transaction, with an operator audit entry. It never converts an existing email, issues a session or prints a password. It is restricted to localhost development/test databases and refuses production. Password input is hidden and confirmed. Production provisioning is separate future work.

`/me` includes account type. Server rendering guards `/admin`; API authorization independently rereads the actor's current database state before every Admin request and locks it inside administrative transactions. Existing private endpoints remain scoped to the authenticated account, even for admins. Admin account metadata and aggregate counts are the explicitly authorized cross-account exceptions. Admins cannot suspend other admins or themselves through this surface.

Suspension stores a timestamp and revokes all sessions atomically. Suspended login performs the same password work and returns the same error as an unknown account. Protected requests check suspension; mutation transactions take a shared user lock and recheck it before effects or receipt replay. Session insertion/update takes the same shared lock, preventing new sessions from committing around a suspension. Already-running reads may finish. Reactivation permits a new login without restoring revoked sessions. Session revocation affects existing sessions; it does not prohibit future login.

Management revisions advance for suspension, reactivation and session revocation, independent of hourly activity updates. Required If-Match and owner-scoped idempotency receipts retain the existing retry contract. PostgreSQL enforces immutable account type, forbids suspended admins and maintains revisions. Ordinary account deletion still cascades its private data correctly.

## Persistence and cross-domain boundaries

Admin routes/services/repositories are in Identity, which owns users, sessions and the new `admin_audit` table. Audit records and write receipts commit with each management effect. PostgreSQL rejects audit updates/deletes. Actor/target UUIDs deliberately have no cascading foreign keys: records remain intelligible as identifiers after accounts are deleted. No names, emails, passwords, session tokens or journal data are copied into the audit log. The actor is null only for operator account creation.

User search selects only identity metadata, treats wildcard characters literally and supports exact account IDs. User and audit lists use bounded keyset pagination with millisecond creation timestamps. Domain usage returns aggregate record counts through Planning, Goals, Nutrition and Exercise public services; each domain keeps its own persistence. No cross-domain private repository/table access is added.

Statistics include all accounts, signup counts over a rolling seven days and active unsuspended accounts over seven/thirty days. Last-active is a successful login or protected API request, updated at most hourly. Usage counts stored planned blocks, food entries, goals, strength workouts (including drafts) and cardio. These are sampled counts, not a transactional analytics warehouse or health/nutrition summaries.

Health checks the database and reports the API package version, process uptime and process-local completed-request/server-error/aborted-request counters. Counters contain no identifiers/payloads and reset on restart. It is a point-in-time report, not durable monitoring. No jobs, dependencies or external services are added.

## Web

Account menu exposes Admin only for admin accounts. Overview, Users and Audit history share the existing responsive shell, semantic palette and accessible native confirmation dialogs. Search/filtering, pagination, loading/empty/read-error states, explicit management confirmation and retained uncertain-write retry keys are included. Personal-domain navigation is unchanged.

The owner subsequently authorized permanent deletion of regular User accounts. Admin accounts, including the acting Admin, are protected. The UI requires typing the target email, and the API validates it against the locked target along with If-Match. Deletion cascades private records and credentials/sessions; the immutable audit keeps only actor/target IDs, action and timestamp. Deletion, audit insertion and the acting Admin's retry receipt commit in one transaction. An identical retry succeeds after the target is gone; a fresh attempt returns 404. Failed audit insertion rolls back the account and all cascades.
