# Food development assessment

**Date:** November 2, 2026. **Scope:** review the retained Food preview and recommend a bounded next milestone. This assessment does not enable Food, implement fixes or authorize a public release.

Food is already a usable vertical slice. Continue by hardening interrupted writes and read recovery, then bring its forms into the current Calendar/Fitness conventions. A new nutrition backend or a larger feature set is not the starting point.

The owner subsequently authorized the reliability milestone. Submitted-write recovery, pending-action protection and retained-list retries are now implemented locally on `develop`; see the current verification entry in [IMPLEMENTATION](IMPLEMENTATION.md). The findings and reproduction evidence below describe the original assessment. The owner subsequently authorized Food’s return to default development navigation and APIs. Other deferred features remain gated, and public deployment is not authorized. Form polish remains separate work.

## Foundation at assessment

- Daily logging supports saved foods, meals, recipes and quick entries without a library definition. Corrections, copying, deletion, favourites, archive/restore, water, weight and searchable history are implemented.
- Express routes validate shared contracts and call the canonical Nutrition service/repository. Hydration and Body remain separate services. Next.js uses the typed client; nutrition and daily calculations stay on the backend.
- Logged nutrition is an independent snapshot. Recipe yield and portion scaling preserve unknown nutrients and explicit zero. Preparation edits resolve owned active ingredients; historical copying retains the recorded snapshot. Scheduling and eating remain distinct.
- The shared Day panel already follows Calendar's selected date, domain/all activity filtering and responsive drawer. Food contributes recorded moments without inventing duration or duplicate time sources.
- At assessment, Food was disabled in default `core` scope. `preview` also enables other deferred features; changing both applications to preview is a local review technique, not a Food-only release strategy.

## Findings and priorities

| Priority | Finding                                                                                             | Evidence                                                                                                                                                                                                                                                                                              | Proposed next step                                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First    | Uncertain saves do not survive refresh. A committed create can be manually repeated with a new key. | Food forms use the in-memory pending values/key in shared `Form`; they do not persist a recovery receipt. Browser reproduction results are recorded below.                                                                                                                                            | Reuse the existing account-scoped recovery patterns from Calendar/Fitness for submitted input, source revision and exact request key. Restore the original operation before accepting another save. |
| First    | Inline actions can lose their retry handle on navigation or unmount.                                | `FoodLibrary`, `FoodEntries`, water quick logging and measurement deletion use `useCommand` without its optional persistence. Their controllers do not register pending-action navigation guards. This is a source-review finding; held-request navigation was not fault-injected in this assessment. | Cover favourites, archive/restore, entry deletion and measurements as well as modal saves. Keep relevant actions and navigation guarded until the outcome is known or safely recoverable.           |
| Next     | Later-page or background read errors replace already loaded content.                                | Food library/history/picker and measurement history render the general error branch whenever the query has an error, even when cached pages exist. Source-review finding; no pagination fault injection was run.                                                                                      | Follow Fitness: retain loaded rows and selections, distinguish initial/pagination/refresh failures, and retry the failed operation without duplicates or misleading empty states.                   |
| Polish   | Forms retain older interaction conventions.                                                         | Food logging and measurements use native local-date/time inputs; preparation forms use ordinary scrolling submit controls. Source comparison with the newer Calendar timing controls and Fitness save layouts.                                                                                        | Review shared date/time controls, compact action hierarchy, persistent save access and field-error focus at desktop and 320px. Preserve units, ambiguous-time validation and explicit saves.        |

Ordinary unsaved drafts also disappear on refresh; that is an existing documented limitation. Prioritize recovery of submitted operations before deciding whether all unsubmitted Food drafts need recovery. Existing in-page retries retain their key and pass the exercised scenarios.

## Recommended milestone: Food reliability

Work directly on `develop`, following the owner’s updated branch preference. Limit the first implementation slice to submitted-write recovery, pending-action protection and retained-list read recovery. Use existing contracts, services and recovery mechanisms unless a demonstrated defect requires a boundary change. Keep Food behind its current release gate.

Acceptance criteria:

1. Lost responses followed by refresh or navigation restore the original payload/key/revision; retry creates one record or applies one version change. Recovery stays scoped to the account and operation. Unavailable browser storage cannot silently send an unrecoverable operation.
2. Pending or uncertain form and inline actions cannot abandon their recovery path. Verify create/edit/copy, preparation changes, favourites/archive/restore, entry deletion and water/weight writes.
3. Pagination and background refresh failures retain existing rows, search and selected ingredients. Targeted retry restores the list without duplicating rows. Initial read failures still offer a clear retry.
4. Existing snapshot, unknown/zero, owner-isolation, timezone and Calendar-source tests remain passing. Add meaningful failure/recovery regressions on desktop and phone, including account switching and storage failure.
5. Update FEATURES and actual verification evidence, then stop for review. Form polish and Food release promotion are subsequent scoped decisions.

After reliability, review Food's normal creation/logging/editing flows visually beside current Calendar/Fitness. The subsequently authorized Food return enables web/API/Calendar surfaces consistently while leaving Tasks, Assistant and other deferred features gated. Food browser workflows now run in the core CI gate alongside Calendar/Fitness, including reliability and timezone cases; the API integration job also covers Food.

Meal planning, shopping lists, targets, broader trends, lookup/barcodes, pantry and AI remain outside this milestone. Existing history ordering by entry creation time and corrections limited to amount/time/label are intentional behaviors, not new defects.

## Verification evidence

- Frozen offline dependency installation passed with the existing lockfile on Node 26.0.0 and pnpm 9.15.9. GitHub CI uses Node 24 LTS; local results are not substituted for that runtime.
- All **16 API integration tests** passed across Everyday Food, Food slice, nutrition/measurements and release scope, against the isolated local `_test` PostgreSQL database. Coverage includes snapshots, yield/portion calculations, missing values, owner-scoped references, revisions/replays, local-day bounds, histories and disabled core endpoints.
- All **three focused unit tests** passed for nutrition totals and measurement-date defaults.
- All **eight existing desktop/phone browser cases** passed across Everyday Food and the shared Food Day panel. They cover real browser → API → database → rendered results, including food/recipe/meal creation, historical nutrition, adjusted logging, copying/corrections/deletion, quick entries, water/weight, archive/restore, in-page uncertain retries, selected-day navigation, responsive fit and automated accessibility.
- Two temporary desktop/phone probes reproduced the refresh defect: the server committed one food, its successful response was replaced with an uncertain 503, refresh removed the Retry save action, and manual re-entry created a second food with a different request key. Both probes passed their defect-reproduction assertions; they do not certify correct behavior. The temporary probe was removed afterward. Verification stopped at this confirmed recovery gap; the other findings remain source-review observations.

The assessment itself changed no product code, schema, release policy or local development configuration. Tests use synthetic accounts and test-only in-memory email delivery; no external email or production operation occurs. This is a focused assessment, not a full security audit, all-browser visual review or a claim that the broader preview suite passes.
