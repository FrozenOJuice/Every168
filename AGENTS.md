# Every168

Read the complete `168HOURS_BUILD_SPEC.md` and `docs/IMPLEMENTATION.md` before changes. Implement only authorized Core work; stop at its completion gate.

- Preserve user changes; do not commit, push, deploy, or seed production without explicit authorization.
- Owner preference: existing development/test application data is disposable. Prefer a clean reset over backfills, legacy compatibility, or helpers built to retain old data. Keep normal application integrity and user isolation correct.
- Keep Express routes thin, domain services canonical, persistence in module repositories, and cross-domain calls through public services.
- Scope every private read/write and reference lookup to the authenticated user. Never log personal records or credentials.
- Keep Next.js independent of API internals and Drizzle. Shared contracts define the wire boundary.
- Preserve unknown measurements, food snapshots, timezone-correct weeks, and unique activity time sources.
- Use the exact semantic palette from the spec and accessible responsive forms.
- Keep `docs/FEATURES.md` current as the owner's project-at-a-glance reference for the whole app, including Admin and new domains. Update concise, practical feature bullets in place when behavior changes. Put limitations, missing functionality, and owner-requested improvement notes under `Needs work` at the bottom of the relevant section or subsection, separate from current features; omit empty headings. Keep intentional behavior and authorization rules in the feature bullets; Needs work notes are not implementation commitments. When work is implemented, update the features and remove or revise the corresponding note. Preserve requested notes until addressed or withdrawn; notes alone do not authorize implementation. Do not turn this into a change log or link it from the README unless requested.
- Run relevant checks and record actual results in `docs/IMPLEMENTATION.md`.
- Order `docs/FEATURES.md` by the user's workflow, not implementation history: Account access first, Calendar immediately second as the main product experience, then settings, supporting planning features, daily logging, and review, with Admin/shared behavior last. Within sections, introduce setup and creation before editing, reuse, deletion, and review; keep `Needs work` notes at the bottom of their section.
