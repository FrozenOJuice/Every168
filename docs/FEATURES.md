# Features

The project at a glance: what each area has and what needs work. Keep descriptions short and update them as the app grows.

Scope: the whole app, including account access, settings, Calendar, Unscheduled plans, Routines, daily measurements, Fitness, Food and Tasks, Goals, and Admin. The [product scope](SCOPE.md) describes the direction and future phases; feature bullets below describe current functionality.

- Put Account access first and Calendar immediately after it as the main product experience. Follow with settings, supporting planning features, daily logging, and review. Keep Admin and shared behavior at the end.
- Within each section, introduce setup and creation before editing, reuse, deletion, and review. List current features and behavior in that order.
- Put limitations, missing functionality, and requested improvement notes under **Needs work** at the bottom of the relevant section or subsection. Keep them out of the available-feature bullets.
- Keep notes as short, specific bullets; omit empty Needs work headings. These notes describe gaps and limits for review, not commitments to implement everything listed.
- When an item is implemented, update the feature bullets and remove or revise its Needs work note.

The default first-release scope is Calendar and Fitness workouts/exercises. Goals, Routines, Unscheduled plans, Calendar Templates, Tasks, Training Programs, Food (including water/weight logging), legacy cardio entry points and Assistant are retained for later. Their entry points and direct pages are disabled, along with deferred domain APIs and Calendar contributions/actions. Existing Calendar reservations and recorded time remain intact. `RELEASE_SCOPE=preview` explicitly enables the retained features; the detailed Templates/Tasks/Training programs/Food/Assistant bullets below describe that preview scope.

## Account access

- Register with a name, email, and password, then verify email ownership before signing in. Signup never signs in automatically.
- Request a verification email or password reset without exposing whether an account exists. Recovery links expire and work once. Password resets revoke existing sessions.
- Change the password in Settings using the current password; successful changes sign out every session.
- Log in with email and password; show or hide the password while typing.
- Open Calendar after signing in.
- Stay signed in between visits while the session is valid.
- Sign out through the account menu.
- Each account has its own private data.

### Needs work

- Public email delivery needs an owner-configured Resend sender/key and real-inbox acceptance testing.

## Calendar

### Views and navigation

- Switch between Day, Week, and Month; Calendar opens in Week view by default.
- The calendar fills the available workspace beside the navigation sidebar.
- Add, Search, and Actions share the compact toolbar; selection controls do not take a separate row.
- Use the top-right arrows to move one day, week, or month at a time.
- Today returns to the current date in the active view.
- Switching views follows the selected date: a selected Month day opens its week or day; a selected Week time slice opens that day.
- Dates, times, and week boundaries follow account settings. Unchanged saved clock times retain their exact instants when editing across a repeated DST hour; newly entered ambiguous or missing times require correction.
- Calendar plan and manual-time writes retain their exact pending request in account-specific tab storage before sending. After refresh, Retry same change confirms the original request without creating a duplicate and restores its Undo action.
- Overflow lists support the same plan selection, editing, copy/paste, deletion, right-click actions, and undo/redo as the calendar, including mixed timed/all-day groups.

#### Day

- The heading above the grid shows the weekday and date and can be selected.
- The date button shows the full month, day, and year.
- Clicking the date opens a small calendar; hovering over another day outlines it.
- The activity list on the right shows plans and recorded activity for that day.
- Ongoing activity appears as Now, and the next upcoming item appears as Next.
- The Next plan card uses normal plan controls: click to select, double-click or press Enter to edit, and use copy/delete shortcuts or right-click actions.
- Earlier, Now, and Coming up show the complete timed activity list. The highlighted Next activity also remains in Coming up. Plan cards omit repeated standalone Planned labels; recorded activity retains its identifying details.
- If workout-completion lookup fails, the Day feed keeps its activity list and offers a retry while withholding unconfirmed Now/Next plan emphasis.
- Workout activity opens its Fitness session for review or correction. In preview scope, Food activity opens its local-date Food log. Retained cardio activity stays visible without links to the retired pages.
- A reservation whose linked scheduled workout is finished stays visible with Workout completed and keeps its planned time. It is omitted from Now/Next emphasis, allowing the next unfinished activity to take priority. Completion follows the linked session even when recorded time falls in another week; unrelated recorded time does not complete a workout reservation. This applies to Calendar and the shared domain Day panels.

#### Week

- Seven day columns show timed plans, with an all-day row above them.
- Click a day heading to select it; double-click or press Enter on a focused heading to open Day view.
- The date button shows the month and year.
- Clicking the date opens a calendar with the selected week highlighted as one range.
- Hovering over another week outlines the whole week.
- Overlapping plans appear beside each other; crowded days provide access to the remaining plans.

#### Month

- A plan crossing week boundaries has one command identity while its continuation remains visible on each date.
- The month grid fits the available screen area.
- Click a day cell to select it; double-click or press Enter on a focused cell to open Day view.
- Plans show their title on the left and start time on the right; long titles end in an ellipsis.
- Cells show up to four plans. With five or more, they show three and a “+N more” link; smaller layouts may show fewer.
- Clicking “+N more” opens Day view for that date.
- The date button opens a three-column, four-row month picker with year navigation.
- Hovering over another month outlines it.

#### Date dropdowns

- Open beneath the date button and shift inside narrow viewports to retain usable date targets.
- Close by choosing a date, clicking outside, or pressing Escape.

### Time grid and zoom

- Day and Week have a time grid running from 00:00 to 24:00.
- Drag the time column to expand or compress the spacing between hours.
- Zoom out far enough to fit the whole day; the grid cannot shrink beyond that fit.
- Time labels adapt to four-hour, two-hour, hourly, half-hour, or quarter-hour gaps.
- Selecting, creating, moving, and resizing still use five-minute increments at every zoom level.
- Double-click the time column or press R to reset to the default spacing.
- Day and Week share the saved zoom setting.
- Clock-change days use an ordered time list when a regular 24-hour grid would be misleading.

### Selection

#### Plans

- Click a timed or all-day plan to select it; it gets a filled selected color.
- Clicking another plan without a modifier replaces the selection.
- Shift-click selects the chronological range from the plan anchor, including plans between them.
- Timed and all-day plans can be selected together.
- ⌘-click / Ctrl-click adds or removes individual plans.
- Space selects the focused plan; Shift+Space selects its chronological range, and ⌘/Ctrl+Space adds or removes it. Enter opens the editor.
- The plan anchor is the most recent click or Space selection without Shift, including a ⌘/Ctrl toggle. Shift selection keeps that anchor.

#### Days

- In Day view, click the heading above the grid to select the day.
- In Week view, click a day heading; in Month view, click a day cell.
- The outline appears on mouse-down. Selected days get an outline; their plans do not individually get filled colors.
- In Week and Month, drag across days to select a continuous range.
- Shift-click selects the range from the day anchor to the clicked day.
- ⌘-click / Ctrl-click adds or removes individual days.
- The day anchor is an ordinary click or Space selection, the start of a drag, or an individual toggle when nothing was selected. Further individual toggles keep that anchor.
- Clearing the selection resets its anchor.
- Changing the viewed date or calendar view clears plan, day, and time-slice selections and their anchors.
- Escape clears the selection when no editor, menu, or drag is active.
- Plans removed from the loaded Calendar data leave the selection; a plan spanning several weeks still counts once.

#### Keyboard and touch access

- Tab enters the day headings/cells once, then arrow keys move between dates. Month Up/Down moves one week.
- Arrow navigation continues into adjacent dates, weeks, or months when reaching the visible edge.
- Space selects the focused day; Shift+Space extends from its anchor, and ⌘/Ctrl+Space toggles it. Shift+arrow extends within the displayed dates.
- The time grid keeps a Tab entry after selecting a day. Up/Down steps by five minutes; Left/Right moves to the same time on the adjacent day.
- Choose Actions → Select multiple to add or remove plans or days by tapping, without modifier keys. Actions → Done selecting returns to ordinary selection; plan and day groups stay separate.
- While Select multiple is active, taps toggle selection instead of dragging or double-tap editing/navigation.
- Actions opens the existing Calendar menu for the selected plans, time, or days, or the viewed day when nothing is selected. For several selected days, the earliest selected day is its paste destination.
- Actions remains available for selected plans hidden by the layout. Opening it preserves the selection, including a precise five-minute destination.
- The Actions control shows the selected count and marks when multiple selection is on. The same menu is available inside overflow lists.
- Copy, Paste, Delete, Undo, and Redo use the same operations as shortcuts and right-click menus.

#### Five-minute slices

- In Day and Week, click an empty five-minute slice to select a precise date and time.
- The selected slice remains highlighted for actions such as Add and Paste.
- Plan, day, and time-slice selections are separate. Selecting one clears the others, including when using modifiers.

### Plans

#### Creating timed plans

- Click an empty five-minute slice to select a date and time.
- Hovering shows the slice's time above it and a quick-action + at its right edge.
- Double-click an empty slice to open a new plan draft there.
- Drag across empty time to create a draft; its block changes size while dragging.
- Add in the top-left toolbar opens a menu with Add plan and enabled domain scheduling actions. Choose Add plan for a new draft.
- New plan drafts use the selected slice’s time, or the current hour on the selected/viewed date when no precise time is selected.
- Add and double-click drafts start with a one-hour duration; dragging sets the duration directly.
- Creation opens a compact, anchored form up to 380px wide, with tighter desktop spacing and touch-sized controls on phones. Labels sit above the title and timing fields. Date buttons use the shared calendar; start/end times use scrolling hour/minute controls. Moving Start preserves the chosen duration.
- The same creation form handles timed and all-day plans; switch modes with All day. Notes are directly available, with no More details or Other plans disclosure.
- Save and Cancel stay at the bottom while longer fields scroll; the heading remains visible. Save creates the plan, and Cancel, outside click or Escape cancels an idle unsaved draft. Pending/uncertain writes keep the form open with same-request retry.
- A click used to cancel the draft does not also select the calendar underneath it.
- Plans can overlap and continue past midnight.
- Passing a plan's scheduled time does not automatically record activity.

#### Scheduling from a domain

- Add → Schedule workout searches ready reusable workouts from Fitness, with further results available through Load more. Drafts are excluded; empty and failed searches provide guidance and retry.
- Scheduling carries the selected Calendar date and exact five-minute time into the shared Fitness scheduling form. Without a selected time, it rounds the current clock up to the next quarter hour on the viewed date. Review start/end, duration and workout notes before saving.
- Change workout returns to the retained search; changed timing requires discard confirmation. Scheduling uses Fitness’s normal validation and persistent same-request retry, creates one linked reservation with its own workout snapshot, and leaves the reusable workout and recorded sessions unchanged.
- Success returns to the reserved date in the current Calendar view with a toast. The reservation’s editor provides the normal Start/Continue workout or finished-summary action.
- Calendar shows scheduling actions only for registered, enabled sources. Fitness is the first supported domain; deferred domains add no empty menu options.

#### Editing and moving

- Double-click a plan, or press Enter when it is focused, to open the same compact 380px form layout as creation. The header and bottom Cancel/Save actions remain visible while longer content scrolls.
- Edit title, timing and directly visible notes using the shared Calendar date pickers and scrolling time controls. Moving Start preserves duration; changing End resizes it. Cancel leaves the stored plan unchanged, and pending/uncertain saves lock fields, header actions and dismissal until confirmed or retried.
- Toggle All day when editing to convert the existing plan, keeping its identity, title, and notes. Saving replaces its previous mode; cancelling leaves it unchanged.
- Turning off All day gives one continuous plan with editable start/end dates and times, including any nights between them.
- Turning on All day covers the dates occupied by the timed plan; an end exactly at midnight does not add another day.
- Mode changes support undo and redo as one action, with the same occurrence scopes for repeating plans.
- The header Plan actions menu contains precise calendar adjustment, Repeat, Duplicate and Delete plan as applicable; Escape closes the menu before the editor. Duplicate opens a separate draft with copied details and the next local date.
- Drag a timed block to another time or day, preserving its duration.
- Drag any plan in a selected group to move the whole group, including mixed timed/all-day selections. Dragging an unselected plan moves only that plan.
- Group moves preserve relative local dates, clock-time spacing, and each duration. All-day plans shift by dates and keep their type and span; a time-only move leaves their dates unchanged.
- A ghost remains at the original position while the moving block snaps to its destination.
- Group moves show previews and original ghosts for the selected plans. They save atomically and are one undo/redo action.
- The moving preview shows the title, time range, date, and Escape-to-cancel hint.
- Drag the top or bottom edge to resize a block; its height changes during the drag.
- Release to save a move or resize; press Escape to cancel.
- In Month view, moving a timed plan to another day preserves its clock time.
- The Plan actions menu also provides calendar move/resize controls for touch use; shared date/time fields provide precise entry.
- Resizing changes only the grabbed plan. Moving a group changes only selected repeating occurrences, leaving their series rules unchanged.
- Linked workout/task actions remain separate from saving the reservation. Linked recorded-time navigation sits in the scrolling form body; source-owned recorded activity remains read-only here and opens its own review workspace.

