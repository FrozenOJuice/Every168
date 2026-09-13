# Calendar expansion

The owner authorized six additions after the first Calendar pass: drag editing, recurrence, copy/templates, date-only items, search/filter, and selected-date domain quick actions. Calendar remains the central general planner, with Day · Week · Month and Week as default. This adds no AI, provider integration, native app, notification delivery or background jobs.

## Persistence and ownership

Planning retains separate routes, application services and repositories. Every new private read, mutation and category/goal/parent reference is owner-scoped. Composite foreign keys, check constraints and immutable-owner/revision triggers reinforce the boundary. Mutations use the existing transaction and idempotency receipt, and edits/deletes require `If-Match`. Bulk operations commit all changes together or roll back. The web imports shared contracts and the API client, never database code.

`calendar_items` holds all-day or unscheduled plans. All-day dates are inclusive, with a maximum 31-day span. An unscheduled item may have a date or remain in the paginated undated list. These items never enter allocated/recorded-hour calculations. Scheduling an item creates a normal block and removes the original item in one versioned, retry-safe transaction.

## Finite repeating plans

`calendar_series` stores the rule, plan details, timezone and deleted dates. Daily/weekly rules have an explicit end, at most 366 local dates, and an interval from 1 to 52. Weekly intervals are anchored to the Monday of the first week. There is no infinite expansion worker.

Occurrences are materialized `time_blocks` with a series ID, immutable occurrence date and exception flag. Editing or dragging one changes that block only. Deleting one records an exclusion. Whole-series edits replace individual edits while retaining exclusions within the revised date range. Existing occurrence dates retain block IDs. Removed occurrences detach actual-time links; recorded activity keeps its original times. Whole-series deletion retains actual activity as well.

Series and individual mutations lock the parent before the occurrence. Child inserts/updates/deletes advance the series revision, so a concurrent one-occurrence edit and whole-series edit cannot silently overwrite each other. A rule's timezone stays fixed even if account preferences change. Missing clock times are skipped and reported; a repeated clock time uses its first occurrence. Durations represent elapsed time.

## Copying and templates

Copy and template capture include up to 100 plans whose **start date** falls within the selected day/week. Overnight plans copy in full. Undated items, actual entries, source identities and recurrence rules are excluded. Resulting blocks/items are independent plans. A week follows the account's preferred first day.

Copy previews show every proposed plan. A source fingerprint includes owner-scoped IDs/revisions, preferences and the source range; applying a stale preview returns the standard conflict error. Target plans are never overwritten. Local start times and elapsed durations are retained; missing destination clock times reject the whole action, while repeated times use the first occurrence.

Templates have owned parent rows and normalized entries with day offsets, local start minutes (including seconds/milliseconds), elapsed durations and ordinary category/goal foreign keys. They are captured from the calendar, renamed, deleted and applied through focused endpoints. Child changes advance the parent revision. Applying a template checks both its previewed revision and the account preferences revision, so timezone/week-start changes require another preview. To revise a routine's contents, edit a calendar day/week and capture a new template.

## Browser interactions and search

The pointer interaction provider owns previews, 15-minute snapping, Escape/pointer cancellation and edge auto-scroll. It writes only when a completed drag changes a plan. Desktop supports Day/Week moves and edge resizing, empty-time selections into drafts, and Month moves by date. Touch users enter an explicit adjustment mode through the block editor; ordinary gestures keep scrolling. Clock-change Day views retain ordered exact times and form editing. Keyboard users retain the same forms; dragging is always optional.

Optimistic geometry does not replace canonical server records. Failed confirmed writes leave the old plan visible; uncertain writes keep the original payload/key available for an explicit retry. Revision conflicts require reloading. Source actuals are edited in their domains.

Visible filters match title, type and category without changing API totals or linkage metadata. History search also accepts date bounds in the account timezone and uses a stable `(created_at, id, kind)` cursor across blocks, actuals and date-only items. Search text is literal, including SQL wildcard characters. Results remain owner-scoped and open ordinary editors.

Quick actions reuse Food, Cardio, Strength, Goals, water and weight forms with the selected local date. They require explicit submission and do not infer completion from planned blocks. Domain reporting panels remain outside Calendar.
