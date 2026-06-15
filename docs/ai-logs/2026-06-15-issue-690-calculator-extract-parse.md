# 2026-06-15 — Decompose `calculator.svelte.ts`: extract parse/conversion to utils

## Session Narrative

### Prompt 1: Work on issue #690, make PR when ready

**AI response**: Issue #690 asks to decompose the `calculator.svelte.ts` god
module by pushing its pure energy parse/unit-conversion logic out into
importable, side-effect-free functions with direct unit tests. The cheaper
`$derived` fix (#689) it depended on had already landed.

I extracted three pure functions into a new `src/lib/utils/energy-row-parse.ts`:

1. **`parseRowEnergy(text, masterUnit, massNumber, atomicMass?)`** — parses one
   row's raw text and normalises it to MeV/nucl, returning a discriminated
   `RowParseOutcome` (`empty` / `invalid` / `valid`) that carries the display
   `unit`, `unitFromSuffix`, and `normalizedMevNucl`. This is the pure core of
   the old `parseRow()` (and absorbs the old `convertRowEnergyToMevNucl`
   try/catch wrapper). The state module now layers engine result lookup + STP
   conversion on top of a `valid` outcome.

2. **`convertRowTextForNewParticle(text, masterUnit, oldParticle, newParticle)`**
   — the per-row E_nucl-conserving rescale logic from `convertRowsForNewParticle`,
   returning the new row text or `null` for blank/unparseable rows.

3. **`convertRowTextToUnit(text, masterUnit, targetUnit, massNumber, atomicMass?)`**
   — the KE-preserving unit conversion from the `setRowUnit` handler.

`calculator.svelte.ts` retains only state declarations + thin wiring: it maps
the `RowParseOutcome` onto `CalculatedRow`, loops `convertRowTextForNewParticle`
over rows, and calls `convertRowTextToUnit` from `setRowUnit`. The file dropped
from ~520 to ~407 lines and no longer contains any inline unit-math bodies; the
now-unused `parseEnergyInput` / `convertEnergyFromMeVperNucl` /
`getEnergyUnitCategory` imports were removed.

Added `src/tests/unit/energy-row-parse.test.ts` (33 cases) covering the three
functions directly — no state object needed — including edge cases:
non-positive/out-of-range energy, unknown-unit suffixes, SI-prefix collapse
(`1 GeV`), MeV/u vs MeV/nucl, electron and proton particle switches, plain-number
master-unit interpretation, and MeV/u preservation across heavy-ion switches.

No behaviour change: all existing calculator unit/integration tests pass
unchanged; `pnpm run check`, `pnpm lint`, and `pnpm run format:check` are clean.

## Tasks

### Extract pure parse/conversion helpers from `calculator.svelte.ts`

- **Status**: completed
- **Stage**: Stage 8 / code-health (Issue #690)
- **Files changed**:
  - `src/lib/utils/energy-row-parse.ts` (new)
  - `src/lib/state/calculator.svelte.ts`
  - `src/tests/unit/energy-row-parse.test.ts` (new)
  - `CHANGELOG-AI.md`, `docs/ai-logs/README.md`, this log
- **Decision**: Modelled `parseRowEnergy` as a discriminated union
  (`RowParseOutcome`) rather than returning a partial `CalculatedRow`, so the
  pure function stays free of state/engine concerns (id, raw input, stopping
  power, CSDA range) while still carrying every field the parse step actually
  determines (unit, unitFromSuffix, normalizedMevNucl, message). The helpers
  take a minimal `ParticleMass` shape (`{ id, massNumber, atomicMass }`) instead
  of `ParticleEntity` so they are testable with plain literals and decoupled
  from the WASM types; `ParticleEntity` is structurally assignable.
- **Decision**: Also extracted the `setRowUnit` conversion (not named in the
  issue but clearly pure unit-math) to satisfy the acceptance criterion that
  the state file "contains no unit-math bodies inline".
- **Issue**: The pre-existing `guard-forbidden-files.test.ts` fails in this
  sandbox because `git commit` signing is unavailable (signing server returns
  400) — unrelated to this change.
