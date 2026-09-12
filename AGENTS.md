# 168Hours

Read the complete `168HOURS_BUILD_SPEC.md` and `docs/IMPLEMENTATION.md` before changes. Implement only authorized Core work; stop at its completion gate.

- Preserve user changes; do not commit, push, deploy, or seed production without explicit authorization.
- Keep Express routes thin, domain services canonical, persistence in module repositories, and cross-domain calls through public services.
- Scope every private read/write and reference lookup to the authenticated user. Never log personal records or credentials.
- Keep Next.js independent of API internals and Drizzle. Shared contracts define the wire boundary.
- Preserve unknown measurements, food snapshots, timezone-correct weeks, and unique activity time sources.
- Use the exact semantic palette from the spec and accessible responsive forms.
- Run relevant checks and record actual results in `docs/IMPLEMENTATION.md`.