#### Small blocks

- Block height reflects the actual duration, including five-minute plans.
- Blocks too short for text hide it; hover, keyboard focus, or selection reveals their details.
- A 15-minute plan can show its title at default zoom; a five-minute plan can show it at maximum zoom.
- Double-click still opens the compact editor.
- Resize handles appear only when there is enough room.
- Zoom in or use the day's plan list when small adjacent blocks are difficult to target.

#### All-day plans

- Choose Add → Add plan and enable All day; the all-day row’s context menu also offers Add all-day plan.
- Use one date or a multi-day span.
- Day and Week show these in the All day row, with compact title-only blocks.
- Select and copy an all-day plan individually or together with timed plans.
- In Week and Month, drag an all-day plan between dates; grabbing a later day of a multi-day plan preserves its full span.
- Drag the left/start edge to change its first date, or the right/end edge to change its last date. The calendar updates during resizing; Escape cancels, and releasing saves.
- On touch screens, select the plan before dragging. The editor's date fields remain available in every view, including Day.
- Single repeating all-day adjustments offer the same occurrence scopes as timed adjustments. All-day moves and resizes support undo and redo.
- Create timed copy… under Actions opens a separate timed draft and keeps the original all-day plan.

- Before saving a timed plan as all-day, the editor explains that linked workout/activity associations are removed while recorded results and time remain. Undo restores the links; changing back to timed does not reconnect them.

#### Repeating plans

- Repeat timed or all-day plans daily or weekly, including custom intervals and selected weekdays. Creation offers Doesn’t repeat, Daily, Weekly and Custom choices, revealing weekdays, interval and end-date controls as needed.
- Add repetition while creating a plan, or choose Repeat from an existing plan's editor. The original plan becomes the first occurrence.
- Choose an end date and preview the occurrences before saving.
- An occurrence's editor shows its repeating schedule and provides Edit repeating rule.
- The compact rule editor uses shared date calendars and scrolling time controls, visible notes, account-ordered weekdays, and a fixed Cancel/Save footer. Time zone settings remain available separately.
- Stop repeating and scoped Delete actions live in the header menu; stopping opens a dedicated last-date form.
- Converting one occurrence keeps it in the series as an individual edit. Series changes preserve individually converted occurrences by default; Replace individual edits applies the series mode to them too.
- Editing, moving, resizing, or deleting one repeating plan offers This occurrence, This and following occurrences, or Entire series.
- This and following starts a separate series at the chosen occurrence; earlier occurrences keep their original rule.
- Series edits preserve other individually edited occurrences within the new date range by default. Choose Replace individual edits to apply the rule to them too.
- Deleted occurrences stay excluded when the rule changes.
- Stop repeating after a chosen date removes later occurrences and keeps earlier ones. A multi-day occurrence that starts on or before that date keeps its full span.
- Repeating all-day plans use calendar dates and preserve their one-day or multi-day spans across clock changes.
- Creating repetition, changing either series scope, stopping repetition, and deleting a series each support undo and redo as one action.

#### Unscheduled plans

- Manage unscheduled plans from their sidebar destination.
- Scheduling one places it on the calendar as a timed plan.
- A dated plan without a time can appear in the day's Any time area.

### Copy and paste

#### Copying

- Use ⌘C / Ctrl+C to copy selected plans or selected days.
- Copy one timed plan, one all-day plan, or a group containing either kind.
- Copy one day, a continuous range, or separate selected days.
- Day copying includes timed and all-day plans that start on those dates, not activity logs or plans carried over from an earlier date.
- In Day view, select the heading before copying the day.
- Copy stores a snapshot: later source edits, moves, or deletion do not change what gets pasted.
- The clipboard belongs to the current account and browser tab and survives a page refresh in that tab.

#### Pasting

- With plans selected, use ⌘C / Ctrl+C then ⌘V / Ctrl+V to duplicate them at their copied dates and times, including all-day plans and groups.
- Select a destination before pasting to place the copied plans elsewhere.
- Select a Day/Week heading or Month cell to keep the copied plans' original clock times.
- Select a five-minute slice in Day/Week to place a copied timed plan at that time.
- For a group of plans, a time-slice destination shifts the earliest timed plan to that time and preserves spacing between timed plans.
- Whole-day copies preserve clock times; all-day plans remain all-day.
- The earliest copied day is the date anchor. Gaps between days stay intact: Monday and Thursday pasted onto Tuesday become Tuesday and Friday.
- Copy in one view and paste in another, including several days pasted from Day view.
- Paste uses one destination anchor; it does not repeat the copy onto every selected destination day.
- Overlap is allowed, including overlap with the source plans.
- Pasted plans are independent; copying an occurrence does not copy its repeating rule.
- Paste happens immediately without a confirmation popup.
- A brief “Plans pasted” message offers Undo; the whole paste is one undo action.

### Right-click menus

- Right-click a timed or all-day plan for Edit, Duplicate, Copy, and Delete. A selected group offers Copy, Duplicate, and Delete.
- Selected groups offer Move… with the shared date calendar and time wheels. The earliest timed plan is named as the destination anchor; an all-day-only group uses its earliest date. Other selected plans retain their spacing and duration; only selected repeating occurrences move.
- Duplicate creates independent plans at the same dates and times without replacing the clipboard; the group is one undo action.
- Right-click empty Day/Week time for Add plan here or Paste here, snapped to five minutes.
- Plan menus also offer Paste here. In the Day/Week timed grid, use the five-minute time under the pointer, even over an occupied block; keyboard-opened menus use the focused plan’s start time. Month and all-day row targets use the clicked day and preserve copied clock times. Mixed groups retain their types and spacing; overlap is allowed.
- Right-click empty all-day space for Add all-day plan or Paste. Pasting preserves timed and all-day plan types.
- Right-click a day heading or Month cell for Open Day, Add plan, Copy day, and Paste into day. Open Day is omitted in Day view.
- Selected days offer Copy selected days and Paste. Paste uses the day invoked as its destination anchor, preserving relative dates and clock times.
- Right-clicking a selected plan or day preserves its group; an unselected plan or day becomes the sole selection, including in Select multiple mode. Empty-space menus preserve the existing selection.
- Right-click the time column for Reset zoom. Every menu ends with Undo and Redo; unavailable actions are disabled.
- Shift+F10 or the Context Menu key opens the menu beside the focused plan, day, time slot, or time column. Arrow keys navigate, Enter activates, and Escape closes and returns focus.
- Menus fit the viewport and close on outside interaction. Text fields retain their native browser menus.

### Deletion, undo and redo

- Delete / Backspace removes a selected timed or all-day plan without a confirmation alert.
- Delete a standalone all-day plan through its editor without confirmation; the same undo support applies.
- A single repeating plan asks which occurrence scope to delete.
- With several plans selected, Delete / Backspace removes the group, including mixed timed/all-day selections, as one undo action.
- Group deletion removes only the selected occurrences, even when they belong to repeating series.
- ⌘Z / Ctrl+Z undoes the latest supported action; repeat it to undo several actions in reverse order.
- ⌘⇧Z / Ctrl+Shift+Z or Ctrl+Y redoes the most recently undone Calendar plan action. Repeated shortcuts walk backward or forward through history.
- Plan undo/redo covers timed and all-day creation/duplication, edits, moving, resizing, deletion, individual/group copy-paste, group deletion, and whole repeating-series changes.
- Calendar plan history keeps the latest 100 actions per account and tab, across date/view changes, leaving and returning to Calendar, and page refreshes.
- A successful new action clears redo. Selection, navigation, copying, cancelled drafts, and failed requests keep it available.
- Redo restores the exact saved plans and their identities, independently of the clipboard. Each group action stays one history step.
- Sign-out clears history. Fresh browser visits start empty; history stays local to the tab.
- Conflicting newer changes stop undo/redo without advancing history. Interrupted history requests can be retried after refresh with the original request key.
- In preview scope, applying a template can be undone and redone as one action, including after a refresh in the same signed-in browser session.
- Creating, splitting, editing, stopping, or deleting repeating plans is one undo action. Undo restores previous rules, individual edits, and excluded dates; undoing conversion restores the original standalone plan.
- Fitness session records retain their actual start/finish range and one source link. Paused intervals are excluded from recorded-time and category totals, clipped to the viewed range; record details explain the exclusion.
- Activity created through Calendar forms can be undone, including food, water, weight, cardio, workout starts, and manually recorded time. Undo removes the original activity record as well as its Calendar entry.
- Undoing a paste removes all plans created by that paste; undoing a group deletion restores the group.
- Undoing plan changes preserves recorded activity when restoring or removing plans.

### Feedback messages

- Copying shows a brief confirmation using the shared app toast.
- Pasting, duplication, supported deletions, template application, and Calendar activity logging show a brief message with Undo.
- Undo remains available by keyboard after the message disappears.
- Missing selections and empty copies show guidance; failed actions show an error and offer retry where supported.

### Search and filters

- Search opens a compact panel; clicking outside or pressing Escape closes it.
- Search by title and filter by record type.
- Optionally limit history results with clearable From/Through date calendars; the collapsed date control summarizes the active range and opens when validation needs attention. Browse further results from calendar history.
- Apply filters to the visible calendar and clear them to show everything again.

### Templates and preview logging (preview scope)

- Templates is deferred from first release: its menu and read/write APIs are disabled, with existing templates and code retained. In preview scope, open Templates directly from Actions → Templates. All-day and repeating options live in Add → Add plan; there is no separate Calendar tools screen. Preview scope exposes Quick actions directly in Actions.
- Save a named template from a day, week, or date range using shared date calendars and compact forms with fixed bottom actions.
- Browse template cards with their day span; use their header menus to rename or delete.
- Choose a start date and number of cycles, then review plans grouped by date in a scrollable preview before applying. Back retains the chosen destination and cycles.
- Applying creates independent plans without replacing existing plans. Pending or uncertain writes prevent dismissal and offer retry with the same request.
- Preview-only Quick actions log water or weight using the chosen date/time; first-release scope hides these tools and the grid shortcut buttons.
- The + beside a five-minute slice also opens quick actions; it hides while creating a block by dragging.
- Point-in-time activity can appear as a moment without occupying a duration block.

### Keyboard shortcuts

| Shortcut                             | Action                                              |
| ------------------------------------ | --------------------------------------------------- |
| ⌘C / Ctrl+C                          | Copy selected plans or days                         |
| ⌘V / Ctrl+V                          | Paste at the selected destination                   |
| ⌘Z / Ctrl+Z                          | Undo the latest supported action                    |
| ⌘⇧Z / Ctrl+Shift+Z; Ctrl+Y           | Redo the latest undone Calendar plan action         |
| Delete / Backspace                   | Delete selected timed or all-day plans              |
| Enter on a plan                      | Open its editor                                     |
| Enter on a Week heading / Month cell | Open that date in Day view                          |
| Space on a day heading / Month cell  | Select that day                                     |
| Space on a plan                      | Select that plan                                    |
| Shift+Space                          | Extend the focused plan/day selection               |
| ⌘/Ctrl+Space                         | Add or remove the focused plan/day                  |
| Arrow keys on headings / Month cells | Move focus between dates                            |
| Up/Down on time grid                 | Select the previous/next five-minute slice          |
| Left/Right on time grid              | Select the same time on the adjacent day            |
| Escape                               | Cancel an active drag or dismiss an editor/dropdown |
| R                                    | Reset Day/Week time-grid zoom                       |
| Shift+F10 / Context Menu key         | Open actions for the focused Calendar target        |

Calendar shortcuts leave normal typing and text-field shortcuts available while editing fields.

### Needs work

- Activity logging retains current-Calendar-visit undo only; it is outside plan redo and persisted history.
- Current limits: all-day spans and template sources cover up to 31 days; repeating plans cover up to 366 local dates.
- Copy limit: up to 100 plans within a 31-day range. Template application allows up to 52 cycles, bounded by 100 plans and 366 days.
- External calendar sync and reminders are not available.

## Navigation and settings

