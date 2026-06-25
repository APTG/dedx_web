# 2026-06-25 — Plot axis title margins (#795) + linear-Y nice ceiling (#796)

## Session Narrative

### Prompt 1: "Work on the first PR from the list proposed here: …/issues/800"

**AI response**: Issue #800 is the master epic for the plotting-area
redesign. Its "Suggested PR cadence" table lists **PR A = #795 + #796** as the
first, lowest-risk bundle (pure JSROOT-object-model tweaks + one pure util, no
chrome). Implemented both on branch `claude/tender-planck-6xrky8`.

**#795 — Axis title margins.** JSROOT's default `fTitleOffset` is too small for
our tick-label font, so the X title ("Energy […]") and, in linear-Y, the Y
title ("Stopping Power […]") overlap their tick numbers. Added shared constants
`AXIS_X_TITLE_OFFSET = 1.2` and `AXIS_Y_TITLE_OFFSET = 1.4` to
`src/lib/utils/plot-utils.ts` and applied them to `hist.fXaxis.fTitleOffset` /
`hist.fYaxis.fTitleOffset` inside `buildMultigraph` in
`src/lib/components/jsroot-plot.svelte`. Because the component rebuilds the
histogram on every draw (the `$effect` re-runs on any series/scale change, and
the export path calls `buildMultigraph` too), the offsets are re-applied after
every redraw and on the off-screen export pad — satisfying the "re-apply after
every redraw" rule without a separate after-draw hook.

**#796 — Linear-Y nice ceiling.** Added the pure `niceCeil(x)` util and
extended `computeAxisRanges` with an `opts: { yLog?, yMin?, yMax? }` argument.
Linear-Y now uses `niceCeil(dataMax)` over the visible series with a `0` floor;
log-Y keeps the power-of-ten rounding; a manual `yMin`/`yMax` override (whose UI
is owned by #798) wins verbatim. `src/routes/plot/+page.svelte` passes
`{ yLog: plotState.yLog }`.

### Key decision: the 2.5 step

The issue body's inline `niceCeil` snippet rounds to 1/2/5 ×10ⁿ, which yields
`2262 → 5000` and `2500 → 5000`. But the issue's **acceptance criteria** state
`2262 → 2500`, `2500 → 2500`, `2501 → 5000`, `0.42 → 0.5`. Those require a 2.5
step between 2 and 5. The acceptance list is the authoritative, testable
contract, so `niceCeil` uses the set {1, 2, 2.5, 5, 10}. This is called out in a
code comment and in the changelog.

## Tasks

### #795 · Axis title margins

- **Status**: completed
- **Stage**: plot-redesign (epic #800), PR bundle A
- **Files changed**: `src/lib/utils/plot-utils.ts`,
  `src/lib/components/jsroot-plot.svelte`,
  `src/tests/components/jsroot-plot.test.ts`,
  `tests/e2e/plot-axis-margins.spec.ts`, `docs/04-feature-specs/plot.md`
- **Decision**: applied offsets in `buildMultigraph` rather than a separate
  `applyAxisMargins(painter)` after-draw hook, because this codebase rebuilds
  and redraws the multigraph on every change instead of mutating a persistent
  painter — so `buildMultigraph` *is* the after-every-draw hook, and it also
  covers the export pad with the same shared constants.
- **Issue**: none.

### #796 · Linear-Y nice ceiling auto-range

- **Status**: completed
- **Stage**: plot-redesign (epic #800), PR bundle A
- **Files changed**: `src/lib/utils/plot-utils.ts`,
  `src/routes/plot/+page.svelte`, `src/tests/unit/plot-utils.test.ts`,
  `tests/e2e/plot-linear-y-range.spec.ts`, `docs/04-feature-specs/plot.md`
- **Decision**: `niceCeil` uses {1, 2, 2.5, 5, 10} per the acceptance criteria
  (not the 1/2/5 snippet). Manual `yMin`/`yMax` plumbing added to
  `computeAxisRanges` now; the entry UI is left to #798.
- **Issue**: Playwright specs were authored but not run locally — this
  environment has no built WASM and the `canvas` native dep fails to compile, so
  the JSROOT-rendering e2e specs are validated in CI. Unit + component tests run
  green locally (`plot-utils.test.ts`, `jsroot-plot.test.ts`).
