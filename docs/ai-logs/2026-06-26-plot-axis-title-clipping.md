# 2026-06-26 — Plot axis title clipping follow-up (#801 regression)

## Session Narrative

### Prompt 1: "Issues with PR #801 — autorange for linscale is OK, but axis title text is clipped (top of 'S' in 'Stopping Power', descender of 'y' in 'Energy'). Text is being cut from outside. Maybe the plot area should have a tiny breathing space around it."

**AI response**: Root cause: PR #801 raised `AXIS_X_TITLE_OFFSET` /
`AXIS_Y_TITLE_OFFSET` to `1.6` to clear the tick labels, but JSROOT's pad
margins (default ~0.1) were left untouched. With the larger offset the rotated
Y title and the X title are pushed all the way to the SVG edge, where JSROOT's
SVG clips them from outside.

Pushing the titles out is only half the fix — the frame also needs room around
it. Added shared `PAD_LEFT_MARGIN = 0.14` / `PAD_BOTTOM_MARGIN = 0.14` constants
in `plot-utils.ts` and a small `applyPadMargins(JSROOT)` helper in
`jsroot-plot.svelte` that widens `gStyle.fPadLeftMargin` / `fPadBottomMargin`
before each draw and restores them afterwards. JSROOT creates a fresh pad on
every draw and reads its margins from `gStyle`, so the wider left/bottom margins
shift the whole frame — and the titles hanging off it — inward, giving the
titles breathing space inside the SVG instead of being cut off. Top/right keep
JSROOT's defaults since nothing is clipped there.

Applied (and snapshot/restored) on both draw paths: the on-screen
`drawPlot` (folded into its existing settings `restore`) and the off-screen
export pad (try/finally), so exports keep matching the on-screen plot and the
global `gStyle` change never leaks to other consumers.

### Key decision: widen pad margins, not shrink the title offset

The offsets from #795/#796 are what keep the titles clear of the tick numbers,
so lowering them risks re-introducing the overlap. Widening the pad margins
fixes the clipping without touching the overlap behaviour — and directly
implements the "tiny breathing space around the plot" the report asked for.

## Tasks

### Axis title clipping (breathing-space pad margins)

- **Status**: completed
- **Stage**: plot-redesign (epic #800), follow-up to PR #801 (#795 + #796)
- **Files changed**: `src/lib/utils/plot-utils.ts`,
  `src/lib/components/jsroot-plot.svelte`,
  `src/tests/components/jsroot-plot.test.ts`,
  `tests/e2e/plot-axis-margins.spec.ts`, `docs/04-feature-specs/plot.md`
- **Decision**: widen left/bottom pad margins via `gStyle` (snapshot/restore on
  both the on-screen and export draw paths) rather than reduce the title
  offsets, so the no-overlap fix from #795/#796 is preserved.
- **Issue**: Playwright specs authored but not run locally — this environment
  cannot build the `canvas` native dep, so the JSROOT-rendering e2e specs are
  validated in CI. Unit + component tests run green locally
  (`plot-utils.test.ts`, `jsroot-plot.test.ts`, 42 passing).
