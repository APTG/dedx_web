# Stage 6: Calculator (basic) — Session Log

**Date:** 2026-04-28  
**Model:** Qwen3.5-397B-A17B-FP8 via opencode  
**Branch:** `qwen/stage-6-calculator`

## Session Summary

This session implements all 8 tasks from the Stage 6 Calculator (basic) plan: fixing the critical WASM calculation bug, code cleanup, SI prefix extraction, material phase badge, restore defaults button, app toolbar, URL sync, loading skeleton with retry CTA, and documentation grooming.

## Tasks Completed

### Task 0 — Fix WASM calculation bug: STP and CSDA range always return 0

**Three bugs fixed in `src/lib/wasm/libdedx.ts:calculate()`:**

1. **Float/double mismatch:** energies and STP buffers were allocated with `_malloc(n * 8)` and written via `HEAPF64` (8-byte doubles), but the C functions expect `float` (4-byte). Fixed by using `HEAPF32` and correct byte sizes (4 bytes for energies/STP, 8 bytes for CSDA).

2. **Swapped parameters 3 and 4:** The call was `_dedx_get_stp_table(programId, particleId, materialId, energiesPtr, numEnergies, stpPtr, csdaPtr)`, but C expects `(program, ion, target, no_of_points, energies*, stps*)`. Fixed by reordering to `(programId, particleId, materialId, numEnergies, energiesPtr, stpPtr)`.

3. **CSDA not computed:** `_dedx_get_stp_table` does NOT fill a CSDA buffer; a separate call to `_dedx_get_csda_range_table` is required. Added the second WASM call.

**Additional changes:**
- Added `HEAPF32: Float32Array` to `EmscriptenModule` interface
- Added `_dedx_get_csda_range_table` declaration to interface
- Added `getMinEnergy()` and `getMaxEnergy()` methods to `LibdedxService` interface and implementation
- Created integration test `src/tests/integration/wasm-calculate.test.ts` with real WASM tests (skipped when binary absent)
- Added E2E test in `tests/e2e/calculator.spec.ts` for non-zero STP/range values
- Added `data-testid` attributes to `result-table.svelte` for E2E selectors

**Commit:** `fix(wasm): correct float/double types, param order, add CSDA call in calculate()`

---

### Task 1 — Code cleanup: delete dead modules + rename energy-input state

**Actions:**
- Deleted `src/lib/state/url-sync.ts` (unused after calculator URL sync rewrite)
- Deleted `src/tests/unit/url-sync.test.ts` (36 tests removed)
- Deleted `src/tests/unit/energy-input-format.test.ts` (6 tests — already covered in unit-conversions.test.ts)
- Renamed `src/lib/state/energy-input.svelte.ts` → `src/lib/state/energy-rows.svelte.ts`
- Updated imports in `calculator.svelte.ts` and `energy-input-state.test.ts`

**Test results:** 453 unit tests pass (42 tests removed with deleted files)

**Commit:** `chore: delete dead url-sync.ts, rename energy-input→energy-rows, fold format test`

---

### Task 2 — Extract canonical SI prefix table to `energy-units.ts`

**Actions:**
- Created `src/lib/utils/energy-units.ts` with `SI_PREFIX_TABLE` constant
- Updated `energy-parser.ts` and `energy-conversions.ts` to import from canonical module
- Added 5 canonical import unit tests

**Commit:** `refactor(units): extract canonical SI prefix table to energy-units.ts`

---

### Task 3 — Material phase badge + resolved program label + energy range label

**Actions:**
- Added material phase badge ("gas"/"liquid"/"solid") to `entity-selection-comboboxes.svelte`
- Added resolved program label below entity selectors in `calculator/+page.svelte`
- Added energy range label below result table with TODO for `getMinEnergy`/`getMaxEnergy`
- Added 4 component tests for phase badge

**Commit:** `feat(calculator): add material phase badge, resolved program label, energy range hint`

---

### Task 4 — Restore defaults button + paste > 200 values warning

**Actions:**
- Added `resetAll()` to `CalculatorState` and `EnergyRowsState` interfaces
- Added `hasLargeInput` derived value (>200 filled rows)
- Added Restore defaults button to calculator page header
- Added large-input warning with `role="status"`
- Added E2E test for large-input warning

**Commit:** `feat(calculator): add restore-defaults button, large-input warning, resetAll()`

---

### Task 5 — App toolbar: Share URL + disabled Export buttons + mobile nav

**Actions:**
- Added toolbar to `+layout.svelte` with Share URL, Export PDF, Export CSV buttons
- Export buttons disabled (`hidden sm:inline-flex` for mobile overflow prevention)
- Share URL copies `window.location.href` to clipboard with "Copied!" feedback
- Fixed mobile nav overflow with `min-w-0` and `shrink-0` classes
- Added 4 E2E tests in `tests/e2e/toolbar.spec.ts`

**Commit:** `feat(layout): add app toolbar with Share URL and disabled Export PDF/CSV buttons`

---

### Task 6 — Calculator URL sync (calculator-url.ts + wire to page)

