# Every168 identity

**Every168** is the current product name, pronounced “Every one sixty-eight.” It refers to the 168 hours in every week. Use that exact capitalization, without a space or suffix. The short promise is **Plan your week. Record your training.** The longer portfolio line adds **Review what actually happened.**

This is a local software-engineering portfolio, not a deployed service. The name does not imply ownership of a domain, a registered trademark or legal clearance. The repository is `FrozenOJuice/Every168`. Repository links follow that name; no domain ownership or hosting configuration is implied.

## Visual identity

<img src="../apps/web/public/brand/wordmark.svg" width="280" height="64" alt="Every168 wordmark with a green time-block E mark" />

- **Mark:** an E formed from three rounded time blocks and a shared left edge, on a rounded green square. It connects Calendar structure with repeated training without adding a separate fitness symbol. It is geometric, original project artwork with no font dependency.
- **Wordmark:** Every in foreground ink, 168 in primary green, on one line. The shared `BrandLink` component is used in the app shell, sign-in, registration, verification and recovery screens. The decorative mark has an empty alt; the link's accessible name is “Every168 home.”
- **Typography:** retain the application's local system stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. The compact wordmark uses weight 750 and modest negative letter spacing; body/form typography stays unchanged. There is no external font request or bundled commercial typeface. SVG wordmark text uses the same family; exact glyphs vary by operating system.
- **Colors:** retain the established semantic palette below. Branding does not introduce unrelated gradients, new action colors or a new interface theme. The icon reverses the E to white on primary green.
- **Usage:** keep the mark square, wordmark horizontal and both proportional. Leave at least a quarter of the mark's width clear around standalone artwork. Use the wordmark on the existing light backgrounds; the standalone green tile works on light or dark surfaces. Do not stretch the assets or use the icon alone as an unlabeled navigation action.

| Semantic token     | Color     |
| ------------------ | --------- |
| Background         | `#f8f8f5` |
| Foreground         | `#1e2422` |
| Card               | `#ffffff` |
| Primary            | `#196b57` |
| Primary foreground | `#ffffff` |
| Muted              | `#eef0eb` |
| Muted foreground   | `#66706c` |
| Border             | `#dfe3dc` |
| Input              | `#cfd5cd` |
| Focus ring         | `#2a806a` |
| Destructive        | `#b42318` |

## Assets and reproduction

- [Canonical mark SVG](../apps/web/public/brand/mark.svg) is used directly in the interface.
- [Standalone wordmark SVG](../apps/web/public/brand/wordmark.svg) is the portfolio lockup; keep its geometry/colors in sync with the mark and shared component.
- [Browser SVG icon](../apps/web/src/app/icon.svg), [multi-size favicon](../apps/web/src/app/favicon.ico) and [180px Apple icon](../apps/web/src/app/apple-icon.png) are generated from the canonical mark by [the asset script](../scripts/brand-assets.mjs). Run `pnpm brand:assets` after installing Playwright Chromium. It uses a local browser, no application server or database.
- [Genuine application captures](media/README.md) come from `pnpm portfolio:capture`. Each authenticated capture checks the product title, home-link name and absence of the former visible name. A sign-in capture also shows the account-access identity. Never replace the application DOM or present a mockup as an app capture.

These project-created brand assets use the root MIT terms, without changing the existing copyright notice or third-party licenses. The mark's originality is not a trademark-clearance claim. Lucide/Feather notices remain with the gallery.

## Compatibility and naming audit

The former product name was **168Hours**. The rename updates present-day product prose and display surfaces, rather than replacing every matching byte. Remaining references fall into the following intentional groups:

| Class              | Retained names or locations                                                                                      | Reason                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Technical          | Root package `168hours`; private `@168hours/*` workspace packages, imports, filters and boundary rules           | Keep a coherent internal package graph; a package migration offers no user-facing benefit. Public clone instructions use Every168.               |
| Technical          | Browser-storage keys beginning `168hours:`, history markers `__168hours*` and their regression fixtures          | Preserve recovered drafts, exact pending requests, rest timers, navigation context and Undo/Redo across the rename.                              |
| Technical          | `X-168hours-Client-IP` and `X-168hours-Session-Refresh` headers, tests and technical documentation               | Preserve the security boundary and both sides of existing authentication/proxy behavior.                                                         |
| Technical          | `https://168hours.invalid` URL-parsing bases                                                                     | Reserved, non-routable sentinels used to validate local return navigation; these are neither public domains nor product links.                   |
| Technical          | `168HOURS_BUILD_SPEC.md` filename and links; formatter exclusion                                                 | Preserve the authoritative specification path and existing instructions.                                                                         |
| Historical         | Original build-spec body, dated implementation entries, first-release audit/remediation and deployment snapshots | Preserve the names, commands, paths and evidence used at the time. New provenance notes identify the current name without rewriting the reports. |
| Historical context | This naming guide, explanatory compatibility notes and negative branding assertions in tests                     | Explain or detect the old name; they do not present it as the current product.                                                                   |
| Literal quantity   | “168 hours” in the name's explanation                                                                            | Describes the length of a week, rather than an alternate product name.                                                                           |

Database names, roles, volumes, SQL migrations, session-cookie names and stored user data also stay unchanged. The auth library's display `appName` is now Every168; its cookie prefix remains the library's existing `better-auth` default. API log and PostgreSQL connection labels are now `every168-api`; those labels do not name a database, schema or persistent identifier.

The same Every168 shell/metadata applies when retained preview features are enabled. Their implementations, roadmap notes and scope gates remain intact. Sender addresses and email-link origins remain operator configuration; account email display name, subjects and body use Every168 without inventing a brand-owned mailbox or changing delivery behavior.

## Publication decisions

Review the visual identity and portfolio wording before staging/publishing. Decide whether to review name/trademark availability for intended future use, independently of this repository task; no clearance or domain purchase was performed. The [publication review](PUBLICATION_REVIEW.md) records preserved author metadata, the source/asset licensing assessment and future binary-distribution limits. Optional next presentation work is a genuine recorded walkthrough or a social card composed from the recaptured Week/Live views. Public hosting remains deferred.
