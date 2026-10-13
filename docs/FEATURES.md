# Features

The project at a glance: what each area has and what needs work. Keep descriptions short and update them as the app grows.

Scope: the whole app, including account access, settings, Calendar, Unscheduled plans, Routines, Food, Exercise, Goals, and Admin.

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
- Use the top-right arrows to move one day, week, or month at a time.
- Today returns to the current date in the active view.
- Switching views follows the selected date: a selected Month day opens its week or day; a selected Week time slice opens that day.
- Dates, times, and week boundaries follow account settings.

#### Day

- The heading above the grid shows the weekday and date and can be selected.
- The date button shows the full month, day, and year.
- Clicking the date opens a small calendar; hovering over another day outlines it.
- The activity list on the right shows plans and recorded activity for that day.
- Ongoing activity appears as Now, and the next upcoming item appears as Next.
- Earlier, Now, and Coming up groups organize the remaining activity without repeating Next.
- Activity from another domain links back to its source.

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
- The plan anchor is the most recently clicked plan, including a ⌘/Ctrl-click. Shift-click uses that anchor.

#### Days

- In Day view, click the heading above the grid to select the day.
- In Week view, click a day heading; in Month view, click a day cell.
- The outline appears on mouse-down. Selected days get an outline; their plans do not individually get filled colors.
- In Week and Month, drag across days to select a continuous range.
- Shift-click selects the range from the day anchor to the clicked day.
- ⌘-click / Ctrl-click adds or removes individual days.
- The day anchor is an ordinary click, the start of a drag, or a ⌘/Ctrl-click when nothing was selected. Further ⌘/Ctrl-clicks keep that anchor.
- Clearing the selection resets its anchor.

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
- Save creates the plan. Clicking outside or pressing Escape cancels an unsaved draft.
- A click used to cancel the draft does not also select the calendar underneath it.
- Plans can overlap and continue past midnight.
- Passing a plan's scheduled time does not automatically record activity.

#### Editing and moving

- Double-click a plan, or press Enter when it is focused, to open its compact editor.
- Change its title, date, start/end times, and notes; notes are under More details.
- Use Duplicate in a timed plan's actions to open a separate draft with the same details.
- Drag a timed block to another time or day, preserving its duration.
- A ghost remains at the original position while the moving block snaps to its destination.
- The moving preview shows the title, time range, date, and Escape-to-cancel hint.
- Drag the top or bottom edge to resize a block; its height changes during the drag.
- Release to save a move or resize; press Escape to cancel.
- In Month view, moving a timed plan to another day preserves its clock time.
- The editor also provides move/resize controls for touch use and precise time entry.

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
- Add a time creates a separate timed plan and keeps the original all-day plan.

#### Repeating plans

- Repeat timed or all-day plans daily or weekly, including custom intervals and selected weekdays.
- Add repetition while creating a plan, or choose Repeat from an existing plan's editor. The original plan becomes the first occurrence.
- Choose an end date and preview the occurrences before saving.
- An occurrence's editor shows its repeating schedule and provides Edit repeating rule.
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
- Duplicate creates independent plans at the same dates and times without replacing the clipboard; the group is one undo action.
- Right-click empty Day/Week time for Add plan here or Paste here, snapped to five minutes.
- Plan menus also offer Paste here. In the Day/Week timed grid, use the five-minute time under the pointer, even over an occupied block; keyboard-opened menus use the focused plan’s start time. Month and all-day row targets use the clicked day and preserve copied clock times. Mixed groups retain their types and spacing; overlap is allowed.
- Right-click empty all-day space for Add all-day plan or Paste. Pasting preserves timed and all-day plan types.
- Right-click a day heading or Month cell for Open Day, Add plan, Copy day, and Paste into day. Open Day is omitted in Day view.
- Selected days offer Copy selected days and Paste. Paste uses the day invoked as its destination anchor, preserving relative dates and clock times.
- Right-clicking a selected plan or day preserves its group; an unselected plan or day becomes the sole selection. Empty-space menus preserve the existing selection.
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
- Applying a template can be undone as one action.
- Creating, splitting, editing, stopping, or deleting repeating plans is one undo action. Undo restores previous rules, individual edits, and excluded dates; undoing conversion restores the original standalone plan.
- Activity created through Calendar forms can be undone, including food, water, weight, cardio, workout starts, and manually recorded time. Undo removes the original activity record as well as its Calendar entry.
- Undoing a paste removes all plans created by that paste; undoing a group deletion restores the group.
- Undoing plan changes preserves recorded activity when restoring or removing plans.

### Feedback messages

- Copying shows a brief confirmation.
- Pasting, duplication, supported deletions, template application, and Calendar activity logging show a brief message with Undo.
- Undo remains available by keyboard after the message disappears.
- Missing selections and empty copies show guidance; failed actions show an error and offer retry where supported.

### Search and filters

- Search opens a compact panel; clicking outside or pressing Escape closes it.
- Search by title and filter by record type.
- Optionally limit results by date; browse further results from calendar history.
- Apply filters to the visible calendar and clear them to show everything again.

### Templates and quick actions

