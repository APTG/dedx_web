# 2026-05-17 — Issue #530 PR A: Adaptive Picker Kit + Particle/Material/Program Rework

## Session Narrative

### Prompt 1: Implement PR A from issue #530

**AI response**: Read issue #530 on GitHub (APTG/dedx_web), created branch
`feat/issue-530-mobile-picker-part-a`, and implemented all changes scoped to
PR A (entity-selection components only; Plot page untouched). The session
spanned two Claude Code context windows.

**Work completed across both windows:**

1. **`size-bucket.ts`** — new utility exporting `SizeBucket = "tiny" | "medium" | "large"`
   and `computeBucket(count)` with thresholds ≤10 / ≤150 / 151+.

2. **`particle-tab.svelte`** — removed Common/Ions section headers; replaced with
   a single flat Z-sorted list. Named particles (proton, alpha) sort first and render
   bold. Each list item shows `getParticleListLabel(p, z)` so Z is embedded in the
   name label (`proton (Z=1)`, `Carbon (C, Z=6)`) with no separate right-aligned column.

3. **`material-tab.svelte`** — replaced three side-by-side columns with a single active
   list plus pill controls. Fixed sub-tab order: Compounds → Elements → Custom. Active
   sub-tab persists to `localStorage["webdedx.materialSubtab"]`. Scroll position per
   sub-tab is saved/restored via `queueMicrotask`. An `$effect` silently switches
   sub-tabs when the selected material lives in a non-active sub-tab. Bottom fade
   indicator. Custom sub-tab gated on `isAdvancedMode`.

4. **`program-tab.svelte`** — imports `computeBucket`; if `bucket === "tiny"` renders
   `<ProgramInlineList>` (no scroll, no search bar); otherwise existing auto-hero + list.

5. **`program-inline-list.svelte`** — new flat tappable list for tiny-bucket programs.
   Shows auto-select hero unless in multi-mode. `data-testid="picker-program-inline-list"`.

6. **`picker-sheet.svelte`** — new full-screen search overlay for mobile. Autofocuses
   input, locks body scroll, traps focus (Tab cycling), closes on Escape and hardware
   Back (via `popstate`). Shows Done button in multi-select Advanced mode. Results:
   flat particles (Z in name), grouped materials via `<GroupedResultList>`, flat programs.

7. **`grouped-result-list.svelte`** — used inside picker-sheet for Material tab.
   Groups results under COMPOUNDS / ELEMENTS / CUSTOM headers.

8. **`search-input.svelte`** — new `onMobileTap?: () => void` prop. Mobile detection
   via `window.matchMedia("(max-width: 640px)")` with jsdom guard. On mobile: renders
   `<button>` styled as input; on desktop: real `<input type="search">`.

9. **`entity-selection.svelte`** — added `PickerSheet` conditional render, mobile
   detection `$effect` with jsdom guard, no autofocus on mobile, `openSheet`/`closeSheet`
   callbacks, `onMobileTap={openSheet}` on `SearchInput`.

10. **`entity-selection.svelte.ts`** — added `materialSubtab`, `sheetOpen`,
    `scrollPositions` state + `setMaterialSubtab`, `setSheetOpen` methods.

11. **`size-bucket.spec.ts`** — 12 unit tests covering all bucket boundaries.

12. **`mobile-picker.spec.ts`** — new E2E spec with mobile viewport (412×915):
    no autofocus on tab change, search tap opens sheet, Back closes sheet,
    material default=Compounds, particle flat list, program ≤10 no search.

13. **Updated tests**: `entity-selection-tabbed.spec.ts` (E2E), `custom-compounds.spec.ts`
    (E2E), `entity-selection-tabbed.test.ts` (unit) — updated test IDs and assertions
    to match new UI.

**Key bugs fixed during implementation:**

- `window.matchMedia is not a function` in jsdom — fixed by adding guard
  `if (!window.matchMedia) return;` in both `entity-selection.svelte` and
  `search-input.svelte`.
- Particle list test expected `"proton (Z=1)"` but component rendered separate
  `getParticleLabel(p)` + `Z={z}` span. Fixed by switching to `getParticleListLabel`.
- Material anchor test expected both Water (Compounds) and Carbon (Elements) visible
  simultaneously — impossible with sub-tab layout. Updated test to switch to Elements
  sub-tab before checking Carbon.
- Picker-sheet dialog not found synchronously after `state.setSheetOpen(true)` —
  fixed by adding `await tick()` from svelte before the `getByRole` query.

**Final test result:** 1368 passed, 0 failed.

## Tasks

### PR A: Adaptive Picker Kit + Particle/Material/Program Rework

- **Status**: completed
- **Stage**: Stage 8 / mobile (issue #530)
- **Branch**: `feat/issue-530-mobile-picker-part-a`
- **Files changed**:
  - `src/lib/components/entity-selection/size-bucket.ts` (new)
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/components/entity-selection/program-tab.svelte`
  - `src/lib/components/entity-selection/program-inline-list.svelte` (new)
  - `src/lib/components/entity-selection/picker-sheet.svelte` (new)
  - `src/lib/components/entity-selection/grouped-result-list.svelte` (new)
  - `src/lib/components/entity-selection/search-input.svelte`
  - `src/lib/components/entity-selection/entity-selection.svelte`
  - `src/lib/state/entity-selection.svelte.ts`
  - `src/tests/unit/size-bucket.spec.ts` (new)
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `tests/e2e/mobile-picker.spec.ts` (new)
  - `tests/e2e/entity-selection-tabbed.spec.ts`
  - `tests/e2e/custom-compounds.spec.ts`
  - `docs/04-feature-specs/entity-selection.md`
- **Decision**: Sub-tab pills instead of three-column layout. Three columns are
  incompatible with mobile-first design (each column needs its own scroll and
  takes 1/3 of horizontal space). Pill controls give full width to one list at
  a time and are immediately understandable.
- **Decision**: `window.matchMedia` guard needed in every `$effect` that calls
  it — jsdom does not implement `matchMedia`, so without the guard all unit
  tests that render these components fail.
- **Issue**: E2E tests (`mobile-picker.spec.ts`) require WASM binaries and
  a running dev server. Not run in this session — they are validated in CI.