- Main navigation contains Calendar and Fitness on desktop and mobile. Preview scope adds Tasks, Food and Assistant; their code and existing data remain intact while disabled.
- Food, Fitness and Tasks share the same full-height Calendar-style Day panel on the right, aligned to the top without a domain title bar. The panel shares Calendar’s 350px side-panel width and responsive date typography (20px on desktop, 18px at 700px and below, 13px at 360px and below). Drawers cap at the same width and fit narrower screens. The panel starts with one plain date button matching Calendar and has one full-width outlined Open Calendar navigation button in the footer, with a Calendar icon and forward arrow, without a separate Your day header or repeated date. Today uses Calendar’s shared outlined button style beside the domain/All activities filter. Two-letter weekdays distinguish Tuesday/Thursday and Saturday/Sunday; domain-only empty states name the domain. It includes date/week navigation, domain-only or All activities, next-plan emphasis and a same-date Calendar link. The selected day carries between these workspaces during navigation; explicit date URLs take precedence. At 1150px and below, Day opens the panel as a drawer. Calendar retains its full workspace.
- The shared Day activity list uses Calendar’s section headings, card typography, spacing and selection styling. Select a timed or all-day plan to reveal Actions for inline editing or deletion; double-click or Enter opens the same Calendar editor. Selection controls sit below the list without shifting cards or adding a separate divided section. Without a selection, available Undo/Redo controls replace the Actions menu and its label. Calendar Undo/Redo and repeating-occurrence scope choices work here too. Removing a reservation preserves reusable workouts and recorded activity; Undo restores the reservation and its links. Recorded activity opens its own domain record. Pending or uncertain changes block day/filter changes, navigation and drawer dismissal until confirmed or retried.
- Unscheduled and Goals remain accessible by URL outside main navigation. Reusable Routines remain accessible directly; preview scope also exposes them within Tasks.
- In preview scope, open the dedicated Assistant from navigation or use the floating Ask Assistant button. First-release scope mounts neither the Assistant provider nor its launcher.
- Open Settings through the account menu.
- Choose a timezone or use the device's timezone.
- Choose Sunday or Monday as the first day of the week.
- Choose weight (kg/lb), distance (m/km/yd/mi), and Fitness duration units (seconds, minutes, hours or minutes-and-seconds). These account defaults persist across devices.

### Categories

- Create and edit life categories in Settings, with a name and optional color.
- Archive categories; existing records keep their category.
- Assign categories to goals.

## Tasks

- Deferred from the first release. Tasks navigation, direct pages, task/project/schedule/time APIs and task-specific Calendar activity/actions are disabled in core scope. Code and data are retained; the workflows below remain available in preview scope. Existing Calendar reservations and recorded-time accounting remain intact, with task-sourced time read-only while its workspace is unavailable. Standalone Routines remain available.

### Capture and organize

- Open Tasks from main navigation. Inbox captures a task with only its title; moving it out of Inbox does not require a project. Quick capture in Today assigns the selected planned day, and capture within a project assigns that project.
- Use Inbox, Today, Upcoming, All tasks and Projects. Today includes unfinished tasks planned or due by the selected day and linked work on that day; overdue deadlines are labelled. Upcoming includes future deadlines/planned days and linked future work. The selected date carries between domain workspaces.
- Add notes, an optional due date, a separate planned work day, optional priority and tags. Tasks can stand alone or belong to a project/section. Add, edit, check, remove and reorder up to 100 subtasks.
- Search titles, notes and tags; filter active, completed, skipped or all statuses, priority, a tag and archived tasks. Projects provide their own task view. Task and project lists load additional pages on request.
- Edit, duplicate, move out of Inbox, mark In progress/To do, complete, reopen, archive and restore. Duplication creates an independent Inbox task with fresh unchecked subtasks and no recurrence, reservations or actual time.
- Delete a task with confirmation; its linked planned blocks and recorded task time are removed together. Completing a task keeps its reservations and does not invent actual time. Archived tasks remain available through filters.

### Projects

- Create a project with a name, optional description/target date and ordered named sections. Add standalone or existing tasks to it through the task editor; move tasks up/down within a section.
- Review canonical completed/total task counts. Explicitly complete, archive or reactivate a project independently of its task statuses. Archived/completed projects remain visible and editable.
- Remove a section to leave its tasks unsectioned. Delete a project with confirmation to retain its tasks as standalone tasks, including their Calendar links and history.

### Schedule and record work

- Reserve several Calendar work blocks for one task. A planned day and a due date remain separate from timed reservations. Scheduling and actual time logging keep task completion independent.
- Open a reservation in Calendar to move or edit it; Calendar offers Open task. Calendar deletion removes the reservation link, and undo restores unchanged links. Task-only Day activity includes genuinely linked blocks, dated tasks, completion moments and actual task time; All activities shows the broader day.
- Dated unfinished tasks appear in Calendar Day's Any time list with planned/due context. Week and Month indicate dated tasks alongside moments. Completing/skipping a task records a completion moment with no duration.
- Log actual start/end times with optional notes; correct or delete records afterward. Each record contributes exactly one task-time ledger entry. Calendar and the Day panel open the canonical task for review. Local-time input follows account timezone and rejects ambiguous/nonexistent times; unchanged saved instants are retained during corrections.
- Forms retain input on errors, protect unsaved edits, reject stale writes and reuse the same request key after an uncertain response. Pending/uncertain changes block dismissal.

### Repetition and reusable checklists

- Repeat daily, weekly or monthly, with an optional inclusive end date. Completing or skipping the current occurrence creates its next task with fresh unchecked subtasks. Monthly recurrence retains its original day, clamping shorter months and returning to that day afterward.
- Edit just an occurrence or apply its template/repetition changes to future occurrences. Completed/skipped history remains independent. Reopening an old occurrence never creates a second successor. Archive or delete a current occurrence to stop working on it; use Skip to advance instead.
- Open existing Routines inside Tasks for reusable ordered checklists, saved progress and completion counts. These remain distinct from dated task occurrences and do not fabricate timed activity.

### Needs work

- Pending task-detail actions can be dismissed while the request is still running. Extend shared busy protection to detail actions, list completion/reordering and project deletion, rather than only form saves.
- Task details need clearer action hierarchy, readable status labels and directly usable subtasks. The current modal presents most management actions as equal-weight buttons; scheduling/time forms still use older native date/time controls.
- Before enabling Tasks publicly: pending task/project saves, quick capture, scheduling and time-entry commands retain their retry key only while mounted, not across refresh. Task dialogs block in-app navigation while form saves are pending; refresh recovery still needs alignment with Fitness.
- Task time-entry validation reports a general error without marking or focusing the affected field; it still needs a consistency/accessibility pass alongside the newer Fitness forms.
- Forms use explicit saves without unsaved-draft recovery after refresh. Boards, dependencies, attachments, collaboration, notifications, automatic scheduling, live timers and advanced reporting are outside this pass.
- One next repeating occurrence is generated when the current one is completed or skipped; future occurrences are not bulk-created in Calendar. A task supports up to 100 reservations and 200 actual-time records, and projects up to 50 sections.

## Goals

- Create and edit a goal with a title, optional description, target date, and category.
- Set its status to Active, Completed, Paused, or Archived.
- Browse goals by status and load more results.
- Complete a goal directly from its card; reopen a completed goal as active.
- Cards show the goal's status, description, and target date when provided.

### Needs work

- Goals are deferred and absent from main navigation.
- Numeric targets, milestones, and automatic completion are not available.

## Unscheduled plans

- Keep plans in a separate list at `/unscheduled` until they have a scheduled time.
- Create and edit a title, notes, and optional date.
- Leave the date blank to keep a plan in the backlog; dated plans can appear in Calendar without occupying timed space.
- Schedule a plan by choosing its date and start/end times.
- Scheduling replaces the unscheduled item with a timed block and opens that date in Day view.
- Delete an unscheduled plan through its editor, with confirmation.
- Load more items when the list has additional results.

- Unscheduled Calendar plans remain separate from tasks; creating a task does not convert a retained plan.

## Routines

- Open reusable Routines within Tasks or at the retained `/routines` URL.
- Create a named routine with an ordered checklist.
- Edit the name and steps; add, remove, or move steps up and down.
- Check and uncheck steps; progress is saved between visits.
- See the number of checked steps and how many times the routine has been completed.
- Finish routine becomes available when every step is checked.
- Finishing increments the completion count and clears the checklist for its next use.
- Editing steps restarts the current checklist while keeping the completion count.
- Delete a routine with confirmation.

### Needs work

- Checklists support up to 50 steps.
- Completing a routine does not create Calendar blocks or record a timed session.

## Daily measurements

- Deferred with Food for the first release. The following logging features are available in preview scope.
- Log water or weight through Calendar quick actions, with a date and time.
- Measurement logs appear as Calendar moments without allocating time.

## Fitness

- Use Weight throughout measurement selectors, target/result fields, summaries, recorded-set tables, personal records, validation and unit settings. Internal measurement identifiers remain unchanged.

### Workspace

- Fitness has no toolbar Units button. Choose account-wide weight, distance and duration defaults in Settings; individual measurement fields keep their own unit selectors. Values convert for display without rewriting workouts or discarding recovered edits. Converted duration inputs use up to three decimal places, retaining significant digits for very small nonzero amounts. Explicitly typed precision remains visible and unchanged; display rounding never rewrites the stored seconds. Rest timers and whole-session elapsed time retain clock formatting.
- My workouts initially shows six saved workouts on wider screens and four at browser widths of 900px and below; Load more workouts appends another page of the same size, and search covers all saved workout titles. Failed pagination or background refresh keeps loaded workout cards visible with an inline retry; retrying pagination appends the missing page without duplicating cards.
- Fitness has Training, Exercises and History tabs in that order, with active-state navigation retained through exercise details. Training contains active sessions and saved workouts (plus deferred programs in preview scope). Exercises at `/fitness/exercises` owns the searchable library, favourites/hidden filters, custom exercise creation and management; the library is no longer appended beneath My workouts. History contains recorded sessions and permanent weekly totals. All three tabs fit alongside Day at 320px; the old in-page Jump to menu is removed. The shared Day panel remains available across ordinary Fitness views, while the shared workout editor uses the adjacent exercise library.
- Exercise details retain the Summary, Live workout, workout editor or Exercises library that opened them. Following a different source workout returns through the same exercise to that original parent; opening a workout or exercise already in the current path returns to its existing visit. Contextual Back controls and browser Back/Forward avoid stacked copies of the same screens. Same-tab refresh retains this account’s return path and editor mode. History/library filters, loaded results, scroll, the exact opening control and recoverable workout drafts return with the view; new interaction takes priority over delayed position restoration. Direct links use safe Fitness return destinations.
- Fitness-only Day activity includes genuinely linked scheduled workouts and recorded workout/exercise activity. All activities also shows Calendar plans and other domains. Planned activities use Calendar’s selection, inline editor and delete/Undo actions without leaving Fitness; recorded workouts open their session, with unsaved-change protection before leaving.
- Create/edit a reusable workout or start training in the main area, replacing its default content. Clicking an exercise card opens details. While a workout is open, a separate, always-visible Add to workout button sits below the equipment/muscle information; adding does not open details or hide that information. Exercises can also be added from details, each with an unfinished set. Titles, notes, ordered exercises and targets remain in place.
- In the workout editor, exercise names and their chevrons expand/collapse the card; a separate Exercise details info control opens the shared reference pane. It uses the updated details-page toolbar, title, compact illustration, equipment/muscle facts and instructions, with Favourite beside the return action. All exercise details use the updated layout without Details/History tabs. Creator references omit inline recall. Personal records and the always-visible Reps by weight list follow the exercise information, reusing the main page’s calculations, labels and source-workout links. Narrow panes stack record cards. Reps by weight uses one three-column header with aligned weight/best reps/all-time totals, followed by a labelled Best reps achieved source button in each row; Latest session and All sessions appear on the main details page and Live exercise details. Desktop retains the workout beside the pane. On phones the reference replaces the workout view and hides the extra creator navigation/switcher while open. Back to workout or Escape restores the originating card, workout scroll and focus without losing edits. References opened from library cards return to the library, and their Add action returns to the retained workout. Failed reads retain a return action and retry.
- Create/edit exercises from Exercises or the inline workout picker. Creating while building or training adds the exercise and returns to the workout. Cancelling or closing a dirty exercise form asks before discarding its changes.
- During workout creation/editing, Back to Fitness sits at the upper left (Back to exercise when entered from exercise details), with the ⋯ Workout actions menu at the upper right when available. Creation and editing keep their page heading screen-reader-only. Leaving with changes offers Keep editing, Discard or Save draft in the same shared confirmation style used for recorded-result corrections.
- During workout creation/editing, Training, Exercises and History stay fixed above independent workout and library scroll panes. The workout heading, title, notes and exercises scroll together above pinned Save draft and Save workout actions; scrolling either pane does not move the page.
- Sets can be cleared while typing; leaving the field blank restores one set. Changing Basic set counts preserves shared targets/rest and stays in Basic; newly introduced rest gaps inherit the shared setting. A single set retains that setting for later expansion while its rest control is disabled. Basic/Advanced editor switching is instant. Only expanding/collapsing the whole exercise animates, with reduced-motion preferences respected.
- Workout target cards place Advanced editor in the exercise header before Collapse and Delete. Desktop shows its label; narrow screens use a sliders icon with the shared tooltip. The control stays available on collapsed cards and opens the exercise when used. Intent tags sit at the bottom of the expanded card. Measurement choices use compact toggle chips with checkmarks for selected fields and no repeated selection helper text. Sets and targets remain grouped beneath a distinct exercise header. Advanced editor and Reset to basic use the same white fill, neutral border and sliders icon at rest; the label identifies the action rather than a selected-mode highlight. Rest and notes share full-width outlined disclosures, with their arrows at the far right in both states. Both expand into fields with integrated headers.
- An empty workout directs you to choose exercises from the library. The Add exercise button is omitted when the library is visible beside the editor; smaller layouts retain it to open the library, alongside the Add exercises view switcher. This applies to creating and editing workouts.
- Workout creation/editing currently uses a reversible layout experiment: the Day panel is hidden, the wider draft stays in the middle beside app navigation and the library uses two columns within a narrower right pane on desktop. On smaller screens, the editor Back control sits above the Your workout/Add exercises switcher and remains available in either view. Spacing keeps setup close to those controls. Both views retain their state. Sessions retain the inline picker and Day panel. Search/filters and workout recovery remain available.
- Scheduled workouts are shown in the shared Calendar day panel; Training keeps its focus on saved workouts and programs.

