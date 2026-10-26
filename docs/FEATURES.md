# Features

The project at a glance: what each area has and what needs work. Keep descriptions short and update them as the app grows.

Scope: the whole app, including account access, settings, Calendar, Unscheduled plans, Routines, daily measurements, Fitness, Food and Tasks, Goals, and Admin. The [product scope](SCOPE.md) describes the direction and future phases; feature bullets below describe current functionality.

- Put Account access first and Calendar immediately after it as the main product experience. Follow with settings, supporting planning features, daily logging, and review. Keep Admin and shared behavior at the end.
- Within each section, introduce setup and creation before editing, reuse, deletion, and review. List current features and behavior in that order.
- Put limitations, missing functionality, and requested improvement notes under **Needs work** at the bottom of the relevant section or subsection. Keep them out of the available-feature bullets.
- Keep notes as short, specific bullets; omit empty Needs work headings. These notes describe gaps and limits for review, not commitments to implement everything listed.
- When an item is implemented, update the feature bullets and remove or revise its Needs work note.

## Account access

- Register with a name, email, and password.
- Log in with email and password; show or hide the password while typing.
- Open Calendar after signing in.
- Stay signed in between visits while the session is valid.
- Sign out through the account menu.
- Each account has its own private data.

### Needs work

- Password recovery and email verification are not available.

## Calendar

### Views and navigation

- Switch between Day, Week, and Month; Calendar opens in Week view by default.
- The calendar fills the available workspace beside the navigation sidebar.
- Add, Search, and Actions share the compact toolbar; selection controls do not take a separate row.
- Use the top-right arrows to move one day, week, or month at a time.
- Today returns to the current date in the active view.
- Switching views follows the selected date: a selected Month day opens its week or day; a selected Week time slice opens that day.
- Dates, times, and week boundaries follow account settings.
- Overflow lists support the same plan selection, editing, copy/paste, deletion, right-click actions, and undo/redo as the calendar, including mixed timed/all-day groups.

#### Day

- The heading above the grid shows the weekday and date and can be selected.
- The date button shows the full month, day, and year.
- Clicking the date opens a small calendar; hovering over another day outlines it.
- The activity list on the right shows plans and recorded activity for that day.
- Ongoing activity appears as Now, and the next upcoming item appears as Next.
- The Next plan card uses normal plan controls: click to select, double-click or press Enter to edit, and use copy/delete shortcuts or right-click actions.
- Earlier, Now, and Coming up groups organize the remaining activity without repeating Next.
- Workout activity opens its Fitness session for review or correction. Food activity opens its local-date Food log. Retained cardio activity stays visible without links to the retired pages.

#### Week

- Seven day columns show timed plans, with an all-day row above them.
- Click a day heading to select it; double-click or press Enter on a focused heading to open Day view.
- The date button shows the month and year.
- Clicking the date opens a calendar with the selected week highlighted as one range.
- Hovering over another week outlines the whole week.
- Overlapping plans appear beside each other; crowded days provide access to the remaining plans.

#### Month

- The month grid fits the available screen area.
- Click a day cell to select it; double-click or press Enter on a focused cell to open Day view.
- Plans show their title on the left and start time on the right; long titles end in an ellipsis.
- Cells show up to four plans. With five or more, they show three and a “+N more” link; smaller layouts may show fewer.
- Clicking “+N more” opens Day view for that date.
- The date button opens a three-column, four-row month picker with year navigation.
- Hovering over another month outlines it.

#### Date dropdowns

- Open beneath the date button, centered on it.
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
- Add in the top-left toolbar opens a new plan draft.
- Add uses the selected slice's time, or the current hour on the selected/viewed date when no precise time is selected.
- Add and double-click drafts start with a one-hour duration; dragging sets the duration directly.
- A compact editor beside the plan provides its title, date, and start/end times.
- The same editor creates timed and all-day plans; switch modes with All day.
- Save creates the plan. Clicking outside or pressing Escape cancels an unsaved draft.
- A click used to cancel the draft does not also select the calendar underneath it.
- Plans can overlap and continue past midnight.
- Passing a plan's scheduled time does not automatically record activity.

#### Editing and moving

- Double-click a plan, or press Enter when it is focused, to open its compact editor.
- Change its title, date, start/end times, and notes; notes are under More details.
- Toggle All day when editing to convert the existing plan, keeping its identity, title, and notes. Saving replaces its previous mode; cancelling leaves it unchanged.
- Turning off All day gives one continuous plan with editable start/end dates and times, including any nights between them.
- Turning on All day covers the dates occupied by the timed plan; an end exactly at midnight does not add another day.
- Mode changes support undo and redo as one action, with the same occurrence scopes for repeating plans.
- Use Duplicate in a timed plan's actions to open a separate draft with the same details.
- Drag a timed block to another time or day, preserving its duration.
- Drag any plan in a selected group to move the whole group, including mixed timed/all-day selections. Dragging an unselected plan moves only that plan.
- Group moves preserve relative local dates, clock-time spacing, and each duration. All-day plans shift by dates and keep their type and span; a time-only move leaves their dates unchanged.
- A ghost remains at the original position while the moving block snaps to its destination.
- Group moves show previews and original ghosts for the selected plans. They save atomically and are one undo/redo action.
- The moving preview shows the title, time range, date, and Escape-to-cancel hint.
- Drag the top or bottom edge to resize a block; its height changes during the drag.
- Release to save a move or resize; press Escape to cancel.
- In Month view, moving a timed plan to another day preserves its clock time.
- The editor also provides move/resize controls for touch use and precise time entry.
- Resizing changes only the grabbed plan. Moving a group changes only selected repeating occurrences, leaving their series rules unchanged.

