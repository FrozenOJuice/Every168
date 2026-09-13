# Core UI standards

The owner approved a calendar-first home after backend hardening. This document records the implemented UI direction; feature slices should follow it when extending their workflows.

## Navigation and information hierarchy

- Primary destinations: Calendar (`/`), Food, Exercise, Goals. Use the slim desktop sidebar; at widths up to 900px, use four labeled bottom navigation items and an account control in the top bar. Nested exercise routes keep Exercise selected.
- Account disclosure: identity, Settings, Sign out. Keyboard Escape closes it and restores focus. Settings contains preferences and categories.
- Calendar is the central general planner. Date and Day/Week/Month view live in URL query parameters. The old `/week` URL redirects to Calendar. Food and Exercise use local section controls with URL state.
- Domain page headers contain a title, one useful description and the page’s main actions. Calendar uses an integrated top toolbar so its grid fills the workspace. Domain reporting and tracking controls belong inside their domains.
- Calendar has no details toggle or extra settings/summary/Today panel beneath it. Compact tools/search dialogs and selected-date quick actions are authorized; reporting surfaces remain in their domains.

## Calendar behavior

- View controls appear as Day, Week, Month; Week is the default on every viewport. Date navigation is Previous → Today → Next, with the arrows stepping by the active view. Navigation, view selection, and Add block sit in the top toolbar. Calendar occupies the available viewport height.
- Week and Day share a 24-hour time grid. Today starts near the current time; other selected dates start at 07:00. Scrolling is remembered in page memory across periods and views; Today resets it to the current time. Week keeps seven readable columns in a contained scroller on smaller screens, initially revealing the selected date. Headers and the time axis stay visible. The date title opens a date picker, and a live marker follows the account timezone without moving the scroller each minute.
- Selecting the grid prefills creation in 15-minute increments; hover previews show the selected time. Keyboard users use Add block or focus an existing record to edit. The editor offers 15/30/60/120-minute durations. Changing Start preserves elapsed duration across dates and clock changes; changing End sets a new duration. Invalid or ambiguous local times remain editable and must be resolved before saving.
- Month follows the preferred week start and displays four to six rows, including spillover dates. Available cell space determines up to three previews. “+N more” opens all records for that day. Narrow cells use one large date/count button opening the same list, with Add block and Open Day view actions. Empty wider cells offer creation when space permits. Date/view changes survive reload and browser history; month arrows clamp at shorter month ends.
- Plans and actual entries appear together, with solid/dashed borders, a legend, and explicit accessible labels. Linked records remain separate entries at their real times and accessible from the editor; no plan is inferred to be completed. API summaries still account for planned and recorded time separately.
- Short records receive usable targets with title/time priority, and colliding targets occupy separate lanes. Week displays two lanes per overlap group; excess records are accessible through a count button in the day header. Other records stay on the grid. Day permits every lane with contained scrolling. Overnight continuations show an end-time/continuation label. Clock-change days use an ordered list in Day with explicit zone labels for repeated/missing hours.
- Planned blocks retain category/goal fields and Log actual in their editor. Duplicate opens a draft for the following local date with the saved title, category, goal, notes and duration. Nothing is created until Save; recorded time and identity/revision fields are never copied. New or moved plans reveal their saved date/time. Recorded activity remains visible and links to its source domain. Search/filter and quick actions live in compact top controls and dialogs; the lower summary/health panel remains removed.
- Month loads at most six existing week endpoints through the typed API client. A failed week has a retryable error, never a false empty calendar. Editing invalidates the same week caches across every view. Date-only plans load separately for the same bounded visible range. Their sticky row, Month previews and day lists keep them outside timed allocation.

- Calendar tools offer finite daily/weekly rules, one-occurrence/whole-series editing, unscheduled plans and atomic scheduling, copying and templates. Review bulk copies before applying them. Search filters visible records or searches all history by title/category/type/date. Filters retain canonical linkage/overlap metadata.
- Desktop pointers can move planned blocks, resize their edges and drag empty time into a draft; Month previews move by date. Touch users select Move/Resize from the block editor, then drag the selected block in Day. Ordinary touch gestures continue to scroll. Always retain form editing. Use 15-minute previews, cancellation and same-intent retries; never drag actual source activity into a new record.
- At narrow widths, the Add button becomes a labeled plus icon so all toolbar targets fit. Quick actions reuse the domain forms and prefill the selected date; they do not infer activity from plans.

## Visual standards

Food keeps Daily log and Food library as URL-addressable sections. The daily page has a date heading, Previous → Today → Next and a labeled date picker. Meals and canonical nutrition totals are the primary content; water and weight sit alongside on wide screens and stack below on smaller screens. Each meal offers a direct add action. Recent food opens searchable, paginated history for repeat logging. Creating a missing food returns to the logging draft. Water shortcuts save the selected date explicitly; weight review labels older measurements and plots only actual points. History supports edits/deletes, and food definitions support archive/restore. Every form keeps the shared validation, conflict and retry behavior.

- Use the exact eleven semantic color tokens in `168HOURS_BUILD_SPEC.md`. Never alter the palette to create a new visual theme. Category colors are organizational hints accompanied by names.
- Use system sans-serif fonts. Body text is 14px; page titles scale from 26–32px, section headings are about 17px, form labels 13px. Calendar cells use compact type and expose full information in their editor or Day view.
- Use a 4px spacing rhythm, principally 8/12/16px within groups and 24/32px between sections. Common controls and panels use an 8px radius; dialogs use 12px. Borders and spacing establish groups; shadows are reserved for overlays.
- Use the green primary button for the main action, bordered buttons for secondary actions, and destructive text for deletes. Controls should have 44px touch targets; avoid hover-only actions.
- The muted foreground on the muted background falls below 4.5:1 contrast. Use foreground text on muted controls, or put muted text on card/background surfaces.
- Share base styles in `app/globals.css`; shell, calendar and existing domain styles are separated under `styles/`. Keep feature behavior in feature components, separate from layout and styling.

## Forms and states

Exercise retains Strength, Cardio and Exercise library sections. Histories offer title search and status/type filters, with explicit creation-order labels. Workout sets remain the main editing surface, with move/remove/repeat controls; repeated sets start unchecked. A new exercise returns selected in the picker. Finish now or enter the real finish time of a past session; clearing a completed finish requires confirmation. The explicit save bar stays above phone/tablet navigation. Cardio shows seconds for short activities and formats optional distance/pace in preferred units. Archive/restore and per-exercise progress live in the library.

- Persistent labels, explicit units, inline validation, visible busy state and a clear save action are required. Dialogs use the native modal element, a labeled heading, a close control and Escape dismissal. Closing restores focus to the opener when it still exists, without scrolling the page.
- Keep drafts on recoverable/stale-save errors. Preserve the shared Form/useCommand revision and idempotency behavior. An uncertain write exposes an explicit retry of the same intent. Do not silently substitute a newer revision.
- Confirm deletes. Source-backed time must be edited through its source activity; deleting a plan retains recorded time.
- Show useful empty, loading and recoverable error states. Do not invent statistics or treat missing measurements/nutrients as zero.
- Scope browser verification to the workflows changed. Check desktop, phone and tablet layouts, keyboard navigation, overflow, accessibility, ownership, save failures and complete user flows.

CI is intentionally absent. `pnpm verify` remains the complete local check. No calendar-provider integration, third-party drag engine, offline sync or post-Core domain was introduced.