### Exercise library

- The Exercises tab contains the exercise library, with responsive cards, search and filters. Create exercise uses the primary green plus-icon button on Exercises and an outlined white button inside workout editors; Create workout remains the primary action in Training. Search and filter controls share one row when the library has room, and wrap on narrow screens. Search, filters and sorting reset when navigating to another workout or Fitness page, except that opening exercise details from Exercises and returning preserves the library search, filters, scroll position and card focus. Reopening the picker or exercise help within the same workout also preserves its filters. Its cards scroll with the page rather than inside a separate scroll area. Workout builders and sessions open it only when adding an exercise. Workout and exercise forms keep scrolling fields and fixed actions; the shared Day rail stays independent on the right.
- While search, equipment/muscle filters, Favourites or Hidden are active, the matching exercise count appears in muted text beside Clear all. It hides when no filters are active; the library heading and space above the cards stay clear.
- Exercise details keep Back to Exercises and management actions in one row. On desktop, Add to workout sits beside the illustration below the name/facts; on smaller screens it fills the width beneath them. Its chooser spans the overview below both columns, focuses search when opened and closes with Escape back to the trigger without leaving the exercise. Instructions appear when present; an unspecified equipment field uses plain secondary text. Workout-context details keep their existing selection flow.
- Browse 16 built-in strength exercises with equipment, muscle groups, short instructions, and visual placeholders. Cards emphasize the exercise name, show equipment beneath it, and show as many muscle tags as fit on one line, with a +N count for the remainder; details show all muscles. Long card names and equipment lists use at most two lines, with full text available on hover; custom labels remain visible. Desktop cards reserve a shallow illustration area above the text. On phones, full-width rows put a small thumbnail beside the text; illustrations remain placeholders until assets are ready.
- In the Filters panel, a compact dropdown without search controls sorting; in the desktop library panel it sits below Equipment and Muscle group. Sort built-in and custom exercises together by Name A–Z (default), Name Z–A, or Recently added. Show more exercises extends a stable sorted prefix: built-ins join when their position is reached, with equal-name boundary groups deferred until complete. Recently added shows paginated custom exercises before built-ins. Recently added puts newest custom exercises first, then built-ins alphabetically; favouriting or hiding a built-in does not change its order. Sorting applies alongside filters, and Clear all preserves the chosen sort.
- The library toolbar contains Search, Favourites, Hidden, then Filters. On very narrow phones, Search uses its own full-width row. Hidden uses the same outlined styling, text color and green active state as the other filter buttons, with a visible label and tooltip; Favourites uses an icon on narrow screens in the main library. The workout creator keeps the Favourites label visible beside Filters on desktop and phones. Hidden is a main-library management view and is omitted when choosing exercises for a workout. Hidden switches to hidden built-ins and archived custom exercises, with a visible explanation of that scope; one visibility filter covers both.
- Filters slides open and closed below the toolbar; reduced-motion settings disable the animation. Equipment and Muscle group search fields share the panel width equally. A list of full-width option rows floats below the active field without enlarging the panel; click anywhere on a row to toggle it, and selected rows show a checkmark. Options hide when focus leaves the group, and only the option list scrolls. Arrow keys navigate options; Home/End move to the first/last option. Escape first closes options and returns to search, then closes Filters on a second press.
- Results update immediately, matching any selected option within each group and combining equipment with muscles. Selected equipment and muscle filters appear as removable chips below the panel and remain below the toolbar when it closes; all tags share one horizontally scrollable row, so muscle tags never wrap below equipment. The scrollbar is hidden; an edge fade indicates more tags offscreen, and touch, trackpad and keyboard scrolling remain available. One Clear all button stays fixed at the right and vertically centered with the tags; it resets filters, visibility, favourites and exercise search. The Filters badge counts equipment and muscle choices; Favourites and Hidden show their active state only on their toolbar buttons, without removable tags.
- Empty states distinguish no favourites, no hidden/archived exercises, no hidden favourites and no search/filter matches, with guidance for each. An incomplete page does not claim the entire library is empty. Failed later pages keep loaded cards visible and show Retry loading exercises beside pagination; retry extends the same sorted results. Background refresh errors also preserve available cards.
- Filters stays open while browsing results. Click Filters again or press Escape from the panel to close it; Escape returns focus to the Filters button. Filtering works for built-in and custom exercises alike.
- Favourite or unfavourite an exercise from its details or the always-visible star at the top-right of its card. Stars are outlined until favourited and filled when favourited. Successful saves immediately update the details star and exercise revision for subsequent edits. Hover/focus adds a subtle tinted background; keyboard navigation retains visible focus. Clicking the star does not open details. Starred exercises appear in the Favourites filter, including when choosing exercises for a workout. Favourites are private, persist across refreshes, and retain their status when hidden, shown, archived or restored.
- From Exercises, selecting an exercise opens a dedicated, directly linkable details page with Back to Exercises at the upper left. The top row aligns Back to Exercises on the left with the favourite star and Exercise actions menu on the right. On wide layouts the illustration sits left of the exercise name, equipment and muscles; narrow layouts put the name above the illustration and equipment/muscles below. Instructions and Your history follow. Add to workout is a normal-width, left-aligned primary button on desktop and full-width on phones. The ⋯ Exercise actions menu toggles closed on a second trigger click and supports keyboard opening and Escape with focus return. It sits beside the favourite star and contains Duplicate exercise and Hide from library (or Show in library); custom exercises also offer Edit exercise, Archive/Restore exercise and eligible Delete exercise. Built-ins can be viewed without importing them. Custom exercises retain editing, duplication, archive/restore and eligible deletion. Back to Exercises or browser Back restores the library search, filters, loaded results, scroll and source focus during the current visit. While building or logging a workout, details remain in the adjacent pane or the temporary phone view, with the workout retained.
- Add to workout expands an inline chooser beneath the button with selectable saved workouts and a separate Create new workout action. Nothing is preselected. Search all saved workout titles using the same search field as My workouts, with independent search text. The results use two columns when the chooser has room and one column on phones, scrolling within a bounded list; Add, Create new workout and Cancel remain outside it. Create new workout and Cancel are equal-width outlined buttons beneath the full-width primary Add action. Selection persists across searches and pagination. Confirm Add to [workout] to save one blank set and stay on exercise details, with a success toast naming the exercise and destination and an Edit workout action. The toast lasts eight seconds of unpaused time; hover or keyboard focus pauses dismissal. Cancel or a completed addition returns focus to Add to workout. Editing opens and focuses the added exercise, including when the same exercise appears more than once. Create new workout opens an unsaved creator with the exercise included. Both paths use Back to exercise; leaving unsaved edits retains Keep editing, Discard and Save draft. Pending or uncertain additions block dismissal and navigation; Retry same change reuses the exact update and revision to avoid duplicate additions.
- Browsing does not create personal records. Favourites and built-in visibility are private account preferences, separate from exercise definitions.

### Built-in and custom exercises

- Built-ins are curated, read-only definitions. Favourite, Hide, or Duplicate them; their core names, instructions, equipment and muscles cannot be edited or permanently deleted.
- Hide removes a built-in from the active library without affecting saved workouts, logging or history. Find it using Hidden and choose Show in library to restore visibility.
- Create a private custom exercise with a name, selected measurements, optional instructions, optional equipment/muscles, and a Favourite star beside the Create/Edit heading. Measurements explain per-set tracking, workout overrides and the requirement to keep one selected. Search fields stay above removable selected chips; arrows/Enter select options, Escape/outside click closes them. Removing a chip keeps the dropdown closed instead of returning pointer focus to search. Keyboard removal focuses another chip, or the closed search field when none remain. Nearby blank-space clicks dismiss and release search focus in one click.
- Create/Edit exercise puts the name first, Equipment and Muscles worked side by side on wider screens, and a visible compact Instructions (optional) textarea that can be resized. Cancel and Create exercise/Save changes stay fixed below the scrolling fields.
- Field validation explains problems beside the affected input and focuses it. Cancel leaves unchanged exercises directly; changed forms use the shared Keep editing/Discard changes confirmation. Unsaved edits use the shared styled discard confirmation for in-app navigation; pending/uncertain saves block in-app dismissal/navigation. Refresh and tab closing do not trigger native browser warnings; same-tab recovery remains available. An account- and route-scoped same-tab receipt restores an interrupted creator/editor after refresh with its original values, captured revision and request key; Retry same change confirms the original write without duplicate creation. Storage failure prevents sending the write. Successful creation shows Exercise created, or Created and added to workout when added successfully; failed workout additions are identified separately.
- Choose any combination of Reps, Weight, Duration, Distance and Laps independently, with at least one selected. Custom exercises choose default measurements in Create/Edit; built-ins have curated defaults. These measurements do not impose strength/cardio categories.
- Exercise forms, details and workout editors omit Intent tags. Previously stored tags remain intact when editing, copying or reusing exercises and workouts.
- Create a custom exercise in the main area while preparing or recording a workout; the action says Create and add to workout and uses the existing addition/limit checks. Custom cards and details have a small Custom label; there is no fixed library-count cap.
- Duplicate either type opens a prefilled Create exercise form. Create exercise saves the independent custom copy; Cancel creates nothing and returns to the source. Copies retain the definition, but start active and unfavourited, with no copied workout history or progress. Built-in originals stay unchanged. Interrupted copy saves use the creator’s same-tab recovery and same-request retry.
- Edit custom definitions, or Archive/Restore them. Hide/Show and Archive/Restore confirm success with a named toast and Undo; Undo uses the confirmed revision and leaves saved workouts/history intact. Pending or uncertain detail actions and favourites block in-app navigation until confirmed or retried. Past sessions retain their recorded exercise names and results. Restore archived custom exercises before adding them to new workouts or reusing workouts that contain them; hidden built-ins remain usable.
- Permanently delete a custom exercise only when no saved/scheduled workout or recorded workout references it. Used exercises show unavailable Delete with a visible explanation and Archive guidance; built-ins never offer permanent deletion.
- Both types use the same workout, set logging, exercise history and progress systems.

### Prepare and schedule

