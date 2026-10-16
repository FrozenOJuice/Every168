# Features

The project at a glance: what each area has and what needs work. Keep descriptions short and update them as the app grows.

Scope: the whole app, including account access, settings, Calendar, Unscheduled plans, Routines, daily measurements, Fitness and the planned Food workspace, Goals, and Admin. The [product scope](SCOPE.md) describes the direction and future phases; feature bullets below describe current functionality.

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
- Strength activity opens its Fitness session for review or correction. Retained Food and cardio activity stays visible without links to the retired pages.

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

- Main navigation contains Calendar and Fitness on desktop and mobile.
- Unscheduled, Routines, and Goals pages are retained for later scope decisions and accessible by URL; they are absent from main navigation.
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

### Needs work

- Unscheduled plans are retained for later Tasks scoping and absent from main navigation.

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

- Routines are retained for later Tasks scoping and absent from main navigation.
- Checklists support up to 50 steps.
- Completing a routine does not create Calendar blocks or record a timed session.

## Daily measurements

- Log water or weight through Calendar quick actions, with a date and time.
- Measurement logs appear as Calendar moments without allocating time.

## Fitness

### Workspace

- The wider main area shows Next workout, saved My workouts, creation/start actions and secondary History access. A persistent exercise library sits on the right; no top-level tabs or separate Browse exercises screen.
- Create/edit a reusable workout or start training in the main area, replacing its default content. Clicking an exercise card always opens details. While a workout is open, hovering or keyboard-focusing a card replaces its equipment/muscle preview with an inset button with a soft border and faint green tint, showing + beside Add to workout in the information area; clicking it adds without opening details. The name and illustration remain visible. Touch screens show the action without hovering. The independent favourite star stays top-right. There is no separate Info button or bottom Add row. Exercises can also be added from details, each with an unfinished set. Titles, notes, ordered exercises and targets remain in place.
- Exercise help/details replace the right-side library while the main workout stays visible. Back to exercises restores the library filters and scroll position.
- Exercise creation/editing uses the main area while retaining the current workout's draft. The right library remains available on desktop; saving or cancelling returns to the previous main view. Creating an exercise while building or training adds it to the current workout.
- On narrow screens, Add exercise/Help shows the library or details, and Back to workout restores the active editor or training view without losing its state. Exercise forms use the main area and return to the library when closed.
- Next workout uses the earliest unstarted linked Calendar workout whose scheduled time has not ended. Calendar moves update it; started instances and deleted links are excluded. A matching title on an ordinary Calendar block does not establish a Fitness connection.

### Exercise library

- On desktop, the main workout area and right library/details use the remaining viewport height with equal 16px outer spacing and scroll independently. The right panel keeps its width while switching between browsing and building, with two card columns, a full-width search row and compact toolbar controls.
- While search, equipment/muscle filters, Favourites or Hidden are active, the matching exercise count appears in muted text beside Clear all. It hides when no filters are active; the library heading and space above the cards stay clear.
- Browse 16 built-in strength exercises with equipment, muscle groups, short instructions, and visual placeholders. Cards emphasize the exercise name, show equipment beneath it, and show as many muscle tags as fit on one line, with a +N count for the remainder; details show all muscles. Long card names and equipment lists use at most two lines, with full text available on hover; custom labels remain visible.
- In the Filters panel, a compact dropdown without search controls sorting; in the desktop library panel it sits below Equipment and Muscle group. Sort built-in and custom exercises together by Name A–Z (default), Name Z–A, or Recently added. Recently added puts newest custom exercises first, then built-ins alphabetically; favouriting or hiding a built-in does not change its order. Sorting applies alongside filters, and Clear all preserves the chosen sort.
- The library toolbar contains Search, Favourites, Hidden, then Filters. On very narrow phones, Search uses its own full-width row. Hidden is a quieter outlined icon-only button with a tooltip and green active state; Favourites also uses an icon on narrow screens. Hidden switches to hidden built-ins and archived custom exercises; one visibility filter covers both.
- Filters slides open and closed below the toolbar; reduced-motion settings disable the animation. Equipment and Muscle group search fields share the panel width equally. A list of full-width option rows floats below the active field without enlarging the panel; click anywhere on a row to toggle it, and selected rows show a checkmark. Options hide when focus leaves the group, and only the option list scrolls. Arrow keys navigate options; Home/End move to the first/last option. Escape first closes options and returns to search, then closes Filters on a second press.
- Results update immediately, matching any selected option within each group and combining equipment with muscles. Selected equipment and muscle filters appear as removable chips below the panel and remain below the toolbar when it closes; all tags share one horizontally scrollable row, so muscle tags never wrap below equipment. The scrollbar is hidden; an edge fade indicates more tags offscreen, and touch, trackpad and keyboard scrolling remain available. One Clear all button stays fixed at the right and vertically centered with the tags; it resets filters, visibility, favourites and exercise search. The Filters badge counts equipment and muscle choices; Favourites and Hidden show their own active states.
- Filters stays open while browsing results. Click Filters again or press Escape from the panel to close it; Escape returns focus to the Filters button. Filtering works for built-in and custom exercises alike.
- Favourite or unfavourite an exercise from its details or the star at the top-right of its card. Empty card stars appear on hover or keyboard focus and stay visible on touch screens; filled stars stay visible. Card stars are outlined until favourited; favourited stars stay filled even on hover. Hover or keyboard focus adds a subtle tinted button background and preserves the card outline. Pointer clicks do not leave a focus outline or keep an empty star visible after moving away; keyboard navigation retains visible focus. Clicking the star does not open details; starred exercises appear in the Favourites filter, including when choosing exercises for a workout. Favourites are private, persist across refreshes, and retain their status when hidden, shown, archived or restored.
- Select an exercise to replace the right library with its name and favourite star, large illustration placeholder, bulleted equipment list, muscle tags, and instructions. Back to exercises returns to the library; the main workout remains intact.
- Add an exercise to an existing workout or begin building a new workout from it.
- Browsing does not create personal records. Favourites and built-in visibility are private account preferences, separate from exercise definitions.

