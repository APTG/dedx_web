# 2026-04-27 — PR review fixes

**Model:** (Claude Sonnet 4.6 via Copilot coding agent)

## Session Narrative

### Prompt 1: "@copilot+claude-opus-4.7 apply changes based on the comments in this thread; fix failing E2E tests; add entries to AI logs"

**AI response:** Worked through all six reviewer comments on PR #379:

1. **Unused local `switchParticle()` in `calculator.svelte.ts`.** The
   inner local function declared at lines 129-139 was never called —
   the returned object defined its own `switchParticle` at lines 424-434
   which is what the page actually invokes. With `noUnusedLocals` this
   would fail svelte-check / CI. Deleted the local function. Verified
   the returned method still has access to the same closure variables
   (`previousParticle`, `convertRowsForNewParticle`,
   `entitySelection.allParticles`, `entitySelection.selectParticle`).

2. **Duplicated `getAvailableUnits()` in `+page.svelte` vs
   `result-table.svelte`.** The master `EnergyUnitSelector` on the
   calculator route was missing the `MeV/u` Advanced-mode entry that
   `ResultTable` already exposed, so `MeV/u` could never be picked as
   the master unit even when Advanced was on. Extracted both
   implementations into `src/lib/utils/available-units.ts`
   (`getAvailableEnergyUnits(particle, advancedMode)`); the master
   selector now passes `isAdvancedMode.value` and behaves identically
   to per-row dropdowns.

3. **Out-of-date file-level docstring in
   `tests/e2e/particle-unit-switching.spec.ts`.** The header still
   described the original "lock down today's no-conservation behaviour
   + fixme the desired KE conservation" model, but Tasks 4 and 5 made
   KE conservation the actual implementation. Rewrote the docstring to
   describe the active spec (E_nucl preserved across particle switch;
   row toggle re-expresses the same KE in the new unit).

4. **Stale "no Add row button" assertion.** Task 7 added an explicit
   `+ Add row` button below the table, so the negative assertion
   `toHaveCount(0)` would now fail. Replaced it with a positive test
   that locates the button by its accessible name (`/\+\s*Add row/i`)
   and verifies clicking it appends a row.

5. **Duplicated "DESIRED" describe block.** The block at lines 151-254
   contained three `test()` cases (not `test.fixme()`) that were exact
   duplicates of the active "E_nucl conservation" tests above, plus
   two genuinely-pending `test.fixme()` cases, plus an active electron
   test. Collapsed the block to keep only the two pending fixme cases
   (master-unit toggle KE conversion, multi-row independent KE
   conservation) and dropped the duplicates and the electron case.

6. **Electron not selectable in combobox vs E2E test that selects it.**
   `entity-selection-comboboxes.svelte:209-218` deliberately rejects
   particle id 1001 (`if (particle.id === 1001) return;`) because
   ESTAR is not implemented in libdedx v1.4.0. Rather than open up
   electron selection (which would let the user trigger an
   immediately-failing calculation), removed the electron-switching
   E2E case and added a note in the new describe-block header
   pointing at the combobox's id-1001 guard.

**Validation:**

- Unit/integration: 425/425 pass.
- `pnpm build`: clean.
- `pnpm exec svelte-check`: 113 → 112 errors (the 1 fix is the unused
  `switchParticle`; the remaining 112 are pre-existing `$app/paths`
  module-resolution noise from running outside CI's full `kit sync`
  context, not from this change).

## Tasks

### Remove unused local `switchParticle()`
- **Status:** completed
- **Files changed:**
  - `src/lib/state/calculator.svelte.ts` (-12 lines)
- **Decision:** deleted instead of "wire local fn into the returned
  method" because the returned method already worked correctly and the
  local declaration was leftover refactoring. Smallest possible diff.

### Share `getAvailableEnergyUnits()` between master + per-row selectors
- **Status:** completed
- **Files changed:**
  - `src/lib/utils/available-units.ts` (new, 27 lines)
  - `src/routes/calculator/+page.svelte` (-9, +3 — replaced inline
    helper, imported `isAdvancedMode`)
  - `src/lib/components/result-table.svelte` (-13, +3 — replaced
    inline helper)

### E2E spec cleanup
- **Status:** completed
- **Files changed:**
  - `tests/e2e/particle-unit-switching.spec.ts`
    - Rewrote file-level docstring (active KE conservation, not fixme).
    - Removed the duplicate "DESIRED" describe block; kept only the
      two genuine `test.fixme()` pending cases (master-unit toggle
      conversion, multi-row independent conservation).
    - Removed the electron-switching test (combobox blocks id 1001).
    - Replaced the negative "no Add row button" assertion with a
      positive test that verifies the `+ Add row` button exists and
      appends a row when clicked.

### Issues left open
- The 112 pre-existing svelte-check errors (mostly unresolved
  `$app/paths` types) are environment / kit-sync noise outside this
  PR's scope; CI runs the full sync flow and is the authoritative
  signal.
- Local Playwright run not re-attempted in this round — no E2E
  expectations changed in a way that could regress without also
  showing up in the CI E2E job.
