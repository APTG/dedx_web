# 2026-06-26 — Advanced-options disclosure above the plot (#798)

## Session Narrative

### Prompt 1: Work on issue #798, make PR when ready

**AI response**: Implemented the plotting-area-redesign issue #798 — surfacing the
Advanced options as an inline collapsible disclosure mounted directly above the
plot canvas, and wiring the manual Y-range override that overrides the #796
`niceCeil` auto-range.

Key decisions:

- **Reused the shared `advanced-options-panel.svelte`** rather than forking a new
  component, matching the issue's "Files" guidance. The panel gained three
  optional props: `plotRanges` (enables the disclosure presentation + Y-range
  inputs), `showCalculationControls` (default `true`; the plot page passes
  `isAdvancedMode.value` so density/I-value/interpolation/MSTAR stay
  Advanced-mode-only), and `persistKey` (localStorage key for open/closed). When
  `plotRanges` is omitted the calculator page renders exactly as before.
- **Kept the Bits UI Accordion** as the disclosure primitive instead of
  hand-rolling a `<details>` — it already provides an `aria-expanded` button,
  keyboard (Enter/Space) toggling, a chevron that reflects state, and DOM
  presence (collapsed content is unmounted, which the Playwright "collapsed on
  load" assertion relies on). Open state is now controlled via `bind:value` so it
  can be hydrated from / written to `localStorage`
  (`webdedx.plot.advancedOpen.v1`).
- **Discoverability vs. scope:** the panel previously rendered only in Advanced
  mode below the fold. To satisfy "visible on cold load" without exposing the
  physics controls to Basic users (out of scope), the disclosure container now
  renders whenever a material is selected, but the calculation controls inside
  remain gated on Advanced mode. Basic mode therefore shows just the Y-range
  override.
- **Content hint:** the issue's literal hint `Y-range · grid · markers · ref
  lines` advertises controls that do not exist (grid/markers/ref-lines were
  explicitly out of scope and have no UI today). Used an honest hint instead —
  `Y-range` in Basic mode, `Y-range · density · interpolation` in Advanced mode.
- **Y-range state** lives in plot state (`plot.svelte.ts`) as `yMin` / `yMax`
  with a `setYRange` setter, cleared by `resetAll`, and is read by the existing
  `computeAxisRanges` `opts` (the override math already shipped in #796). Empty
  input = auto; a finite positive number wins verbatim.

## Tasks

### Advanced-options disclosure + manual Y-range

- **Status**: completed
- **Stage**: Plot chrome (epic #800, PR bundle C)
- **Files changed**:
  - `src/lib/state/plot.svelte.ts` — `yMin`/`yMax` state, `setYRange`, reset.
  - `src/lib/components/advanced-options-panel.svelte` — disclosure props,
    persistence, Y-range section, calc-controls gate, gear header + hint.
  - `src/routes/plot/+page.svelte` — moved the panel above the canvas, wired
    `plotRanges`/`persistKey`/`showCalculationControls`, fed `yMin`/`yMax` into
    `computeAxisRanges`.
  - `docs/04-feature-specs/plot.md` — new §8 disclosure spec + state notes.
  - `src/tests/unit/plot-state.test.ts` — `setYRange` + reset coverage.
  - `src/tests/components/advanced-options-panel.test.ts` — Y-range / disclosure
    rendering + calculator-unchanged coverage.
  - `tests/e2e/plot-advanced-disclosure.spec.ts` — new Playwright spec.
- **Decision**: see narrative — reuse shared panel via opt-in props; keep
  Accordion primitive; honest content hint.
- **Issue**: e2e not run locally (no built WASM in `static/wasm/`); the spec
  follows the established `plot-linear-y-range.spec.ts` patterns and runs in CI.
