# Product scope

**Current objective (2026-10-30):** local portfolio presentation through source, documentation and genuine synthetic-data captures. Public deployment is deferred. The default Calendar/Fitness scope and retained preview implementations are unchanged; the broader direction below is a roadmap, not a claim of implemented or hosted functionality.

Every168 currently connects Calendar planning and Fitness logging. The broader direction is **Calendar as a shared overview, specialized domains for depth, and optional future AI to connect context**; the AI capability is not implemented.

This document records the agreed direction and priority order. It describes future work as well as existing foundations; it does not authorize implementing every phase now. [FEATURES](FEATURES.md) lists what is currently available and what needs work. The [build specification](../168HOURS_BUILD_SPEC.md) retains the original Core requirements and technical constraints.

## Calendar: the shared overview

- See what is planned, happening, and already recorded across domains.
- Show scheduled activities as time blocks and point-in-time logs as moments.
- Open a domain record from Calendar to see or edit its details.
- Keep suggestions, accepted plans, activities in progress, and completed records distinct.
- Scheduling an activity does not mark it completed; suggesting a meal does not log it as eaten.
- Domain content without a date, such as a food library or project notes, stays in its domain rather than becoming a calendar item.
- The 168-hour week remains a useful planning and review frame within Day, Week, and Month views.

## Domains: useful experiences of their own

- First-release navigation contains Calendar and Fitness. Goals, Routines, Unscheduled plans, Calendar Templates, Tasks, Food, Assistant and Training Programs are deferred behind preview scope, with their code and data retained. The first Strength workflow covers reusable workouts, optional scheduling, set-by-set session logging, and review. The old Exercise UI remains retired; Everyday Food reuses the retained nutrition, hydration and body services. Preview Tasks includes reusable Routines; preview retains standalone Unscheduled plans and Goals.

- Work toward three built-in workspaces around Calendar: Fitness, Food, and Tasks.
- Fitness covers workout planning, sessions, sets, reps, rest, and progress. Fitness is the product workspace name; the existing Exercise backend module supplies its canonical records and services.
- Fitness uses Training, Exercises and History within the main column. Exercises owns library browsing and management, and details return to the retained Exercises context; workout editors retain their adjacent library. Workouts and programs are the starting point. Add exercise opens an inline picker and returns to the retained workout; last-session sets appear during preparation and training, with shared details/history opened in context. Recorded workouts and secondary weekly totals live in History. Food, Fitness and Tasks share the same full-height Day rail without domain title bars and a Day drawer on narrower screens. Calendar retains its full workspace. Exercise visuals remain placeholders, and scheduled activity stays in the shared Day panel.
- The authorized Fitness progress slice adds local-week summaries, per-exercise trends and sourced personal records, previous-session context while training, and comparisons between workouts with matching exercises and tracking types. It uses existing actual records and leaves automatic progression, cardio UI and advanced set types for later scope.
- The authorized general Fitness slice supports mixed activities in the shared workout/program flow, optional default and per-session intent tags, editable measurement presets, distance and laps with targets, recovery and progress. Intent never restricts measurements; a separate cardio workspace is not part of this slice.
- Training Programs is deferred from the first release; its implementation and data remain available in preview scope. The authorized Training Programs slice adds repeating ordered saved workouts, optional preferred weekdays, explicit next-workout scheduling/rescheduling, session-driven advancement, skipping, pause/resume, editing and history. Prepared snapshots stay independent; deleting a program preserves workouts and Calendar entries. Bulk future scheduling, periodization and automatic load/repetition progression remain outside this slice.
- Exercise management distinguishes curated read-only built-ins from user-owned custom definitions while using one workout/logging system. Built-ins support favourite, hide and duplicate; custom exercises support editing, duplication, archiving and safe deletion when unused. Preferences remain account-specific. A larger curated catalogue, primary/secondary muscle roles and illustration highlighting are later additions.
- Everyday Food covers a daily food log, private foods and favourites, reusable saved meals, basic recipes with ingredient amounts/instructions/yield, optional nutrition, quick and repeated entries, corrections/history, and water/weight review. Logging preserves independent snapshots. Meal planning, shopping lists, custom targets, broader trends, external lookup, barcodes, pantry and AI remain a later pass.
- Food, Fitness and Tasks share a reusable Calendar day panel: selected-day context, domain/All activities, shared Calendar styling and a responsive Day drawer. The selected day carries between these workspaces; each domain supplies its own source actions and actual plan links. This is the convention for future domain workspaces. Calendar itself keeps its full view without an extra domain panel; Settings, Admin and retained hidden pages are unchanged.
- Tasks helps users capture commitments, organize to-dos and projects, choose next actions, and follow progress. The authorized Everyday Tasks slice includes Inbox, standalone tasks/subtasks, optional deadlines/planned days, priorities/tags, projects/sections/order, completion/history, recurrence, multiple Calendar reservations and independently recorded actual time. Repeating tasks create one next occurrence on completion/skip and retain completed history. Existing Routines are accessible within Tasks. Boards, dependencies, attachments, collaboration, notifications, automatic scheduling and advanced reporting remain later work.
- A task represents something to complete; a Calendar block represents time allocated toward it. Scheduling or spending time on a task does not automatically complete it, and completing a task does not require scheduling it.
- An unscheduled plan is a scheduling state, not automatically a task. An unscheduled workout belongs in Fitness; an unscheduled meal belongs in Food. Tasks may surface actionable items across domains without taking ownership of their records.
- Keep detailed domain workflows in their own interfaces while sharing relevant activity with Calendar.
- Support logging during an activity, not just entering everything afterward. A workout should be one ongoing session that can be updated as sets are completed and finished when done.
- Make the built-in domains useful without AI.
- Additional built-in domains can be scoped individually; there is no commitment to build a specialized domain for every hobby.