- Calendar tools contains Repeating plan, All-day plan, Templates, and Quick actions.
- Save a named template from a day, week, or date range.
- Rename or delete saved templates.
- Choose a start date and number of cycles, preview, then apply a template to create independent plans.
- Quick actions open activity-entry forms from Calendar, using the chosen date/time where supported.
- Starting a workout through Calendar keeps you on Calendar with an Undo option; open the workout to continue it.
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

- Navigate to Calendar, Unscheduled, Routines, Food, Exercise, and Goals.
- Open Settings through the account menu.
- Choose a timezone or use the device's timezone.
- Choose Sunday or Monday as the first day of the week.
- Choose weight and distance units.

### Categories

- Create and edit life categories in Settings, with a name and optional color.
- Archive categories; existing records keep their category.
- Assign categories to goals.

## Goals

- Create and edit a goal with a title, optional description, target date, and category.
- Set its status to Active, Completed, Paused, or Archived.
- Browse goals by status and load more results.
- Complete a goal directly from its card; reopen a completed goal as active.
- Cards show the goal's status, description, and target date when provided.

### Needs work

- Numeric targets, milestones, and automatic completion are not available.

## Unscheduled plans

- Keep plans in a separate sidebar list until they have a scheduled time.
- Create and edit a title, notes, and optional date.
- Leave the date blank to keep a plan in the backlog; dated plans can appear in Calendar without occupying timed space.
- Schedule a plan by choosing its date and start/end times.
- Scheduling replaces the unscheduled item with a timed block and opens that date in Day view.
- Delete an unscheduled plan through its editor, with confirmation.
- Load more items when the list has additional results.

## Routines

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

## Food

### Food library

- Create and edit foods with a name, serving amount, and serving unit: grams, millilitres, items, or servings.
- Enter calories per serving and optional protein, carbohydrates, fat, and fibre.
- Search saved foods.
- Archive foods, show archived foods, and restore them for future use.

### Daily log

- Move between dates to review meals, nutrition, water, and weight.
- Log a saved food under Breakfast, Lunch, Dinner, Snack, or Other.
- Choose the number of servings, including fractional servings, and when it was eaten.
- Create a missing food while logging, then return to the entry.
- Edit or delete a food entry; repeat an existing entry to log it again.
- Review daily nutrition totals for calories, protein, carbohydrates, fat, and fibre.
- Unknown nutrient values stay unknown instead of being counted as zero; totals indicate missing values.
- Logged entries keep their original food details and nutrition when the library food changes or is archived.
- Search food-entry history and load more results; repeat entries using their saved food details.
- Food entries appear as moments on Calendar, linked back to Food.

### Water

- Log 250 ml or 500 ml with quick buttons, or enter a custom amount.
- Choose or correct the time the water was consumed.
- See the selected day's total and individual entries.
- Review water history; edit or delete entries.
- Water logs appear as Calendar moments without allocating time.

### Weight

- Log a weight and measurement time in the preferred kg/lb unit.
- See the latest measurement through the selected day and that day's entries.
- Review a 30-day trend chart.
- Browse the full measurement history; edit or delete entries.
- Weight logs appear as Calendar moments.

### Needs work

- Recipes, barcode scanning, external food lookup, and custom nutrition targets are not available.
- The weight trend chart shows up to 200 measurements over 30 days; remaining measurements are available in history.

## Exercise

### Exercise library

- Create and edit named strength exercises with optional notes.
- Search exercises; archive and restore them.
- Existing workouts retain their saved exercise details when the library changes.
- Create an exercise while building a workout.

### Strength workouts

- Start a workout with a title, start time, optional notes, and optional linked Calendar plan.
- Add exercises and reorder or remove them.
- Add sets with repetitions, load, and/or duration; mark sets completed or incomplete.
- Repeat the last set, reorder sets, or remove them.
- Add notes to each exercise in the workout.
- Enter loads in the preferred kg/lb unit; missing loads remain unknown.
- Save an in-progress workout and resume it later. Workout edits require an explicit save.
- Finish a workout now, or enter its actual finish time when logging a past workout.
- Edit completed workouts; clearing the finish time reopens a workout and removes its completed Calendar time until it is finished again.
- Search workout history and filter by in-progress or completed status.
- Delete a workout and its generated Calendar time.

### Cardio

- Log an activity type, title, start time, and duration.
- Optionally add distance, notes, and a linked Calendar plan.
- Enter distance in the preferred km/mi unit.
- Search cardio history and filter by activity type.
- Edit or delete an activity; its Calendar time updates or is removed with it.

### Calendar connection

- Finished strength workouts and cardio produce recorded sessions on Calendar.
- Linking a session to a plan keeps planned and recorded time separate.
- Open the source activity from Calendar to edit it.
- A recorded session is counted once, even when it also has a linked plan.

### Strength progress

- Review an exercise's completed sets from finished workouts, newest first.
- See the maximum recorded load and individual set details.
- Timed sets count even without a load; incomplete sets and unfinished workouts do not count toward completed progress.

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

- Responsive layouts support desktop, tablet, and phone screens.
- Forms show validation feedback; failed reads offer retry controls.
- Supported saves retain their request when a response is uncertain so retrying does not create duplicate records.
- Conflicting edits are rejected instead of silently overwriting a newer saved version.
- Dates and local-day summaries follow the account timezone, including daylight-saving changes.

### Needs work

- Custom/public domains, social sharing, and native mobile apps are not implemented.
