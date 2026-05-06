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

**AI response:** Three bugs diagnosed and fixed:

---

## Tasks

### Bug 1: Density override not applied in Calculator

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
  - Imported `advancedOptions` singleton at module level (same pattern as other
    Svelte 5 module singletons in the project).
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

### New tests: density override and aggregate state in calculator

- **Status:** completed
- **Stage:** 6.8
- **Files changed:** `src/tests/unit/calculator-state.test.ts`
- **Decision:**
  - Added `afterEach(() => { advancedOptions.value = {}; })` to prevent
    state bleed between tests (singleton pattern).
  - Added describe block `"density override (AC-6)"` with 3 tests:
    - Half density → half CSDA range (formula: range_cm = range_g/cm² / ρ)
    - Double density → double keV/µm stopping power (formula: S_kevum = S_mass × ρ / 10)
    - Clearing override reverts to built-in density
  - Added describe block `"aggregate state override → display unit coupling (AC-3, Behavior §3)"` with 4 tests:
    - Gas material baseline → MeV·cm²/g
    - aggregateState="condensed" override on gas → keV/µm
    - aggregateState="gas" override on condensed → MeV·cm²/g
    - Clear override reverts to material built-in unit

### Total test count: 716 (up from 709)
