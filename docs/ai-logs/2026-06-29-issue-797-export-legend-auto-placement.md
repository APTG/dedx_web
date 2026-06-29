# 2026-06-29 — Export legend auto-placement (#797 follow-up)

## Session Narrative

### Prompt 1: "work on #797, make PR when ready"

**AI response**: Investigated and found that issue #797 ("Legend in exports —
inject a TLegend into the off-screen pad") had already been **implemented and
merged** via PR #804 (`feat(plot): series-strip rework + in-canvas export
legend`), which the just-fetched `origin/master` already contained at commit
`ae650dc`. The working branch was identical to master, so a fresh PR would have
been empty. The only loose end was the issue's **"Open question"**: the legend
was shipped at a fixed top-right position, with auto-placement to the emptiest
corner left as a possible enhancement (epic open question 1).

Confirmed direction with the user, who chose to **build the auto-placement
enhancement**.

Implemented it as pure, testable additions to `plot-utils.ts`:

- `axisFraction(value, min, max, isLog)` — maps a data value to its [0,1]
  fraction across an axis, honouring log scale (NaN for invalid log inputs).
- `legendBoxForCorner(corner, rows)` — the legend rectangle anchored to a given
  frame corner, sized for `rows` entries. Horizontally flush to the frame side,
  inset vertically; the `"tr"` box reproduces the historical top-right placement
  exactly, so a top-right choice is a visual no-op vs. the prior behaviour.
- `chooseLegendCorner(input, rows)` — maps every in-frame sample point to pad
  NDC and counts overlaps against each of the four candidate boxes, returning
  the emptiest. Tie-break order is `tr → tl → br → bl`, so proton-in-water
  (peak on the left) stays top-right and the legend only moves when a curve
  would be occluded.
- `buildExportLegend` gained an optional third `placement` argument. With it the
  legend auto-places; without it the fixed top-right box is kept, so existing
  2-arg call sites and unit tests are unchanged.

Caller (`jsroot-plot.svelte` `buildMultigraph`) now collects the per-series
display-unit `(x, y)` arrays alongside the legend items and threads `xLog`/`yLog`
from the export path into the builder.

## Tasks

### Auto-place the export legend into the emptiest frame corner

- **Status**: completed
- **Stage**: plot-redesign (epic #800), problem 5 / open question 1
- **Files changed**:
  - `src/lib/utils/plot-utils.ts` — `axisFraction`, `legendBoxForCorner`,
    `chooseLegendCorner`, `LegendCorner`/`LegendBoxNDC`/`LegendPlacementInput`
    types; `buildExportLegend` optional `placement` arg.
  - `src/lib/components/jsroot-plot.svelte` — collect sample points + thread
    `xLog`/`yLog`; pass placement data to `buildExportLegend`.
  - `src/tests/unit/build-export-legend.test.ts` — new `chooseLegendCorner` and
    `legendBoxForCorner` cases; default-placement-unchanged assertion.
  - `docs/04-feature-specs/plot.md` — Export → In-canvas legend section.
  - `CHANGELOG-AI.md`, this log.
- **Decision**: occupancy is measured by counting raw sample points inside each
  candidate box (cheap, no geometry library) rather than analytic curve/box
  intersection; curves are densely sampled so this is an accurate proxy. The
  box keeps the historical width/row-height; only its anchor corner changes.
  Tie-break favours top-right to preserve the established default.
- **Decision**: kept `buildExportLegend` backward compatible (placement is
  optional) so the prior fixed top-right behaviour and its tests are untouched;
  the new behaviour activates only when the caller passes sample data.
- **Issue**: none outstanding. The on-screen plot is unaffected — it never
  receives a legend (HTML strip remains its only legend, per Q1/#793).

### Prompt 2: "Reply to review comments, fix failing CI issues"

**AI response**: Two follow-ups on PR #807:

- **Review comment** (Copilot): `buildMultigraph`'s `opts` made `xLog`/`yLog`
  optional even on the export path, so a future `withLegend: true` call could
  omit them and the auto-placement would silently assume linear axes. Reworked
  `opts` into a discriminated union on `withLegend` so TypeScript enforces
  `xLog`/`yLog` whenever the legend is drawn; dropped the `?? false` fallbacks.
- **Failing CI** (`accessibility.spec.ts` — zero WCAG AA violations on the plot
  page): the **Reset zoom** button (from #794's `plot-toolbar.svelte`, not this
  PR) used coral `#e7663b` text on white = 3.3:1, below the 4.5:1 AA threshold.
  Pre-existing on master, but fixed here at the user's request: darkened the
  button text/border to `#c2410c` (~5.2:1, same accent identity). No test
  asserts the colour, so behaviour coverage is unaffected.

## Verification

- `vitest run` on `build-export-legend.test.ts` (14), `jsroot-plot.test.ts`
  (20), `plot-utils.test.ts` (30) — all green.
- `svelte-check` — 0 errors / 0 warnings.
- `eslint` + `prettier` — clean on the changed files.
- Playwright `plot-export-legend.spec.ts` is CI-run (needs built WASM); legend
  entries/labels are unchanged, only the box anchor moves, so its assertions
  (visible label present, hidden label absent, no on-screen legend) still hold.
