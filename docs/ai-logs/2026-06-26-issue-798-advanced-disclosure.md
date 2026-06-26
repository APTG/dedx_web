# 2026-06-26 — Advanced-options disclosure above the plot (#798)

## Session Narrative

### Prompt 1: Work on issue #798, make PR when ready

**AI response**: Initial implementation moved the Advanced options into a
disclosure above the plot, made it discoverable on a Basic-mode cold load, and
added a manual Y-range (`yMin`/`yMax`) override wired into `computeAxisRanges`.

### Prompt 2: Exclude the Y-range feature; the advanced panel should only be visible in Advanced mode; address review comments; fix failing E2E

**AI response**: Reworked the PR to the narrower scope requested:

- **Dropped the manual Y-range feature entirely** — reverted the `yMin`/`yMax`
  state, setters, and `resetAll` handling in `plot.svelte.ts`; removed the
  Y-range inputs, the input-mirror `$effect`, and the parse helpers from
  `advanced-options-panel.svelte`; and stopped feeding `yMin`/`yMax` into
  `computeAxisRanges` on the plot page. `computeAxisRanges` keeps its latent
  `opts.yMin`/`yMax` from #796, but no UI feeds them now. This also resolves the
  two Copilot review comments about the Y-range inputs (the mirror effect
  clobbering in-progress typing, and the component tests asserting the inputs
  before expanding) — the code under review no longer exists.
- **Gated the disclosure to Advanced mode (AC-1).** The panel is rendered only
  when `isAdvancedMode.value` is true, restoring the original behaviour; the
  `plot.spec.ts` "panel absent in Basic mode" test is back to its master form.
  Removed the `showCalculationControls` prop that had been added to expose the
  panel in Basic mode.
- **Kept the disclosure presentation + persistence.** The panel still moves to
  directly above the plot canvas, shows the `⚙ Advanced options` gear header
  with a `density · interpolation` hint, and persists open/closed to
  `webdedx.plot.advancedOpen.v1` — now driven by a single opt-in `persistKey`
  prop (replacing the removed `plotRanges`/`showCalculationControls` props).
- **Fixed the failing E2E.** The CI failure was entirely in the new
  `plot-advanced-disclosure.spec.ts` (the Y-range override test and the
  cold-load test). Rewrote the spec for Advanced mode without Y-range:
  collapsed-on-load above the plot, keyboard toggle exposing `#density-override`,
  and open-state persistence across reload.

## Tasks

### Advanced-options disclosure (Advanced-mode only)

- **Status**: completed
- **Stage**: Plot chrome (epic #800, PR bundle C)
- **Files changed**:
  - `src/lib/components/advanced-options-panel.svelte` — opt-in `persistKey`
    prop → controlled Accordion + localStorage persistence, gear header +
    content hint + test ids. No Y-range.
  - `src/routes/plot/+page.svelte` — panel moved above the canvas, gated on
    `isAdvancedMode.value`, passes `persistKey`. `computeAxisRanges` opts back to
    `{ yLog }` only.
  - `docs/04-feature-specs/plot.md` — §8 rewritten (Advanced-mode-only, no
    Y-range); Axis-Ranges "manual override" note softened to "latent (#796)".
  - `src/tests/components/advanced-options-panel.test.ts` — disclosure-
    presentation tests (opt-in via `persistKey`, calculator unchanged).
  - `tests/e2e/plot-advanced-disclosure.spec.ts` — rewritten for Advanced mode.
  - Reverted `src/lib/state/plot.svelte.ts`, `src/tests/unit/plot-state.test.ts`,
    and `tests/e2e/plot.spec.ts` to their master forms.
- **Decision**: reuse the shared panel via a single `persistKey` opt-in; keep
  the Bits UI Accordion as the disclosure primitive; Y-range deferred.
- **Issue**: e2e not run locally (no built WASM in `static/wasm/`); the spec
  follows the established `plot.spec.ts` Advanced-mode patterns and runs in CI.
