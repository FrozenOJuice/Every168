# 168Hours - Comprehensive First-Release Audit

Audit date: October 29, 2026. Target: Calendar, Fitness, Accounts and Settings responsive web release. Source: working tree based on `41467a3`, including the owner's existing uncommitted changes. This is a release-readiness assessment, not approval of a deployed environment.

## A. Executive summary

**Decision: NO-GO for unrestricted public signup today.** The everyday product is substantially implemented and worth preparing for release; a rewrite or another feature expansion is unnecessary. Specific security, release-boundary and Calendar defects remain, and production recovery/deployment has not been demonstrated.

The strongest parts are canonical backend ownership, transactional revision/idempotency enforcement, independent planned versus actual workout records, derived history/records, shared Fitness editing, and unusually substantial integration and browser coverage. Production compilation succeeds. Normal workout journeys are far better supported than the remaining launch infrastructure.

The most important weaknesses are an applicable pre-authentication body-parser availability advisory; missing public account recovery/credential-change lifecycle; excluded standalone features still reachable directly; Month clipboard identity duplication across week boundaries; and inability to edit saved repeated-hour plans without changing their times. A small-screen date picker also has measured undersized adjacent targets, and exercise-history pagination failures replace previously loaded results.

No cross-account disclosure, authorization bypass, SQL injection or XSS exploit was found in reviewed paths or successful isolation checks. That is evidence of useful protections, not proof that every possible attack or production configuration is safe. No application-level Critical exploit was demonstrated. Registry Critical labels are not automatically application Critical findings.

### Method and boundaries

- Read the audit brief, project instructions, build specification, implementation history, scope, architecture, security, foundation, UI and verification documentation. Traced actual routes, contracts, controllers, services, repositories, schema/migrations and test fixtures.
- Parallel specialist reviews covered security, Calendar and Fitness; the primary review coordinated operations, verification, UI evidence and consolidation.
- Database writes were confined to synthetic isolated test accounts/databases. No actual user records were inspected, no production endpoint was exercised, and no disruptive exploit payload was sent.
- No fixes, refactors, dependency/configuration changes, commits, pushes or deployments were made. This report is the sole intended repository artifact. Test/build outputs are temporary or ignored. Next-generated TypeScript include changes are restored to their exact pre-audit contents after checks.
- Static inspection, real HTTP/database tests, browser reproduction and unverified deployment assumptions are distinguished below. Existing test names or older documentation are not treated as proof of current behavior.

## B. Scope coverage matrix

**Status meaning:** Verified = representative behavior executed in this audit, not universal correctness; Defective = an evidenced defect in that capability; Partially Verified = executed coverage plus material untested branches or a static-only concern; Not Verified = no execution of that requirement; Missing = implementation unavailable. Finding IDs reference section C. Integration results include identified fixture failures and a measured layout discrepancy; do not read the matrix as an entirely green release gate.

Evidence shorthand: **IT** = current real-PostgreSQL integration execution; **BR** = current existing browser regressions run with `RELEASE_SCOPE=core`; **AP** = temporary core-mode audit probes using synthetic accounts; **ST** = source trace; **UT** = current unit execution. Exact commands/outcomes are in G.

| Capability/workflow                                                             | Status             | Verification and evidence                                                                                   | Findings/limits                                                                                     |
| ------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Register, sign in, sign out                                                     | Verified           | IT `identity`, `auth-security`, `session-security`; BR `isolation`, release journeys                        | Public credential lifecycle missing: R02                                                            |
| Session expiry, renewal, cookie attributes and logout replay                    | Verified           | IT `session-security`; browser account switching; ST auth wrapper                                           | Actual TLS/edge not tested: R04                                                                     |
| Account isolation: private reads/writes, foreign references, search and reports | Verified           | IT `authorization`, `integrity`, Calendar/Strength/progress suites; BR known-ID isolation                   | Sampled families and registered-route session checks, not exhaustive penetration test               |
| Timezone, week-start and unit settings                                          | Partially Verified | IT preferences, local-week/DST and conversions; AP saved timezone; BR unit controls                         | Changing settings during an already-open editor and all cross-tab combinations not exhaustively run |
| Day/Week/Month navigation and normal rendering                                  | Verified           | BR Calendar context/menu/redo/scheduling; AP Month and clock-change Day; ST bounded loaders                 | Arbitrary dense data and real devices remain unverified                                             |
| Timed plan creation/editing                                                     | Defective          | BR shared compact editor and retries; AP saved fall-back-hour title-only edit fails                         | R06                                                                                                 |
| All-day and multi-day plans/conversion                                          | Partially Verified | IT Calendar/conversion/move; BR recurrence and context operations                                           | Conversion fixture is nondeterministic: R14; not every touch resize rerun                           |
| Repeating rules, scopes, exceptions, stop/delete and undo                       | Verified           | IT Calendar; BR `calendar-repeating`; ST finite expansion/parent revisions                                  | Calendar uncertain intents after refresh: R09                                                       |
| Move, resize, overlapping/cross-midnight plans                                  | Partially Verified | IT `calendar-move`, `calendar-conversion`; BR adjustment/context flows; ST gestures/clipping                | Cross-week aggregation affects selected groups: R05; full pointer/touch suite not rerun             |
| Duplicate, copy/paste and mixed selection                                       | Defective          | BR normal context/redo flows; AP Sunday-to-Monday Copy rejects selection                                    | R05; extra copies from Copy day are statically traced, not independently pasted in AP               |
| Delete, undo/redo and persistent plan history                                   | Verified           | IT `planning-undo`, Calendar; BR `calendar-redo`; ST persisted history/exact replay                         | Non-history sent intents do not recover identically: R09                                            |
| Calendar search and result navigation                                           | Partially Verified | IT Calendar literal search/cursors; AP opens Search and inspects options; ST date filters/result dispatch   | Exposes Unscheduled option/data: R03; all date-filter browser scenarios not rerun                   |
| Workout scheduling and opening from Calendar                                    | Verified           | IT Strength snapshots/day links; BR domain scheduling and complete journey                                  | Completion-link failure is silently defaulted: R10                                                  |
| Shared Fitness Day panel                                                        | Partially Verified | Complete scheduled journey plus ST shared feed/navigation/actions                                           | Fault-injected completion lookup not executed: R10                                                  |
| Exercise catalogue/custom creation, favourites/hide/archive/delete              | Verified           | IT catalogue/isolation; BR secondary actions and history workflows                                          | Full catalogue content and illustrations intentionally deferred                                     |
| Exercise details, instructions, PRs, reps by weight and sessions                | Defective          | IT progress recalculation/unknowns/ownership; BR history foundation; AP cursor failure hides loaded content | R08; selected-field summary inconsistency R13; contextual selection restoration R17                 |
| Reusable workout creation/editing/drafts/recovery                               | Verified           | IT Strength draft/publish rules; BR workout recovery, advanced editor and navigation                        | No cross-device/offline guarantee                                                                   |
| Basic/advanced sets and all measurement types                                   | Verified           | IT independent/per-set measurements; UT conversions/reset/display; BR advanced controls                     | General Laps PR fixture stale, not a lost result: R14                                               |
| Immediate start and scheduled start/resume                                      | Verified           | IT Strength begin/linking/idempotency; BR secondary actions/complete journey                                | Full every-device immediate-start session not exhaustively exercised                                |
| Live complete/skip, rest, notes, pause/resume and session edits                 | Verified           | IT pause/time ledger and Strength; BR complete journey/secondary actions                                    | Background mobile suspension and screen-reader operation not physically tested                      |
| Live interruption/refresh recovery and uncertain saves                          | Verified           | IT receipt replay; BR workout recovery and complete journey                                                 | Browser storage unavailable/full and prolonged offline operation not covered                        |
| Finish, summary, explicit correction, repeat and comparisons                    | Partially Verified | IT progress/comparison; BR summary polish, result corrections, contextual navigation                        | Concurrent comparison snapshot race remains static: R12                                             |
| Workout search/history and weekly totals                                        | Verified           | IT literal/keyset history and local-week totals; BR history foundation/release flows                        | Excess 12-week computation for one-week UI: R11; large histories not benchmarked                    |
| Excluded Tasks/Food/Assistant/Programs/Templates                                | Verified           | IT release boundaries; BR release scope; ST core composition                                                | Retained implementations are legitimate preview code                                                |
| Excluded Goals/Routines/Unscheduled                                             | Defective          | AP direct pages and APIs respond; AP Search offers Unscheduled                                              | R03                                                                                                 |
| Desktop and narrow browser UI                                                   | Partially Verified | BR desktop/phone, AP 320px, automated accessibility and screenshots                                         | R07; no full assistive-technology/browser certification                                             |
| Production build                                                                | Verified           | `NEXT_DIST_DIR=.next-audit pnpm build` succeeds for workspace/API/web                                       | Compile result, not deployed-runtime approval                                                       |
| Fresh database setup and migration replay                                       | Partially Verified | Existing isolated test DB migrations run through all suites                                                 | Fresh initialization executed (39 migrations); actual production upgrade/restore not demonstrated   |
| Public deployment, backups, monitoring and incident recovery                    | Not Verified       | ST repository has local Compose, validated config and health/drain boundaries                               | R04                                                                                                 |
| Password recovery, verified mailbox onboarding and user credential rotation     | Missing            | ST auth allowlist, auth UI and configured providers; IT unsupported auth endpoints reject                   | R02                                                                                                 |