#### Small blocks

- Block height reflects the actual duration, including five-minute plans.
- Blocks too short for text hide it; hover, keyboard focus, or selection reveals their details.
- A 15-minute plan can show its title at default zoom; a five-minute plan can show it at maximum zoom.
- Double-click still opens the compact editor.
- Resize handles appear only when there is enough room.
- Zoom in or use the day's plan list when small adjacent blocks are difficult to target.

#### All-day plans

- Create an all-day plan from Calendar tools or the plan editor.
- Use one date or a multi-day span.
- Day and Week show these in the All day row, with compact title-only blocks.
- Select and copy an all-day plan individually or together with timed plans.
- In Week and Month, drag an all-day plan between dates; grabbing a later day of a multi-day plan preserves its full span.
- Drag the left/start edge to change its first date, or the right/end edge to change its last date. The calendar updates during resizing; Escape cancels, and releasing saves.
- On touch screens, select the plan before dragging. The editor's date fields remain available in every view, including Day.
- Single repeating all-day adjustments offer the same occurrence scopes as timed adjustments. All-day moves and resizes support undo and redo.
- Create timed copy… under Actions opens a separate timed draft and keeps the original all-day plan.

##### Needs work

- Converting a timed plan to all-day preserves recorded activity but detaches its plan links. Undo restores those links; converting back through the editor does not reconnect them.

#### Repeating plans

- Repeat timed or all-day plans daily or weekly, including custom intervals and selected weekdays.
- Add repetition while creating a plan, or choose Repeat from an existing plan's editor. The original plan becomes the first occurrence.
- Choose an end date and preview the occurrences before saving.
- An occurrence's editor shows its repeating schedule and provides Edit repeating rule.
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
- Selected groups also offer Move… to enter a destination date and time precisely. The earliest timed plan is the anchor; an all-day-only group uses its earliest date.
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

#### Needs work

- Improve the right-click → Move… flow for selected plans.

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
- Applying a template can be undone as one action.
- Creating, splitting, editing, stopping, or deleting repeating plans is one undo action. Undo restores previous rules, individual edits, and excluded dates; undoing conversion restores the original standalone plan.
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
- Optionally limit results by date; browse further results from calendar history.
- Apply filters to the visible calendar and clear them to show everything again.

### Templates and quick actions

- Open Actions → Calendar tools for Repeating plan, All-day plan, Templates, and Quick actions.
- Save a named template from a day, week, or date range.
- Rename or delete saved templates.
- Choose a start date and number of cycles, preview, then apply a template to create independent plans.
- Quick actions log water or weight using the chosen date/time.
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

- Template application and activity logging retain their existing current-Calendar-visit undo only; they are outside plan redo and persisted history.
- Current limits: all-day spans and template sources cover up to 31 days; repeating plans cover up to 366 local dates.
- Copy limit: up to 100 plans within a 31-day range. Template application allows up to 52 cycles, bounded by 100 plans and 366 days.
- External calendar sync and reminders are not available.

## Navigation and settings

- Main navigation contains Calendar, Fitness, Food, Tasks and Assistant on desktop and mobile.
- Food, Fitness and Tasks share the same full-height Calendar-style Day panel on the right, aligned to the top without a domain title bar. It includes date/week navigation, domain-only or All activities, next-plan emphasis and a same-date Calendar link. The selected day carries between these workspaces during navigation; explicit date URLs take precedence. At 1150px and below, Day opens the panel as a drawer. Calendar retains its full workspace.
- Unscheduled and Goals remain accessible by URL outside main navigation. Reusable Routines are also accessible within Tasks.
- Open the dedicated Assistant preview from navigation, or use the floating Ask Assistant button for quick chat on your current page.
- Open Settings through the account menu.
- Choose a timezone or use the device's timezone.
- Choose Sunday or Monday as the first day of the week.
- Choose weight (kg/lb), distance (m/km/yd/mi), and Fitness duration units (seconds, minutes, hours or minutes-and-seconds). These account defaults persist across devices.

### Categories

- Create and edit life categories in Settings, with a name and optional color.
- Archive categories; existing records keep their category.
- Assign categories to goals.

## Tasks

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

- Log water or weight through Calendar quick actions, with a date and time.
- Measurement logs appear as Calendar moments without allocating time.

## Fitness

### Workspace

