# 2026-05-08 — Inverse STP: keV/µm unit conversion factor bug

## Session Narrative

### Prompt 1: 0.7286 keV/µm shows red dashes in Inverse STP

**User request**: Inverse STP shows red `—` for input 0.7286 keV/µm in proton/water.
URL: `?imode=stp&ivalues=0.7286&iunit=kev-um`. Fix it and add AI changelog.

**Root cause**:

`stpToMevCm2g` had a factor-of-100 error in the `kev-um` branch:

```ts
// WRONG — divides by 10 instead of multiplying
return value / (10 * density);

// CORRECT — 1 keV/µm = 10⁴ keV/cm = 10 MeV/cm → divide by density
return (value * 10) / density;
```

Derivation: 1 keV/µm × (1 MeV / 1000 keV) × (10⁴ µm / cm) = 10 MeV/cm.
Mass stopping power = 10 MeV/cm ÷ ρ [g/cm³] = 10/ρ MeV·cm²/g.

With the wrong formula, 0.7286 keV/µm → 0.07286 MeV·cm²/g, which is below the
minimum STP achievable in the ICRU 49 data range (~2.15 MeV·cm²/g at 10000 MeV).
WASM returned `LibdedxError` for both branches → `status="no-solution"` → red `—`.

With the correct formula, 0.7286 keV/µm → 7.286 MeV·cm²/g, which is well within
range. WASM returns valid E_low and E_high.

The same bug existed in two places:
- `src/lib/state/inverse-lookups.svelte.ts` (`stpToMevCm2g` exported function)
- `src/routes/calculator/+page.svelte` (local duplicate helper, used at runtime)

The previous 30 keV/µm smoke test passed despite the bug because 30/10 = 3 MeV·cm²/g
is still in range for ICRU 49 — it just returned wrong energy values silently.

**Fixes applied**:

1. `src/lib/state/inverse-lookups.svelte.ts` line 153: `value / (10 * density)` →
   `(value * 10) / density`

2. `src/routes/calculator/+page.svelte` line ~805: same correction in local helper

3. `src/tests/unit/inverse-lookups-conversion.test.ts` (new file): 8 unit tests for
   `stpToMevCm2g` covering keV/µm, mev-cm, mev-cm2-g, and non-unity density cases.
   The test for 0.7286 keV/µm → 7.286 MeV·cm²/g directly prevents regression.

**Result**: 834 unit tests pass (8 new). The duplicate local function in `+page.svelte`
is a pre-existing maintenance issue (not introduced here); left as-is since fixing it
would be a refactor beyond the scope of this bug fix.

## Tasks

### Fix keV/µm → MeV·cm²/g conversion factor

- **Status**: completed
- **Stage**: 6.9
- **Files changed**:
  - `src/lib/state/inverse-lookups.svelte.ts`
  - `src/routes/calculator/+page.svelte`
  - `src/tests/unit/inverse-lookups-conversion.test.ts` (new)
- **Decision**: Fixed both copies of the function. Added unit tests to the
  dedicated test file since this function is exported and testable in isolation.