### Built-in and custom exercises

- Built-ins are curated, read-only definitions. Favourite, Hide, or Duplicate them; their core names, instructions, equipment and muscles cannot be edited or permanently deleted.
- Hide removes a built-in from the active library without affecting saved workouts, logging or history. Find it using Hidden and choose Show in library to restore visibility.
- Create a private custom exercise with a name, optional instructions, equipment, muscles worked, and a Favourite star beside the Create/Edit heading. Search fields stay above removable selected chips; arrows/Enter select options, Escape/outside click closes them. Removing a chip keeps the dropdown closed instead of returning pointer focus to search. Keyboard removal focuses another chip, or the closed search field when none remain. Nearby blank-space clicks dismiss and release search focus in one click.
- Create a custom exercise in the main area while preparing or recording a workout; it is added to the current workout. Custom cards and details have a small Custom label; there is no fixed library-count cap.
- Duplicate either type into an independent custom exercise and open its editor. Copies retain the definition, but start active and unfavourited, with no copied workout history or progress. Built-in originals stay unchanged.
- Edit custom definitions, or Archive/Restore them. Past sessions retain their recorded exercise names and results. Restore archived custom exercises before adding them to new workouts or reusing workouts that contain them; hidden built-ins remain usable.
- Permanently delete a custom exercise only when no saved/scheduled workout or recorded workout references it. Used exercises offer Archive instead; built-ins never offer permanent deletion.
- Both types use the same workout, set logging, exercise history and progress systems.

### Prepare and schedule

- Create reusable strength workouts with a title, ordered exercises and exercise notes. Optional workout notes start collapsed behind Add notes.
- Creation/editing has a Cancel action instead of a My workouts back link. The exercise list scrolls while Save draft and Save workout stay at the bottom. Desktop uses the adjacent library directly; Add exercise switches to the library on narrow screens.
- Save draft keeps an incomplete workout in My workouts with a Draft label and Continue editing. Drafts may have no exercises or sets; unnamed drafts use Untitled workout. Saved drafts survive refresh and can be edited or deleted.
- Save workout requires a title, at least one exercise and at least one set per exercise. It makes a draft ready to start or schedule; drafts cannot do either. Saving an existing workout as a draft makes that reusable workout unavailable for starting/scheduling until ready again, without changing its scheduled copies or recorded sessions.
- Cancel leaves unchanged forms immediately. Unsaved changes offer Save draft, Discard or Keep editing; discarding edits preserves the previously saved workout or draft.
- Added exercises use compact cards with a six-dot handle, a name that opens exercise help, and a visible remove button. Add set and optional exercise notes sit beneath the set list.
- Planned sets use compact numbered rows with reps and load together. Expand a row's chevron for optional duration and rest; collapsed rows still show any saved timing values. Each set has a visible remove button.
- Drag six-dot handles to reorder exercises or sets with a mouse or touch. Focus a handle and use Up/Down arrow keys to move it. Escape cancels a drag; release applies the new order. Lists scroll near their edges while dragging. Reordering preserves all targets and set details.
- The default main area shows Next workout first, saved My workouts below it, and History as a secondary disclosure. Empty sections use short, unboxed messages.
- Create a workout beside the My workouts heading. Saved cards show the title, exercise/set counts and a compact exercise preview; Start workout is the main action, with quieter Edit and Schedule actions beneath it. Start empty workout is a secondary action below the saved list.
- Schedule a workout as Calendar time. Each scheduled workout keeps its own copy of the exercises and targets.
- Edit or delete a reusable workout without changing scheduled copies or recorded sessions.
- Start a scheduled workout from its Fitness card or Calendar editor; starting it again opens the same session.
- Adjust scheduled dates, times, and titles in Calendar. Calendar deletion and undo preserve the scheduled workout link.
- Scheduling does not start or complete a session; actual start/end times are recorded separately.