- An empty workout shows a compact instruction to add exercises from the library, without a drop-zone border. The Workout name field starts blank without placeholder text.
- Create reusable workouts mixing activities such as lifting, running, swimming and cycling, with a title, ordered exercises and exercise notes. Workout and exercise notes share the same full-width outlined disclosure as Rest, with a right-aligned chevron and a filled indicator when text exists. Expanded notes form one bordered field with the disclosure built into its header. Empty notes start collapsed; saved notes open when editing. Collapsing keeps the text; clear the field to remove a note.
- Creation/editing uses Back to Fitness (or Back to exercise when entered from details). The exercise list scrolls while Save draft and Save workout stay at the bottom. The footer uses button labels only; the saved card’s Draft/Continue editing or Start/Schedule state distinguishes the result. Desktop uses the adjacent library directly; phones switch between Your workout and Add exercises. Basic target fields wrap on phones, with unit-bearing measurements on full rows so the value remains readable. At very narrow widths, exercise controls use a separate row beneath the name.
- Save draft keeps an incomplete workout in My workouts with a small Draft status at the top right beside the workout name and one full-width Continue editing action. Draft cards use a thin dashed border with normal colors, opacity and name/preview styling and stay in My workouts. Drafts may have no exercises; each exercise in the editor keeps at least one set. Unnamed drafts use Untitled workout. Saved drafts survive refresh and can be edited or deleted.
- Save workout requires a title, at least one exercise and at least one set per exercise. It makes a draft ready to start or schedule; drafts cannot do either. Saving an existing workout as a draft makes that reusable workout unavailable for starting/scheduling until ready again, without changing its scheduled copies or recorded sessions.
- My workouts uses an adaptive grid with a 220px minimum card width: columns fit the available main pane and share the remaining width evenly, avoiding an unused strip at the right. Cards fill one column at browser widths of 600px and below. All workout cards use a more visible thin border, solid for ready workouts and longer, more widely spaced dashes for drafts. Cards show the title and exercise count without total sets, followed by a plain bulleted preview of the first four exercises. A quiet, noninteractive +N more summary indicates the remaining exercises; cards do not expand. Edit opens the complete workout. My workouts initially loads up to six cards above 900px and four at 900px and below, with an outlined Load more workouts button for additional pages. Search spans the full section width. The outlined pagination button stays centered without an icon on desktop and phones, shows Loading workouts… and is disabled while fetching; new cards append without an explicit scroll jump. Long names wrap without a cutoff or inner scroller. Equal-width Edit and Schedule actions sit above a full-width primary Start/Continue workout action at the bottom. Draft and ready cards share the same height within each row. Drafts show their status with a full-width primary Continue editing action.
- Search My workouts by title across all saved workouts, including drafts and results beyond the loaded cards. Search is case-insensitive, treats punctuation literally and retains normal result pagination. Empty searches show all workouts; unmatched searches show a clear empty state.
- Unsaved workout creation/editing recovers automatically after navigation or refresh in the same browser tab, separately for each account and workout. Incomplete and invalid entries are retained. A brief Draft restored toast offers Discard; expiry or dismissal keeps the edits. Discard recovered changes remains under Workout actions afterward. Save or Discard clears recovery; Save draft/Save workout still saves to your account. Pending saves retain the original payload, revision and request key across refresh; Retry same change confirms the same operation without creating a duplicate or applying an update twice.
- If recovered edits conflict with a newer saved workout, save them as a new draft or discard them to load the latest; recovery never silently overwrites it. If browser storage is unavailable, saving is blocked before sending and the editor asks you to keep the page open and restore storage.
- Cancel leaves unchanged forms immediately. Unsaved changes open a compact confirmation with Keep editing, Discard and a primary Save draft action. Desktop keeps the choices in one row; phones give Save draft its own full-width row. Discarding edits preserves the previously saved workout or draft.
- Creating a workout, editing a saved workout and editing an active session use one shared editor: the same back navigation, name field, Notes control, exercise heading/Add exercise action, cards, library layout and pinned footer. No visible Create/Edit workout title repeats the form's purpose; the page heading remains available to screen readers. Saved workouts use Save draft / Save workout; sessions add collapsed Adjust start time, rest feedback and autosave actions, with Back to workout and session-only changes.
- Workout validation appears beside the title, notes, exercise list or affected set field. Save focuses the first problem and opens collapsed cards/timing fields when needed. Incomplete drafts remain supported; invalid entered values must be corrected.
- Opening Edit on an existing workout starts all exercise cards collapsed, including advanced exercises and recovered edits. Newly added exercises start expanded for setting targets, using compact cards with a six-dot handle, a name/chevron button plus a clickable header background and summary that expand or collapse the card, a separate Exercise details info control, and a visible remove button. Advanced editor and Reset to basic share a fixed button width so switching modes keeps the header stable; phones retain the compact icon button. Collapsed cards show only the exercise header, with help, editor controls, reordering and removal still available; expanding restores entered values. In the set editor, Add set is a left-aligned outlined white plus-icon button directly beneath the set rows, before the divider for Notes, with a minimum 44px click target. Notes expand below their persistent toggle, using the same control as workout notes. Clearing the field removes the note when the workout saves or the session autosaves.
- Adding an exercise from the builder library expands, scrolls to and focuses its new card, including duplicate occurrences and additions below a long workout. Focus stays on the card rather than opening the phone keyboard. Subsequent target edits retain focus normally.
- In preview scope on phones, the workout editor and Live workout dock Ask Assistant in the top app bar so quick chat stays available without covering set fields, rest or save controls.
- Removing an exercise in the reusable-workout editor offers an eight-second Undo toast that pauses on hover or keyboard focus. Undo restores the most recently removed occurrence with its sets, targets, rest, measurements, tags and notes near its original neighbors, preserving other edits, then expands and focuses it. Consecutive removals replace the previous Undo offer; saving or leaving ends it. Restored changes still require saving. Undo does not exceed the 50-exercise limit.
- The last set cannot be removed from an exercise in the set editor or training; remove the exercise itself when it is no longer needed. Removing an additional set in the reusable-workout editor offers an eight-second Undo toast that pauses on hover or focus. Undo restores its targets, hidden values, measurements and rest near its original neighbors without reverting later edits, then opens Advanced and focuses the restored set. Only the latest removal is offered; saving or leaving ends the offer, and the 100-set limit is preserved. Saved or recovered draft exercises with no sets open with one blank, editable set, so Basic always has available measurement fields.
- During workout creation/editing, each exercise header shows a live target summary beside its name, retained when collapsed: 3×12 | 100 kg for matching sets, with a vertical separator before other targets and compact spacing around ×, or ranges such as 3 sets | 8–12 reps | 80–100 kg when targets vary. Mixed measurements group consecutive matching sets in order, such as 1×45s / 2×8 | 80 kg; longer combinations show the first three groups and a remaining-set count. Partially unset targets are identified. On phones, differing targets or measurements use a short count such as “6 sets · Mixed targets”; matching sets with more than two measurements show the set and measurement counts. Simple matching targets retain their normal summary. Editor summaries follow the units selected in their fields, including converted values and per-set unit choices; matching load displays use the same two-decimal precision as the input. Different set units remain separate in full summaries and use Mixed units in compact summaries when targets otherwise match. Hidden saved values and actual session results are excluded.
- The creation preview starts each exercise with a set count and shared measurement targets. Basic and Advanced numeric fields share compact direct entry on phones and touch screens. Desktop uses the same flush right-hand up/down controls alongside direct typing and select-on-focus. Arrows adjust values in the displayed unit and respect field limits; Tab moves directly between inputs and keyboard arrows still adjust the focused number. Blank targets are allowed. Advanced editor exposes individual warm-up/working-set targets for selected measurements, with a full-width outlined Measurements disclosure matching Notes and Rest. Its header includes the selected measurements and a far-right chevron; the choices open inside the same bordered field. Custom per-set measurements, differing targets or differing between-set rest keep the exercise in Advanced editor when recovered or reopened. Editing a shared target applies it to all sets. Optional Rest between sets uses a connected field header with a compact timer-style Minutes : Seconds input. Its header shows Rest as needed when unset, the saved duration, No rest for zero, or Varies for differing intervals. Its heading stays full width and outlined even when collapsed. With fewer than two sets the entire control dims with a very light neutral tint when disabled, fading in/out as availability changes (instant with reduced motion), with Requires 2+ sets separated from the label by a fixed gap; adding a second set enables it. Reducing back to one collapses the editor without clearing stored rest. Focusing either time field selects its number, so typing replaces existing digits or zero padding directly. Set up to 60 minutes; extra seconds carry into minutes on blur. Unset rest means rest as needed, without a timed target. Unused minutes/seconds stay blank when reopening; clearing the entered duration unsets rest. Only an explicitly entered zero means no rest. Reopening the inline editor keeps that zero in the minutes or seconds field where it was entered. Collapsing preserves the value; changing it applies to every between-set rest, excluding the final set. Exercise/workout notes remain available.
- Duration, distance and load use the same integrated value → custom unit dropdown → desktop arrows layout. Unit selectors form flush bordered segments; Advanced fields use balanced widths and left-aligned values, with set action buttons matching the 48px inputs. Choose sec/min/hr, m/km/yd/mi or kg/lb independently per Advanced set without changing other sets or account defaults. Shared target controls apply their unit choice across the exercise. Unit choices stay with the mounted exercise/set through collapsing and switching editor modes. Add set carries the bottom set’s selected weight, distance and duration units into its independent new row. Numeric focus uses a continuous green outline flush with the whole control’s outer edge and rounded corners, drawn above the unit and arrow segments so they do not cover it. Load fields show up to two decimal places and distance up to three, without trailing zeros. Switching units converts the display without rewriting the underlying value; subsequent typing and arrow steps use the selected unit. Account preferences remain the initial defaults and explicit global unit changes update fields.
- Reps, load, duration, distance and laps fields select their current number on focus in Basic, Advanced and training. Clicking or tabbing in lets typing replace the existing value directly; blank targets and preferred-unit conversion are retained.
- In the workout builder, Add set appends a new set using the bottom set’s measurements, reps, load, duration, distance, laps and rest targets. There is no separate duplication or copying control. The first set starts blank; every new set is independent, with no copied actual results or completion.
- Reset to basic uses a short fixed title and a compact summary of affected target categories/rest, listed once regardless of set count. It explains when custom measurements return to exercise defaults and which matching values stay. It keeps Cancel/Reset actions. It removes set measurement overrides, retains shared selected targets/rest, clears differing targets/rest and unselected measurement targets, then returns to basic for adjustment. Cancel preserves the draft; collapsing preserves settings. Set count, notes, intent and recorded results remain intact. Save the workout to persist the reset.
- Each set inherits the exercise’s measurements until customised. Use the ruler button beside the set’s × (Add or remove measurements tooltip) to choose its own fields. The ruler stays highlighted for custom selections, with a tooltip and accessible description explaining the exception; matching exercise defaults clears that state. Options expand below the inputs inside the shaded set outline. A reset icon alongside the options restores inheritance, with a Reset to exercise measurements tooltip. When a set’s selection matches the exercise, it automatically follows exercise defaults again; the reset icon is disabled. Changing exercise defaults updates inherited sets while differing custom sets keep their selections; hidden values are retained.
- Overrides survive draft recovery, reordering, added-set target reuse, saves, scheduling, programs, session logging and repeating workouts. History and statistics use each set’s effective selection and preserve original set numbers when filtering results.
- Set rows show each selected measurement; every selection uses the same outlined set row with measurement fields between the draggable number and remove control. Labels and values retain the same typography as measurements are added. Each selected exercise measurement has its own column, keeping all five on one compact line when space permits. Desktop and tablet sets share one horizontal scroll area when needed, with set numbers and actions pinned. On phones, each set puts its number and measurement/remove controls above a two-column field grid; weight, distance and duration span both columns for readable numbers beside their units, unused slots disappear, and additional measurements wrap without horizontal scrolling or fields underneath controls. Each set renders only its selected measurements; adding a custom measurement does not reserve an empty space in other sets. Exercise-wide and per-set measurements use the same ordered columns: Reps, Weight, Duration, Distance and Laps. Adding a measurement to one set no longer puts it on a separate line; each desktop row sizes its own selected fields, while phones wrap them in the same order. Set/rest spacing stays compact in Advanced editor. Unselected measurement inputs are absent; add them through the measurement selector. Their stored values remain intact. Each set has a draggable number and a removal control. During training, Targets contains only selected measurements.
- Rest appears as an editable line between sets: Rest as needed when unset, No rest for an explicit zero, or a duration such as Rest 1m 30s. It belongs to the preceding set and moves with it. Click a divider in Advanced editor or training to edit its minutes and seconds in a small, single-line control with visible min/sec suffixes, borderless inputs and a keyboard-focus underline. Touch targets remain usable; the basic Rest editor retains its larger labeled fields. Moving between the fields keeps editing open; Enter or leaving the editor finishes editing and Enter restores focus to the divider. Changes apply only to that rest interval. The final set has no rest control. If removing or reordering sets leaves an invalid final rest value, a visible Clear invalid rest action allows saving; adding a following set restores editing. This applies while building and training.
- Enter duration targets and actual results with one amount and an integrated sec/min/hr selector inside the field, before desktop step arrows across Basic, Advanced and live editors. Changing the field’s unit converts its display without changing the stored duration or account default; decimal minutes/hours are supported. The account duration preference initializes the field; minutes-and-seconds picks seconds, minutes or hours appropriate to the initial value. Global preference changes update displayed units. Blank stays unknown and explicit zero stays zero for validation. Histories, saved-workout previews and comparisons retain the global preference; editor summaries follow local unit choices; stored durations still require whole-second precision.
- Choose measurements and intent for each exercise while building or training. Saving captures those choices; scheduled copies, program workouts and recorded sessions retain them independently of later definition edits. Adding or removing a measurement never clears its stored targets or actual values. Use one set for a continuous activity or several for repeated intervals.
- Drag an exercise’s six-dot handle or a set’s number to reorder with a mouse or touch. Set numbers show a subtle border/background on hover or keyboard focus and a visible border on touch. Focus a handle and use Up/Down arrow keys to move it. Escape cancels a drag; release applies the new order. Lists scroll near their edges while dragging. Reordering preserves all targets and set details.
- Training shows saved My workouts with a compact empty state; preview scope also shows Training programs. Create workout is the primary creation action; preview-only Create program is outlined. Training stays focused on workouts; exercise browsing lives in Exercises. Recorded sessions live in History.
- Create a workout beside the My workouts heading. Saved cards use two columns when space allows and one on narrower layouts. Saved cards use a tight exercise preview with a non-expanding remaining count, with equal-height draft and ready cards within each row. Saved cards show the title, exercise count and a compact exercise preview; Start workout is the main action, with quieter Edit and Schedule actions beneath it.
- Schedule a workout in a compact dialog showing its name and account timezone. Start defaults to the selected Day-panel date and the local clock rounded up to the next 15-minute boundary, carrying midnight into the following day, with an initial one-hour reservation. Exact quarter-hour instants stay unchanged and the picker still supports any minute. A Duration readout shows the valid elapsed range in hours/minutes, including across midnight and clock changes. Shared custom calendar and scrolling time pickers edit both endpoints; moving Start preserves the valid elapsed duration, including across clock changes. Field-level errors identify invalid/ambiguous times and end-before-start ranges, and focus the first invalid control. Cancel closes an unchanged form; changed fields require discard confirmation. Pending or uncertain writes block dismissal and retain exact retry payloads/keys across refresh. Success shows a five-second toast (paused on hover/focus) with View in Calendar opening the reserved date in Day view, and selects the reserved day in the shared Day panel. Each scheduled workout keeps its own copy of the exercises, captured names and targets. Starting it preserves those names even if a custom exercise has since been renamed.
- Edit or delete a reusable workout without changing scheduled copies or recorded sessions. Delete reusable workout (or Delete draft) lives in the editor’s upper-right ⋯ Workout actions menu and uses the same wording in its confirmation title and action. Confirmation explains that scheduled workouts and recorded results stay.
- Start a scheduled workout from its Fitness card or Calendar editor; starting it again opens the same session. The Calendar editor offers Continue workout for an active linked session and View workout summary once finished, with loading/retry feedback before choosing the action. Starting a separate workout from Fitness offers existing sessions to resume before creating another.
- Pending or uncertain workout/program schedules stay open and protect navigation. After refresh, reopen with the reviewed times and Retry same change using the original request key; retrying cannot create a second schedule.
- Adjust scheduled dates, times, and titles in Calendar. Calendar deletion and undo preserve the scheduled workout link.
- Scheduling does not start or complete a session; actual start/end times are recorded separately.