### Possible direction as domains grow

- Treat domains as specialized workspaces with their own deeper navigation. Keep Calendar and the workspaces easy to reach from a stable main navigation.
- Allow substantial domain functionality when it serves the workspace's purpose. Fitness might grow into workout builders, exercise libraries, gym tools, and performance analysis; Food might grow into recipes, meal planning, nutrition, and groceries. These examples are possibilities, not implementation commitments.
- Keep specialized tools useful independently; not every feature or record needs to appear on Calendar.
- Show useful everyday workflows first and reveal advanced tools progressively.
- Share scheduling, search, quick actions, and consistent editing and undo behavior where applicable. Explore shared support for tasks, reminders, goals, progress, and future AI without forcing every domain into identical workflows.
- Keep one underlying record across surfaces. A workout shown in Fitness and Calendar is the same workout; changes must agree everywhere.
- Reorganize or split a workspace when users struggle to navigate it or understand what belongs there, rather than because it reaches a particular size.
- Keep this direction separate from implementation scope: no new navigation, shared subsystem, or advanced domain tool is authorized by these possibilities alone.

## AI: assistance across domains

- Help users plan, review, and make choices using relevant context across their own domains. Future Assistant operations should cover actions available to the authenticated user, including creating workouts/meals and scheduling, through canonical services and existing permissions.
- Ask follow-up questions when preferences, goals, equipment, availability, or other constraints are missing.
- Use relevant saved preferences, accepted plans, recorded activity, and prior decisions in later requests.
- Distinguish a conversational suggestion from a saved plan, an ongoing activity, or a completed record.
- Let users review suggestions and save useful results into the appropriate domain and Calendar.
- Use structured domain context and existing ownership rules; other accounts' private records are not part of a user's AI context.

Example flow:

1. Ask for a workout plan.
2. AI asks about goals, experience, equipment, schedule, and relevant constraints.
3. Review and save the plan to Fitness; scheduled sessions appear on Calendar.
4. Log the workout as it happens.
5. Later, ask for a recipe. AI can consider training context alongside dietary preferences and other relevant information, perhaps offering a higher-protein option.
6. Saving a recipe, planning a meal, and recording that it was eaten remain separate actions.

