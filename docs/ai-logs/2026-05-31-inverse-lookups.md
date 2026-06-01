# 2026-05-31 — Range → STP and STP → Range converters (Issue #673)

## Session Narrative

### Prompt 1: Prepare a plan to implement issue #673

**AI response**: Researched the codebase (state, calc orchestrators, table
components, WASM contract, inverse-lookups spec). Issue #673 asks to extend the
two advanced-mode inverse tabs so each shows a second output, consistent with
the `Energy →` (STP, Range) layout:

- **Range →** today outputs Energy; add **STP**.
- **STP →** today outputs Energy (low-E / high-E branches); add **Range** —
  one range per energy branch, so columns grow with the branches.

Key finding: the inverse WASM calls (`getInverseCsda`, `getInverseStp`) return
only the resolved energy plus an echo of the input quantity. The complementary
quantity is recovered by running the existing **forward** `calculate()` at the
resolved energy/energies — no new WASM entry point. Posted the plan to the issue
for review.

### Prompt 2: Work on the plan; do not wait until E2E is green

**AI response**: Implemented per the confirmed design decisions (shared STP unit
header menu for Range →; paired-per-branch layout for STP →).

## Tasks

### Inverse tabs: second output column

- **Status**: completed (unit + type + lint green; E2E not run — needs built WASM)
- **Stage**: Stage 8 (advanced calculator / inverse lookups)
- **Files changed**:
  - `src/lib/state/inverse-lookups.svelte.ts` — `RangeRow.stoppingPower`,
    `InverseStpRow.rangeLowCm` / `rangeHighCm`; initializers + validators.
  - `src/lib/state/inverse-calc.svelte.ts` — forward calc after each inverse
    lookup: Range → reads `stoppingPowers`; STP → reads `csdaRanges` per branch
    (g/cm² → cm via density). Respects single-solution collapse; nulls on error.
  - `src/lib/components/results/table-advanced.svelte` — `→ STP` column for the
    Range tab using `StpUnitHeaderMenu`; native MeV·cm²/g → display unit via
    `convertStpMass` (density prop, so the unit switches at render without recalc).
  - `src/lib/components/results/table-inverse-stp.svelte` — `→ Range` column
    paired with each energy branch; reuses the low-E reveal animation.
  - `src/routes/calculator/+page.svelte` — wires `stpDisplayUnit`,
    `onSelectStpUnit`, and effective `density` into the Range table.
  - `src/tests/unit/inverse-calc.test.ts` — new assertions for `stoppingPower`,
    `rangeLow/HighCm`, and single-solution collapse.
  - Specs: `docs/04-feature-specs/inverse-lookups.md` (v7), `calculator.md` tab
    table, `docs/06-wasm-api-contract.md` forward-calc note.
- **Decision**: Store the STP value as native MeV·cm²/g (Range row) and the
  range as cm (STP rows). The Range STP column converts to the display unit at
  render time (output unit changes must not trigger a recalc, matching the
  forward tab), so the component needs density; the STP range column stores cm
  directly so it needs no density at render. Output STP unit is shared with the
  `Energy →` tab via `stpOutputUnit`, persisted through `sunit=` — no new URL
  param.
- **Issue**: Inverse-tab CSV export is not implemented in the codebase (spec
  describes it but no builder exists), so no export code changed. E2E scenarios
  for the new columns are described in the spec but not added/run here per the
  request not to block on E2E (requires built WASM in `static/wasm/`). The
  `guard-forbidden-files` unit test fails in this sandbox due to git
  commit-signing config — pre-existing and unrelated.