### Training programs

- Deferred from the first release. Core scope hides the section, creation and section-menu entries, and session return links; all program pages and APIs are unavailable. Code and stored programs remain available in preview scope. Existing workouts, Calendar entries and recorded sessions remain usable. The following features describe preview scope.

- The empty Training programs section explains that programs organize workouts into a repeating training plan. Create program beside the Training programs heading opens the dedicated creator. Create named programs from ready saved workouts, with notes, a start date and up to 20 ordered steps. The same workout can appear more than once; the sequence repeats after its last step.
- Choose preferred weekdays to suggest training dates in your account timezone, or leave them unchecked for a flexible rotation. Date suggestions do not reserve Calendar time or prevent training on another day. Start date uses the shared custom calendar and explains that suggestions begin from that date without scheduling workouts.
- Program forms put the workout sequence directly after Program name, followed by grouped date preferences and notes. Numbered sequence rows keep reorder/remove controls beside the name on desktop and phones, with pinned save actions. Add workout opens an inline searchable list with direct Add buttons, a bounded scroll area and Done/Escape to close and return focus. Keep adding workouts, including repeats, without a separate selection/confirmation step; feedback identifies each added position and the 20-workout limit. Search all ready workouts with the shared Search workouts field and paginated results; drafts are excluded before pagination. Restored/off-page sequence entries resolve their workout names independently, with explicit loading/unavailable/retry states. Fields identify validation errors beside the affected control and focus the first error when saving.
- Unsaved program drafts recover after navigation or refresh in the same account and tab, including incomplete fields and step ordering. A toast announces recovery; Discard recovered changes remains available. Conflicting saved revisions block overwriting. Cancel confirms discarding edits; storage failures warn before leaving.
- Interrupted program saves retain the reviewed input and request key through refresh. Retry same change completes the original save without creating a duplicate program. Cancelling a new program returns to the main Fitness page; cancelling an edit returns to that program, with changed drafts requiring confirmation.
- Edit program details, add/remove workouts and reorder steps. Changes apply to future workouts; a workout already started or scheduled retains its captured exercises and targets. Unavailable or draft source workouts are identified so you can replace or skip them.
- Start the next workout directly, or schedule it explicitly. Rescheduling moves the same Calendar entry and keeps your position. Calendar and Fitness open the same linked session.
- Finishing the session advances the program automatically. Skipping advances without recording a workout and removes that step’s reserved Calendar time; an in-progress session must be finished or discarded first.
- Pause/resume programs and filter active, paused or all programs. Pausing stops new program actions but preserves access to existing workouts and Calendar entries.
- Delete a program and its step history without deleting recorded workouts or existing Calendar entries.
- Review the next step, cycle, finished/skipped counts and paginated history with session links. Training includes a link back to its program; Training shows active and paused programs directly, with Show more programs for additional results.
- Counts reflect session corrections/deletions. Deleting the latest session returns that step to ready; deleting an older session does not rewind later steps. Edits preserve step identity when reordering; if a completed step was removed, continuation uses its former position in the revised sequence.

#### Needs work

- Main Fitness program cards need clearer emphasis on the name/next workout, plainer rotation/completion wording, visible paused/in-progress status and Load more behavior matching My workouts. Keep each card as one link without extra action rows. Owner requested retaining these review findings for a later pass.

- Programs repeat one sequence; multi-week phases, deloads and automatic load/repetition progression are not implemented. Schedule one next workout at a time; there is no bulk future scheduling.

### Train

- Live workouts open the first exercise with unfinished sets, while other exercises remain collapsed and independently selectable. Live card disclosure arrows sit beside the exercise name, matching the editor; planned summaries flow on the same line when space permits and wrap naturally on narrow screens. Cards explicitly label target summaries Planned; changing actual reps/weight leaves these planned targets intact, while unit choices convert their display. Completed counts and skipped counts remain separate. The current set has directly editable results, its planned target, visible set position and prominent Complete set action. Other sets use compact summary rows. Completed rows have a green checkmark, subtle green tint and prominent recorded values; skipped rows use a neutral skip icon and Undo without displaying target or result numbers, with text labels retained for both states. Completed sets offer Edit without undoing completion or restarting rest, and completed/skipped rows retain Undo. Multiple cards can stay open.
- A sticky Live status area shows workout time (including rest and excluding pauses), completed/skipped/remaining set counts and progress; the active rest countdown stays in that area while scrolling. Rest is tied to its originating exercise/set: skipping or undoing unrelated sets preserves it, undoing its originating completion cancels it, and completing a new timed set replaces it. Origin identities reconcile after saving so refresh and reordering retain the deadline; removing the origin clears its timer.
- Live controls emphasize Workout time with In progress / Paused integrated into its caption. Pause/Resume and Finish share one action group aligned right on desktop, with an equal-width action row below the timer on phones. Set counts and progress sit beneath the controls; active rest uses a separated row without another nested card. Pause freezes workout and rest timers and disables live result entry, completion, skipping, Undo and reordering until Resume; session setup remains editable. Pause intervals are saved with the session and recovered through refresh and the existing retry/conflict flow. Finishing while paused closes the pause without counting its time. Summary, History, weekly totals and comparisons use workout time including rest but excluding pauses; summaries show the excluded paused duration. Correcting start/finish clips pauses to the corrected span. Calendar retains the actual start/finish envelope and one source-linked record, excluding paused intervals from recorded/category totals with correct range clipping; the record details explain that exclusion.
- Reorder exercises directly while training using their drag handles or Up/Down keys. Work through exercises in any order without reordering if preferred. Open cards, their selected sets, targets and recorded results stay attached to the exercise through reordering and saves. Only the session order changes; reusable workouts remain unchanged.
- Untouched sets prefill their selected planned measurements in editable fields, using preferred units. Complete set confirms those displayed values as actual results, so planned reps/weight need no repeated entry. Opening a card alone records nothing; skipping does not copy planned results. Undo a skipped set to return it to the queue, then confirm its planned values with Complete set. Missing targets stay unknown, and existing partial results—including explicit zero and cleared fields—are never filled from targets.
- Deliberately clearing all actual measurements survives saving and refresh; those blanks are not replaced by planned targets.
- Result fields are visible immediately and prefilled from untouched targets; editing autosaves, while Complete set explicitly confirms performance. Done correcting closes direct edits of completed results while retaining completion. Custom set measurements are respected, hidden measurements remain intact, and completion requires at least one valid result. Complete/Skip advances to the first unfinished set within that exercise; upcoming sets cannot be selected directly. Undo clears only the chosen set’s completion/skip status, retains its values, cancels rest only if that set started the active timer, and preserves later results. After an exercise is handled, Next exercise names and opens the next unfinished exercise, wrapping to earlier unfinished exercises when needed. This explicit handoff collapses the previous card and focuses the next set. Choose exercise is also available mid-exercise, preserving entered results without completing sets or changing exercise order. Its secondary dropdown opens a bounded overlay of unfinished exercises with their planned set/measurement summaries in account units; selecting one uses the same handoff without changing saved exercise order. Next exercise aligns right after Choose exercise, matching the primary set-action position; on phones the actions stack with Next exercise last. Clicking Choose exercise again or pressing Escape closes the dropdown, and the redundant completion-count sentence is omitted while another exercise remains. Advancing or undoing sets keeps the active controls in view below the sticky status. When all sets are handled, the same Finish control becomes primary without an extra completion message; an entirely skipped workout explains that at least one set must be completed. Reload opens the first unfinished exercise and selects each exercise’s first unfinished set when expanded. Finishing the workout remains explicit.
- Inline rest edits apply minutes and seconds together on leaving the field group or pressing Enter. Changing the active rest’s duration adjusts its deadline from the original rest start, preserving elapsed rest; shortening below elapsed time shows Rest finished, and removing the rest clears its timer. The sticky live controls keep one Finish action throughout the session, outlined while sets remain and primary once all sets are handled. It requires a completed set, confirms finishing with unfinished sets and retains save/retry feedback. Completing the final set focuses that same control without scrolling away; there is no duplicate bottom Finish button. The phone header keeps a visible Edit label. The main live header provides a direct Discard action with confirmation, returning to Training and clearing the session’s rest timer; the session editor retains Discard in Workout actions. Workout notes appear in a labelled, readable section above the live status, and the compact status sits with the timer rather than above the workout title.
- Edit workout uses the creator’s collapsible exercise cards, starting closed, with shared targets and optional Advanced editor for individual sets, measurements, rest, notes and intent. Desktop shows the exercise library alongside the editor in place of the Day panel; phones use the same Your workout / Add exercises tabs as the creator. Additions and edits affect only the current session, leaving the saved workout unchanged. Back to workout restores the Day panel and retained live view, including its open exercise, current set and running rest timer. Target edits preserve recorded results; only this session changes. New cards stay open through automatic saves and server identity assignment.
- Restore starting workout appears in the active-session editor when its setup differs from the stored starting snapshot. Save as new workout stays on the left, followed by Restore starting workout with the same neutral button style; Done editing is the primary action on the right and Discard workout is in the top-right Workout actions menu. Restore resets the name, notes, exercise order, measurements, sets and targets; retains timing and matching recorded results; confirms removal of logged sets; and offers a hover/focus-paused Undo toast until another edit. The snapshot survives refresh and is independent of later reusable-workout edits.
- Removing exercises or sets with recorded, skipped or deliberately edited results requires confirmation. Undo removal restores the removed results, including after the removal saves. Typed basic set counts apply on leaving the field, so entering a multi-digit count does not truncate sets between keystrokes.
- Live exercise info and View history use the normal full-page exercise-details presentation: the same typography, responsive visual/facts columns, PR cards and full history. The toolbar has the normal transparent, non-sticky treatment, with Back to workout as its contextual return. View history only sets the initial scroll/focus to Your history after results load. Live picker-opened details use this full layout as well; the old Details/History switch and duplicate inline recall are removed. Back to workout/Escape retain current inputs, open exercise, scroll and opener focus.
- In live workouts, exercise help opened from an exercise or View history returns directly with Back to workout or Escape, preserving the open exercise, current set, scroll and opener focus. Error states retain the same direct return. Details opened from either an exercise info control or the library while creating, editing or logging a workout use Back to workout and return to the retained workout. Outside workout contexts, exercise details return to Exercises. Shared Fitness back controls use the same arrow, font size, semibold weight, spacing and touch target.
- Live training shows a flat Previous session footer with the date, one grouped actual-results summary (such as 3×12 | 50 kg) and an outlined View history button. It omits individual-set previews and +N more text; varying results use compact ranges. Full results stay in the contextual history pane, with Back to workout/Escape preserving live inputs and opener focus. Only completed results count, missing measurements stay explicit, and the current session is excluded.
- Rest appears as a divider between each pair of sets, matching the advanced editor: Rest as needed, No rest, or a configured duration. Click the divider to edit its compact minutes/seconds fields. No rest divider follows the last set. Completing a set starts its configured rest timer above the exercise list when another set follows in that exercise. Skip rest clears a running timer; an expired timer says Rest finished and offers Dismiss timer. Set completion never waits for the timer; unset and zero rest do not start a timer. Timers identify their exercise and survive editor switches, navigation and refresh in the same tab, scoped to the account and session.
- First-release recording needs no effort, mood or soreness ratings. Estimated one-rep max, fastest pace and overall workout scores remain outside this release.
- Session edits save automatically after a short pause. Keep editing while a save runs; later edits queue behind it and older responses cannot replace them. Uncertain saves pause further edits until their outcome is confirmed. Clean Saved status remains available to assistive technology without a standalone visible label; Saving, Unsaved changes and conflict status appear beside the live header controls. Live sessions autosave without a transient Save changes button. Live targets, exercise summaries and completed-set results follow their per-set input unit selections, with matching weight rounding. Live save failures use the same compact feedback as the editor, pinned with the status area and one primary Retry save action; conflicts offer confirmed reload. In the session editor, Done editing flushes pending edits and returns to the workout only after saving; Back to workout uses the same behavior. The primary button shows Saving while waiting. Failed saves keep the editor open with compact footer feedback and one primary Retry save action; uncertain retries reuse the original request. Conflicts offer confirmed reload instead. The scope note says Changes apply to this session only. Save as new workout creates a separate reusable workout from the current name, notes, exercises and planned targets without filling blank targets from recorded results. The action is disabled when the reusable setup matches the starting snapshot or the last copy saved from this session; logged results, timing and occurrence IDs do not count as setup changes. The last-copy comparison survives navigation and refresh in the same tab. It keeps the session open and shows a Saved “[workout name]” to My workouts toast with an Edit workout action; the session and original saved workout remain unchanged. The live-session editor offers a collapsed Adjust start time control with the shared custom month/day picker and a full-field styled time dropdown with scrollable Hour, Minute and AM/PM columns and explicit Set time. The selected values open centred and highlighted; scrolling, clicking and keyboard navigation select values. Dismissal leaves the time unchanged; noon/midnight convert correctly. Date selection preserves the time and respects account timezone/week-start settings. It opens automatically for invalid or recovered time values; finished-workout correction uses Adjust workout time with matching custom start/finish date and time controls. Live training has no Workout details dropdown. Invalid settings automatically reopen the editing view, including after refresh; recorded-workout corrections expose the same form.
- Recover session edits across navigation and refresh in the same tab, including incomplete or invalid measurements and date/time entries. Validation identifies affected fields; invalid timing opens its correction control automatically. Invalid fields keep the session marked Unsaved changes and block saving until corrected. Stale drafts cannot overwrite newer saved changes. If local recovery storage fails, leaving with unsaved changes requires confirmation; pending or uncertain writes protect navigation.
- Uncertain session saves offer Retry same change with the same request key, including after refresh. Any edits queued behind that save remain available afterward.
- Finish a partially completed session with confirmation while preserving skipped and unfinished sets; at least one completed set is required. Finishing keeps the Live view and disables further changes while the finish request is unresolved, showing Finishing during the request. Review opens only after save confirmation; known and uncertain failures retain the sticky Retry save feedback, and uncertain retries reuse the original request key.
- Discard an accidental session with confirmation. Workout deletion, exercise deletion, discarding program/schedule edits and finishing an incomplete workout use matching dialogs with explicit action labels.