The owner-authorized interface preview provides a dedicated Assistant workspace and a compact global quick-chat popup, with a mobile bottom sheet. Both share the composer draft and explicitly attached page/date context, retained across navigation until changed. Open in Assistant continues in the dedicated area; a return link leads back to the captured workspace, respecting existing unsaved-change protection and workout recovery. Sending is disabled; the preview reads no records for AI and executes no actions. Drafts remain in account-scoped component memory while browsing and clear on reload. Actual AI integration, action previews/execution and the depth of recipe functionality will be scoped separately.

## Clients: natural use on each device

- Keep responsive web as the current foundation.
- Add dedicated mobile and desktop apps later, using the same account, backend, contracts, and domain rules.
- Adapt interactions to the device rather than requiring identical layouts everywhere.
- Mobile should support full everyday use, especially quick logging during activities such as workouts.
- Desktop should support planning, detailed management, and review.
- Treat a watch app as a stretch goal for small interactions such as timers, completing a set, or a quick log. Its exact scope remains undecided.

## Planned order

| Priority | Area                       | Direction                                                                      |
| -------- | -------------------------- | ------------------------------------------------------------------------------ |
| 1        | Core platform and Calendar | Accounts, settings, reliable planning, and shared activity visibility.         |
| 2        | Built-in domains           | Develop Fitness, Food, and Tasks, including logging activities as they happen. |
| 3        | Cross-domain AI            | Clarifying conversations and assistance informed by relevant domain context.   |
| 4        | Mobile and desktop apps    | Device-appropriate interfaces on the shared platform.                          |
| 5        | Custom domains             | Let users organize and track interests beyond the built-in domains.            |
| 6        | Watch app                  | Stretch goal, after custom domains.                                            |

Custom domains are deferred. Keep them in mind when designing shared Calendar integration and domain boundaries, but do not build their creation interface, configurable fields, or a generic tracking engine now. Fishing, knitting, and drawing are examples of possible later custom domains, not new built-in-domain commitments. Public domain sharing and a domain marketplace are not committed features.

## Architecture and scope boundaries

- One modular platform and shared backend; domains own their records and expose public services.
- Calendar composes relevant domain activity; AI and future clients reuse domain capabilities through defined interfaces.
- Keep business rules, calculations, ownership checks, and safe writes canonical in the backend rather than recreating them in each client or AI layer.
- Avoid building speculative infrastructure for every future domain or device.
- This roadmap supersedes the older weekly-planner-only framing and expansion ordering. Original Core exclusions still bound Core implementation; adding an item to this roadmap does not begin its implementation.
- Integrations, notification delivery, social features, billing, and other older expansion ideas require their own scope decisions.

### Workout creation preview

The owner is trialling a reversible draft-left/library-right layout for reusable workout creation and editing. Hide the Day panel in this workspace. Keep top-level Fitness tabs fixed above independently scrolling workout and library panes, with save actions pinned beneath workout content; mobile switches between Your workout and Add exercises. Compact controls set the set count and shared optional targets, with Advanced editor retaining individual targets and advanced fields. Existing data formats, draft recovery and save commands remain canonical. `workoutCreationExperiment` controls the trial; sessions retain their inline picker and Day panel.

### Independent Fitness measurements

The owner-authorized follow-up replaces fixed measurement presets with independent Reps, Load, Duration, Distance and Laps choices, requiring at least one. Apply to custom exercise defaults and workout/session snapshots; preserve hidden values, units, recovery, scheduling and history. Progress derives metrics from selected fields, with volume available whenever Reps and Load are both selected.

The owner-authorized per-set follow-up adds optional overrides that inherit exercise measurements by default, customisation/reset in preparation and training, preserved values and snapshots, and effective per-set reporting. It includes draft recovery and copying but no automatic progression or new measurement types.
