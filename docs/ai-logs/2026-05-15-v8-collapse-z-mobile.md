# 2026-05-15 — v8 picker: auto-collapse, Z inline, mobile tabs, promote to default

## Session Narrative

### Prompt 1: vertical space / UX improvements + drop ?v8=1

User reported that the Calculator page wastes vertical space because the
particle/material/program picker is always expanded. Requested:

1. Auto-collapse the tab panel after all three selections are complete
2. Move Z= atomic number inline into the particle name/bracket
3. Fix `× clear` pill misalignment (Z far right from name, clear button tiny)
4. Stack tab-bar value below title on narrow mobile screens
5. Drop `?v8=1` flag entirely — make v8 the default render path on both
   Calculator and Plot pages

**AI response**: Analysed the v8 component tree
(`entity-selection-v8.svelte`, `particle-tab.svelte`, `selected-pill.svelte`,
`tab-bar.svelte`) and identified all affected files. Added `getParticleListLabel`
utility, rewrote particle-tab list rows and selected-pill, updated tab-bar for
responsive stacking, added `collapsible` prop + `panelOpen` state to
`entity-selection-v8`, removed `isPickerV8` gating from calculator and plot
routes, and rewrote/updated all affected E2E tests.

## Tasks

### Add `getParticleListLabel` to particle-label.ts

- **Status**: completed
- **Stage**: entity-selection v8
- **Files changed**: `src/lib/utils/particle-label.ts`
- **Decision**: Created a new exported function rather than changing
  `getParticleLabel`, to avoid breaking any call sites that need the old label.
  For ions with a symbol bracket ("Lithium (Li)") Z is inserted before the
  closing paren → "Lithium (Li, Z=3)". For named particles without brackets
  ("proton") Z is appended as a new paren group → "proton (Z=1)".

### particle-tab.svelte — Z inline + selected-pill cleanup

- **Status**: completed
- **Files changed**: `src/lib/components/v8/particle-tab.svelte`
- **Decision**: Removed separate `<span Z=N ml-auto>` column from list items.
  Used `getParticleListLabel(p, atomicNumber)` in both the list rows and the
  selected-pill label. Removed `meta` prop from SelectedPill (Z now in label).

### selected-pill.svelte — fix `× clear` alignment

- **Status**: completed
- **Files changed**: `src/lib/components/v8/selected-pill.svelte`
- **Decision**: Moved `ml-auto` from the `meta` span to the `× clear` span.
  Added a light border badge to `× clear` to make it more visible. With
  `ml-auto` always on the clear button it now pushes to the right edge
  regardless of whether `meta` is present.

### material-tab.svelte — density inline in selected pill

- **Status**: completed
- **Files changed**: `src/lib/components/v8/material-tab.svelte`
- **Decision**: Moved `ρ=...` density from `meta` prop into the pill `label`
  string for consistency with the list-row display style.

### tab-bar.svelte — mobile stacked layout

- **Status**: completed
- **Files changed**: `src/lib/components/v8/tab-bar.svelte`
- **Decision**: Used `flex-col sm:flex-row` on the inner label span so that at
  viewports below `sm` (640px) the selected value appears below the tab title
  rather than inline. Colon separator is hidden on mobile via `hidden sm:inline`.
  Value text uses `text-muted-foreground` on mobile and inherits on sm+ to
  visually distinguish it from the tab title without being too prominent.

### entity-selection-v8.svelte — collapsible auto-collapse

- **Status**: completed
- **Files changed**: `src/lib/components/v8/entity-selection-v8.svelte`
- **Decision**: Added `collapsible?: boolean = false` prop. `panelOpen` is a
  `$state(true)`. A `$effect` closes the panel when `collapsible && isComplete`.
  `openPanel(tab)` sets both `activeTab` and `panelOpen = true`. RecipeBar
  `onActivateTab` and tab-bar `onActivate` both call `openPanel`. Plot page
  uses the default (`collapsible=false`) so its panel is always expanded.

### Drop ?v8=1 flag — make v8 default

- **Status**: completed
- **Files changed**: `src/routes/calculator/+page.svelte`,
  `src/routes/plot/+page.svelte`
- **Decision**: Removed `isPickerV8`/`initPickerV8FromUrl` imports and all
  `{#if isPickerV8.value}` branches. Calculator renders `<EntitySelectionV8
collapsible={true}>` unconditionally. Plot renders `<EntitySelectionV8>`
  unconditionally (no collapsible). The `picker-flag.svelte.ts` file is kept
  (it may be imported by tests) but is no longer called from routes.

### E2E test updates

- **Status**: completed
- **Files changed**:
  - `tests/e2e/v8-entity-selection.spec.ts` — removed `?v8=1`, added collapse
    test, updated sentinel and test descriptions
  - `tests/e2e/entity-selection.spec.ts` — rewritten for v8 UI (tabs + testids
    instead of combobox buttons)
  - `tests/e2e/calculator.spec.ts` — sentinel updated
  - `tests/e2e/complex-interactions.spec.ts` — sentinel updated, v7 particle/
    material selection updated to use v8 testids; added `selectParticle` helper
  - `tests/e2e/custom-compounds.spec.ts` — all `getByRole("button", { name:
/^Material$/ })` patterns replaced with `v8-tab-material` testid; v7
    dropdown patterns replaced with v8 panel patterns
  - `tests/e2e/advanced-options.spec.ts`, `complex-interactions.spec.ts`,
    `inverse-lookups.spec.ts`, `particle-unit-switching.spec.ts`, `plot.spec.ts`,
    `custom-compounds.spec.ts`, `layout.spec.ts`, `responsive.spec.ts` — all
    WASM sentinel waits updated from `[aria-label="Particle"]` to
    `[data-testid="v8-entity-selection"]`

### Unit test updates

- **Status**: completed
- **Files changed**: `src/tests/unit/entity-selection-v8.test.ts`
- Added tests:
  - `"particle list items show Z inline in name (no separate Z column)"`
  - `"selected-pill includes Z inline in label (no separate meta)"`
  - `collapsible mode` describe block: panel hidden when complete + defaults,
    clicking tab re-opens, panel always open when not collapsible

### Spec update

- **Status**: completed
- **Files changed**: `docs/04-feature-specs/entity-selection.md`
- Updated status from "v8 draft behind ?v8=1" to "v8 production".
- Documented collapsible behaviour, Z inline format, and mobile tab layout.
