# 2026-05-06 — Stage 6.8 Advanced Options: density override + advanced-mode panel gating

**Model:** Claude Sonnet 4.5 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Density override, advanced-mode panel gating, tests

User (@grzanka) reported:

1. Adjusting density in the Advanced Options panel has no effect on the
   calculated range or stopping power in Calculator mode.
2. The Advanced Options panel is always present in Plot mode, even when
   switching to Basic mode.
3. Requested tests for the density override and a check that all spec
   acceptance criteria have corresponding test coverage.

**AI response:** Three bugs diagnosed and fixed, then a follow-up prompt revealed
the root reactive trigger was missing.

### Prompt 2: E2E verification; still doesn't work in the browser

User (@grzanka) reported that even after the math fix, the CSDA range still doesn't
change when density is adjusted in the browser.

**AI response:** Diagnosed the real bug — `performCalculation()` was never called
reactively when `advancedOptions` changes. Fixed three reactive paths and added
E2E tests.

---

## Tasks

### Bug 1: Density override not applied in Calculator (math)

- **Status:** completed
- **Stage:** 6.8
- **Root cause:** `calculator.svelte.ts` → `performCalculation()` called
  `service.calculate()` without the `options` argument, and derived the
  display-unit density exclusively from `entitySelection.selectedMaterial?.density`.
  Neither `advancedOptions.value.densityOverride` nor other advanced options
  (aggregate state, interpolation mode, etc.) were forwarded to the service
  or used in unit conversions.
- **Files changed:** `src/lib/state/calculator.svelte.ts`
- **Decision:**
  - Imported `advancedOptions` singleton at module level.
  - Passed `advancedOptions.value` as 5th arg to `service.calculate()`.
  - Changed density for unit conversions to
    `advancedOptions.value.densityOverride ?? material?.density ?? 1`.
  - Fixed `getStpDisplayUnit()` to respect `aggregateState` override (spec
    Behavior §3): `"gas"` override → `"MeV·cm²/g"`, `"condensed"` override →
    `"keV/µm"`, no override → use material built-in.

### Bug 2: Advanced Options panel visible in Basic mode on Plot page

- **Status:** completed
- **Stage:** 6.8
- **Root cause:** `src/routes/plot/+page.svelte` rendered `<AdvancedOptionsPanel>`
  inside `{#if entityState.selectedMaterial}` without also checking
  `isAdvancedMode.value`. Spec AC-1 states the accordion must be absent
  from the DOM in Basic mode.
- **Files changed:** `src/routes/plot/+page.svelte`
- **Decision:**
  - Added `import { isAdvancedMode } from "$lib/state/advanced-mode.svelte"`.
  - Changed the condition to `{#if isAdvancedMode.value && entityState.selectedMaterial}`.

### Bug 3: Mock `calculate()` missing `options?` parameter

- **Status:** completed
- **Stage:** 6.8
- **Root cause:** The two mock classes in `src/lib/wasm/__mocks__/libdedx.ts`
  had `calculate()` without the optional `_options?: AdvancedOptions` param,
  causing a TypeScript type mismatch after the real service's signature was
  updated.
- **Files changed:** `src/lib/wasm/__mocks__/libdedx.ts`

### Bug 4 (root reactive trigger): Calculation not retriggered on density change

- **Status:** completed
- **Stage:** 6.8
- **Root cause:** The unit math was correct, but nothing in the reactive system
  called `performCalculation()` (or `triggerCalculation()`) when `advancedOptions`
  changed:
  - Single-program mode: `result-table.svelte`'s `$effect` only watched
    `entitySelection.isComplete`, never `advancedOptions`.
  - Multi-program mode: the calculator page's multi-program `$effect` read
    `advancedOptions.value` only inside a `setTimeout` callback (not a reactive
    dep), so it never re-ran when options changed.
  - Plot preview: `advancedOptions.value` was read only inside `getService().then()`
    (async), not as a reactive dep of the enclosing `$effect`.
- **Files changed:**
  - `src/routes/calculator/+page.svelte` — two new `$effect` entries:
    1. Read `advOptsKey` and call `calcState.triggerCalculation()` in basic mode
    2. Read `advOptsKey` at top of multi-program effect so it retriggers on option changes; snapshot `advancedOptions.value` before the `setTimeout` so the closure uses consistent options
  - `src/routes/plot/+page.svelte` — preview `$effect` now snapshots
    `advancedOptions.value` synchronously (`const snapshotAdvOpts = advancedOptions.value`)
    before the `getService().then()` call, which both registers the reactive dep
    AND passes a consistent value to `getPlotData`.
- **Decision:** The `$effect` reactive trigger belongs in the component layer
  (`+page.svelte`), not in the state factory (`calculator.svelte.ts`). State
  factories are plain functions called in test code without a component context;
  adding `$effect` inside them triggers `effect_orphan` errors in Vitest tests.

### New tests: density override and aggregate state in calculator

- **Status:** completed
- **Stage:** 6.8
- **Files changed:** `src/tests/unit/calculator-state.test.ts`
- **Decision:**
  - Added `afterEach(() => { advancedOptions.value = {}; })` to prevent
    state bleed between tests (singleton pattern).
  - Added describe block `"density override (AC-6)"` with 3 tests:
    - Half density → half CSDA range
    - Double density → double keV/µm stopping power
    - Clearing override reverts to built-in density
  - Added describe block `"aggregate state override → display unit coupling (AC-3, Behavior §3)"` with 4 tests

### New E2E tests

- **Status:** completed
- **Stage:** 6.8
- **Files changed:** `tests/e2e/advanced-options.spec.ts`, `tests/e2e/plot.spec.ts`
- **Added tests:**
  - Calculator: density 2× → CSDA range decreases by ≥30%
  - Calculator: density 2× → keV/µm stopping power increases by ≥50%
  - Calculator: Advanced Options panel absent in Basic mode (AC-1)
  - Calculator: panel appears/disappears on mode switch
  - Plot: Advanced Options panel absent in Basic mode (AC-1)

### Total unit test count: 716 (up from 709)
