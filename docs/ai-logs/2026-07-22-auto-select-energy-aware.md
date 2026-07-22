# 2026-07-22 — Auto-select program resolution ignores energy (#871)

## Session Narrative

### Prompt 1: Work on https://github.com/APTG/dedx_web/issues/871, make commits and push, create PR when ready

**AI response**: Read the issue — `resolveAutoSelect()` in
`entity-availability.svelte.ts` picks the first chain candidate (e.g. `ICRU73
→ ICRU73_OLD → MSTAR` for heavy ions) that has any tabulated particle/material
data, without checking whether the requested energy falls inside that
candidate's `getMinEnergy()`/`getMaxEnergy()` bounds. A heavy ion below ICRU
73's 0.025 MeV/nucleon floor gets stuck reporting "out of range" even though
MSTAR, later in the same chain, covers it (floor 0.001 MeV/nucleon).

Traced the reactive wiring end-to-end (with a research subagent covering
`calculator-page-orchestrator.svelte.ts`'s effect graph) before choosing a
design: `resolvedProgramId` is read inside several `$effect` bodies across the
orchestrator, so any new `$state` its computation depends on propagates
correctly through the existing effect chain — no new effect ordering hazard.

Implemented an energy-hint mechanism:

- `entity-availability.svelte.ts`: `createEntityAvailabilityState()` now takes
  an optional `service: LibdedxService` and reads a new
  `selection.autoSelectEnergyMevNucl` getter. `resolveAutoSelect()` first
  tries chain candidates that are both available AND cover the energy hint
  (via `service.getMinEnergy`/`getMaxEnergy`), only falling back to today's
  energy-blind "first available" behavior when no hint/service is present or
  no candidate covers the energy — matching the issue's proposed fix exactly.
- `entity-selection.svelte.ts`: `createEntitySelectionState()` takes an
  optional second `service` param (kept optional so the ~60 existing test call
  sites that construct state without a service keep working unchanged), holds
  `autoSelectEnergyMevNucl` as `$state`, and exposes
  `setAutoSelectEnergyHint(energy: number | null)`.
- `app-init.svelte.ts`: passes the already-available `service` through to
  `createEntitySelectionState`.
- `calculator-page-orchestrator.svelte.ts`: new `setupAutoSelectEnergyHint()`
  effect reads `calcState.rows[0].normalizedMevNucl` (parsed from raw text,
  independent of which program is resolved — no circular dependency) and
  pushes it into `entityState.setAutoSelectEnergyHint()`. Wired in before
  `setupSingleEntityCalculation()`.

Chose "first row only" for the energy hint (not per-row), matching the issue's
explicitly-sanctioned simplification ("today it's a single program for all
rows either way").

Added `src/tests/unit/auto-select-energy.test.ts` with a focused mock service
(ICRU73/ICRU73_OLD/MSTAR with distinct energy floors) covering: energy-blind
fallback with no hint, floor-crossing resolving to MSTAR, in-range energy
staying on ICRU 73, energy above every candidate's ceiling falling back to the
first chain member, and the no-`service`-passed case staying energy-blind.

Verified end-to-end in a real browser (Playwright driving the dev server with
the built WASM): selected Boron + Silicon Dioxide, typed `220.5 keV`, and
confirmed the UI switched from "Auto-select → ICRU 73" (100 MeV/nucl default)
to "Auto-select → MSTAR" with a valid 1.068 µm CSDA range and no out-of-range
error — matching the aidedx reference answer (1.044 µm, MSTAR) cited in the
issue.

Full suite (`pnpm test`, 1965 tests), `svelte-check`, `pnpm lint`, and
`pnpm format:check` all pass.

## Tasks

### Make Auto-select energy-aware so heavy ions fall through to a wider-range program

- **Status**: completed
- **Stage**: entity-selection (bug fix, not a redesign-plan stage)
- **Files changed**:
  - `src/lib/state/entity-availability.svelte.ts`
  - `src/lib/state/entity-selection.svelte.ts`
  - `src/lib/state/app-init.svelte.ts`
  - `src/lib/state/calculator-page-orchestrator.svelte.ts`
  - `src/tests/unit/auto-select-energy.test.ts` (new)
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-07-22-auto-select-energy-aware.md`
- **Decision**: Threaded the energy as a settable `$state` hint pushed by a
  dedicated orchestrator effect, rather than parameterizing `resolvedProgramId`
  itself with an energy argument. The latter would have required updating every
  call site (`plot-page-orchestrator.svelte.ts`, `multi-entity-calc.svelte.ts`,
  `inverse-range-calc.svelte.ts`, `inverse-stp-calc.svelte.ts`,
  `calculator-url-sync.svelte.ts`, etc.) and would have let different call
  sites disagree on which program is "the" resolved one. The hint approach
  keeps `resolvedProgramId` as the single source of truth everywhere, at the
  cost of the resolution reacting one effect-tick after the energy row changes
  (imperceptible — same debounce window as the calculation itself already
  uses).
- **Issue**: The issue's own "open questions" are still open: multi-row Basic
  mode resolves against row 0 only (matches existing single-program-for-all-rows
  behavior, not changed here), and the "Auto-select → X" display doesn't yet
  explain *why* a floor was involved. Neither blocks this fix; both are
  reasonable follow-ups if requested.
