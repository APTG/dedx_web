# Stage 5 — Core Shared Components

> **Status:** Complete (28 April 2026)
>
> Stage 5 produced the five reusable building blocks that Stage 6's
> feature pages compose into the Calculator and Plot routes. Every
> sub-stage was implemented in its own PR with TDD, then the closing
> UX review on 28 April confirmed all acceptance criteria are met.

## Sub-stages

| #     | Component                                            | Status | PR(s)                                                                                                                                                                                                                                                          | Detailed log                                                                          |
| ----- | ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 5.1   | Entity selection (cascading dropdowns + full panels) | ✅     | [#366](https://github.com/APTG/dedx_web/pull/366), [#367](https://github.com/APTG/dedx_web/pull/367) (combobox transparency), [#371](https://github.com/APTG/dedx_web/pull/371) (cascading fixes)                                                              | [`stage-5-entity-selection.md`](stage-5-entity-selection.md)                          |
| 5.2   | Energy input + per-line validation + debounce        | ✅     | [#368](https://github.com/APTG/dedx_web/pull/368), [#369](https://github.com/APTG/dedx_web/pull/369) (logs)                                                                                                                                                    | (folded into 5.4 once the unified table replaced the standalone component)            |
| 5.3   | Energy unit selector (segmented control)             | ✅     | [#370](https://github.com/APTG/dedx_web/pull/370)                                                                                                                                                                                                              | (covered by stage-5-audit + ux-review)                                                |
| 5.4   | Unified input/result table                           | ✅     | [#374](https://github.com/APTG/dedx_web/pull/374), [#376](https://github.com/APTG/dedx_web/pull/376) (MeV/nucl), [#377](https://github.com/APTG/dedx_web/pull/377), [#378](https://github.com/APTG/dedx_web/pull/378), [#379](https://github.com/APTG/dedx_web/pull/379) | [`stage-5.4-result-table.md`](stage-5.4-result-table.md), [`stage-5-audit-2026-04-26.md`](stage-5-audit-2026-04-26.md) |
| 5.5   | JSROOT plot wrapper + plot route                     | ✅     | [#394](https://github.com/APTG/dedx_web/pull/394)                                                                                                                                                                                                              | [`../ai-logs/2026-04-27-stage5-jsroot-plot.md`](../ai-logs/2026-04-27-stage5-jsroot-plot.md) |

## Closing audits

- **Stage-5 audit (26 Apr 2026):** [`stage-5-audit-2026-04-26.md`](stage-5-audit-2026-04-26.md) — flagged ~480 LOC of dead code (`energy-input.svelte` component + `units/energy.ts` + redundant tests), missing master `EnergyUnitSelector`, missing debounce wiring, kinetic-energy-conservation gap on particle / per-row-unit switches.
- **Stage-5 closing UX review (28 Apr 2026):** [`../ux-reviews/2026-04-28-stage5-completion-and-stage6-readiness.md`](../ux-reviews/2026-04-28-stage5-completion-and-stage6-readiness.md) — verified every audit item is closed, identified 11 open polish items (3 desktop / 8 mobile) deferred to Stage 6 polish or Stage 7, and gave the green light to start Stage 6.

## Outcomes

- All five sub-components are stable, reused in place, and exercised by 425+ unit/integration tests.
- ~480 LOC of dead/duplicated code removed (`energy-input.svelte` component, `units/energy.ts`, `energy-input-format.test.ts` overlaps).
- Particle/material display naming centralized in [`src/lib/utils/particle-label.ts`](../../src/lib/utils/particle-label.ts) and reused by both calculator comboboxes and plot legends.
- KE conservation across particle / per-row-unit switches is locked in by spec ([`unit-handling.md` v4](../04-feature-specs/unit-handling.md)) **and** by E2E tests ([`tests/e2e/particle-unit-switching.spec.ts`](../../tests/e2e/particle-unit-switching.spec.ts)).
- Plot URL state encoded/decoded via [`plot-url.ts`](../../src/lib/utils/plot-url.ts) (canonical params) — serves as the reference implementation for the Calculator URL sync that Stage 6 owns.

## What Stage 6 picks up

- Calculator URL sync per [`shareable-urls.md`](../04-feature-specs/shareable-urls.md) (delete the unwired `src/lib/state/url-sync.ts` first).
- Shared layout toolbar (Export PDF / Export CSV / Share URL) per [`export.md`](../04-feature-specs/export.md) v3 §0 — also unblocks the mobile hamburger / overflow nav noted in M1 of the closing review.
- Multi-program mode per [`multi-program.md`](../04-feature-specs/multi-program.md).
- CSV + PDF export per [`export.md`](../04-feature-specs/export.md).
- 11 open polish items from the closing UX review (3 desktop, 8 mobile/Stage 7).
