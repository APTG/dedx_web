# 2026-05-18 — Issue #530 Part B — Plot add-series flow, keyboard shortcuts, JSROOT fix

## Session Narrative

### Prompt 1: Implement Part B of issue #530

User requested implementation of the remaining work from issue #530: fix the JSROOT "Failed to load the plot engine" crash, resolve Part A open questions (★ prefix for named particles, slide-up animation), add `/` keyboard shortcut, series-strip component, and plot page re-layout with live-edit + multi-create.

**AI response**: Created a detailed implementation plan covering:

- Root cause of JSROOT crash: `ObjectPainter.mjs:1828` runs `Object.assign(internals.jsroot, {...})` during module evaluation when JSROOT lazily loads on first `draw()` call with empty multigraph. `internals` is undefined due to ES module circular dep evaluation order. Fix: guard prevents the empty draw call.
- Part A deferred: (c) ★ prefix for proton/alpha; slide-up 200ms animation with prefers-reduced-motion; desktop stays inline.
- `/` shortcut: focuses search input from anywhere in the picker.
- SeriesStrip component with testids `plot-series-strip`, `plot-add-series`, `plot-series-row-{idx}`.
- Plot page re-layout: uses SeriesStrip, `editingSeriesId` state, live-update effect, multi-create for Advanced mode.

Plan approved after adjusting: removed "No data yet" placeholder (first load should show proton+water preview within ~2s).

### Prompt 2 (continuation): Resume implementing

**AI response**: Implemented in this order:

1. JSROOT empty-draw guard in `jsroot-plot.svelte` + unit test + E2E regression tests in `plot.spec.ts`
2. ★ prefix in `particle-tab.svelte` and `picker-sheet.svelte`
3. Slide-up sheet animation in `entity-selection.svelte` (fly transition, prefers-reduced-motion)
4. Fixed jsdom test failures from Svelte 5 WAAPI stub in `src/tests/setup.ts`
5. `/` shortcut in `handleGlobalKey` in `entity-selection.svelte`
6. Keyboard shortcuts section in `user-guide/+page.svelte`
7. `updateSeries()` in `plot.svelte.ts` + unit tests in `plot-state.test.ts`
8. `SeriesStrip` component at `src/routes/plot/series-strip.svelte`
9. Plot page re-layout: SeriesStrip integration, `editingSeriesId`, `handleSelectSeriesForEdit`, live-update `$effect`, `handleAddOrMulti` + `handleAddMultiSeries`
10. Unit tests: `search-input-keyboard.spec.ts`
11. E2E tests: `keyboard-nav.spec.ts`, `plot-add-series.spec.ts`

## Tasks

### JSROOT empty-draw crash fix

- **Status**: completed
- **Stage**: Stage 8 / Plot page
- **Files changed**: `src/lib/components/jsroot-plot.svelte`, `src/tests/components/jsroot-plot.test.ts`, `tests/e2e/plot.spec.ts`
- **Decision**: Guard returns early (no error state set) so the "Loading plot engine…" placeholder stays visible until the default proton+water preview arrives (~2s). No user-visible error.
- **Root cause**: `ObjectPainter.mjs:1828` runs at module-evaluation time during the first `JSROOT.draw()` call. With an empty multigraph (0 series, no preview), `internals` is undefined due to ES module circular dep evaluation order in the Vite bundle. E2E tests missed this because all tests supply entity URL params, so WASM computes preview before the first draw tick.

### Part A deferred choices

- **Status**: completed
- **Files changed**: `src/lib/components/entity-selection/particle-tab.svelte`, `src/lib/components/entity-selection/picker-sheet.svelte`, `src/lib/components/entity-selection/entity-selection.svelte`, `src/tests/setup.ts`, `src/tests/unit/entity-selection-tabbed.test.ts`
- **Decision**: ★ prefix rendered as a `<span aria-hidden="true">` before the label for named particles (id=1 proton, id=2 alpha). Animation: `fly({ y: 600, duration: 200 })` for in, `fly({ y: 600, duration: 150 })` for out; duration=0 when `prefers-reduced-motion` or not in browser.
- **Issue**: Svelte 5 uses `animation.onfinish` callback (not `.finished` promise) to remove elements after out-transitions. Had to add `window.Element.prototype.animate` stub to `src/tests/setup.ts` that invokes `onfinish` on the next microtask. Also updated scroll-lock test to use `waitFor()` for resilience.

### `/` keyboard shortcut

- **Status**: completed
- **Files changed**: `src/lib/components/entity-selection/entity-selection.svelte`, `src/routes/docs/user-guide/+page.svelte`
- **Decision**: Added `if (event.key === "/" && !isMobile && document.activeElement !== searchInputRef)` to `handleGlobalKey`. Also expands the panel if it's currently collapsed.

### updateSeries() method

- **Status**: completed
- **Files changed**: `src/lib/state/plot.svelte.ts`, `src/tests/unit/plot-state.test.ts`
- **Decision**: Replaces `PlotSeriesData` fields only; preserves `seriesId`, `color`, `colorIndex`, and `visible`. Triggers `recomputeLabels()` so labels stay accurate.

### SeriesStrip component

- **Status**: completed
- **Files changed**: `src/routes/plot/series-strip.svelte` (new)
- **Decision**: Single component with preview row, committed series rows (with live-edit highlight via `ring-2 ring-primary`), +Add / Done editing header button. Clicking a series label enters edit mode; clicking again exits.

### Plot page re-layout

- **Status**: completed
- **Files changed**: `src/routes/plot/+page.svelte`
- **Decision**: Removed old mobile disclosure-button + `entityPanelsOpen` pattern; replaced with `EntitySelection collapsible={isMobile}`. Sidebar now shows SeriesStrip via main area. `handleAddOrMulti` delegates to multi-create when Advanced mode + multi-select has >1 item. `handleAddMultiSeries` iterates across `particle|material|program` dimension, calling WASM for each.

### Tests

- **Status**: completed
- **Files changed**: `src/tests/unit/search-input-keyboard.spec.ts` (new), `tests/e2e/keyboard-nav.spec.ts` (new), `tests/e2e/plot-add-series.spec.ts` (new)
- **Decision**: 7 unit tests for search-input keyboard forwarding; 5 E2E tests for keyboard nav (/, ↑↓, Enter, auto-advance); 5 E2E tests for add-series flow (add, count, visibility, remove, edit mode).

## Final state

All 1379 unit tests pass. No lint errors. TypeScript errors in `external-data/units.ts` are pre-existing.
