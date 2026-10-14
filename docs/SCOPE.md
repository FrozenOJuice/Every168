# Product scope

168Hours is a personal planning and tracking platform: **Calendar shows your life, domains provide depth, and AI connects the context between them.**

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

- Current foundation: Calendar and Fitness are the main-navigation destinations. The first Strength workflow covers reusable workouts, optional scheduling, set-by-set session logging, and review. The old Food and Exercise UI remains retired; Food backend capabilities and data are retained for later work. Keep Unscheduled and Routines for later Tasks decisions; Goals are deferred.

- Work toward three built-in workspaces around Calendar: Fitness, Food, and Tasks.
- Fitness covers workout planning, sessions, sets, reps, rest, and progress. Fitness is the product workspace name; the existing Exercise backend module supplies its canonical records and services.
- Food covers meals, nutrition, and food records; recipes are part of the future Food direction.
- Tasks helps users capture commitments, organize to-dos and projects, choose next actions, and follow progress. Projects organize tasks within this workspace; detailed workflows remain to be scoped.
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

- Help users plan, review, and make choices using relevant context across their own domains.
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

AI implementation details and the depth of recipe functionality will be scoped separately.

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
