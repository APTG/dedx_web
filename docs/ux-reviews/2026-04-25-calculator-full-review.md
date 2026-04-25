# UX Review — Calculator Page (Full)

> **Date:** 2026-04-25  
> **Scope:** Full calculator page — auto-select program logic, result table
> rendering, energy input interactions, error handling, and E2E test coverage.  
> **Basis:** Live interactive testing on deployed build + code review.
> **Reporter:** User (leszek.grzanka@gmail.com) + Claude Sonnet 4.6

---

## Summary

The entity-selector and energy-input components are individually solid (all 24
issues from the previous review are fixed).  However, the **integration** of
those components with the result-table and the auto-select program logic reveals
several critical gaps.  The app can become entirely unresponsive to user input
or crash with a JavaScript `RangeError` under realistic (non-default) usage
patterns.

Five issues have been fixed in this session; three remain open for future work.

---

## Critical Issues

### 1. Auto-select blocks calculation for valid particle+material combinations

**Status:** ✅ FIXED (2026-04-25, commit `b1dcbc8`)

**Reported:** "User selects Hydrogen and Urea, program stays at Auto-Select.
User gets a message 'Select a particle and material to calculate.'  That is
confusing: particle and material is selected, but user is not able to see any
results.  Only after switching to Bethe-Bloch the user can do something."

**Root cause:** `resolveAutoSelect()` only tried programs in a hard-coded
priority chain (e.g., ICRU49 → PSTAR for protons).  If neither program
supports the selected material (e.g., Urea is not in the NIST PSTAR database),
the function returned `null`.  `isComplete` became `false`, and the result
table displayed the generic placeholder — even though a particle AND a material
were both explicitly selected.

**Fix:** Added a fallback step: after the preferred chain fails, pick the first
program returned by `getAvailablePrograms(matrix, particleId, materialId)`.
For Hydrogen+Urea, Bethe-Bloch (MSTAR) is returned by the matrix and is now
automatically selected.

**Trade-off:** MSTAR uses a simpler Bethe-Bloch formula and may be less
accurate than NIST tabulated data for standard materials.  The resolved program
name is shown via the "Auto-select → Program Name" display, so users who care
can verify which program was chosen.

---

### 2. `formatSigFigs` throws `RangeError` and crashes the page

**Status:** ✅ FIXED (2026-04-25, commit `b1dcbc8`)

**Reported:** "After typing 12 in place of 100 after default load and then
typing 12 in new row I get: `Uncaught RangeError: precision 317 out of range`"

**Root cause:** `formatSigFigs()` computed `decimalPlaces` as
`sigFigs − magnitude − 1`.  For subnormal WASM output values (magnitude ≈ −314),
`decimalPlaces` reached 317.  `Number.prototype.toFixed(n)` throws a `RangeError`
for `n > 100` in V8.

**Fix:**
1. Return `"—"` for `NaN` / `Infinity`.
2. For values with `magnitude < −(sigFigs + 5)` or `magnitude ≥ 15`, use
   `toPrecision(sigFigs)` (scientific notation) instead of `toFixed()`.
3. Clamp `decimalPlaces` to `[0, 100]` as a safety net.

**Note:** The physical root cause of the subnormal value (why WASM returns it
for normal inputs) is undiagnosed.  The fix prevents the crash but doesn't
hide the underlying physics issue — `"—"` / scientific notation will still
signal that something unexpected was returned.

---

### 3. `selectionSummary` always shows bare "Auto-select" (never resolves name)

**Status:** ✅ FIXED (2026-04-25, commit `b1dcbc8`)

**Root cause:** The `selectionSummary` getter referenced `this.resolvedProgram`
which does not exist on `EntitySelectionState`.  The condition was always
falsy, so the resolved program name was never appended.

**Fix:** Access `resolvedProgram` via the correctly typed `selectedProgram`
object (`sp.resolvedProgram` where `sp` is narrowed to `AutoSelectProgram`).

**Impact:** The `<SelectionLiveRegion>` component announces
"Program: Auto-select → PSTAR" correctly to screen readers now.

---

## Medium Issues

### 4. No inline error message for invalid energy input

**Status:** ✅ FIXED (2026-04-25, commit `b1dcbc8`)

**Reported:** "If I type 'bebok' then no message is printed about wrong value."

**Root cause:** `result-table.svelte` showed a red border on invalid rows
and a bottom summary ("N of M values excluded") but no per-row explanation.
The `CalculatedRow.message` field was set by `parseRow()` but never rendered.