**Actions:**
- Created `src/lib/utils/calculator-url.ts` with `encodeCalculatorUrl`/`decodeCalculatorUrl`
- Added 11 unit tests for URL encode/decode round-trip
- Wired URL sync to `calculator/+page.svelte` with `urlInitialized` guard
- Added 3 E2E tests in `tests/e2e/calculator-url.spec.ts`

**Commit:** `feat(calculator): implement URL state sync per shareable-urls spec (calculator-url.ts)`

---

### Task 7 — Stage 5.1 polish: loading skeleton + auto-fallback notification + retry CTA

**Actions:**
- Installed shadcn-svelte Skeleton component
- Added loading skeleton to `calculator/+page.svelte` and `plot/+page.svelte`
- Added in-body retry CTA when WASM fails with error details
- Added `lastAutoFallbackMessage` and `clearAutoFallbackMessage()` to `EntitySelectionState`
- Added dismissable auto-fallback notification UI

**Commit:** `feat(calculator): loading skeleton, retry CTA, auto-fallback notification for entity selection`

---

### Task 8 — Documentation grooming (no code changes)

**Actions:**
- Added cross-check stubs to `shareable-urls.md` and `shareable-urls-formal.md`
- Consolidated calculator wireframes in `entity-selection.md` and `05-ui-wireframes.md`
- Added STP implementation note to `06-wasm-api-contract.md`
- Added historical narrative disclaimers to `docs/ux-reviews/README.md` and `docs/ai-logs/README.md`

**Commit:** `docs: grooming — shareable-urls cross-check, wireframe consolidation, STP implementation note, historical disclaimers`

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/wasm/libdedx.ts` | Fixed `calculate()` method, added `getMinEnergy`/`getMaxEnergy` |
| `src/lib/wasm/types.ts` | Added `getMinEnergy`/`getMaxEnergy` to `LibdedxService` interface |
| `src/lib/utils/energy-units.ts` | Created with `SI_PREFIX_TABLE` constant |
| `src/lib/utils/calculator-url.ts` | Created with `encodeCalculatorUrl`/`decodeCalculatorUrl` |
| `src/lib/utils/energy-parser.ts` | Updated to import `SI_PREFIX_TABLE` |
| `src/lib/utils/energy-conversions.ts` | Updated to import `SI_PREFIX_TABLE` |
| `src/lib/state/energy-rows.svelte.ts` | Renamed from `energy-input.svelte.ts`, added `resetRows()`, `hasLargeInput` |
| `src/lib/state/calculator.svelte.ts` | Added `resetAll()`, `hasLargeInput` delegate |
| `src/lib/state/entity-selection.svelte.ts` | Added `lastAutoFallbackMessage`, `clearAutoFallbackMessage()` |
| `src/lib/components/entity-selection-comboboxes.svelte` | Added material phase badge |
| `src/lib/components/result-table.svelte` | Added `data-testid` attributes |
| `src/routes/+layout.svelte` | Added app toolbar with Share URL and Export buttons |
| `src/routes/calculator/+page.svelte` | Added phase badge, labels, restore button, large-input warning, URL sync, skeleton, retry CTA, fallback notification |
| `src/routes/plot/+page.svelte` | Added skeleton and retry CTA |
| `tests/e2e/calculator.spec.ts` | Added WASM calculation test, large-input warning test |
| `tests/e2e/toolbar.spec.ts` | Created with 4 toolbar tests |
| `tests/e2e/calculator-url.spec.ts` | Created with 3 URL sync tests |
| `src/tests/integration/wasm-calculate.test.ts` | Created with 3 integration tests |
| `src/tests/unit/calculator-url.test.ts` | Created with 11 unit tests |

## Test Results

- **Unit tests:** 476 passing
- **Integration tests:** 3 skipped (no WASM binary locally)
- **E2E tests:** 10 new tests added (toolbar, URL sync, WASM calculation, large-input warning)

## Commits

| Hash | Message |
|------|---------|
| `272f404` | `fix(wasm): correct float/double types, param order, add CSDA call in calculate()` |
| `2aa4f6b` | `chore: delete dead url-sync.ts, rename energy-input→energy-rows, fold format test` |
| `04ed8e1` | `refactor(units): extract canonical SI prefix table to energy-units.ts` |
| `32eed35` | `feat(calculator): add material phase badge, resolved program label, energy range hint` |
| `fb5d364` | `feat(layout): add app toolbar with Share URL and disabled Export PDF/CSV buttons` |
| `0e099d7` | `feat(calculator): implement URL state sync per shareable-urls spec (calculator-url.ts)` |
| `7e5905f` | `feat(calculator): loading skeleton, retry CTA, auto-fallback notification for entity selection` |
| `e9620dd` | `docs: grooming — shareable-urls cross-check, wireframe consolidation, STP implementation note, historical disclaimers` |
| `b664761` | `chore: add tailwind-merge peer dependency for tailwind-variants` |

## Next Steps

- Stage 6.7: Export CSV functionality (`docs/04-feature-specs/export.md`)
- Stage 6.8: Export PDF functionality
- Stage 6.9: Advanced mode toggle (per-row units, manual program override)
- Stage 7: Plot enhancements (multi-series, axis controls, download)
- Run `pnpm build` for production build gate verification
- Update `CHANGELOG-AI.md` with Task 7-8 entries