- Units in the Fitness toolbar changes one account-wide default for load, distance and duration, including while editing or training. Existing values convert immediately in editors, summaries and exercise history; changing units does not rewrite workouts or discard unsaved edits. The same choices are available in Settings; kg/lb also applies to body-weight entries. Rest timers and whole-session elapsed time retain clock formatting.
- Fitness has Training and History navigation. Its main page and central workout editor show a visible scrollbar when content overflows. Training shows all active workouts with pagination, saved workouts, Training Programs and then the exercise library; History lists recorded workouts with search, status filters and secondary weekly totals. The shared Day panel stays full height on the right, including while building or training, without a domain title bar.
- Fitness-only Day activity includes genuinely linked scheduled workouts and recorded workout/exercise activity. All activities also shows Calendar plans and other domains. Planned activities open Calendar on the selected date; recorded workouts open their session, with unsaved-change protection before leaving.
- Create/edit a reusable workout or start training in the main area, replacing its default content. Clicking an exercise card always opens details. While a workout is open, hovering or keyboard-focusing a card replaces its equipment/muscle preview with an inset button with a soft border and faint green tint, showing + beside Add to workout in the information area; clicking it adds without opening details. The name and illustration remain visible. Touch screens show the action without hovering. The independent favourite star stays top-right. There is no separate Info button or bottom Add row. Exercises can also be added from details, each with an unfinished set. Titles, notes, ordered exercises and targets remain in place.
- Exercise names and last-session links open Details/History in the exercise library pane, beside the workout on desktop during creation/editing. Narrow screens switch to that pane; Back to exercises or Escape returns to the library search. The workout stays intact; Your workout or Back to workout switches back to it. Instructions, last-session recall, ordered sets and older sessions share the same view used by library cards. Failed reads retain a return action and retry.
- Create/edit exercises from the Training library or the inline workout picker. Creating while building or training adds the exercise and returns to the workout. Cancelling or closing a dirty exercise form asks before discarding its changes.
- During workout creation/editing, Training and History stay fixed above independent workout and library scroll panes. The workout heading, title, notes and exercises scroll together above pinned Save draft and Save workout actions; scrolling either pane does not move the page.
- Sets can be cleared while typing; leaving the field blank restores one set. Basic/Advanced editor switching is instant. Only expanding/collapsing the whole exercise animates, with reduced-motion preferences respected.
- Workout target cards place Advanced editor in the exercise header before Collapse and Delete. Desktop shows its label; narrow screens use a sliders icon with the shared tooltip and active-state styling. The control stays available on collapsed cards and opens the exercise when used. Intent tags sit at the bottom of the expanded card. Measurement choices use compact toggle chips with checkmarks for selected fields and no repeated selection helper text. Sets and targets remain grouped beneath a distinct exercise header. Advanced editor uses a bordered control with a sliders icon and visible active state. Rest and notes share full-width outlined disclosures, with their arrows at the far right in both states. Both expand into fields with integrated headers.
- The dotted empty workout area directs you to choose exercises from the library; mobile uses the Add exercises tab.
- Workout creation/editing currently uses a reversible layout experiment: the Day panel is hidden, the wider draft stays in the middle beside app navigation and the library uses two columns within a narrower right pane on desktop. Mobile switches between Your workout and Add exercises, preserving both. Sessions retain the inline picker and Day panel. Search/filters and workout recovery remain available.
- Scheduled workouts are shown in the shared Calendar day panel; Training keeps its focus on saved workouts and programs.

### Exercise library

- The exercise library sits below Training Programs, with responsive cards, search and filters. Its cards scroll with the page rather than inside a separate scroll area. Workout builders and sessions open it only when adding an exercise. Workout and exercise forms keep scrolling fields and fixed actions; the shared Day rail stays independent on the right.
- While search, equipment/muscle filters, Favourites or Hidden are active, the matching exercise count appears in muted text beside Clear all. It hides when no filters are active; the library heading and space above the cards stay clear.
- Browse 16 built-in strength exercises with equipment, muscle groups, short instructions, and visual placeholders. Cards emphasize the exercise name, show equipment beneath it, and show as many muscle tags as fit on one line, with a +N count for the remainder; details show all muscles. Long card names and equipment lists use at most two lines, with full text available on hover; custom labels remain visible.
- In the Filters panel, a compact dropdown without search controls sorting; in the desktop library panel it sits below Equipment and Muscle group. Sort built-in and custom exercises together by Name A–Z (default), Name Z–A, or Recently added. Recently added puts newest custom exercises first, then built-ins alphabetically; favouriting or hiding a built-in does not change its order. Sorting applies alongside filters, and Clear all preserves the chosen sort.
- The library toolbar contains Search, Favourites, Hidden, then Filters. On very narrow phones, Search uses its own full-width row. Hidden is a quieter outlined icon-only button with a tooltip and green active state; Favourites also uses an icon on narrow screens. Hidden switches to hidden built-ins and archived custom exercises; one visibility filter covers both.
- Filters slides open and closed below the toolbar; reduced-motion settings disable the animation. Equipment and Muscle group search fields share the panel width equally. A list of full-width option rows floats below the active field without enlarging the panel; click anywhere on a row to toggle it, and selected rows show a checkmark. Options hide when focus leaves the group, and only the option list scrolls. Arrow keys navigate options; Home/End move to the first/last option. Escape first closes options and returns to search, then closes Filters on a second press.
- Results update immediately, matching any selected option within each group and combining equipment with muscles. Selected equipment and muscle filters appear as removable chips below the panel and remain below the toolbar when it closes; all tags share one horizontally scrollable row, so muscle tags never wrap below equipment. The scrollbar is hidden; an edge fade indicates more tags offscreen, and touch, trackpad and keyboard scrolling remain available. One Clear all button stays fixed at the right and vertically centered with the tags; it resets filters, visibility, favourites and exercise search. The Filters badge counts equipment and muscle choices; Favourites and Hidden show their active state only on their toolbar buttons, without removable tags.
- Filters stays open while browsing results. Click Filters again or press Escape from the panel to close it; Escape returns focus to the Filters button. Filtering works for built-in and custom exercises alike.
- Favourite or unfavourite an exercise from its details or the star at the top-right of its card. Empty card stars appear on hover or keyboard focus and stay visible on touch screens; filled stars stay visible. Card stars are outlined until favourited; favourited stars stay filled even on hover. Hover or keyboard focus adds a subtle tinted button background and preserves the card outline. Pointer clicks do not leave a focus outline or keep an empty star visible after moving away; keyboard navigation retains visible focus. Clicking the star does not open details; starred exercises appear in the Favourites filter, including when choosing exercises for a workout. Favourites are private, persist across refreshes, and retain their status when hidden, shown, archived or restored.
- Select an exercise to replace the lower library with its name and favourite star, large illustration placeholder, bulleted equipment list, muscle tags, and instructions. Back to exercises returns to the library; the main workout remains intact.
- Add an exercise to an existing workout or begin building a new workout from it.
- Browsing does not create personal records. Favourites and built-in visibility are private account preferences, separate from exercise definitions.

