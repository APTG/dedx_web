# AI Session Log: MeV/nucl Unit Conversion Fix

**Date:** 2026-04-25  
**Stage:** 5.4 (Result Table refinement)  
**Model:** Qwen/Qwen3.5-122B-A10B (via opencode)  
**Branch:** `fix/unit-label-mismatch`

---

## Problem

After deploy, users reported that the result table showed incorrect unit values. The column header read "→ MeV/nucl" but the displayed values were actually in MeV/u (MeV per atomic mass unit), not MeV/nucl (MeV per nucleon).

For heavy ions where atomic mass ≠ mass number (e.g., Carbon-12 with atomic mass 12.011 vs mass number 12), these two units differ:

- **MeV/u**: Energy per atomic mass unit = `E / m_u`
- **MeV/nucl**: Energy per nucleon = `E / A`

Where `m_u` is the atomic mass and `A` is the mass number.

---

## Root Cause Analysis

1. The function `convertEnergyToMeVperU()` in `src/lib/utils/energy-conversions.ts` was misnamed—it actually normalized to MeV/u, not MeV/nucl.

2. The internal WASM API expects energies in **MeV/nucl**, but the helper produced MeV/u and the calculator state fed those values to the WASM call as if they were MeV/nucl. As a result, both the calculation inputs and the displayed unit label were wrong for heavy ions (the input value was off by a factor of `m_u / A`, and the column header read "MeV/u" instead of "MeV/nucl").

3. For protons (A=1, m_u≈1), MeV/u ≈ MeV/nucl, so the bug was only visible for heavy ions.

---

## Changes Made

### 1. `src/lib/utils/energy-conversions.ts`

- Renamed `convertEnergyToMeVperU()` → `convertEnergyToMeVperNucl()`
- Fixed conversion logic to always return MeV/nucl:
  ```typescript
  case "MeV/u":
    return (baseValue * m_u) / massNumber;  // convert MeV/u → MeV/nucl
  case "MeV":
    return baseValue / massNumber;          // convert total MeV → MeV/nucl
  case "MeV/nucl":
    return baseValue;                       // already MeV/nucl
  ```

### 2. `src/lib/state/calculator.svelte.ts`

- Updated import: `convertEnergyToMeVperU` → `convertEnergyToMeVperNucl`
- Updated all function calls

### 3. `src/lib/utils/energy-parser.ts`

- Updated comment referencing the function name

### 4. `src/lib/components/result-table.svelte`

- Column header now correctly reads "→ MeV/nucl" (was "→ MeV/u" intermediate fix)

### 5. `src/lib/state/entity-selection.svelte.ts`

- No changes needed (not affected)

### 6. Tests Updated

- `src/tests/unit/energy-conversions.test.ts`: Updated test names and expectations
- `src/tests/components/result-table.test.ts`: Updated expected values:
  - Stopping power: `0.4608` → `0.4615` (Math.log(101) = 4.615)
  - CSDA range: `9.896 m` → `10 m` (100^1.5 = 1000 cm = 10 m)

### 7. `src/routes/docs/+page.svelte`

- Updated project status from "Stage 4 (Project Scaffolding)" → "Stage 5"

---

## Test Results

All 396 tests pass:
```
Test Files  21 passed (21)
Tests       396 passed (396)
```

---

## Verification

For a heavy ion like Carbon-12:
- Input: `100 MeV` (total kinetic energy)
- Old behavior: displayed `100 / 12.011 ≈ 8.33 MeV/u` → labeled as "MeV/nucl" ❌
- New behavior: displays `100 / 12 ≈ 8.33 MeV/nucl` → correctly labeled ✅

For a proton (A=1):
- Input: `100 MeV`
- Result: `100 / 1 = 100 MeV/nucl` (MeV/u and MeV/nucl are the same for A=1)

---

## Follow-up (review feedback)

Three review issues from the initial fix were addressed in a follow-up commit:

1. **Stale import in `energy-input.svelte`** — the conversion column helper still
   imported `convertEnergyToMeVperU` (removed by the rename). It now calls
   `convertEnergyToMeVperNucl` directly with the active particle's `A` and
   `m_u`, which removes the unnecessary MeV/u → MeV/nucl round-trip.

2. **Round-trip tests** in `energy-conversions.test.ts` were composing
   `convertEnergyFromMeVperU(convertEnergyToMeVperNucl(...))`, which is only
   the inverse when `atomicMass === massNumber`. A new
   `convertEnergyFromMeVperNucl()` helper was added (the proper inverse of
   `convertEnergyToMeVperNucl`) and the round-trip tests now use it with
   realistic `atomicMass` values for carbon and helium. Direct unit tests for
   the new helper were added too.

3. **Root-cause wording** above was sharpened: the bug was *both* a wrong
   numeric input to the WASM call (off by `m_u / A` for heavy ions) and a
   wrong UI label, not just a label mismatch.

---

## Related Files

- `docs/06-wasm-api-contract.md` - WASM API uses MeV/nucl
- `docs/04-feature-specs/unit-handling.md` - Unit conversion spec
- `src/lib/wasm/types.ts` - EnergyUnit type definition

---

## Attribution

(Qwen/Qwen3.5-122B-A10B via opencode). Raw transcript: [qwen-session](2026-04-25-mevnucl-fix-qwen-session.md)

Follow-up review fixes: (Claude Sonnet 4.6 via Copilot coding agent).