### Review and reuse

- Open History to search recorded workouts, filter by In progress or Finished, and load more. Workouts sort by their start date, newest first, with stable pagination; timing corrections reposition them. Workout choice and History status use searchable custom dropdowns that float over content and dismiss with one outside click, including nearby blank space.
- Workout links from exercise details carry the exercise origin through Latest session, Personal records, Reps by weight and All sessions. The summary’s top-left link says Back to the exercise name and returns to that exercise with selected measurements, scroll position and source-link focus restored in the same account/tab. Origin survives workout refresh and result correction; direct/History visits retain Back to History. Following a workout reference explicitly closes contextual exercise details, including links to the workout already open and repeated links with an unchanged URL. Return destinations are restricted to internal exercise pages, and the name uses the authenticated exercise lookup.
- Finishing and opening a workout from History use the same read-only Workout summary. Its main heading combines the workout name with Summary inside the white overview card, with local date and start/end times vertically centered on the right, wrapping below on narrow screens. The contextual back link and Correct results share the action row above. Timezone and cross-midnight dates are preserved; it also shows workout duration including rest but excluding pauses, exercises performed and completed sets against their totals, with skipped/unfinished counts separate. Workout notes use the same labelled card and green left border as Live workout; actual exercise summaries follow. Workout time explicitly includes rest and excludes pauses. When paused, a separate time breakdown shows total elapsed time and time paused, making clear how workout time is derived even when pauses are longer than active time. Collapsed exercise cards show compact record indicators, with green badges only for improved weight/reps records and neutral labels for first results or longest recorded distance/duration. Fully skipped or unfinished exercises identify that outcome directly, including mixed skipped/unfinished counts when no set was completed. On screens up to 480px, overview metrics use aligned label/value rows so long durations remain on one line. Expanded sets retain small per-set records based on earlier finished workouts; first recorded results establish a baseline instead of claiming an improvement, and first reps-at-weight results identify the weight. Longest distance/duration labels stay neutral. Corrections/deletions recalculate these derived indicators. Exercise info buttons stay vertically centered in their summary headers when sets are collapsed or expanded. Expand individual exercises or Show all sets to inspect recorded measurements; unknown results stay unknown, explicit zero stays zero, and skipped/unfinished rows show their status instead of actual measurements. Each set keeps a separate Planned line for comparison, with No targets set for an empty plan. Opening or expanding the summary records no changes. Back to Fitness is the primary exit on the right; Back to History, Correct results, Repeat workout, comparison and additional reuse/deletion actions remain available. Repeat workout confirms before starting a new session with the same exercises and targets; Cancel leaves the summary open without creating a session. Repeat workout, Save as new workout, Delete recorded workout and Back to Fitness share one bottom action group without stacked editor rows, separator lines or a More actions disclosure. It wraps to a two-column grid on phones; deletion confirms removal of this session’s history, results and recorded Calendar time while keeping its reusable workout and planned time. Finished sessions keep History selected in the domain navigation.
- Choose Correct results to edit titles, notes, exercises, sets and actual start/end times in the shared editor, with the library beside it on desktop and Add exercises on phone. Expanded exercises use the shared editor’s set rows, with numbered drag handles, compact measurement fields, flush unit selectors/steppers and matching measurement/remove buttons. Recorded values are editable, and exercise headers follow each completed set’s selected display units, including mixed units; each set’s Completed/Skipped/Unfinished status dropdown sits beside its number above the inputs, with completed status highlighted in green. Per-set measurement options span the row and stay within the visible editor width as fields are added, with wrapping choices and a reachable reset control. Planned values stay beneath the inputs; skipped/unfinished sets keep editable values with an explicit note that those values do not count until completed. Fully skipped/unfinished exercise summaries name the outcome, including mixed non-completed counts. Collapsed exercise cards keep the correction list compact without leaving empty scroll space. Rest planning, exercise recall and intent controls stay out of result correction. The reusable-workout reminder paragraph is omitted. Adjust workout time uses the shared date picker and scrolling hour/minute/AM/PM controls, without repeated timezone or Timing labels. Times use the current account timezone; changing it in Settings changes displayed clock times while preserving the recorded instants and elapsed duration. It previews workout time, paused time and total elapsed time, and allows existing pauses to be edited or removed. Corrections must keep pauses ordered, non-overlapping and within the workout; changing start/finish flags pauses outside those bounds rather than silently trimming them. Invalid local pause times stay in the local correction draft and block saving; unchanged instants retain their precision. The phone editor tab is labelled Recorded results. Corrections stay in a local draft until Save corrections saves them and returns to the summary. Cancel and Save corrections remain beside each other on phones. Bottom-left Cancel and Back to summary return without saving; unsaved corrections require Discard corrections confirmation, with Keep editing available. Leaving through Training, other links or browser Back/Forward uses the shared styled Discard changes / Keep editing dialog; discarding clears the local correction draft before navigating. Cancellation stays disabled while a save is pending or uncertain. Failures keep edits open with consistent Retry save feedback; uncertain saves reuse their request key. Start and finish times each show their own validation; correcting one does not clear an error in the other.
- Finished sessions appear on Calendar with one source of recorded time. Corrections and deletions update Calendar.
- Repeat a previous session with fresh set completion and empty actual performance; reuse its measurements, intent tags and targets, or actual values where targets were absent.
- Save session exercises and targets as a separate reusable workout.
- Review each exercise’s finished-session history, including skipped/unfinished outcomes, and open its original session.
- Delete a session with confirmation; its planned Calendar time remains.

### Exercise history and statistics

- Each exercise’s History view puts Latest session first, compact Personal records second, and All sessions third. The embedded sections use headings beneath Your history; Latest session pairs its title with the source link and presents results before notes. Record cards place the main result beside relevant context (such as weight with reps or reps at a weight), followed by a source-workout button containing its date. Latest session, personal records, Reps by weight and All sessions reuse one workout reference: an outlined bold workout-title link with the muted date beneath the name inside the same button and a right arrow, without a separate View workout subtitle. Clicking the title, date or other button content navigates; surrounding rows do not. All sessions uses compact non-clickable rows without separator lines, whose workout-title button includes a grouped actual-results summary such as 3×12 | 50 kg beside the name, wrapping beneath it when needed; the date and account-local start time sit beneath the name inside the button, distinguishing same-day sessions without separate date headings. This replaces the standalone completed-set count. The summary uses confirmed completed sets and their captured measurements/preferred units, excludes skipped/unfinished values and keeps missing results explicit; it does not repeat individual sets or add secondary navigation controls. Record cards stack on smaller screens. Load six sessions initially and use Load older sessions for more. Failed pagination retains loaded results and offers Retry older sessions; background refresh failures retain the last loaded data. Exercises without finished sessions show one explanatory empty state instead of empty records/statistics/measurement controls. Latest session retains workout/exercise notes and set order; skipped/unfinished rows show their outcome without treating entered values as recorded results. The familiar Show measurements selector controls visible Reps, Weight, Duration, Distance and Laps without excluding sessions or sets; contextual return navigation retains the selected measurements. Start with the union of recorded measurements, or the measurements from an exercise reference. Keep at least one selected. Missing or unselected-at-recording values say Not recorded. There is no separate Progress tab.
- Workout History groups finished sessions under one account-local date heading, merging same-day results across loaded pages. Each date group has one lightly bordered white surface with compact divided rows and no status controls. Workout names and exercise/completed-set counts sit on the left; workout duration is emphasized on the right with the quieter start time beneath it. Long names wrap naturally, with timing aligned to the row’s top. Workout durations display whole seconds without exposing timestamp fractions; stored timestamps retain their precision. Skipped/unfinished sets do not inflate completed counts; corrections and deletions update the list. Full-width shared workout search and the outlined centered Load older workouts action match Training. Empty results distinguish no matches from no finished sessions; failed pagination retains loaded rows with a targeted retry.
- Opening a finished session from History carries its search and selected week into Back to History. Returning restores loaded pages, scroll position and the originating row’s keyboard focus, including after refreshing the summary. Optional position recovery is scoped to the account and browser tab; navigation remains available without storage. Session deletion retains the originating History search and week.
- Weekly totals is a permanent section beneath the Workout history list, without a show/hide button. The compact header places week navigation at the top right, with This week immediately to its left; on narrow screens the controls stay together in a right-aligned row below the title. Workouts, Workout time and Completed sets share an unboxed recap strip on desktop and compact label/value rows on phones. Workout time uses whole minutes (45m or 2h 15m; under a minute shows <1m). Weight volume is omitted from Weekly totals. Empty weeks show No finished workouts this week instead of zero/unknown metric cards. Previous/next buttons, a shared custom week picker and an outlined This week action retain History search while changing the week. Weeks follow account timezone and week-start preferences. Date ranges share a trailing year within one year (Oct 26 - Nov 1, 2026) and show both years across New Year (Dec 28, 2026 - Jan 3, 2027). The report omits the explanatory paragraph beneath its metrics.
- See finished workout count, summed workout duration including rest but excluding pauses, and completed sets. A workout and its full active duration belong to the week it started; planned workouts, ongoing sessions, skipped sets and unfinished sets are excluded.
- Volume means actual weight × reps for sets whose captured measurements include both Reps and Weight, including selections with additional measurements. Unknown values stay unknown, zero weight stays zero, and partial totals identify the number of sets missing measurements. Weight and volume follow the preferred kg/lb unit.
- Browse exercise history from Exercises, the inline picker or a workout. Archived exercises retain history. Set tables respect each set’s captured measurements and chosen visible columns; hidden stored values do not become recorded results. Intent tags do not divide history.
- Review all-time records for heaviest weight (with that set’s reps alongside it), most reps, longest recorded duration and longest recorded distance. Reps by weight is an always-visible paginated list with equal-width desktop columns titled Weight, Best reps in one set, Total reps all time and Best reps achieved. The titles explain the values without a helper paragraph. The best set’s workout uses the same shared reference; when the source column stacks below the values, its Best reps achieved label stays visible above the button. The weight row itself is not a link. Labelled values stack on smaller screens, heaviest weight first. Total reps sums confirmed selected reps/weight pairs across all finished sessions, excluding skipped/unfinished/in-progress results and updating after corrections/deletions; canonical kg values define the buckets while display follows kg/lb preferences. Every record has a date and source-workout link; ties use the earliest workout. Duration and distance are literal recorded maxima rather than performance scores. Volume and laps remain statistics, not personal-record awards.
- Personal records follow the chosen visible measurements without an exact-combination filter. Records span eligible completed sets across all captured measurement setups, excluding hidden/unselected values. History follows workout dates rather than entry dates and supports loading older sessions. Exercise details omit Session statistics and its measurement dropdown/comparison/session list for the first release; weekly totals in History and the workout comparison remain available.
- Compare a saved workout with the most recent earlier finished workout having the same exercises and captured measurement selections, even when exercise order changes. Repeated exercises with identical selections match in occurrence order. A full-width Compare with previous workout row sits with clear spacing below the exercises. Its chevron reflects the expanded state; the entire row toggles the comparison within the page, with keyboard and expanded-state support. Its content uses a shared outlined workout title/date/time button, a paired workout-time comparison and compact exercise tables with aligned shaded column headings. Workout time uses the same whole-second formatter as the summary, including rest and excluding pauses. Completed sets and best measurements appear in aligned measurement/this-workout/previous-workout tables without weight-volume totals; missing results stay explicit. Matching titles alone do not establish a comparison.
- Only confirmed completed sets in finished workouts qualify for records; targets, unfinished/skipped results and hidden/unselected measurements never contribute. Corrections and deletions update derived progress and records. Exercise renaming and archiving preserve access to recorded results.

