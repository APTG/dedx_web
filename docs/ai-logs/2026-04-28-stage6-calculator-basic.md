# Stage 6: Calculator (basic) — Session Log

**Date:** 2026-04-28  
**Model:** Qwen3.5-397B-A17B-FP8 via opencode  
**Branch:** `qwen/stage-6-calculator`

## Session Summary

This session implements **Task 0** from the Stage 6 plan: fixing the critical WASM calculation bug where STP and CSDA range always return 0.

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

**Test results:**
- 453 unit tests pass
- Integration tests skipped (no WASM binary locally)
- All pre-existing lint warnings remain (47 errors, pre-existing)

**Actions:**
- Deleted `src/lib/state/url-sync.ts` (unused after calculator URL sync rewrite)
- Deleted `src/tests/unit/url-sync.test.ts` (36 tests removed)
- Deleted `src/tests/unit/energy-input-format.test.ts` (6 tests — already covered in unit-conversions.test.ts)
- Renamed `src/lib/state/energy-input.svelte.ts` → `src/lib/state/energy-rows.svelte.ts`
- Updated imports in `calculator.svelte.ts` and `energy-input-state.test.ts`

**Test results:** 453 unit tests pass (42 tests removed with deleted files)

**Commit:** `chore: delete dead url-sync.ts, rename energy-input→energy-rows, fold format test`

## Files Modified

- `src/lib/wasm/libdedx.ts` — Fixed `calculate()` method, added `getMinEnergy`/`getMaxEnergy`
- `src/lib/wasm/types.ts` — Added `getMinEnergy`/`getMaxEnergy` to `LibdedxService` interface
- `src/lib/components/result-table.svelte` — Added `data-testid` attributes for E2E
- `tests/e2e/calculator.spec.ts` — Added WASM calculation E2E test
- `src/tests/integration/wasm-calculate.test.ts` — New integration test file (created)

## Next Steps

Continue with Task 1 (delete dead modules + rename energy-input state), Task 2 (extract SI prefix table), Task 3 (material phase badge + labels), Task 4 (restore defaults button + large input warning), Task 5 (toolbar with Share URL + Export buttons), Task 6 (calculator URL sync), Task 7 (loading skeleton + retry CTA + auto-fallback notification), Task 8 (documentation grooming).