### Built-in and custom exercises

- Built-ins are curated, read-only definitions. Favourite, Hide, or Duplicate them; their core names, instructions, equipment and muscles cannot be edited or permanently deleted.
- Hide removes a built-in from the active library without affecting saved workouts, logging or history. Find it using Hidden and choose Show in library to restore visibility.
- Create a private custom exercise with a name, optional instructions, equipment, muscles worked, and a Favourite star beside the Create/Edit heading. Search fields stay above removable selected chips; arrows/Enter select options, Escape/outside click closes them. Removing a chip keeps the dropdown closed instead of returning pointer focus to search. Keyboard removal focuses another chip, or the closed search field when none remain. Nearby blank-space clicks dismiss and release search focus in one click.
- Create/Edit exercise puts the name first, Equipment and Muscles worked side by side on wider screens, and a visible compact Instructions (optional) textarea that can be resized. Cancel and Create exercise/Save changes stay fixed below the scrolling fields.
- Field validation explains problems beside the affected input and focuses it. Cancel leaves unchanged exercises directly; changed forms offer Keep editing or Discard changes. Leaving through navigation, the Day panel, refresh or closing the tab warns while exercise changes are unsaved or a save is unresolved; pending/uncertain saves retain their retry controls.
- Choose any combination of Reps, Load, Duration, Distance and Laps independently, with at least one selected. Custom exercises choose default measurements in Create/Edit; built-ins have curated defaults. These measurements do not impose strength/cardio categories.
- Add optional custom intent tags such as strength, cardio, technique, recovery or recreation. Up to eight tags, 32 characters each, are trimmed, lowercased and deduplicated. Custom definitions provide defaults; each exercise in a workout can override or clear its tags independently of measurements.
- Create a custom exercise in the main area while preparing or recording a workout; the action says Create and add to workout and uses the existing addition/limit checks. Custom cards and details have a small Custom label; there is no fixed library-count cap.
- Duplicate either type into an independent custom exercise and open its editor. Copies retain the definition, but start active and unfavourited, with no copied workout history or progress. Built-in originals stay unchanged.
- Edit custom definitions, or Archive/Restore them. Past sessions retain their recorded exercise names and results. Restore archived custom exercises before adding them to new workouts or reusing workouts that contain them; hidden built-ins remain usable.
- Permanently delete a custom exercise only when no saved/scheduled workout or recorded workout references it. Used exercises offer Archive instead; built-ins never offer permanent deletion.
- Both types use the same workout, set logging, exercise history and progress systems.

### Prepare and schedule