## C. Detailed findings

### R01 - Active dependency vulnerabilities need remediation before public exposure

- **Severity:** High. **Category/features:** security and availability; all API workflows. **Release:** Must Fix Before Release.
- **Evidence:** `apps/api/src/app.ts:92`, `createApp`, registers `express.json({ limit: "256kb" })` before private session middleware at `:94-96`. `pnpm-lock.yaml` resolves Express 5.2.1/body-parser 2.3.0. `pnpm audit --prod --json` reports 32 advisory entries representing 31 distinct GHSA IDs and 44 metadata vulnerability instances (8 Critical, 11 High, 20 Moderate, 5 Low). These counts overlap packages/paths and are not 44 independently demonstrated exploits.
- **Problem and impact:** The active JSON parser accepts compressed input before authentication. Its version/configuration matches a published unauthenticated process-crash advisory. Decoded body size limits do not fix the decompressor listener error. This creates a credible application-wide denial-of-service exposure.
- **Safe verification/reproduction:** Installed version and middleware order were checked against the [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828). No crash payload was sent. A future regression must execute malformed compressed/trailing-byte requests only against an isolated disposable child process and assert process survival.
- **Correction:** Update compatible dependencies/lockfile to fixed releases, or disable JSON inflation if unused; retain bounded parsing and safe error envelopes. Re-audit the resolved graph, not just top-level package declarations.
- **Other advisories:** Zod 4.6.2 is on the active validation boundary; its fixed version is at least 4.6.6. The 256KB cap limits, but does not prove harmless, collection-validation resource consumption. See the [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Next 16.3.5 and sharp have image-related advisories; app source does not use ImageResponse, custom remote-image patterns, `dangerouslyAllowSVG` or `use cache` functions, so the scan does not prove reachable RCE here. The [Next image advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw) is also platform/configuration dependent. Update the framework and test its actual deployment. Proxy-addr 2.0.7 requires particular unsafe trust-subnet settings for the [reported spoofing condition](https://github.com/advisories/GHSA-jqcg-44mw-7w3h); default empty trust avoids that condition. Better Auth OAuth advisories do not match the email/password-only, allowlisted app. Its internal limiter is disabled, so the adapter limiter advisory does not describe the canonical limiter. Vite/Vitest paths exist in the dependency graph; their development servers are not proven public production services.
- **Regression risks/tests:** Express error/body handling, auth cookies/origin checks, validation messages, framework rendering and all Calendar/Fitness journeys. Recheck advisory applicability after updates; do not enable unused auth capabilities merely to upgrade.
- **Confidence/limitations:** High for body-parser applicability and installed versions; exploitation intentionally not attempted. Other entries are conditional or bounded risks, not fabricated Critical incidents.

### R02 - Open public accounts lack recovery and credential control

- **Severity:** High for open signup. **Category/features:** authentication/account access. **Release:** Must Fix Before Release for unrestricted public signup.
- **Evidence:** `apps/api/src/shared/auth/handler.ts:21`, auth endpoint allowlist, exposes signup/signin/signout/session lookup only. `shared/auth/auth.ts:16` enables email/password without verification/reset delivery. `apps/web/src/features/identity/auth-form.tsx:55` has sign-in/signup but no recovery. `apps/api/tests/auth-security.integration.test.ts:93` explicitly rejects unsupported reset/change-password/session-management endpoints.
- **Reproduction:** Register a synthetic account, inspect Login/Settings, and request the excluded credential lifecycle endpoints. There is no supported forgotten-password recovery, known-password rotation or self-service revocation of another browser's session.
- **Problem/impact:** A forgotten password can strand a user's stored schedule/history. A user cannot rotate a compromised password. Signup does not establish control of the claimed mailbox. Signup enumeration policy also remains undecided; absence of verification is not itself proof of account takeover.
- **Correction:** Define the public onboarding and support policy, then implement narrow verification/recovery/credential rotation with safe expiring single-use tokens and session invalidation. Alternatively restrict an initial release to a controlled beta with an explicit support/recovery policy; this changes the launch gate, not the data-ownership requirement. Do not silently expose all library auth routes. 2FA is not imposed as a new v1 feature.
- **Regression risks/tests:** Token expiry/replay, mailbox control, safe enumeration responses, rate limits, suspended users and credential-change revocation; preserve existing origin and logout failure behavior.
- **Confidence/limitations:** High, implementation missing by design; email delivery and operator support have not been demonstrated.

### R03 - Goals, Routines and Unscheduled remain accessible in core scope

- **Severity:** Medium. **Category/features:** release boundary/product scope. **Release:** Must Fix Before Release under the explicitly supplied scope.
- **Evidence:** Ungated pages: `apps/web/src/app/(app)/goals/page.tsx:1`, `routines/page.tsx:1`, `unscheduled/page.tsx:1`. `apps/api/src/app.ts:111` mounts Routines and `:113` mounts Goals unconditionally. `modules/planning/calendar.routes.ts:70` exposes backlog/shared calendar items. `calendar-search.tsx:176` offers Unscheduled plans; `calendar-search.repository.ts:119` includes them in searches.
- **Reproduction/evidence:** Core-mode AP visits all three direct URLs without a 404; authenticated Goals/Routines/backlog reads return 200; Search contains the Unscheduled option. Normal navigation hiding does not close these surfaces. This is not an owner-isolation breach.
- **Impact:** First users can discover unsupported/out-of-scope workflows and create data that the intended v1 UI does not consistently expose.
- **Correction:** Retain code and data behind preview feature gates. Cover pages, dedicated read/write endpoints, search/deep links and unscheduled variants on shared APIs. Preserve all-day operations, existing references, Calendar ledger integrity and copy/undo paths. Do not disable a shared Planning service indiscriminately.
- **Regression risks/tests:** Core direct routes and all mutation families; preview behavior; existing records/references; all-day/date-only reads, copying and undo. Audit Settings references while applying the boundary.
- **Confidence/limitations:** High, direct core runtime exposure confirmed. No destructive mutation of real data attempted.

### R04 - Production deployment and recovery are not yet an evidenced release system

- **Severity:** High. **Category/features:** operations/reliability/privacy; entire product. **Release:** Must Fix Before Release as a readiness gate, not a claim of a broken deployed server.
- **Evidence:** `infra/compose.yaml:1` defines local development/test PostgreSQL only. `docs/foundation.md:33` requires a trusted edge and `:52` explicitly leaves backup/restore and deployment automation for later. `apps/web/next.config.ts:12` sets baseline document headers but no CSP/HSTS policy. `apps/api/src/infrastructure/lifecycle.ts:39` binds the API to loopback; `shared/http/rate-limit.ts:4` uses process-local limits; `env.ts:33` defaults proxy trust empty. No reviewed hosting topology, backup job, restore record or production alert route was found.
- **Problem/impact:** Hosting, edge identity and credential handling determine whether the otherwise useful local safeguards work. A Next-proxied deployment can place multiple users in one limiter bucket unless client identity is configured safely. Scaling replicas does not share the limiter. Data restoration and incident response cannot be assumed from successful migrations.
- **Verification method:** Static inventory and local build/lifecycle tests. No production host, TLS termination, secret manager, backup object or external monitoring account was available to inspect. Missing evidence is explicitly not a demonstrated data breach.
- **Correction:** Choose the deployment topology; provision a non-owner runtime DB role and separate migration identity; set core flags in API and web build/runtime; verify trusted forwarding, TLS/document headers, private response caching, network restrictions and abuse controls. Define encrypted/access-controlled backup retention, restore a copy into an isolated environment, and document deploy/rollback/incident ownership. Wire actionable availability/error monitoring. Use the simplest topology that meets the expected initial load.
- **Regression risks/tests:** Built-server smoke through the real proxy, signup/signin/renewal/logout, forged forwarding headers, 429 recovery, ready/drain/restart, migration failure, backup restore with representative Calendar/Fitness records. No need to create a multi-region or distributed platform for v1.
- **Confidence/limitations:** High that these requirements are not evidenced in this repo; external infrastructure may exist and must be supplied/reviewed before changing the verdict.

### R05 - Month combines duplicate identities for plans crossing a week boundary

- **Severity:** Medium. **Category/features:** functional/data handling; copy/duplicate/group actions. **Release:** Must Fix Before Release.
- **Evidence:** `planning.repository.ts:133` returns plans overlapping each week, correctly. `apps/web/src/features/planning/calendar-clipboard.tsx:163` flattens week blocks without identity deduplication. `capturePlans` at `:214-227` compares the duplicated loaded count with the unique selection count; `copyDays` at `:277` captures duplicates. Selected-group aggregation has the same assumption.
- **Reproduction:** In UTC/Monday week start, create September 6, 2026 23:30 through September 7 00:30. Open Month, select its start-day card and Copy. AP reproduced “Selection changed. Select the plans again.” despite unchanged selection. The ID appears in two week responses.
- **Problem/impact:** One saved plan becomes two loaded objects. Normal Copy/Duplicate or selected-group operations can reject it. Copy-day capture can carry two intervals into a paste, producing unintended extra independent copies; that extra-paste consequence is statically traced, not separately fault-reproduced.
- **Correction:** Deduplicate timed records by identity at a shared loaded-data aggregation boundary before clipboard capture and selection/group logic. Keep legitimate per-day continuation rendering distinct from record identity.
- **Regression risks/tests:** Cross-week and longer multi-week plans, both week-start preferences, single Copy/Duplicate, copy-day paste exactly once, mixed all-day group movement, limits and undo.
- **Confidence/limitations:** High; desktop browser Copy failure confirmed. Phone Month may not show that specific card in its compact preview, so that exact probe is skipped there.

### R06 - Saved repeated-hour plans cannot save unrelated edits

- **Severity:** Medium. **Category/features:** Calendar correctness/timezone validation. **Release:** Must Fix Before Release.
- **Evidence:** `time-form.tsx:122` calls `localTimeField(timezone)` without the saved instant and `:507-512` reparses local clocks. `apps/web/src/lib/format.ts:33-53` already supports a recorded instant to preserve unchanged ambiguous values. `packages/domain-utils/src/time.ts:4` intentionally resolves repeated planned instants to the earlier occurrence.
- **Reproduction:** Set America/Edmonton. Create a saved plan starting `2026-11-01T07:30:00Z` (01:30 in the first repeated hour), ending `09:00Z`. Change only its title in Calendar. Save remains in the editor with an unambiguous-time validation error; GET confirms the old title remains. AP reproduced on desktop and phone.
- **Impact:** A legitimate stored plan cannot receive ordinary notes/title edits without altering its time. The shared form also warrants checking manual recorded-time edits.
- **Correction:** Carry saved instants through validation, duration derivation and serialization when their displayed local values remain unchanged. Continue rejecting newly entered nonexistent/ambiguous clocks unless explicitly disambiguated.
- **Regression risks/tests:** Both occurrences of the repeated hour, start and end independently ambiguous, title/notes-only edits, recurrence-generated occurrences, midnight/duration shifts and newly ambiguous input rejection.
- **Confidence/limitations:** High; pure validation and full UI/GET evidence. No stored user data changed.

### R07 - Near-edge date pickers shrink below usable adjacent target widths

- **Severity:** Medium. **Category/features:** accessibility/responsive forms; shared Calendar date picker. **Release:** Must Fix Before Release for the stated accessible mobile experience.
- **Evidence:** `calendar-date-picker.tsx:41` limits width symmetrically around the field center rather than shifting a usable-width popup inside the viewport. `styles/calendar.css:1911-1928` divides it into seven zero-gap columns; `:2002` enlarges coarse-pointer height only.
- **Reproduction/measurement:** On a 320x740 phone browser, open Start date in Edit plan. AP measured popup width 183.11 CSS px and adjacent day buttons approximately 23.58x44 CSS px. Desktop-pointer mode at the same width yielded a 174.77px popup and 22.39x34px buttons. The screenshot shows a tall narrow picker over the form. Automated axe checks returned no violations, illustrating their limits.
- **Problem/impact:** Adjacent days are easy to mistap. With zero inter-target spacing, these measurements do not meet the 24px target/spacing baseline described by [WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). This is a measured control-size finding, not a general claim about all WCAG criteria.
- **Correction:** Keep a usable picker width and clamp its horizontal position; fit its height/scrolling without reducing individual day target widths. Retain anchored dismissal, focus restoration and portal boundaries.
- **Regression risks/tests:** 320px and larger widths, Start/End side-by-side fields, Search and rule editors, keyboard/month navigation, viewport resize/scroll, nested dialogs and coarse-pointer dimensions.
- **Confidence/limitations:** High for measured Chromium viewports. Physical touch/VoiceOver not tested.

### R08 - A pagination error replaces already loaded exercise history

- **Severity:** Medium. **Category/features:** failure recovery/UX; exercise details and shared records panel. **Release:** Recommended Before Release.
- **Evidence:** `exercise-progress.tsx:44` uses an infinite query; `:63-65` returns only ErrorState whenever `q.error`, even if previous pages remain cached.
- **Reproduction:** Seed seven synthetic finished workouts containing one exercise. Open details, then return 503 only for its cursor request and choose Load older sessions. AP reproduced the disappearance of Latest session and loaded history on desktop and phone; the error replaces that section. No underlying record is deleted.
- **Impact:** A transient failure appears to erase known results and forces a broader refetch instead of retrying the missing page.
- **Correction:** Reserve initial full-section failure for no data; retain successful pages and show a local next-page retry. Distinguish background-refresh failure. Consider the same guard in `active-workouts.tsx:19` rather than duplicating error-state policy.
- **Regression risks/tests:** Fail a cursor request after page one, retry without duplicate rows, recover while records/PRs stay visible; fail initial read separately.
- **Confidence/limitations:** High; deterministic browser fault injection confirmed, no real server outage induced.

### R09 - Unresolved ordinary Calendar writes lose retry identity on refresh

- **Severity:** Medium. **Category/features:** reliability/data duplication risk; create/paste/move/delete. **Release:** Recommended Before Release.
- **Evidence:** `components/ui/form.tsx:61-86` keeps captured uncertain payload/key in React state. `calendar-clipboard.tsx:115` and `use-calendar-interaction-commands.ts:37` do not opt into durable command recovery. Fitness and persisted Calendar Undo have stronger owner/tab-scoped recovery paths.
- **Scenario:** A save or bulk paste commits but its response is lost. Mounted retries reuse the key correctly. Hard refresh discards that unresolved ordinary command and its retry affordance. Repeating the intent as a fresh command can create another plan/group, and the original undo receipt may never enter the tab's history.
- **Impact:** Ambiguous saved state after interruption; user-driven duplication is possible. This is not proof that normal mounted retries duplicate records.
- **Correction:** Persist sent unresolved intents, keyed by owner/tab, and reconcile/retry their exact payload/key after refresh. Keep unsent-draft autosave a separate product decision.
- **Regression risks/tests:** Committed dropped create/paste responses, refresh, same-key retry, exactly-once visible plans and correct undo recording; signout/account switch; explicit discard only after known result.
- **Confidence/limitations:** High source evidence, refresh fault injection not executed in this audit. Existing mounted-retry and persistent-history regressions passed where run.

### R10 - Day feed silently treats missing completion-link data as unfinished

- **Severity:** Medium. **Category/features:** failure handling/Calendar-Fitness consistency. **Release:** Recommended Before Release.
- **Evidence:** `calendar-day-feed.tsx:119-122` loads Fitness day links; `:161-167` substitutes an empty completed-block list without checking pending/error.
- **Scenario/reproduction:** Finish a scheduled workout whose reservation remains later in the selected day; fail its day-links read. The standalone Calendar feed can promote the finished reservation as Next because completion is unknown but treated as false. Domain panel failure handling is not identical.
- **Impact:** Misleading next-action guidance during a partial read failure, with no visible indication that status is uncertain. Stored completion/time remain correct.
- **Correction:** Keep plans visible, surface a retryable lookup state and avoid completion-dependent emphasis until the lookup is known.
- **Regression risks/tests:** Held/failing link read, completed future reservation, retry, ordinary unlinked plans and cross-week recorded time.
- **Confidence/limitations:** High static path; not fault-injected in this audit. Successful day-link behavior is covered by integration/browser tests.

### R11 - One visible weekly recap triggers twenty-four sequential aggregates

- **Severity:** Medium. **Category/features:** performance/engineering; Fitness History. **Release:** Recommended Before Release.
- **Evidence:** `strength-progress.service.ts:93-103` always generates 12 weekly ranges; `strength-progress.repository.ts:97-134` awaits two aggregates for each; `progress-overview.tsx:84` displays only the last week.
- **Reproduction/method:** Trace one overview request from WeeklyTotals: 24 serial SQL aggregates plus preference retrieval, returning 11 weeks unused by this screen. Query count is established by control flow; production latency has not been measured.
- **Impact:** Unnecessary DB work and round trips each time users switch weeks, magnified by larger histories/concurrent users. Not a demonstrated scalability outage.
- **Correction:** Return the requested week for this consumer or batch the range if other real consumers need 12 weeks. Preserve repeatable-read consistency and timezone boundaries.
- **Regression risks/tests:** Count queries, compare totals across DST/week starts/pauses/unknowns, and inspect representative large-history query plans. Do not introduce precomputed statistics infrastructure without evidence it is needed.
- **Confidence/limitations:** High query-amplification evidence, medium estimated user impact until measured.

### R12 - Comparison assembly assumes separately read snapshots still match

- **Severity:** Medium. **Category/features:** concurrency/read consistency; previous-workout comparisons. **Release:** Recommended Before Release, after focused reproduction.
- **Evidence:** `strength-progress.service.ts:127-151` reads current workout, finds previous ID and reads previous workout separately. At `:143-146`, unmatched signatures permit `splice(-1,1)[0]!` without revalidation.
- **Scenario:** Another tab corrects/deletes a previous workout after match selection. Changed signatures can yield an unrelated final occurrence or undefined during assembly; a deletion can yield a transient 404. No persisted data is changed by this read.
- **Impact:** Misleading or failed comparison under concurrent corrections.
- **Correction:** Read the comparison under one canonical snapshot, or revalidate membership/signatures and return a clear no-match/retry result. Do not merely hide exceptions with an arbitrary fallback occurrence.
- **Regression risks/tests:** Deterministically interleave correction/deletion between matching and read; repeat exercise identities with differing per-set overrides.
- **Confidence/limitations:** Medium; credible static race, not a runtime-confirmed concurrent failure. Ordinary comparison tests pass.

### R13 - Minor Fitness status/filter inconsistencies remain

- **Severity:** Low. **Category/features:** UI state consistency; Training and exercise history. **Release:** Can Defer.
- **Evidence:** `active-workouts.tsx:31-34` hardcodes In progress in both accessible and visible labels despite pause data. `exercise-progress.tsx:75-82` filters records and Latest by Show measurements, but All sessions summaries at `:241-245` ignore those fields.
- **Reproduction:** Pause a workout and return to Training; its card still says In progress. In exercise details, hide Weight with Show measurements; All sessions summaries still include weight while nearby records hide it.
- **Impact:** Small contradictions in otherwise correct stored state and navigation. These are two related presentation inconsistencies, not lifecycle/measurement corruption.
- **Correction:** Derive paused labels from canonical open-pause semantics. Apply the selected measurement scope consistently or explicitly limit the selector's scope.
- **Regression risks/tests:** Pause/refresh/resume/overview; measurement toggles with unknowns and mixed per-set selections. Preserve canonical stored units/results.
- **Confidence/limitations:** High static evidence; these exact presentation cases not separately browser-reproduced in this audit.

### R14 - Nondeterministic and stale fixtures prevent a trustworthy green release gate

- **Severity:** Medium. **Category/features:** QA; recurrence conversion and Fitness records. **Release:** Must Fix Before Release as test-gate corrections, not demonstrated production defects.
- **Evidence:** Current full integration run: 150/152 tests passed; two failed. `calendar-conversion.integration.test.ts:260` assumes `created.items[0]` belongs to March 13, while `series.repository.ts:130` orders snapshots by random UUID. Its hardcoded target can shift the series away from the intended DST gap, correctly returning 200 instead of the fixture's expected 422. `fitness-general.integration.test.ts:250-252` expects a Laps PR, but `strength-progress.repository.ts:311-313` deliberately excludes Laps from PRs, consistent with the agreed record list.
- **Reproduction:** Run the full integration command. The conversion failure depends on random UUID ordering; the Laps expectation is stale. Conversion guards and pure intended-gap expansion were inspected; the latter correctly identifies March 14 as skipped.
- **Browser evidence:** The 74-case core browser run also failed six cases for three fixture assumptions: `fitness-complete-journey.spec.ts:70-76` uses the real current time and creates its “Later plan” two hours later, but `:252` expects it in the original local day's Next section even when that falls after midnight; `fitness-history-foundation.spec.ts:279` requires a query string on a contextual return that validly uses a bare exercise URL; `fitness-workout-recovery.spec.ts:168` expects an older storage warning string. These failed on desktop and phone. Separate temporary copies use a fixed daytime clock/current URL and warning expectations, with outcomes recorded in G; originals remain unchanged. Once the URL assertion was relaxed, the history journey exposed an additional genuine measurement-selection restoration failure (R17), so that case must not be dismissed as fixture-only. The seventh browser failure is a real geometry discrepancy documented as R16, not waived as a fixture issue.
- **Impact:** Red tests obscure whether future real regressions occurred; a random-order fixture can also intermittently falsely pass. Do not change valid product rules to make older assertions green.
- **Correction:** Select the intended occurrence explicitly by date; align the Laps record expectation with current approved semantics while retaining completed-set/max-laps assertions. Freeze browser fixture time deliberately and assert current contextual URL/recovery semantics without weakening the underlying behavior checks.
- **Regression risks/tests:** Rerun full integration repeatedly after the narrow fixture correction. Keep missing-time rejection, owner references, rollback and recorded laps coverage intact. Preserve exact failure logs in the audit evidence.
- **Confidence/limitations:** High source diagnosis. No fixture was changed during this read-only audit.

### R15 - Large UI coordinators and stale documentation raise future regression cost

- **Severity:** Low. **Category/features:** architecture/maintainability. **Release:** Can Defer.
- **Evidence:** `session-editor.tsx:1` is 1,343 lines and coordinates timing/lifecycle/autosave/recovery/navigation/corrections plus markup; `time-form.tsx:1` is 1,081 lines spanning schema/timing/conversion/recurrence/request dispatch and markup. Existing architecture/verification prose still references retired Calendar tools and older history lifetime assumptions, despite newer entries in IMPLEMENTATION.
- **Problem/impact:** The saved-instant omission in R06 illustrates how equivalent time-editing paths can drift. Overgrown controllers make narrowly scoped UI changes harder to review. Historical prose can mislead contributors about current release boundaries.
- **Correction:** When touching these areas, extract cohesive pure timing/request preparation and lifecycle controllers/view sections while retaining shared editors and canonical services. Reconcile current guidance separately from historical implementation notes. No generic framework or large rewrite is justified by line count alone.
- **Regression risks/tests:** Maintain identical wire payloads, source-time identity, pending locks, recovery and navigation. Use existing full journey, corrections, pause, recovery and Calendar timing tests around each extraction.
- **Confidence/limitations:** High for organization/documentation observations, not evidence that the modular-monolith design is fundamentally wrong.

### R16 - Result-correction measurement options overrun their visible set-list boundary

- **Severity:** Low. **Category/features:** responsive layout; Correct results measurement selector. **Release:** Recommended Before Release; not a standalone data-loss/security blocker.
- **Evidence:** `apps/web/src/features/fitness/workout-set-row.tsx:177` renders the configuration inside the set row. `styles/domain-workspace.css:1231-1236` combines a full container-query width with sticky positioning. The existing desktop `fitness-result-corrections.spec.ts:143-152` measured the configuration right edge at 782.20px while the set-list right edge was 777.20px (test tolerance 1px).
- **Reproduction:** Open Correct results at the desktop test viewport, expand an actual set's Measurements and enable Duration, Distance and Laps alongside reps/weight. The configuration extends about 5px beyond its visible list boundary. Current screenshot confirms the panel is in a horizontally constrained row; phone's corresponding test passed.
- **Problem/impact:** The panel does not remain contained as the shared editor intends. It is a small, concrete layout defect; the current evidence does not establish page-wide overflow, lost results or unreachable Save.
- **Correction:** Account for row offsets/scroll gutter when sizing the sticky configuration; keep the options aligned to the visible container rather than an oversized measurement track. Preserve focus-ring clearance and field horizontal navigation.
- **Regression risks/tests:** Existing result-correction geometry assertions, all five measurements, 320px and desktop widths, keyboard/focus and set-row scroll positions.
- **Confidence/limitations:** High for the measured discrepancy in the current browser run; a focused desktop repeat reproduced the same discrepancy (three tablet release tests passed in that run). Do not dismiss the failed assertion by simply increasing tolerance without checking intended containment.

### R17 - Exercise measurement selections reset after a contextual workout return

- **Severity:** Low. **Category/features:** navigation/state continuity; exercise history. **Release:** Recommended Before Release.
- **Evidence:** `exercise-progress.tsx:41-43` initializes local measurement mode from a prop; `workout-reference.tsx:47` derives the return origin; `fitness-navigation.tsx:359-376` captures the selected mode in a visit, while `exercise-detail-page.tsx:141` supplies the restored mode to details. The supplemental history journey returned to the correct exercise but Duration was unchecked after having been selected before opening its workout.
- **Reproduction:** In details with reps/weight history, enable Duration under Show measurements, open the Latest session workout reference and choose Back to that exercise. In temporary copies of the existing history regression, accepting the valid bare return URL allowed execution to reach the measurement assertion, which failed. This exposes a real state-restoration problem beneath the original brittle URL assertion.
- **Problem/impact:** Contextual navigation returns to the right record but loses the user's chosen measurement view. No actual measurements or workout records are lost.
- **Correction:** Make selector state and the restored visit mode agree when returning/remounting, including actual browser-history traversal. Preserve the loop-bounding/context model rather than adding more nested URL history.
- **Regression risks/tests:** Measurement selection retained through Latest/PR/reps-by-weight/session links, browser Back/Forward, summary corrections and refresh; repeat with Navigation API fallback and exact opener focus/scroll restoration.
- **Confidence/limitations:** High for the observed desktop and phone symptom; the exact restoration branch needs focused debugging. This is not classified as a failed history calculation.

## D. UI/UX, responsive and accessibility assessment

| Screen/workflow                 | What works/evidence                                                                                                            | Meaningful remaining concern                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in / signup                | Focused labelled forms, password visibility, predictable account transition, safe DTO/cookie handling                          | No recovery or credential lifecycle; onboarding verification policy unresolved (R02)                                                                                |
| Settings                        | Shared form validation, explicit save, timezone/week-start/units use canonical preferences                                     | IANA identifier entry is technical; this is a usability tradeoff, not a blocker or reason for a redesign. Full settings-to-open-editor transition matrix unverified |
| Calendar toolbar/views          | Stable primary controls, compact layout, direct date navigation, keyboard/action-menu alternatives; retained date/view context | Very dense actual calendars and physical browser touch require final testing                                                                                        |
| Plan/rule editors               | Shared compact controls, visible notes, fixed footer, explicit scopes and retry feedback; desktop/phone browser coverage       | Saved DST instant validation (R06), narrow picker geometry (R07), unresolved-write refresh behavior (R09)                                                           |
| Selection/copy/undo             | Clear selected state, mixed plan support, keyboard/context access, persistent history                                          | Cross-week identity aggregation (R05)                                                                                                                               |
| Calendar Day / shared rail      | Plans and actuals kept distinct; scheduled workouts open the correct lifecycle; completed reservations retain planned time     | Partial completion-link read failure is hidden (R10)                                                                                                                |
| Training / My workouts          | Primary create action, searchable responsive cards, drafts differentiated without fading; full ready/draft API rules           | Paused overview label (R13)                                                                                                                                         |
| Workout creator/editor          | Shared Basic/Advanced controls, per-set measurements, consistent units, recovery and explicit publication                      | Large controller complexity can defer (R15); no aesthetic rewrite proposed                                                                                          |
| Live workout                    | Clear complete/skip/next actions, persistent pause/rest and session-only editing, completed-state feedback                     | Physical-device background timer behavior, touch ergonomics in an actual workout and assistive technology remain unverified                                         |
| Summary / result correction     | Actuals vs reusable targets separated, explicit correction/discard semantics, contextual return path                           | Concurrent comparison snapshot concern (R12); measurement configuration containment (R16)                                                                           |
| Exercise library/details        | Shared detail content and references, private custom management, derived records/reps-by-weight                                | Pagination failure replaces known results (R08); measurement-summary scope inconsistency (R13)                                                                      |
| Workout history / weekly totals | Searchable real sessions and compact weekly recap; corrected time ordering                                                     | Excess unused weekly computation (R11); no large-history latency target yet                                                                                         |
| Unsupported/deep links          | Most deferred domains return unavailable/404 in core                                                                           | Goals/Routines/Unscheduled remain exposed (R03)                                                                                                                     |

Automated axe checks supplement keyboard, labels, dialog dismissal, focus and overflow assertions in the exercised flows. They do not certify screen-reader compatibility or all WCAG criteria. The 320px date-picker probe is a concrete example of an issue missed by a clean axe result. No aesthetic finding is raised merely because a reviewer prefers a different style. Illustrations and catalogue expansion remain intentional deferred content.

## E. Security and privacy assessment

### Verified protections and supporting evidence

- Private API routes pass through session/access middleware; current `authorization.integration.test.ts` enumerates registered route literals and verifies unauthenticated rejection. Owner/reference tests additionally cover mass assignment, known foreign IDs, nested sets/plans, search and report reads. The browser isolation journey checks separate accounts, logout replay and same-browser account switching.
- Passwords are bounded and salted/versioned with scrypt and timing-safe verification. Signup transactions and injected failure rollback are covered. No plaintext credentials or session tokens are returned in the public auth DTO.
- Production cookie behavior is tested for Secure, HttpOnly, host-only and SameSite attributes; database-backed sessions are authoritative. Invalid/expired/tampered tokens and logout deletion failure are exercised. Production through an actual TLS edge is not tested.
- Mutations require exact Origin and reject cross-site metadata. Application/auth payloads are bounded and strict contracts reject supplied ownership fields. Parameterized queries and literal search escaping reduce injection exposure.
- Writes recheck active ownership/account access in the command transaction; idempotency receipts and effects commit together. No frontend filter is used as the authorization boundary.
- Request logs use route templates and sanitized diagnostics instead of raw bodies, tokens, cookies or personal record values. Error responses do not expose SQL/stack contents. No untrusted HTML insertion sink was found in the searched application code.

### Release risks

R01 requires dependency remediation, particularly the applicable compressed JSON parser issue. R02 is an account lifecycle/readiness gap. R04 requires reviewing real TLS, forwarding, headers, limits, secrets, DB roles and backup access. Missing CSP is defense-in-depth work to consider with the deployment; it is not proof that the app currently has XSS. Signup enumeration and support/retention procedures need explicit policies. Existing operator-only Admin behavior remains privileged and owner-checked; production administrator provisioning is not supplied by the local-only command.

No independent penetration-test certificate or blanket security assurance is claimed. Cross-account isolation passed the executed tests; equivalent authorization must remain enforced when gating deferred endpoints or updating dependencies.

## F. Engineering and data-integrity assessment

### Inventory and execution boundaries

| Layer                  | Actual role and main files                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web routes             | Next App Router authenticated layout; Calendar root, Fitness Training/Exercises/History, workout/session routes, Settings; deferred-route guards and legacy standalone pages                               |
| Web state              | TanStack Query owns server caches; React Hook Form/Zod owns forms; local React state owns selection/pickers; account/tab-scoped storage owns Fitness recovery, return context and Calendar history         |
| Wire boundary          | `packages/contracts` strict schemas/release flags; `packages/api-client` typed HTTP and errors; frontend has no Drizzle/API repository dependency                                                          |
| API composition        | Express `createApp` wires exact auth boundary, session/origin middleware and feature-gated routers; loopback lifecycle/startup with validated configuration                                                |
| Canonical domain rules | Planning time blocks/date-only items/series/selection/search/copy services; Exercise definitions/plans/session/progress services; Identity preferences/access; public cross-domain services in composition |
| Persistence            | Module repositories with Drizzle/pg, owner predicates, parent locks, constraints/triggers, revisions, receipts and opaque transaction context; migration SQL history                                       |
| Shared time/units      | Temporal date/week/DST functions in domain-utils; canonical kg/metres/seconds; display/input units at boundaries                                                                                           |
| Operations             | Local Compose dev/test databases, runtime-role provisioning for local setup, startup/ready/health/drain logic; deployment/backup automation not demonstrated                                               |

### What is sound

The modular monolith is suitable for this release. Boundaries are enforced by an AST-based import check and its negative tests. Services coordinate transactions through opaque scopes; repositories own persistence; cross-domain scheduling/ledger interactions use public services. No failure of the boundary check or concrete circular-import defect was found. Retained future code is not inherently a problem.

Reusable workout targets, scheduled snapshots and actual sessions are separate. Editing an exercise or reusable definition does not rewrite old result snapshots. Finishing/correcting/deleting sessions updates the one canonical source-time entry transactionally. Pause intervals are explicit and excluded from recorded duration without redefining planned reservations. Progress uses completed, non-skipped sets from finished workouts and retains missing measurements as unknown. Records are derived, so correction/deletion does not require a separate statistics backfill.

Database/version/idempotency tests cover stale writes, simultaneous edits, owner+key replay, receipt rollback, private references, detach-not-delete planning links and consistent workout aggregate reads. Migration application and restricted role CRUD/DDL behavior are exercised in isolated tests. This does not substitute for a restored production backup or a real upgrade rehearsal.

### Targeted debt and risks

R05 is a client aggregation identity error, not a reason to stop returning overlapping week records. R06 needs consistent saved-instant handling rather than replacing Temporal. R09 concerns recovery of sent commands, not removal of safe server idempotency. R11 can be addressed with a focused query contract/query batch. R12 needs coherent read snapshots. R15 suggests cohesive extraction while keeping the shared editors. There is no evidence supporting microservices, a new state manager, a rewritten ORM or a generic tracking engine.

Performance review establishes bounded pagination/calendar date ranges and one concrete query-amplification issue. The production build emitted about 2.37MB of JavaScript across all generated chunks; that is **not** an initial-route transfer measurement or proof of poor load time. No p95 latency, concurrent-user capacity, large-history EXPLAIN profile, long-session memory test or physical low-end-device benchmark was performed. These remain explicit verification gaps rather than invented bottlenecks.

## G. Testing and verification results

### Environment and preservation

Node `v26.0.0`, pnpm `9.15.9`, macOS host, local PostgreSQL test service. Test servers use 3100/3101 and synthetic account data; auth/production-cookie integration tests configure production behavior in isolation. The browser runtime is Chromium with desktop and phone device emulation, with 320px probes where stated. It is not a native app or physical-device Safari test.

A pre-audit hash inventory recorded 706 existing repository files. The audit runs on the dirty working tree, not just committed HEAD. Generated Next TypeScript includes are checked/restored, not accepted as source edits. No existing user change is reset. All 706 pre-existing repository files matched their pre-audit hashes after restoring Next-generated includes. The report keeps results here instead of modifying IMPLEMENTATION/FEATURES, because the audit brief permits only this Markdown repository artifact.

### Checks

| Check                                          | Actual outcome                                                                                                                                               | Interpretation                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                    | Passed, including zero warnings and architectural boundaries                                                                                                 | Static quality/boundary check                                                                                                                                                         |
| `pnpm typecheck`                               | Passed across workspace                                                                                                                                      | Strict compile checks, not runtime correctness                                                                                                                                        |
| `pnpm test` first run                          | 177 passed, one password test timed out at 5s while build/integration checks ran concurrently                                                                | Not silently counted as green                                                                                                                                                         |
| `pnpm test` isolated repeat                    | 178/178 unit tests and 6/6 architecture tests passed                                                                                                         | Initial timeout consistent with local contention; rerun did not change code or timeout                                                                                                |
| `pnpm --filter @168hours/api test:integration` | 150 passed, 2 failed, 31 files total, about 179.5 seconds                                                                                                    | R14 diagnoses both fixture issues; suite is currently red                                                                                                                             |
| `NEXT_DIST_DIR=.next-audit pnpm build`         | All workspace/API/web production builds passed                                                                                                               | Does not exercise an actual production proxy/DB role                                                                                                                                  |
| `pnpm audit --prod --json`                     | Failed advisory gate; 32 entries / 31 GHSA IDs; metadata 44 instances                                                                                        | R01 triages reachability rather than treating all labels as exploits                                                                                                                  |
| Temporary core AP suite                        | 9 passed, 1 deliberately skipped                                                                                                                             | Positive reproduction assertions for scope leaks, Month copy, repeated-hour edits, picker dimensions and pagination-error behavior; passing probes confirm defects, not their absence |
| Core existing browser regression               | 67 passed, 7 failed out of 74 (about 500.7 seconds)                                                                                                          | Existing journeys, not substitute temporary mocks for the whole application                                                                                                           |
| Corrected temporary fixture journeys           | 6/8 passed; complete daytime journey and recovery passed desktop/phone, history failed at lost Duration selection (R17)                                      | These are supplementary checks; the repository suite remains unchanged/red                                                                                                            |
| Fresh isolated DB / targeted integration       | 39 migrations applied on a newly created test DB; 38 public tables, zero invalid indexes; 8/10 targeted cases passed, the same two fixture failures repeated | Release boundary suite 4/4; no production/dev schema reset; disposable DB removed                                                                                                     |
| Focused desktop geometry repeat                | Failed again at the same containment assertion                                                                                                               | R16 reproduced independently; not silently reclassified as a pass                                                                                                                     |
| Tablet release-scope check                     | 3/3 tablet core release checks passed                                                                                                                        | Tablet browser emulation only                                                                                                                                                         |
| Formatting / whitespace / preservation         | Final repository formatting, diff whitespace and baseline hash checks passed; all 706 pre-existing files preserved byte-for-byte                             | Sole intended repo addition is this report                                                                                                                                            |

### Commands and evidence locations

- Baseline quality commands are exactly those listed above. Production build used a separate output directory, subsequently moved to `/tmp/168hours-release-audit/production-build` so generated binaries could not enter Tailwind's source scan.
- Temporary browser configuration `/tmp/168hours-release-audit/audit.config.ts` imports the repository's normal server setup and overrides scope to core, using synthetic accounts. Its JSON result is `/tmp/168hours-release-audit/results.json`; screenshots/traces/attachments are under `results/`. Reproductions assert the actual defect symptoms. One phone cross-week card test is explicitly skipped because compact Month does not reliably preview the specific card.
- First temporary-probe attempts had test-only selector/query mistakes (Search accessible name; calendar-items without required date range). They were corrected outside the repository and rerun. A temporary copied-journey setup initially could not resolve a repository-relative helper import; resolving that external harness import allowed execution, without modifying the original tests. A first startup attempt also failed because the audit's unignored build output was scanned by Tailwind; moving that generated directory outside source resolved the audit-induced failure without an application fix. These are not reported as product defects.
- Existing regression configuration `/tmp/168hours-release-audit/regression.config.ts` runs these 15 files with **core** flags on desktop/phone: `release-scope`, `isolation`, `calendar-editor-polish`, `calendar-domain-scheduling`, `calendar-repeating`, `calendar-redo`, `calendar-context-menu`, `fitness-complete-journey`, `fitness-workout-recovery`, `fitness-secondary-actions`, `fitness-result-corrections`, `fitness-advanced-polish`, `fitness-history-foundation`, `fitness-summary-polish`, `fitness-context-navigation`. JSON/logs and screenshots are under the same `/tmp/168hours-release-audit/` directory.
- The complete integration suite also executes retained-domain tests. Those results exercise shared foundations; they do not authorize exposing those features in core.
- Temporary artifacts are local evidence, not a durable CI archive. Current CI is intentionally absent; release checks need a recorded operator-run gate. No test is claimed to have passed merely because IMPLEMENTATION recorded an earlier run.

### Important gaps

The entire browser suite is larger than this selected regression and was not run in full. New signup-to-settings-to-every-calendar-mode UI was not exhaustively repeated. WebKit/Firefox, actual iOS/Android browsers, real screen readers, background OS suspension, prolonged offline writes, storage quota/disabled storage, large datasets/load testing, production proxy cookies/headers, actual backup restore and deployment rollback remain unverified. R09/R10/R12 are clearly identified source-level interruption/read-race risks. Do not collapse these into a blanket “all tests pass” claim.

## H. Prioritized remediation roadmap

Each phase should be independently reviewable and preserve retained preview code. This is a proposed plan; this audit does not implement or authorize unrelated product expansion.

| Phase                                       | Related work                                                                                                                                       | Exit evidence                                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Security dependency and HTTP boundary    | R01; focused compatible dependency/lockfile updates, parser configuration; verify production edge assumptions from R04                             | Current advisory triage has no unresolved applicable High/Critical exposure; isolated malformed-encoded-body process-survival test; auth/origin/cookie/isolation suite and build green |
| 2. Public access and deployment policy      | R02/R04; decide open signup vs controlled beta, credential recovery/rotation and mailbox policy; hosting/secrets/proxy/DB roles/backups/monitoring | Built-server smoke through intended TLS edge; tested restore to isolated environment; documented rollback/support/incident ownership; password lifecycle appropriate to chosen launch  |
| 3. Close release boundaries                 | R03; one coordinated preview-gating pass for pages, dedicated endpoints, shared unscheduled variants/search/deep links                             | Core direct-route/read/write negatives; preview positives; all-day/copy/undo/history/reference integrity retained                                                                      |
| 4. Calendar correctness and controls        | R05/R06/R07; shared identity aggregation, saved-instant timing handling and usable picker position                                                 | Cross-week single/day/group operations exactly once; both repeated-hour title edits preserve UTC; 320px targets/focus/viewport tests; recurrence/conversion/undo regressions           |
| 5. Interruption and partial-read resilience | R08/R09/R10/R12/R16/R17; preserve loaded pages, recover unresolved Calendar intents, completion lookup state, coherent comparison reads            | Controlled drop/refresh/same-key retry; no extra plans; loaded history retained; no false completed Next; deterministic correction/deletion comparison race                            |
| 6. Restore a trustworthy release gate       | R14 plus any current browser fixture discrepancies; fix deterministic dates/current record semantics, not valid domain behavior                    | Full unit/integration/build/core browser gate green repeatedly, including fresh database and account isolation; no unclassified failures                                               |
| 7. Focused performance and final acceptance | R11; requested-week query/batch, realistic dataset plan/timing review; actual phone/browser checks                                                 | Documented query count and representative latency; core workflows on actual mobile browser and keyboard/screen-reader spot checks                                                      |
| After release-critical work                 | R13/R15 status/filter consistency, cohesive controller extraction and current documentation cleanup                                                | Small changes retain existing functional regressions; no broad rewrite                                                                                                                 |

Phases 1-3 establish the security/launch contract. Phase 4 fixes confirmed first-release behavior. Phase 5 reduces practical interruption risks; make explicit acceptance decisions if any are deferred. Phase 6 is a release gate throughout, not a reason to postpone running tests until the end. Coordinate time/picker work and recovery/error-state work to avoid repeatedly altering the same controllers.

## I. Final go/no-go assessment

**NO-GO for unrestricted public users in the current working tree.** Product scope is sufficient; the remaining work is bounded remediation and release verification.

### Explicit blockers

1. Applicable pre-auth body-parser exposure and unresolved active dependency remediation (R01).
2. No adequate public account recovery/credential-change/onboarding policy implemented for open signup (R02).
3. No evidenced production deployment, trusted edge, tested data restore and monitoring/incident path (R04).
4. Explicitly excluded standalone features still available in core (R03).
5. Confirmed cross-week Calendar Copy and saved repeated-hour editing defects (R05/R06).
6. Measured undersized adjacent mobile date-picker targets (R07).
7. Regression release gates are red until their nondeterministic/stale fixtures are corrected, the measured geometry discrepancy is resolved or explicitly accepted, and the full gate rerun (R14/R16).

A controlled invite beta could accept a narrower account-support policy and some nonblocking polish, but it still requires safe dependencies, data isolation, backups/recovery and explicit known-issue decisions. It is not an automatic GO based on the number of passing tests.

### Minimum final verification

After remediation: fresh production-like initialization and upgrade rehearsal; full lint/format/types/unit/integration/build; core release boundaries including all excluded direct routes/API methods; real Calendar and Fitness journeys with account changes, DST/week boundaries, exact uncertain-write recovery and concurrent corrections; representative desktop/tablet/narrow phone; actual mobile browser and assistive-technology spot checks; and a built deployment smoke/restore test through the intended TLS/proxy configuration. Re-run current advisory checks immediately before release.

The major strengths should be preserved: one canonical owner-scoped record, independent planned and actual state, historical snapshots, transactionally unique activity time, safe revisions/retries and shared editing. None of the evidence justifies expanding scope or replacing the architecture to reach v1.
