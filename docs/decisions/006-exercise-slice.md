# Exercise recording and history

The Exercise pass strengthens Core manual strength and cardio. It uses the existing Exercise services/repositories and Planning's public source-time service. No tables, dependencies, routine/program system, GPS, wearable adapters or training scores are added.

## Workout aggregate and safe writes

A workout remains one versioned aggregate. Saving locks the owned parent, validates each referenced exercise and child identifier, and replaces its ordered children in the same transaction as Calendar source time and the command receipt. An existing set may carry its ID; it must belong to the supplied workout exercise, within this user's locked workout. Duplicated or foreign IDs are rejected before persistence. Retained exercise/set IDs keep their creation timestamps and advance their revisions; omitted IDs mean new children. This prevents ordinary corrections from reordering or skipping paginated progress history.

Name snapshots continue rendering unchanged after renaming or archiving an exercise. Existing archived workout exercises remain editable, but adding an archived definition is rejected. Restore is owner scoped and requires the current definition revision. Library searches treat wildcard characters literally.

Progress uses completed sets in finished workouts only. Maximum recorded load and the bounded history page share a read-only repeatable-read transaction. Missing loads remain null. History pages use descending `(created_at, id)` ordering, labeled newest logged first. Workout histories filter by title/status; cardio histories filter by title/type. Existing owner/time indexes and page limits remain sufficient for Core.

## Recording workflow

Strength and Cardio remain the primary sections, with an exercise library and per-exercise progress. The workout coordinator handles the draft/save lifecycle; a separate picker handles library search and selection. Creating an exercise returns with it selected. Repeating a set copies measurements into an unchecked set; completion is explicit.

Workouts require explicit saves. Users may enter a real finish time for a past session or finish now. The editor captures any generated finish instant with the idempotency key, so a lost successful response retries the identical payload. Stale edits retain the draft. Clearing a completed workout's finish asks for confirmation before reopening and removing its source time. Cardio edits preserve the original timestamp's seconds when the minute-level control is unchanged. Duration validation accepts at least one second; short activities display seconds rather than zero minutes.

Unchanged saved strength/cardio timestamps remain editable during a repeated daylight-saving hour: the original instant disambiguates them. New or modified ambiguous/missing local times are rejected. Plan selection uses the validated local date without needing to resolve its time first.

Completed strength and all cardio activities create/update one source time entry, with or without a planned block. Reopening/deletion removes that entry transactionally; deleting a plan retains actual activity. Exercise writes invalidate all relevant Calendar caches, including history search. Units remain kg, metres and seconds at the API/database boundary.

The interface retains the exact palette, labeled inputs, native dialogs and shared retry/error handling. Set controls have explicit move/remove actions and 44px targets. The save bar stays above mobile navigation. Histories and pickers have loading, empty and recoverable error states. Phone/tablet verification uses Chromium emulation; physical-device Safari is still outside this pass.