- An empty workout shows a dotted Add exercise placeholder that focuses the library.
- Create reusable workouts mixing activities such as lifting, running, swimming and cycling, with a title, ordered exercises and exercise notes. Workout and exercise notes share the same full-width outlined disclosure as Rest, with a right-aligned chevron and a filled indicator when text exists. Expanded notes form one bordered field with the disclosure built into its header. Empty notes start collapsed; saved notes open when editing. Collapsing keeps the text; clear the field to remove a note.
- Creation/editing has a Cancel action instead of a My workouts back link. The exercise list scrolls while Save draft and Save workout stay at the bottom. Desktop uses the adjacent library directly; Add exercise switches to the library when Day is showing or on narrow screens.
- Save draft keeps an incomplete workout in My workouts with a Draft label and Continue editing. Drafts may have no exercises; each exercise in the editor keeps at least one set. Unnamed drafts use Untitled workout. Saved drafts survive refresh and can be edited or deleted.
- Save workout requires a title, at least one exercise and at least one set per exercise. It makes a draft ready to start or schedule; drafts cannot do either. Saving an existing workout as a draft makes that reusable workout unavailable for starting/scheduling until ready again, without changing its scheduled copies or recorded sessions.
- My workouts uses narrow vertical cards that wrap across the available width. Cards show the title and exercise count without total sets, followed by a plain bulleted list of every exercise. Long names wrap without a cutoff or inner scroller. Equal-width Edit and Schedule actions sit above a full-width primary Start/Continue workout action at the bottom. Draft cards show their status and a full-width primary Continue editing action.
- Unsaved workout creation/editing recovers automatically after navigation or refresh in the same browser tab, separately for each account and workout. Incomplete and invalid entries are retained. A brief Draft restored toast offers Discard; expiry or dismissal keeps the edits. Discard recovered changes remains under Workout actions afterward. Save or Discard clears recovery; Save draft/Save workout still saves to your account.
- If recovered edits conflict with a newer saved workout, save them as a new draft or discard them to load the latest; recovery never silently overwrites it. If browser storage is unavailable, the editor tells you to save before leaving.
- Cancel leaves unchanged forms immediately. Unsaved changes open a compact confirmation with Keep editing, Discard and a primary Save draft action. Desktop keeps the choices in one row; phones give Save draft its own full-width row. Discarding edits preserves the previously saved workout or draft.
- Workout validation appears beside the title, notes, exercise list or affected set field. Save focuses the first problem and opens collapsed cards/timing fields when needed. Incomplete drafts remain supported; invalid entered values must be corrected.
- Opening Edit on an existing workout starts all exercise cards collapsed, including advanced exercises and recovered edits. Newly added exercises start expanded for setting targets, using compact cards with a six-dot handle, a name that opens exercise help, and a visible remove button. Collapsed cards show only the exercise header, with help, editor controls, reordering and removal still available; expanding restores entered values. In the set editor, Add set sits directly beneath the set rows, before the divider for Notes. Notes expand below their persistent toggle, using the same control as workout notes. Clearing the field removes the note when the workout saves or the session autosaves.
- Adding an exercise updates the workout without an added-exercise notification.
- The last set cannot be removed from an exercise in the set editor or training; remove the exercise itself when it is no longer needed. Additional sets can be removed normally, preserving the remaining targets. Saved or recovered draft exercises with no sets open with one blank, editable set, so Basic always has available measurement fields.
- During workout creation/editing, each exercise header shows a live target summary beside its name, retained when collapsed: 3×12 | 100 kg for matching sets, with a vertical separator before other targets and compact spacing around ×, or ranges such as 3 sets | 8–12 reps | 80–100 kg when targets vary. Mixed measurements group consecutive matching sets in order, such as 1×45s / 2×8 | 80 kg; longer combinations show the first three groups and a remaining-set count. Partially unset targets are identified. Summaries respect selected measurements and preferred units; hidden saved values and actual session results are excluded.
- The creation preview starts each exercise with a set count and shared measurement targets. Basic numeric fields have an attached right-hand up/down control with matching rounded corners, larger chevrons and touch targets, alongside direct typing and select-on-focus. Arrows adjust values in the displayed unit and respect field limits; Tab moves directly between inputs and keyboard arrows still adjust the focused number. Blank targets are allowed. Advanced editor exposes individual warm-up/working-set targets for selected measurements, with a full-width outlined Measurements disclosure matching Notes and Rest. Its header includes the selected measurements and a far-right chevron; the choices open inside the same bordered field. Custom per-set measurements, differing targets or differing between-set rest keep the exercise in Advanced editor when recovered or reopened. Editing a shared target applies it to all sets. Optional Rest between sets uses a connected field header with a compact timer-style Minutes : Seconds input. Its header shows Rest as needed when unset, the saved duration, No rest for zero, or Varies for differing intervals. Its heading stays full width and outlined even when collapsed. With fewer than two sets the entire control dims with a very light neutral tint when disabled, fading in/out as availability changes (instant with reduced motion), with Requires 2+ sets separated from the label by a fixed gap; adding a second set enables it. Reducing back to one collapses the editor without clearing stored rest. Focusing either time field selects its number, so typing replaces existing digits or zero padding directly. Set up to 60 minutes; extra seconds carry into minutes on blur. Unset rest means rest as needed, without a timed target. Unused minutes/seconds stay blank when reopening; clearing the entered duration unsets rest. Only an explicitly entered zero means no rest. Reopening the inline editor keeps that zero in the minutes or seconds field where it was entered. Collapsing preserves the value; changing it applies to every between-set rest, excluding the final set. Exercise/workout notes remain available.
- Reps, load, duration, distance and laps fields select their current number on focus in Basic, Advanced and training. Clicking or tabbing in lets typing replace the existing value directly; blank targets and preferred-unit conversion are retained.
- In the workout builder, use the copy control beside each set’s + and × to apply filled targets or rest to following existing sets separately. Targets apply only to measurements selected in both sets; blank, invalid and hidden source targets leave destinations unchanged. Rest copies unset, zero or a duration only to following intervals before another set. Earlier sets, measurement overrides, notes and recorded results stay intact; unavailable actions are disabled with an ordinary cursor, and a shared toast confirms changes.
- In the workout builder, Add set reuses the previous set’s reps, load, duration, distance, laps and rest targets. The first set starts blank; every new set is independent, with no copied actual results or completion.
- Reset to basic uses a compact confirmation with a short description and Cancel/Reset actions. It removes set measurement overrides, retains shared selected targets/rest, clears differing targets/rest and unselected measurement targets, then returns to basic for adjustment. Cancel preserves the draft; collapsing preserves settings. Set count, notes, intent and recorded results remain intact. Save the workout to persist the reset.
- Each set inherits the exercise’s measurements until customised. Use + beside the set’s × (Add or remove measurements tooltip) to choose its own fields. The + stays highlighted for custom selections, with a tooltip and accessible description explaining the exception; matching exercise defaults clears that state. Options expand below the inputs inside the shaded set outline. A reset icon alongside the options restores inheritance, with a Reset to exercise measurements tooltip. When a set’s selection matches the exercise, it automatically follows exercise defaults again; the reset icon is disabled. Changing exercise defaults updates inherited sets while differing custom sets keep their selections; hidden values are retained.
- Overrides survive draft recovery, reordering, added-set target reuse, saves, scheduling, programs, session logging and repeating workouts. History and statistics use each set’s effective selection and preserve original set numbers when filtering results.
- Set rows show each selected measurement; every selection uses the same outlined set row with measurement fields between the draggable number and remove control. Labels and values retain the same typography as measurements are added. Each selected exercise measurement has its own column, keeping all five on one compact line when space permits. Sets share one horizontal scroll area on narrower screens, with set numbers and actions pinned, complete set outlines and rest controls kept in view. Matching fields retain their positions when another default field is omitted. Set-specific extras use one additional line beneath the default fields. Set/rest spacing stays compact in Advanced editor. Unselected measurement inputs are absent; add them through the measurement selector. Their stored values remain intact. Each set has a draggable number and a removal control. During training, Targets contains only selected measurements.
- Rest appears as an editable line between sets: Rest as needed when unset, No rest for an explicit zero, or a duration such as Rest 1m 30s. It belongs to the preceding set and moves with it. Click a divider in Advanced editor or training to edit its minutes and seconds in a small, single-line control with visible min/sec suffixes, borderless inputs and a keyboard-focus underline. Touch targets remain usable; the basic Rest editor retains its larger labeled fields. Moving between the fields keeps editing open; Enter or leaving the editor finishes editing and Enter restores focus to the divider. Changes apply only to that rest interval. The final set has no rest control. If removing or reordering sets leaves an invalid final rest value, a visible Clear invalid rest action allows saving; adding a following set restores editing. This applies while building and training.
- Enter duration targets and actual results in the selected global duration unit across basic, advanced and live editors. Minutes-and-seconds uses paired fields with blank unused components; seconds, minutes and hours use a single labelled field. Histories, summaries and comparisons follow the same choice. Values remain stored at whole-second precision.
- Choose measurements and intent for each exercise while building or training. Saving captures those choices; scheduled copies, program workouts and recorded sessions retain them independently of later definition edits. Adding or removing a measurement never clears its stored targets or actual values. Use one set for a continuous activity or several for repeated intervals.
- Drag an exercise’s six-dot handle or a set’s number to reorder with a mouse or touch. Set numbers show a subtle border/background on hover or keyboard focus and a visible border on touch. Focus a handle and use Up/Down arrow keys to move it. Escape cancels a drag; release applies the new order. Lists scroll near their edges while dragging. Reordering preserves all targets and set details.
- Training shows saved My workouts and Training programs, each with a primary creation button. Recorded sessions live in History.
- Create a workout beside the My workouts heading. Saved cards use two columns when space allows and one on narrower layouts. Saved cards show the title, exercise/set counts and a compact exercise preview; Start workout is the main action, with quieter Edit and Schedule actions beneath it.
- Schedule a workout as Calendar time. Each scheduled workout keeps its own copy of the exercises, captured names and targets. Starting it preserves those names even if a custom exercise has since been renamed.
- Edit or delete a reusable workout without changing scheduled copies or recorded sessions. Delete workout (or Delete draft) lives in the editor’s ⋯ Workout actions menu beside Cancel and requires confirmation.
- Start a scheduled workout from its Fitness card or Calendar editor; starting it again opens the same session. Starting a separate workout from Fitness offers existing sessions to resume before creating another.
- Pending or uncertain workout/program schedules stay open and protect navigation. After refresh, reopen with the reviewed times and Retry same change using the original request key; retrying cannot create a second schedule.
- Adjust scheduled dates, times, and titles in Calendar. Calendar deletion and undo preserve the scheduled workout link.
- Scheduling does not start or complete a session; actual start/end times are recorded separately.

