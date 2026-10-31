# Application screenshots

These are genuine browser captures of the local Every168 application, using synthetic records created through its real API. They do not show the owner's account, real activity or a deployed service. No generated illustration is used as an application screenshot.

## Gallery

| View                      | Capture                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| Sign in                   | [sign-in.png](screenshots/sign-in.png)                                 |
| Calendar Week             | [calendar-week.png](screenshots/calendar-week.png)                     |
| Calendar Month            | [calendar-month.png](screenshots/calendar-month.png)                   |
| Editing a plan            | [plan-editor.png](screenshots/plan-editor.png)                         |
| Exercise library          | [exercise-library.png](screenshots/exercise-library.png)               |
| Workout builder           | [workout-builder.png](screenshots/workout-builder.png)                 |
| Live workout              | [live-workout.png](screenshots/live-workout.png)                       |
| Completed summary         | [workout-summary.png](screenshots/workout-summary.png)                 |
| Exercise progress/history | [exercise-history.png](screenshots/exercise-history.png)               |
| Responsive live workout   | [live-workout-responsive.png](screenshots/live-workout-responsive.png) |

### Calendar Month

![Month view with synthetic plans and workout activity](screenshots/calendar-month.png)

### Exercise history

![Bench press history with actual sets, personal records and reps by weight](screenshots/exercise-history.png)

### Responsive browser layout

<img src="screenshots/live-workout-responsive.png" width="390" alt="Live workout in a 390px-wide responsive browser viewport" />

## Social preview

![Every168 social preview with genuine Calendar and Fitness captures](social-preview.png)

The 1280×640 [social preview](social-preview.png) combines the original Every168 wordmark with cropped versions of the Calendar Week and Live workout captures above. It is a designed cover using genuine synthetic-data screenshots, with no redrawn or generated application UI. It is uploaded in the repository's Settings → Social preview.

Run `pnpm portfolio:social` after installing Playwright Chromium to regenerate it from the existing captures. The [composition script](../../scripts/social-preview.mjs) requires no server, database or external service and checks the dimensions and GitHub's 1 MB size limit. Regenerate it after refreshing its source captures. Existing project and Lucide/Feather notices below also apply to the composition.

## Reproduce

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm exec playwright install chromium
pnpm portfolio:capture
```

See [local development](../LOCAL_DEVELOPMENT.md#provider-free-showcase) for interactive recording mode. Capture code: [fixture and browser flow](../../tests/portfolio/capture.spec.ts), [configuration](../../playwright.portfolio.config.ts).

- Capture date: 2026-10-30, recaptured after the Every168 rebrand. All ten frames are genuine application captures, including the account-access screen.
- Desktop: Chromium, 1440×1000 CSS pixels, device scale 1.
- Responsive view: the same browser at 390×844 CSS pixels; this is viewport testing, not a native app or physical-phone claim.
- Light theme, English locale, America/Edmonton account/browser timezone.
- A fixed October 2026 clock and synthetic record dates make the scene reproducible. Random account/record IDs are not displayed as user data.
- After capture, the simulated clock advances again so an interactive recording can show working timers. Both fixture servers bind to loopback.
- The existing test-only server captures verification email in memory; no external message is sent. Development data is not queried or reset.
- API responses and application DOM content are not replaced for presentation. Captures wait for real records to load. Animations are disabled by Playwright for settled frames.

## Provenance and licensing

The application source and project documentation use the existing [MIT license](../../LICENSE). The Every168 E mark is an original geometric project asset; its wordmark uses the same system sans-serif family as the interface. Source vectors, generated app icons and reproduction are documented in the [brand guide](../BRAND.md). No third-party exercise illustration or bundled font file was found in the repository; the exercise visuals are explicitly labelled placeholders.

UI icons come from Lucide (`lucide-react`), with ISC terms and MIT terms for Feather-derived icons. Their complete installed notice is retained in [LUCIDE-LICENSE.txt](LUCIDE-LICENSE.txt) alongside these screenshots. Other dependencies retain their own package licenses; node_modules and compiled vendor bundles are not committed as portfolio assets.

Do not assume the project's MIT license grants rights to future artwork or external catalogue imagery. Review source and redistribution rights before adding those assets. No current artwork was relicensed in this pass.

The completed [publication/licensing review](../PUBLICATION_REVIEW.md#licensing) includes an exact [production dependency metadata inventory](../DEPENDENCY_LICENSES.json): 381 unique package/workspace versions, with license fields present for every entry. It combines installed metadata with registry metadata for uninstalled optional-platform packages. The original checkout's pnpm license command failed on missing store indexes; after a frozen online install in a clean source copy it succeeded for 270 versions, all cross-checked against the inventory with no disagreements. The review distinguishes this source/screenshot repository from future redistribution of compiled bundles, native libvips binaries or modified third-party code. No dependency tree or native/vendor binary is redistributed here.
