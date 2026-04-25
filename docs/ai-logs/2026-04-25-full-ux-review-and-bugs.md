# AI Session Log: Full UX Review and Bug Fixes

**Date:** 2026-04-25  
**Stage:** 5.4 (post-merge polish)  
**Model:** Claude Sonnet 4.6 (via Claude Code)  
**Branch:** `fix/ux-review-and-bugs`

---

## Session Narrative

### Prompt 1: Move raw session file, check AI log consistency

Moved `session-ses_23b5.md` (root) → `docs/ai-logs/2026-04-25-mevnucl-fix-qwen-session.md`.
Corrected model attribution from `Qwen3.5-397B` → `Qwen/Qwen3.5-122B-A10B` in the curated
log and CHANGELOG-AI.md (raw session transcript is the authoritative source).  Added
entries to `docs/ai-logs/README.md` (the `mevnucl-fix.md` row was also missing).

### Prompt 2: Full UX review + bug fixes + E2E tests

User reported four bugs observed on the deployed build, asked for a comprehensive UX review
in a folder structure, and requested complex-interaction E2E tests.

---

## Tasks

### Task 1: Fix `resolveAutoSelect` — auto-select fallback
- **Status:** completed
- **Stage:** 5.4
- **Files changed:** `src/lib/state/entity-selection.svelte.ts`
- **Decision:** After the preferred program chain (e.g., ICRU49→PSTAR for proton) fails, fall
  back to the first program returned by `getAvailablePrograms()`.  This unblocks Hydrogen+Urea
  and all similar combinations where MSTAR or another Bethe-Bloch program applies.
  Trade-off: fallback may use a less-accurate program; the resolved name is visible in the UI
  via "Auto-select → MSTAR" so users can override.

### Task 2: Fix `selectionSummary` getter bug
- **Status:** completed
- **Stage:** 5.4
- **Files changed:** `src/lib/state/entity-selection.svelte.ts`
- **Decision:** `this.resolvedProgram` is not a property on `EntitySelectionState`.
  Fixed to `sp.resolvedProgram` where `sp` is the narrowed `AutoSelectProgram` object.
  This was a silent bug — the live region always announced "Program: Auto-select" even when
  a concrete program had been resolved.

### Task 3: Fix `formatSigFigs` RangeError
- **Status:** completed
- **Stage:** 5.4
- **Files changed:** `src/lib/utils/unit-conversions.ts`
- **Decision:** V8 throws `RangeError` for `toFixed(n)` when `n > 100`.  Added three guards:
  (1) return `"—"` for NaN/Infinity; (2) use `toPrecision(sigFigs)` for extreme magnitudes
  (avoiding `toFixed` entirely); (3) clamp `decimalPlaces` to 100 as a safety net.
  The root cause of WASM returning subnormal values is tracked as an open issue in the UX review.

### Task 4: Context-aware incomplete-selection message
- **Status:** completed
- **Stage:** 5.4
- **Files changed:** `src/lib/components/result-table.svelte`
- **Decision:** Three separate messages depending on WHY `isComplete` is false:
  electron (ESTAR), no compatible program found, or nothing selected yet.

### Task 5: Inline per-row error messages
- **Status:** completed
- **Stage:** 5.4
- **Files changed:** `src/lib/components/result-table.svelte`
- **Decision:** `CalculatedRow.message` was computed but never rendered.  Added a
  `<div role="alert">` beneath each invalid input.  Added `placeholder="e.g. 100 keV"`.

### Task 6: Unit tests for fixed code
- **Status:** completed
- **Files changed:**
  - `src/tests/unit/unit-conversions.test.ts` — extreme formatSigFigs values, NaN, Infinity
  - `src/tests/unit/entity-selection-state.test.ts` — auto-select fallback scenario,
    corrected selectionSummary test (was referencing `state.resolvedProgram` which doesn't exist)

### Task 7: Complex-interaction E2E tests
- **Status:** completed
- **Files changed:** `tests/e2e/complex-interactions.spec.ts` (new)
- **Decision:** 18 E2E tests across 6 `describe` blocks covering flows that unit tests miss:
  unit-suffix parsing, inline error rendering, auto-select messaging, multi-row paste, and
  no-crash smoke tests for the exact scenario that triggered the formatSigFigs RangeError.

### Task 8: UX reviews folder + comprehensive review
- **Status:** completed
- **Files changed:**
  - `docs/ux-reviews/README.md` (new)
  - `docs/ux-reviews/2026-04-25-calculator-full-review.md` (new)
  - `docs/ux-reviews/2026-04-24-entity-selector-energy-input.md` (copy)
  - `docs/README.md` — added ux-reviews/ row

---

## Open Issues

- **Bug 6 (MeV/u display):** "12MeV/u" and "12 MeV/nucl" may not show in → MeV/nucl column.
  Parser and conversion logic look correct from static analysis.  E2E test added — will
  surface if it fails in CI.
- **Bug 7 (subnormal WASM values):** Root cause of WASM returning values like 1e-307 for
  12 MeV proton in water is unknown.  Prevented from crashing; not yet diagnosed.
- **Issue 8:** No E2E tests verify STP/CSDA values for heavy ions (Carbon, Helium).