### Training programs

- Create program beside the Training programs heading opens the dedicated creator. Create named programs from ready saved workouts, with notes, a start date and up to 20 ordered steps. The same workout can appear more than once; the sequence repeats after its last step.
- Choose preferred weekdays to suggest training dates in your account timezone, or leave them unchecked for a flexible rotation. Date suggestions do not reserve Calendar time or prevent training on another day.
- Program forms use numbered workout steps, shared notes controls and a pinned save bar. Fields identify validation errors beside the affected control and focus the first error when saving.
- Unsaved program drafts recover after navigation or refresh in the same account and tab, including incomplete fields and step ordering. A toast announces recovery; Discard recovered changes remains available. Conflicting saved revisions block overwriting. Cancel confirms discarding edits; storage failures warn before leaving.
- Interrupted program saves retain the reviewed input and request key through refresh. Retry same change completes the original save without creating a duplicate program.
- Edit program details, add/remove workouts and reorder steps. Changes apply to future workouts; a workout already started or scheduled retains its captured exercises and targets. Unavailable or draft source workouts are identified so you can replace or skip them.
- Start the next workout directly, or schedule it explicitly. Rescheduling moves the same Calendar entry and keeps your position. Calendar and Fitness open the same linked session.
- Finishing the session advances the program automatically. Skipping advances without recording a workout and removes that step’s reserved Calendar time; an in-progress session must be finished or discarded first.
- Pause/resume programs and filter active, paused or all programs. Pausing stops new program actions but preserves access to existing workouts and Calendar entries.
- Delete a program and its step history without deleting recorded workouts or existing Calendar entries.
- Review the next step, cycle, finished/skipped counts and paginated history with session links. Training includes a link back to its program; Training shows active and paused programs directly, with Show more programs for additional results.
- Counts reflect session corrections/deletions. Deleting the latest session returns that step to ready; deleting an older session does not rewind later steps. Edits preserve step identity when reordering; if a completed step was removed, continuation uses its former position in the revised sequence.