**Fix:** Added a `<div role="alert">` below invalid inputs that renders
`row.message` (e.g., "invalid number", "unknown unit: bebok", "must be
positive").

**Spec compliance:** `calculator.md` §4.2 (validation feedback per row) was
not fully met before this fix.

---

### 5. Incomplete-selection message is factually wrong

**Status:** ✅ FIXED (2026-04-25, commit `b1dcbc8`)

**Root cause:** The message "Select a particle and material to calculate."
was shown unconditionally whenever `isComplete` was false — including when both
a particle AND a material were selected but no program supported the pair.

**Fix:** Three context-aware messages replace the single generic one:
- Electron: "Electron (ESTAR) is not yet supported by libdedx v1.4.0."
- Particle+material selected but no program: "No program supports **X** in **Y**.
  Try selecting a specific program from the Program dropdown."
- Neither selected: "Select a particle and material to calculate." (original)

---

## Open Issues

### 6. MeV/u and MeV/nucl unit suffixes may not display converted value

**Status:** 🔍 OPEN — under investigation

**Reported:** "When adding new rows with '12MeV/u' and '12 MeV/nucl' nothing
appears in respective cells in '→MeV/nucl' column."

**Code analysis:** The parser correctly parses "12MeV/u" → `{ value: 12, unit: "MeV/u" }`.
`convertEnergyToMeVperNucl(12, "MeV/u", massNumber, atomicMass)` should return
`(12 × m_u) / A` for the selected particle.  For Hydrogen (A=1, m_u≈1.008)
this is 12.096.  The `CalculatedRow.normalizedMevNucl` should be non-null.

**Hypothesis:** The E2E tests added in this session will help surface whether
the issue is:
- A Svelte 5 fine-grained reactivity miss when `isPerRowMode` changes
- A timing issue where the result table renders before `computeRows()` runs
- A specific browser/build-mode behavior not reproducible in unit tests

**Acceptance test added:** `complex-interactions.spec.ts` — "12 MeV/nucl shows
12 in the → MeV/nucl column" and "12MeV/u shows ~12 for proton".

---

### 7. WASM returns subnormal values for some energy inputs (root cause unknown)

**Status:** 🔍 OPEN — needs physics investigation

**Reported:** The `RangeError` in issue #2 above implies WASM returned
stopping power or CSDA range values in the range 10⁻³⁰⁷–10⁻³¹⁴ cm for a
real energy input (12 MeV proton in water).  These values are physically
nonsensical.

**Expected:** At 12 MeV, proton STP in water ≈ 20–50 MeV·cm²/g; CSDA range
≈ 0.3–0.5 cm.

**Hypothesis:**
- Wrong program ID was used (e.g., a program that doesn't support this
  combination returning garbage instead of an error)
- Unit mismatch between WASM output and the conversion code
- The `calculationResults` Map is keyed on floating-point `normalizedMevNucl`
  values; if two independent computations produce slightly different float
  values for the same logical energy, results would not be found.

**Investigation needed:** Add debug logging in `performCalculation` to record
which energies were sent and what raw values were returned.

---

### 8. No E2E coverage for heavy-ion (Carbon, Helium) calculations

**Status:** 🔍 OPEN

**Gap:** All existing E2E tests use the default Proton+Water combination.
Switching to Carbon or Helium exercises:
- Per-row unit selector (massNumber > 1)
- Different auto-select chain (ICRU73 → MSTAR instead of ICRU49 → PSTAR)
- `convertEnergyToMeVperNucl` with different A and m_u

**E2E test added in this session:** "switching particle to Carbon then editing
energy does not crash" — but does not verify STP values.

---

## Priority Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 2 | `formatSigFigs` RangeError crashes page | Critical | ✅ Fixed |
| 1 | Auto-select blocks valid combinations | Critical | ✅ Fixed |
| 3 | selectionSummary always shows "Auto-select" | High | ✅ Fixed |
| 4 | No inline error for invalid input | Medium | ✅ Fixed |
| 5 | Confusing incomplete-selection message | Medium | ✅ Fixed |
| 7 | WASM returns subnormal values (root cause) | High | 🔍 Open |
| 6 | MeV/u and MeV/nucl not displaying | Medium | 🔍 Open |
| 8 | No heavy-ion E2E coverage | Low | 🔍 Open |
