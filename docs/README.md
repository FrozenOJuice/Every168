# Every168 documentation

**Current objective (2026-10-30):** present the working Calendar/Fitness app as a local software-engineering portfolio. No public deployment is being pursued. The local implementation, not an older remote branch, defines the current behavior.

Current identity: **Every168**. The repository is `FrozenOJuice/Every168`; internal compatibility identifiers remain unchanged, and historical records retain the name used when they were written.

## Start here

| Document                                        | Purpose                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| [Brand guide](BRAND.md)                         | Identity, asset sources and intentionally retained technical/historical names     |
| [Portfolio case study](PORTFOLIO_CASE_STUDY.md) | Problem, engineering decisions, tradeoffs and presentation suggestions            |
| [Local development](LOCAL_DEVELOPMENT.md)       | Installation, local sign-in, optional mail setup, synthetic showcase and commands |
| [Screenshot gallery](media/README.md)           | Actual app captures, reproduction and visual-asset notices                        |
| [Architecture](architecture.md)                 | Implemented module, persistence and client boundaries                             |
| [Authentication and authorization](security.md) | Current identity, isolation and repository-hygiene findings                       |
| [Verification](verification.md)                 | Local checks and test-scope distinctions                                          |
| [Decisions](decisions/)                         | Focused architecture decision records                                             |

## Scope and owner references

- [Product scope](SCOPE.md) separates implemented scope from later direction.
- [Features](FEATURES.md) is the owner's full-app reference, including retained preview features and Needs work notes.
- [Build specification](../168HOURS_BUILD_SPEC.md) records the original constraints and accumulated owner approvals; later explicit instructions take precedence.
- [Implementation record](IMPLEMENTATION.md) preserves historical work and actual check results. Read its dated entries as snapshots, not a single current test total.

## Publication handoff

[Publication and licensing review](PUBLICATION_REVIEW.md) records the current safety findings, source/asset licensing scope and final verification results. Its [dependency inventory](DEPENDENCY_LICENSES.json) describes exact production versions without private filesystem paths or vendored packages.

## Historical release work

The [comprehensive audit](FIRST_RELEASE_AUDIT.md) identified issues before remediation. The [remediation report](FIRST_RELEASE_REMEDIATION.md) records subsequent fixes and verified local results. Their earlier public-beta target does not describe an active deployment or the current portfolio objective.

The [deployment runbook](PUBLIC_BETA_DEPLOYMENT.md) and [foundation notes](foundation.md) remain useful technical references. Actual hosting, email delivery acceptance, public TLS, off-host backups/restores and monitoring were not verified on public infrastructure. There is no need to provision them to view the local synthetic showcase.