#### Needs work

- Programs repeat one sequence; multi-week phases, deloads and automatic load/repetition progression are not implemented. Schedule one next workout at a time; there is no bulk future scheduling.

### Train

- Live workouts show every exercise in a compact, initially collapsed card, with the creator’s target summary (such as 3×12 | 20 kg) and handled-set count. Expand any exercise to see notes and one set at a time. Multiple cards can stay open. Each expanded exercise uses a compact vertical set stack: its first unfinished set shows values and small Complete/Skip/Edit controls in one desktop row; phones wrap actions below with touch-sized targets. Other sets use short summary rows; completed/skipped rows retain Undo.
- Reorder exercises directly while training using their drag handles or Up/Down keys. Work through exercises in any order without reordering if preferred. Open cards, their selected sets, targets and recorded results stay attached to the exercise through reordering and saves. Only the session order changes; reusable workouts remain unchanged.
- Untouched sets show their selected planned measurements as a compact readout in preferred units. Complete set confirms those displayed values as actual results, so planned reps/load need no repeated entry. Opening a card alone records nothing; skipping does not copy planned results. Undo a skipped set to return it to the queue, then confirm its planned values with Complete set. Missing targets stay unknown, and existing partial results—including explicit zero and cleared fields—are never filled from targets.
- Deliberately clearing all actual measurements survives saving and refresh; those blanks are not replaced by planned targets.
- Edit results reveals prefilled fields for the selected set; edits autosave, and Done editing returns to the readout. Custom set measurements are respected, hidden measurements remain intact, and completion requires at least one valid result. Complete/Skip advances to the first unfinished set within that exercise; upcoming sets cannot be selected directly. Undo clears only the chosen set’s completion/skip status, retains its values, cancels the rest timer and preserves later results. The user still chooses which exercise to do next. Reload starts cards collapsed and selects each exercise’s first unfinished set when expanded. Finishing the workout remains explicit.
- Edit workout uses the creator’s collapsible exercise cards, starting closed, with shared targets and optional Advanced editor for individual sets, measurements, rest, notes and intent. Add exercise opens the library. Back to training returns to the retained live view, including its open exercise and current set. Target edits preserve recorded results; only this session changes. New cards stay open through automatic saves and server identity assignment.
- Removing exercises or sets with recorded, skipped or deliberately edited results requires confirmation. Undo removal restores the removed results, including after the removal saves. Typed basic set counts apply on leaving the field, so entering a multi-digit count does not truncate sets between keystrokes.
- In live workouts, exercise help opened from an exercise or Last time returns directly with Back to workout or Escape, preserving the open exercise, current set, scroll and opener focus. Error states retain the same direct return. Details opened from the library still return to that library; the creator keeps its existing side-pane flow.
- Both workout preparation and training show compact Last time references with the latest actual sets and date for the selected measurements. Open the reference for the full exercise history without leaving the workout. Missing measurements stay explicit, and the current session is excluded.
- Rest appears as a divider between each pair of sets, matching the advanced editor: Rest as needed, No rest, or a configured duration. Click the divider to edit its compact minutes/seconds fields. No rest divider follows the last set. Completing a set starts its configured rest timer above the exercise list when another set follows in that exercise. Dismiss the timer to continue at your own pace; unset and zero rest do not start a timer. Timers identify their exercise and survive editor switches, navigation and refresh in the same tab, scoped to the account and session.
- Session edits save automatically after a short pause. Keep editing while a save runs; later edits queue behind it and older responses cannot replace them. Uncertain saves pause further edits until their outcome is confirmed. Clean Saved status remains available to assistive technology without a standalone visible label; Saving, Unsaved changes and conflict status appear beside the live header controls. Save changes appears while edits are unsaved. Workout details uses an outlined disclosure for title, start time, notes, Save as reusable workout and confirmed Discard workout.
- Recover session edits across navigation and refresh in the same tab, including incomplete or invalid measurements and date/time entries. Validation identifies affected fields and Save changes focuses an error. Invalid fields keep the session marked Unsaved changes and block saving until corrected. Stale drafts cannot overwrite newer saved changes. If local recovery storage fails, leaving with unsaved changes requires confirmation; pending or uncertain writes protect navigation.
- Uncertain session saves offer Retry same change with the same request key, including after refresh. Any edits queued behind that save remain available afterward.
- Finish a partially completed session with confirmation while preserving skipped and unfinished sets; at least one completed set is required.
- Discard an accidental session with confirmation. Workout deletion, exercise deletion, discarding program/schedule edits and finishing an incomplete workout use matching dialogs with explicit action labels.

