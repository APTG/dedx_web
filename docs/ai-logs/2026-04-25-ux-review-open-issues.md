# AI Session: UX Review Open Issues (2026-04-25)

**Model:** Qwen/Qwen3.5-397B-A17B-FP8 via opencode  
**Branch:** `fix/ux-review-open-issues-2`  
**Date:** 2026-04-25

---

## Objective

Address 9 open issues from the UX review (`docs/ux-reviews/2026-04-25-calculator-full-review.md`):
- Issue #6: MeV/u and MeV/nucl column display
- Issue #7: Subnormal WASM values (debug logging)
- Issue #8: Heavy-ion E2E tests
- Issue #9: Spec updates (calculator.md, entity-selection.md)
- Issue #10: Refactor `calculationResults` to use rowId keys
- Issue #11: Extract result-table columns into `ColumnDef[]` prop
- Issue #12: Lift electron guard into EntitySelectionState
- Issue #13: Replace formatNumber with formatSigFigs in energy-input
- Issue #14: Document auto-select fallback in shareable URLs

---

## Tasks Completed

### Task 1 — Replace formatNumber in energy-input.svelte with formatSigFigs (Issue #13)

**Status:** ✅ COMPLETED

**Changes:**
- Created unit test in `src/tests/unit/energy-input-format.test.ts` (6 tests)
- Imported `formatSigFigs` from `$lib/utils/unit-conversions`
- Removed local `formatNumber()` helper (lines 151-158)
- Updated `→ MeV/nucl` column to use `formatSigFigs(converted, 4)`
- Ensures consistent number formatting across energy-input and result-table components
- All 411 tests passing (+6 new)

**Commit:** `fix: replace local formatNumber in energy-input with formatSigFigs (#13)`

---

### Task 2 — Add debug logging for subnormal WASM values (Issue #7)

**Status:** ✅ COMPLETED

**Changes:**
- Added `console.warn` logging in `performCalculation()` (`calculator.svelte.ts:186-205`)
- Logs when stopping power or CSDA range values are subnormal (`< Number.MIN_VALUE * 1e10`) or non-finite (NaN/Infinity)
- Includes context: programId, particleId, materialId, energyMevNucl, rawValue
- Created 3 unit tests in `calculator-state.test.ts` for subnormal stopping power, CSDA range, and NaN values
- All 414 tests passing (+3 new)

**Commit:** `fix: warn on subnormal WASM output in performCalculation (#7)`

---

## Next Steps

Continue with remaining tasks in order:
1. ✅ Task 1: formatNumber → formatSigFigs (Issue #13)
2. ✅ Task 2: Debug logging for subnormal WASM values (Issue #7)
3. ⏳ Task 3: Refactor calculationResults to rowId keys (Issue #10)
4. ⏳ Task 4: Extract columns into ColumnDef[] prop (Issue #11)
5. ⏳ Task 5: Lift electron guard into EntitySelectionState (Issue #12)
6. ⏳ Task 6: E2E tests for heavy-ion calculations (Issue #8)
7. ⏳ Task 7: MeV/u and MeV/nucl column display tests (Issue #6)
8. ⏳ Task 8: Spec updates (Issue #9)
9. ⏳ Task 9: Document auto-select fallback in shareable URLs (Issue #14)
10. ⏳ Task 10: Finalize session log and update UX review status

---

## Test Results

- Unit tests: TBD
- E2E tests: TBD
- Lint: TBD
- Format: TBD

---

## Notes

- Following TDD strictly (RED → GREEN → refactor)
- Using Conventional Commits for each task
- Maintaining Svelte 5 runes-only discipline
- Not breaking any of the 405 currently passing tests