### Train

- Record actual reps, load, or duration alongside compact planned-target summaries, using the preferred kg/lb unit. Expand targets, exercise details, and workout details when needed.
- Mark sets Completed or Skipped; other sets remain Unfinished. Skipping remaining sets preserves already completed sets.
- Add, remove, and reorder exercises and sets during the session without changing the reusable workout. Visible remove buttons and six-dot handles use the same mouse/touch and keyboard behavior as the builder, preserving actual results and completion state.
- Show the latest recorded completed set from another session for each exercise when available.
- Start an optional rest timer when completing a set with a rest target.
- Session edits save automatically after a short pause; Save changes is also available.
- Recover session edits across navigation and refresh in the same tab. Stale drafts cannot overwrite newer saved changes.
- Uncertain saves offer Retry same change with the same request key.
- Finish a partially completed session while preserving skipped and unfinished sets; at least one completed set is required.
- Discard an accidental session with confirmation.

### Review and reuse

- See recent workouts in History; expand it to search and filter by In progress or Finished, and load more. Workout choice and History status use searchable custom dropdowns that float over content and dismiss with one outside click, including nearby blank space.
- Review and correct titles, notes, exercise/set details, and actual start/end times.
- Finished sessions appear on Calendar with one source of recorded time. Corrections and deletions update Calendar.
- Repeat a previous session with fresh set completion and empty actual performance; reuse its targets, or actual values where targets were absent.
- Save session exercises and targets as a separate reusable workout.
- Review completed-set history for an individual exercise and open its original session.
- Delete a session with confirmation; its planned Calendar time remains.

### Needs work

- History is accessible from the right-side disclosure; its final placement remains to be decided.

- Exercise visuals are placeholders until the actual assets are ready.
- Catalogue expansion toward 75–100 exercises, primary/secondary muscle roles and illustration highlighting are planned for later.
- Training programs, progression recommendations, advanced analytics, supersets, drop sets, and cardio UI are deferred.
- Sessions support up to 50 exercises and 100 sets per exercise; recorded duration is limited to 31 days.
- Recovery drafts and rest timers are local to the current tab; the timer is not restored on refresh. Unsaved session fields pause briefly while a save is in flight.
- Fitness edits and scheduling are outside Calendar undo/redo; Calendar actions retain their existing history.
- Calendar copying duplicates time plans only, without the attached workout definition. Use Fitness scheduling to place another workout.

## Food

### Needs work

- A new Food workspace is planned. The old frontend is removed; backend APIs and stored records remain.
- Retained food activity is visible on Calendar, but its editing/history UI is unavailable until replacement workflows are implemented.
- Recipes, barcode scanning, external food lookup, and custom nutrition targets are not available.

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
- Forms keep labels clear of visible keyboard-focus outlines and show validation feedback; failed reads offer retry controls.
- Supported saves retain their request when a response is uncertain so retrying does not create duplicate records.
- Conflicting edits are rejected instead of silently overwriting a newer saved version.
- Dates and local-day summaries follow the account timezone, including daylight-saving changes.

### Needs work

- Cross-domain AI and dedicated mobile/desktop apps are planned but not implemented.
- Custom domains are deferred until later, before the stretch-goal watch app; neither is implemented.
- Public domain sharing and social features are not implemented.