### Review and reuse

- Open History to search recorded workouts, filter by In progress or Finished, and load more. Workout choice and History status use searchable custom dropdowns that float over content and dismiss with one outside click, including nearby blank space.
- Finished workouts open a compact read-only review with date, elapsed time, completion counts, notes and actual exercise summaries. Expand an exercise for individual recorded sets; unknown results stay unknown, explicit zero stays zero, and skipped/unfinished sets are labelled. Opening review records no changes.
- Choose Correct results to edit titles, notes, exercise/set details and actual start/end times. Corrections save automatically; Done correcting returns to review after saving. Start and finish times each show their own validation; correcting one does not clear an error in the other.
- Finished sessions appear on Calendar with one source of recorded time. Corrections and deletions update Calendar.
- Repeat a previous session with fresh set completion and empty actual performance; reuse its measurements, intent tags and targets, or actual values where targets were absent.
- Save session exercises and targets as a separate reusable workout.
- Review completed-set history for an individual exercise and open its original session.
- Delete a session with confirmation; its planned Calendar time remains.

### Exercise history and statistics

- Each exercise’s History view opens with all recorded measurements and shows its full last-session set table and expandable older sessions, including load, reps, duration, distance or laps as applicable. A dropdown lists recorded measurement combinations for filtering; references opened for a specific combination retain that filter, with All recorded measurements available. Unknown measurements remain labelled Not recorded. There is no separate Progress tab.
- Weekly totals sit in a secondary disclosure with previous/next navigation. Weeks follow account timezone and week-start preferences.
- See finished workout count, summed session duration including rest, completed sets, and recorded volume. A workout and its full duration belong to the week it started; planned workouts, ongoing sessions, skipped sets and unfinished sets are excluded.
- Volume means actual load × reps for sets whose captured measurements include both Reps and Load, including selections with additional measurements. Unknown values stay unknown, zero load stays zero, and partial totals identify the number of sets missing measurements. Load and volume follow the preferred kg/lb unit.
- Browse exercise history from the Training library, inline picker or a workout. Archived exercises retain history. Set tables respect each set’s captured measurements; unselected fields show a dash and intent tags do not divide history. Select a recorded combination for comparable records and statistics.
- Review all-time personal records for highest load, most reps, longest set, longest distance, most laps or highest set volume, as applicable. Records show the actual set measurements and link to their source workout; ties use the earliest workout.
- Personal records and session statistics sit in secondary disclosures. Switch statistical measures and open source sessions; history follows workout dates rather than entry dates and supports loading older sessions. Latest-versus-previous comparisons flag incomplete measurements. The dot charts have been removed.
- Compare a saved workout with the most recent earlier finished workout having the same exercises and captured measurement selections, even when exercise order changes. Repeated exercises with identical selections match in occurrence order. Compare session duration and each exercise’s completed sets, best measurements and known volume side by side; matching titles alone do not establish a comparison.
- Corrections and deletions update derived progress and records. Exercise renaming and archiving preserve access to recorded results.

### Needs work

- The workout creation layout is an owner-requested experiment and may be reverted after review.
- The live session experience needs further work.

- Exercise visuals are placeholders until the actual assets are ready.
- Catalogue expansion toward 75–100 exercises, primary/secondary muscle roles and illustration highlighting are planned for later.
- Progression recommendations, analytics beyond the current records/trends, supersets and drop sets are deferred.
- The built-in library remains focused on lifting/bodyweight exercises; create custom activities for running, swimming, cycling and other exercise. Older standalone cardio backend records remain separate from the shared workout/progress flow.
- Sessions support up to 50 exercises and 100 sets per exercise; recorded duration is limited to 31 days.
- Recovery drafts and rest timers remain local to the current tab; they do not sync across devices.
- Fitness edits and scheduling are outside Calendar undo/redo; Calendar actions retain their existing history.
- Calendar copying duplicates time plans only, without the attached workout definition. Use Fitness scheduling to place another workout.

## Food

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
- Forms keep labels clear of visible keyboard-focus outlines and show validation feedback; failed reads offer retry controls.
- Supported saves retain their request when a response is uncertain so retrying does not create duplicate records.
- Conflicting edits are rejected instead of silently overwriting a newer saved version.
- Dates and local-day summaries follow the account timezone, including daylight-saving changes.

### Assistant preview

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