### Needs work

- Training cards still label paused sessions In progress, and All sessions summaries do not yet follow the exercise measurement visibility selector. These minor presentation refinements are deferred.
- Sessions started before starting-snapshot storage was introduced cannot restore their original setup; no baseline is inferred from their already-edited state.

- The workout creation layout is an owner-requested experiment and may be reverted after review.
- Exercise visuals are placeholders until the actual assets are ready. Illustrations and catalogue expansion are owner-deferred content work, with flexible timing.
- Catalogue expansion toward 75–100 exercises, primary/secondary muscle roles and illustration highlighting are planned for later.
- Progression recommendations, analytics beyond the current records/trends, supersets and drop sets are deferred.
- The built-in library remains focused on lifting/bodyweight exercises; create custom activities for running, swimming, cycling and other exercise. Older standalone cardio backend records remain separate from the shared workout/progress flow.
- Sessions support up to 50 exercises and 100 sets per exercise; recorded duration is limited to 31 days.
- Recovery drafts and rest timers remain local to the current tab; they do not sync across devices.
- Workout-definition edits and scheduling are outside Calendar undo/redo. Editing or removing an existing Calendar reservation from the shared Day panel uses Calendar history.
- Calendar copying duplicates time plans only, without the attached workout definition. Use Fitness scheduling to place another workout.

## Food

- Deferred from the first release, including meals, recipes and water/weight logging. Routes and Calendar contributions are disabled by default, while code, schemas and stored records are retained. The following features remain available in preview scope.

### Workspace and library

- Open Food from main navigation. Daily log is the default; Food library, Saved meals, Recipes and History share compact navigation above the main workspace. Daily nutrition comes first, with up to four favourite shortcuts, the detailed log, and water/weight below.
- The shared domain day panel sits on the right and uses Calendar’s date picker and activity cards. Choose a day using the week strip, date picker, previous/next or Today; the selected local date stays in the URL across Food views and carries into Fitness. Narrower screens open the same day view through the Day button.
- Switch the panel between Food (food, water and weight records) and All activities (Calendar plans and recorded activity across domains). It highlights Calendar’s next activity and opens the full Calendar on the same date. Food records open their entry editor; water/weight records return to their daily section. Domain activity and its accounting record remain one activity.
- Library Favourites and Archived use explicit toggle buttons with visible selected states.
- Create private foods with a serving amount in grams, millilitres, items or servings. Calories, protein, carbs, fat and fibre are optional per-serving values; blank means unknown and zero remains zero.
- Search foods, meals and recipes; favourite entries, filter favourites, and browse paginated results. Edit definitions or archive/restore them. Archived items remain in history and existing preparation snapshots, but cannot be newly selected for logging or ingredients.
- Changes to library definitions never rewrite logged nutrition. Forms validate entered values, protect unsaved changes, retain uncertain-save payloads for same-key retry, and refuse stale writes.

### Saved meals and recipes

- Create a saved meal by combining foods and recipes for one meal. Set each component’s serving quantity, reorder/remove ingredients, and add optional notes. Preparations contain up to 50 ingredient rows.
- Create a recipe from food ingredients with their quantities, optional instructions and a yield of 1–1,000 portions. Review ingredients and nutrition per portion in the library.
- Nutrition is calculated by the backend from ingredient snapshots and recipe yield. A nutrient remains unknown for a preparation if any ingredient’s value is missing; known values are never presented as a complete recipe total.
- Saving edits refreshes ingredients from their current owned active definitions. Existing preparations and logged portions stay independent of later ingredient changes.
- Log a saved meal or recipe in one action. Adjust the number of portions and, optionally, individual ingredient quantities for that entry. Adjustments preserve the saved definition; recipe ingredient adjustments describe the full batch before portion scaling. A changed source revision requires reviewing the latest definition before logging.

### Daily logging and review

- Record a food, saved meal or recipe at a chosen date/time with a serving multiplier and optional Breakfast/Lunch/Dinner/Snack label. No label is also supported.
- Quick entry records a name, portion and optional nutrition without adding a library food. Create a library food from the logging flow when it should be reusable.
- Review the day’s entries and daily calories/macronutrients/fibre. Totals use the account timezone, including clock-change days. Missing nutrients remain unknown, and partial totals identify entries with missing values.
- Expand an entry to see its recorded nutrition and component portions. Logging a preparation creates one recorded Calendar moment and no duration; Calendar links back to the Food log.
- Correct an entry’s time, amount or meal label, or delete it with confirmation. The view follows a corrected entry to its saved date; nutrition and Calendar refresh after writes.
- Copy an entry to another time or day using its original snapshot, even after the source definition changes or is archived. Search paginated history by recorded names; history lists recently added entries and displays when they were eaten.

### Water and weight

- Log water with 250/500 ml shortcuts or a custom amount/time, review the selected day’s total, and edit/delete or browse previous entries.
- Log weight in the preferred kg/lb unit, review the latest measurement through the selected day and its 30-day trend, and edit/delete or browse paginated history. Missing days do not become zero measurements.
- Water and weight use the existing shared services and Calendar activity. Backdated quick water logs use local noon; today’s use the current time.

### Needs work

- Meal planning, shopping lists, custom nutrition targets and nutrition trends beyond daily totals belong to the next pass.
- Barcode scanning, external food lookup, pantry inventory and AI are not available.
- Recipes use foods; meals can use foods and recipes. Nested recipes and meals within meals are not supported; gram-to-millilitre conversion is not inferred.
- Edits use explicit saves and discard protection; unsaved Food forms do not recover after refresh. Historical entry corrections change amount/time/label; replace an incorrect food by deleting and logging it again.

## Admin

### Access and account types

- Accounts are permanently either a regular user or an admin; there is no promotion or demotion.
- Public registration creates regular accounts.
- Admin accounts have an Admin entry in the account menu, with Overview, Users, and Audit history sections.
- Create separate admin accounts using the local operator command.
- Admin access provides account management and aggregate statistics, without access to other users' personal plans, food, workouts, or goals.

### User management

- Search accounts by name, email, or exact account ID; filter by active or suspended status.
- View account type, name, email, join date, last-active date, and suspension date.
- Suspend a regular account to block sign-in and revoke its existing sessions while retaining its data.
- Reactivate an account so it can sign in again; old sessions stay revoked.
- Revoke all sessions to sign an account out without blocking future sign-in.
- Permanently delete a regular account and its personal data by confirming the target email.
- Account deletion cannot be undone; administrative audit history is retained.
- Admin accounts are protected from suspension, session revocation, and deletion through these controls.

### Statistics and system health

- View total, admin, and suspended account counts; new accounts over seven days; active accounts over seven and 30 days.
- Activity means a successful login or authenticated request, recorded at most hourly.
- View aggregate counts of planned blocks, food logs, strength workouts, cardio activities, and goals.
- Usage counts include stored workout drafts.
- Check API/database health, API version, uptime, request count, server errors, and aborted requests.
- Refresh statistics and health reports; request counters reset when the API restarts.

### Audit history

- Browse an immutable history of admin creation, suspension, reactivation, session revocation, and account deletion.
- Each entry shows the action, time, acting account or local operator, and target account ID.
- Audit entries remain after account deletion and cannot be edited through the app.

### Needs work

- Production admin provisioning is not provided; the operator command supports local development/test databases.

## Across the app

- Shared toasts give brief success, information and error feedback with consistent styling, bottom-right placement, optional actions and dismissal. Calendar and Fitness recovery use them. They avoid phone navigation and fixed workout save actions, pause while hovered or keyboard-focused, and respect reduced motion. Persistent conflicts and field errors remain in the relevant form.

- Shared action tooltips provide consistent styling, delayed hover, keyboard-focus hints, Escape dismissal and placement within the screen. Workout set controls and exercise collapse/remove controls use this treatment; touch actions work directly.

- Disabled buttons and toast actions use a normal arrow cursor, including while saving; the app never uses wait/progress cursors.
- Responsive layouts support desktop, tablet, and phone screens.
- The page scrollbar is hidden; wheel, trackpad, touch and keyboard scrolling remain available.
- Fields share a continuous green focus ring flush with their rounded border, without a gap. Searches and controls with icons, units or connected inputs highlight the whole field; keyboard focus and high-contrast mode remain visible. Forms keep labels clear of outlines and show validation feedback; failed reads offer retry controls.
- Supported saves retain their request when a response is uncertain so retrying does not create duplicate records.
- Conflicting edits are rejected instead of silently overwriting a newer saved version.
- Confirmation actions and template renaming use shared styled dialogs across domains. Unsaved in-app navigation offers Discard changes / Keep editing, preserves the destination and browser history, and blocks pending writes. Refresh/tab closing never registers a native warning; existing recovery remains where supported. Task/Food forms without recovery may lose unsaved edits on refresh. Native alert/confirm/prompt calls are disallowed by lint.
- Dates and local-day summaries follow the account timezone, including daylight-saving changes. Passive timezone-name labels are omitted across summaries, scheduling, Calendar and logging forms; functional timezone settings remain available. Detailed timestamps retain clock-change disambiguation.

### Assistant preview

- Deferred from the first release. The direct page, navigation link and launcher are disabled by default; the following interface is available in preview scope.
- Assistant has a dedicated conversation workspace at /assistant. The floating chat button opens a compact popup from other authenticated pages without unmounting the current workspace; phones use a larger bottom sheet. The launcher stays clear of mobile navigation, fixed workout save actions and ordinary toasts, and is hidden on the Assistant page.
- On desktop/tablet, drag the quick-chat title bar to move it and use the resize grip to change its size; mouse users can also drag edges/corners. Focus Move quick chat or Resize quick chat and use arrow keys, with Shift for larger steps. Escape cancels an active drag; Reset layout restores the default position and size. Bounds keep the popup reachable when the viewport changes. Layout stays in account-scoped memory across closing/navigation and clears on reload; phones keep the bottom sheet.
- Quick chat offers Open in Assistant to continue in the dedicated area. Both views share one editable multiline draft; examples append to existing text. Closing, reopening and client navigation retain the draft in account-scoped memory; reload clears it. No saved conversation history is created.
- Opening quick chat or entering Assistant from a page captures its page/date labels and return link. Conversation context stays attached while browsing elsewhere or entering Assistant. Remove context, Add page context or Use current page makes an explicit change; removing context retains the return destination. Calendar without a date captures account-local today.
- Return to workout/Food/Tasks/Calendar returns to the captured URL and selected day. Workout creation uses existing draft recovery to retain unsaved targets and notes after the round trip; navigation is blocked while its writes are pending or changed edits cannot be recovered because browser storage failed. Other editors retain their existing unsaved-change confirmations, including cancellation of Open in Assistant.
- Quick chat is also reachable from native modal editors. Closing it or Escape restores launcher focus without closing the underlying editor. Desktop/tablet quick chat is nonmodal unless an editor is already modal; phones use native modal focus containment.
- A visible Preview badge, explanatory caption and disabled Send identify the interface. It sends no messages, fetches no records for AI and performs no domain writes.

### Needs work

- Some controls elsewhere still use native browser title hints and have not been moved to the shared tooltip component.

- Actual AI conversations, cross-domain information access, saved conversation history and approved app actions are not implemented; Assistant is currently an interface preview. Dedicated mobile/desktop apps remain planned.
- Custom domains are deferred until later, before the stretch-goal watch app; neither is implemented.
- Public domain sharing and social features are not implemented.
