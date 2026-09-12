# Time accounting and durable history

Use Temporal for local weeks and input conversion. UTC arithmetic alone cannot represent a local week crossing a DST change. Preserve the familiar 168-hour concept while reporting actual calendar capacity and avoiding double-counted coverage.

A plan is never converted automatically into actual time. Explicit cardio records and completed strength workouts write one source entry, whether or not a plan was linked. This makes recorded exercise available in weekly review without duplicate entry. A plan link supplies category context. Source writes/deletes and exercise persistence occur in the same PostgreSQL transaction, backed by a partial unique index.

Workouts are saved as one aggregate with ordered exercise/set children. A locked parent makes replacement and time-accounting atomic. Supplied child IDs must belong to that workout; exercise names are preserved as snapshots. The web includes a required last-seen integer revision to reject stale overwrites, and warns before leaving unsaved work (see decision 003). Core uses explicit saves, without an offline or autosave subsystem.

Food logs preserve per-serving snapshots and quantity. Unknown nutrients remain null and aggregate with an explicit unknown count. An all-unknown total is unknown; a recorded zero remains zero. Repeating a historical food entry reuses its snapshot, including after definition archival.
