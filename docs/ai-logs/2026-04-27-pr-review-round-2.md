# 2026-04-27 — PR review fixes round 2 (calculator type-safety + API + PII)

**Model:** (Claude Sonnet 4.6 via Copilot coding agent)

## Session Narrative

### Prompt 1: @grzanka — "apply changes based on the comments in this thread / Fix as well failing E2E tests and update AI logs"

**AI response:** addressed the 6 reviewer comments on commit `a35fb92`:

1. **`calculator.svelte.ts:82-103` — `oldUnit` typed too narrowly.**
   `parsed.unit` is `EnergySuffixUnit | null` which includes
   SI-prefixed forms like `GeV/nucl` and `TeV/u`. Assigning that to
   `EnergyUnit` was unsound and the subsequent
   `oldUnit === "MeV/nucl"` / `"MeV/u"` comparisons could never
   match for SI-prefixed inputs, silently routing them through the
   `else → MeV` branch.

   Fix: kept the original suffix as a `string` (`oldUnitSuffix`) for
   the call into `convertEnergyToMeVperNucl` (which already accepts
   string), and derived the *category* (`MeV` | `MeV/nucl` | `MeV/u`)
   via a new exported helper `getEnergyUnitCategory()` for the
   `newUnit` decision.

2. **`calculator.svelte.ts:114-119` — wrong MeV/u math.**
   The heavy-ion branch treated `MeV/u` as if it were `MeV/nucl`
   (`newValue = mevPerNucl`), which is wrong because MeV/u is
   `E_total / m_u`, not `E_total / A`. The two diverge whenever
   `atomicMass ≠ massNumber` (i.e. for every real ion).

   Fix: route the heavy-ion branch through
   `convertEnergyFromMeVperNucl(mevPerNucl, newUnit, A_new, m_u_new)`
   which already implements the correct inverse for all three
   categories. The proton (A=1) and electron special cases are kept
   because they short-circuit cleanly.

3. **`calculator.svelte.ts:431-436` — async signature on debounce-only fn.**
   `triggerCalculation()` was typed `async … Promise<void>` but only
   scheduled a debounced call and resolved immediately, so callers
   that did `await state.triggerCalculation()` were not actually
   awaiting any work.

   Fix: changed the contract to `triggerCalculation(): void` and
   `flushCalculation(): Promise<void> | undefined` (the underlying
   debounced function returns a `Promise<void>` from its async
   implementation). Tests already had a `triggerCalculation();
   flushCalculation(); flushCalculation()` pattern which keeps
   working — the wrapped async work runs synchronously up to the
   first await inside the mock service. Documented the correct way
   to wait for completion in the inline comment.

4. **`docs/ux-reviews/2026-04-26-…md:10` — PII (email).**
   Replaced `User (leszek.grzanka@gmail.com)` with `project owner`.
   Pre-existing email entries in older logs were left alone (out
   of scope for this PR).

5. **`docs/ai-logs/2026-04-27-opencode-tasks-1-9-summary.md:4` — `(<model> via <tool>)` parens.**
   Wrapped the Model line in parentheses to match the convention
   used by the other AI log files.

6. **`CHANGELOG-AI.md:13-15` / PR description.** The current PR
   description (last sync) said "no code changes". The PR
   *description* will be refreshed on the next `report_progress`
   call, which restates the round-4 functional changes (calculator
   logic, debounce/triggerCalculation API, MeV/u fix). Changelog
   rows are correct (each round has its own entry).

### Validation

- `pnpm test`: **425/425 pass** after all changes (round 4
  `1200 MeV` test still passes because the heavy-ion branch with
  Carbon (A=12, m_u≈12.011) → `mevPerNucl × A / m_u × m_u` gives
  the same result for the MeV target unit).
- `pnpm build`: clean.

## Tasks

### Tighten convertRowsForNewParticle types and fix MeV/u handling
- **Status:** completed
- **Stage:** 5 (calculator)
- **Files changed:**
  - `src/lib/utils/energy-conversions.ts` — exported new
    `getEnergyUnitCategory(unit: string): EnergyUnit` thin wrapper
    around the existing private `getBaseUnit`.
  - `src/lib/state/calculator.svelte.ts` — kept the suffix as
    `string` for conversion calls, derived the unit category for
    the display-unit decision, and replaced the manual MeV/u
    formula with `convertEnergyFromMeVperNucl(...)` which already
    handles all three target categories correctly.
- **Decision:** chose to route through the existing inverse helper
  rather than special-case MeV/u inline — keeps the math in one
  place and removes the asymmetry between `convertEnergyToMeVperNucl`
  (used on the way in) and the previous hand-rolled formulas (used
  on the way out).

### Make trigger/flush API contract honest
- **Status:** completed
- **Stage:** 5 (calculator)
- **Files changed:**
  - `src/lib/state/calculator.svelte.ts` — `triggerCalculation()` now
    declares `void`; `flushCalculation()` returns the underlying
    `Promise<void> | undefined` so callers can await completion when
    they need to. Existing test/UI callers continue to work (TS
    accepts `await voidExpr`).

### Fix doc PII and AI log header convention
- **Status:** completed
- **Files changed:**
  - `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`
  - `docs/ai-logs/2026-04-27-opencode-tasks-1-9-summary.md`
