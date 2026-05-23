# Stage 6.10 Task 2 — WASM Layer for Custom Compounds

**Date:** 2026-05-10
**Model:** Qwen3.5-397B-A17B-FP8 via opencode
**Branch:** `qwen/stage6-10-custom-compounds`
**Task:** Stage 6.10 Task 2 — WASM layer: custom compound C wrappers + TypeScript interface
**Spec:** `docs/04-feature-specs/custom-compounds.md` §5, `docs/06-wasm-api-contract.md` §2.5

---

## Summary

Implemented the WASM service layer for custom compound calculations. This task adds 4 new C wrapper functions for forward calculation, inverse STP, inverse CSDA, and Bragg peak STP lookups — all accepting custom compound specifications via parallel element ID/atom arrays.

---

## What Changed

### WASM C Layer (`wasm/`)

**New C wrappers in `dedx_extra.h` and `dedx_extra.c`:**

1. `dedx_calculate_custom_forward_flat` — Forward STP/CSDA calculation for custom compounds
2. `dedx_get_inverse_stp_custom_compound_flat` — Inverse STP lookup for custom compounds
3. `dedx_get_inverse_csda_custom_compound_flat` — Inverse CSDA lookup for custom compounds
4. `dedx_get_bragg_peak_stp_custom_compound` — Bragg peak STP energy for custom compounds

**Implementation pattern:**
- All wrappers follow the "flat" API pattern: accept parallel arrays (`elements_id`, `elements_atoms`, `num_elements`) instead of requiring pre-configured workspace
- Each wrapper internally manages workspace/config lifecycle:
  1. Call `dedx_internal_setup_custom_compound` to allocate and populate config arrays
  2. Load config with program, particle, compound spec
  3. Call the core libdedx function
  4. Call `dedx_internal_cleanup_custom_compound` to free arrays
  5. Return result buffer pointer

**Internal helpers (exported but not public API):**
- `dedx_internal_setup_custom_compound` — Allocates `config->elements_id` (int) and `config->elements_atoms` (double) arrays, copies from input
- `dedx_internal_cleanup_custom_compound` — Frees the allocated arrays, sets pointers to NULL

**Build changes:**
- `wasm/build.sh`: Added 6 new symbols to `EXPORTED_FUNCTIONS` (4 wrappers + 2 internal helpers)
- `wasm/contract-manifest.json`: Added 4 new exports under `dedx_extra_custom_compound` backing category
- `wasm/verify.mjs`: All 69 checks pass (49 contract checks + 20 service coverage checks)

### TypeScript Layer (`src/lib/wasm/`)

**Interface extension (`types.ts`):**
```typescript
calculateCustomCompound(params: {
  programId: number;
  particleId: number;
  elements: CompoundElement[];
  density: number;
  iValue?: number;
  energies: number[];
}): CalculationResult;

getInverseStpCustomCompound(params: {
  programId: number;
  particleId: number;
  elements: CompoundElement[];
  density: number;
  iValue?: number;
  stoppingPowers: number[];
  side: 0 | 1;
}): (InverseStpResult | LibdedxError)[];

getInverseCsdaCustomCompound(params: {
  programId: number;
  particleId: number;
  elements: CompoundElement[];
  density: number;
  iValue?: number;
  ranges: number[];
}): (InverseCsdaResult | LibdedxError)[];

getBraggPeakStpCustomCompound(params: {
  programId: number;
  particleId: number;
  elements: CompoundElement[];
  density: number;
  iValue?: number;
}): number;
```

**Service implementation (`libdedx.ts`):**
- Helper `prepareCompoundElements` converts `CompoundElement[]` to parallel HEAP32/HEAPF64 arrays
- All 4 methods use `Module._malloc`/`Module._free` for WASM heap memory management
- Forward calculation: `HEAPF32` for energies/STP output, `HEAPF64` for CSDA ranges
- Inverse lookups: `HEAPF64` for energy output arrays
- Bragg peak: single `f64` return value

**Mock implementations (`__mocks__/libdedx.ts`):**
- `LibdedxServiceImpl` — stub implementations returning empty arrays / 80.0 for Bragg peak
- `MockLibdedxServiceWithElectron` — identical stubs
- Both classes now satisfy the full `LibdedxService` interface including all 4 custom compound methods

### Contracts (`src/tests/contracts/`)

**`service-interface.contract.test.ts`:**
- Added runtime checks for all 4 new methods on both mock classes
- Type-level `satisfies` assertions ensure compile-time interface compliance

---

## Test Results

```
✓ 951 tests passed (49 test files)
✓ Build succeeded (SvelteKit production build ~13s)
✓ Guard passed (no forbidden artifacts staged)
```

---

## Commit

**SHA:** `79c278b`
**Message:** `feat(wasm): add custom compound C wrappers and TypeScript service methods`
**Files changed:** 10 files (1102 insertions, 43 deletions)

---

## Key Decisions

1. **Flat API pattern for custom compound wrappers** — Following the pattern established for inverse lookups in Stage 6.9, the custom compound wrappers accept flat parallel arrays rather than requiring the caller to manage workspace/config lifecycle. This simplifies the TypeScript side and prevents memory leaks from forgotten cleanup.

2. **Internal helper exports** — `dedx_internal_setup_custom_compound` and `dedx_internal_cleanup_custom_compound` are exported in `EXPORTED_FUNCTIONS` but NOT exposed in the TypeScript service interface. They are implementation details for the flat wrappers only.

3. **CompoundElement type** — The existing `CompoundElement` interface (atomicNumber, fraction, type) from `types.ts` is reused. The fraction field represents atom counts (not weight fractions) when passed to WASM — the formula parser already normalizes to atomic fractions.

4. **Bragg additivity** — The C wrappers pass element IDs and atom counts directly to libdedx's `dedx_load_config_for_program_with_compound`. The underlying libdedx library handles Z_eff, A_eff, I_eff calculation via Bragg additivity internally.

5. **Density handling** — Custom compounds may have user-specified density different from the Bragg-sum density. The wrappers pass density through to `dedx_load_config`, which stores it in `config->density`.

---

## Blocking Issues

None. All tests pass, build succeeds.

---

## Next Steps

1. **Task 3** — URL codec: add `material=custom` + `mat_*` params to `calculator-url.ts` and `plot-url.ts`
2. **Task 4** — Compound editor modal: implement `CompoundEditorModal.svelte` with formula/weight-fraction modes
3. **Task 5** — Calculator + Plot page integration: wire custom compound methods to UI components with reactive triggers

---

## Lessons Learned

No new lessons learned in this task. The implementation followed established patterns from Stage 6.9 inverse lookup wrappers.
