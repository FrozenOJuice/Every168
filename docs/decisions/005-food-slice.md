# Food, hydration and weight

The owner requested a complete manual Food slice after Calendar. Food's daily page composes nutrition, hydration and body APIs; these remain separate backend domains. Calendar shortcuts reuse the same forms. No recipes, external food providers, barcode scanning, custom nutrition targets or medical interpretation are included.

## Nutrition and reuse

One food definition describes one serving, with explicit amount/unit, required calories and optional nutrients. Quantity is a serving multiplier. Calories start blank in the creation form; blank optional nutrients remain unknown. The service computes daily, meal and entry values from the same snapshot rows. The browser only formats those values.

Definition edits never rewrite entry snapshots. Entry edits change time, quantity and meal only. Repeating an entry copies its original snapshot, including from an archived/changed definition. Logging a saved food instead uses its current definition. The UI explains this distinction. Archive and restore require the current revision; existing transaction receipts make retries safe. Logging and definition changes retain the existing shared/exclusive locking.

Recent entries use owner-scoped, descending `(created_at, id)` pagination and search their snapshot names. Library and history searches treat `%`, `_` and backslashes literally. An optional local date uses the account timezone. Migration 0009 adds the matching food-entry history index; no new tables are needed.

## Water and weight

Water daily totals and records come from one read of the selected local day. Absence is displayed as not logged. Quick-add buttons capture the current instant when viewing today; other dates use local noon. The captured payload and request key remain unchanged during a retry.

Weight review returns the latest measurement through the selected day, that day's measurements, and up to 200 actual points in its trailing 30 local dates. All three reads share a read-only repeatable-read transaction. The chart reports truncation when necessary; paginated history still exposes every entry. Points use measurement timestamps, including backdated records, and never invent values for missing days.

Measurement histories page by immutable creation time and explicitly describe their ordering. Their optional `through` date excludes later measurement/consumption dates. Dates use half-open timezone-aware bounds, including 23/25-hour days. Weight inputs convert display units to kilograms before validation and persistence; water requires whole millilitres. No targets, scores or success/failure interpretation are added.

## Interface boundaries

Food retains Daily log and Food library URL state. Its coordinator handles navigation and dialogs; meals, history, entry presentation, water/weight panels and reusable forms have focused components. Domain writes invalidate their existing query prefixes and Dashboard summaries. Save responses reveal the saved date. Food creation can return directly to a logging draft, and restore corrects an accidental archive.

The exact palette, native dialogs, labeled controls and existing conflict/retry feedback remain in use. Desktop gives meals the main column and measurements a side column; smaller layouts stack deliberately and offer section links to reach water/weight quickly. Existing source activity, Calendar accounting and authentication behavior are unchanged.
