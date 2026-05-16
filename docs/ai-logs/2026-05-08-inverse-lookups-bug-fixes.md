# 2026-05-08 — Inverse Lookups: STP no-results bug + unit-change recalculation fix

## Session Narrative

### Prompt 1: Fix STP showing no results and Range unit change not recalculating

**User request**: Inverse STP shows nothing for `?imode=stp&ivalues=2,0.4&iunit=kev-um`. Range
unit change (cm → mm) doesn't update the energy result. Fix both, fill AI logs, add E2E tests.

**Root cause — Bug 1 (STP shows nothing)**:

When `getInverseStp` (WASM) returns a `LibdedxError` for a stopping-power value that is out of
the library's energy range, the effect only set `r.energyLowMevNucl = null` /
`r.energyHighMevNucl = null` but left `r.status = "valid"`. The STP result template had no
`{:else}` fallback — the condition `status === "valid" && energy !== null` was false, but so were
the `"invalid"`, `"no-solution"`, and `"empty"` branches. Result: empty div, nothing rendered.

The user's test values (2 keV/µm → 0.2 MeV·cm²/g, 0.4 keV/µm → 0.04 MeV·cm²/g) are at or
beyond the maximum energy in the ICRU49 data range, so WASM returned errors for both.

**Root cause — Bug 2 (unit change no recalc)**:

`setRangeMasterUnit(unit)` only updated `meta.rangeMasterUnit`; it did NOT update existing rows'
`r.unit`. Row `r.unit` is set during `validateRangeRow` (called by `updateRangeRowText`), which
reads `meta.rangeMasterUnit` at validation time. After the master unit changes, rows still carried
the old unit. The CSDA `$effect` read `r.unit` from the snapshot — stale value → wrong
`getUnitToCmFactor` → wrong g/cm² → same result as before. Same pattern for STP.

Additionally, neither effect explicitly read `inverseLookupState.rangeMasterUnit` /
`inverseLookupState.stpMasterUnit`, so even if only the master-unit state changed (without any
row mutation), Svelte 5 would not re-run the effects.

**Fixes applied**:

1. `src/lib/state/inverse-lookups.svelte.ts`
   - `setRangeMasterUnit`: iterate `rangeRows`, update `row.unit = unit` for non-suffix rows
   - `setStpMasterUnit`: iterate `stpRows`, update `row.unit = unit` for all rows

2. `src/routes/calculator/+page.svelte`
   - CSDA `$effect`: added `const _rangeMasterUnit = inverseLookupState.rangeMasterUnit;`
   - STP `$effect`: added `const _stpMasterUnit = inverseLookupState.stpMasterUnit;`
   - STP `$effect` per-row handling: when both `lowResult instanceof Error &&
     highResult instanceof Error`, set `r.status = "no-solution"` instead of leaving "valid"
     with null energies. When at least one succeeds, keep `"valid"`.
   - STP result-low and result-high template cells: added `{:else}` fallback showing "—"
     (matches the existing Range tab pattern)

3. `tests/e2e/inverse-lookups.spec.ts` — 3 new tests:
   - `Inverse STP tab: shows E_low and E_high for 30 keV/µm proton/water @smoke`: loads
     `/calculator?particle=1&material=276&program=2&imode=stp&ivalues=30&iunit=kev-um&advanced=1`,
     asserts both spans match `/^\d+.../`, E_high > E_low > 0
   - `Range tab: unit change triggers recalculation @regression`: loads 10 cm, reads energy,
     changes to mm, asserts energy changes and is less (10 mm < 10 cm)
   - `STP tab: unit change triggers recalculation @regression`: loads 30 keV/µm, reads E_low,
     changes to MeV/cm, asserts E_low changes

## Tasks

### Fix Inverse STP no-results

- **Status**: completed
- **Stage**: 6.9
- **Files changed**:
  - `src/routes/calculator/+page.svelte` (STP effect + template)
- **Decision**: Use `"no-solution"` status (existing status value) when both WASM calls fail.
  No new status type needed.

### Fix Range/STP unit-change recalculation

- **Status**: completed
- **Stage**: 6.9
- **Files changed**:
  - `src/lib/state/inverse-lookups.svelte.ts` (`setRangeMasterUnit`, `setStpMasterUnit`)
  - `src/routes/calculator/+page.svelte` (explicit dep reads in both `$effect`s)
- **Decision**: Propagating the unit to row objects is sufficient to trigger re-runs (Svelte 5
  detects `r.unit` changes via proxy). Explicit master-unit reads are belt-and-suspenders but
  also ensure re-runs even if all rows happened to be empty.

### Add E2E tests

- **Status**: completed
- **Stage**: 6.9
- **Files changed**: `tests/e2e/inverse-lookups.spec.ts`
