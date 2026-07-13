# 2026-07-13 — Heavy-ion Energy unit (MeV/nucl) missing from Range→/STP→ outputs

## Session Narrative

### Prompt 1: Alpha particles don't get MeV/nucl in Range→/STP→

User reported that the Energy tab already auto-switches its unit from MeV to
MeV/nucl for heavy ions (e.g. alpha particles) — an existing, working
feature (`CalculatorState.switchParticle`) — but the Range → and STP →
tabs' resolved "Energy" output always showed plain "MeV" regardless of
particle, in both Basic and Advanced mode.

**AI response**: Traced every `formatEnergy(...)` call site
(`table-basic-range.svelte`, `table-basic-stp.svelte`,
`table-advanced.svelte`'s Range mode, `table-inverse-stp.svelte`) and found
`value-formatters.ts`'s `formatEnergy` hardcoded `"MeV"` as the base unit
passed to `formatEnergyWithUnit` — it never had a way to say "MeV/nucl" even
though the underlying `energyMevNucl` value stored on every row is already
per-nucleon (the Energy tab's own auto-switch relies on this same
normalization; only the display label was wrong). Fixed by threading an
`isHeavyIon` boolean from the shared `EntitySelectionState` (one
`{@const isHeavyIon = isHeavyIonParticle(es.selectedParticle)}` in
`+page.svelte`, computed once and passed to all four components) down to
each `formatEnergy` call.

## Tasks

### Add `isHeavyIonParticle` helper and thread `isHeavyIon` to all inverse-lookup Energy displays

- **Status**: completed
- **Files changed**: `src/lib/utils/available-units.ts` (new
  `isHeavyIonParticle` export — same rule as the existing
  `CalculatorState.switchParticle` heavy-ion check: mass number > 1,
  excluding the electron sentinel id 1001), `src/lib/components/results/value-formatters.ts`
  (`formatEnergy` gained an optional `isHeavyIon` param, defaulting to
  `false`, selecting `"MeV/nucl"` vs `"MeV"` as the base unit passed to
  `formatEnergyWithUnit` — which already supported arbitrary base units,
  it just was never given anything but `"MeV"`), `table-basic-range.svelte`,
  `table-basic-stp.svelte`, `table-advanced.svelte` (new `isHeavyIon` field
  on `RangeModeProps`), `table-inverse-stp.svelte` (new required prop) —
  each now passes its `isHeavyIon` prop into its `formatEnergy(...)` call(s).
  `src/routes/calculator/+page.svelte` computes `isHeavyIon` once from
  `es.selectedParticle` and passes it to all four Range→/STP→ components
  (Basic and Advanced).
- **Decision**: computed `isHeavyIon` from the single shared
  `EntitySelectionState.selectedParticle` rather than duplicating the
  proton/electron/heavy-ion branching per component — this is the same
  entity selection used by the Energy tab's `switchParticle`, so Basic and
  Advanced Range→/STP→ automatically agree with whatever the Energy tab
  would show, with no separate state to keep in sync. Verified
  `es.selectedParticle`'s type (`ParticleEntity | ExternalOnlyParticle |
null`) is structurally assignable to the helper's parameter type without
  a cast, since `ExternalOnlyParticle` already carries `id` + `A` fields
  matching the existing `EnergyUnitParticle` union used by
  `getAvailableEnergyUnits`.
- **Verification**: added a component test per surface
  (`table-basic-range-stp.test.ts` for the two Basic hero cards; new
  `inverse-lookup-heavy-ion-units.test.ts` for the Advanced Range→ table and
  the Advanced STP→ table) asserting plain "MeV" for a non-heavy-ion prop and
  "MeV/nucl" for a heavy-ion prop; new `available-units.test.ts` unit-tests
  `isHeavyIonParticle` directly (proton, electron-sentinel-with-massNumber-4,
  alpha, carbon, and the external-only `A`-keyed particle shape). Manually
  verified end-to-end in a real browser (Playwright driver script, WASM
  build) with `?particle=2&material=276` (alpha/water): Range → showed
  "31.98 MeV/nucl", STP → showed "5.309 MeV/nucl" (high-E) and
  "2.009 keV/nucl" (low-E branch, confirming the SI auto-scale ladder still
  works on the "/nucl" suffix) — a `?particle=1` proton control on the same
  flow showed plain "32.08 MeV". `pnpm run check` (svelte-check + tsc) 0
  errors, `pnpm lint` clean (one pre-existing unrelated warning in generated
  `coverage/`), `pnpm format:check` clean, full Vitest suite — 1949 passed
  (111 files, up from 1935/109).
- **Issue**: unrelated pre-existing quirk noticed but not fixed (out of
  scope — not what was reported): loading `/calculator?particle=2&...` via a
  direct URL restores the alpha particle correctly but the Energy tab's own
  hero label still reads "Kinetic energy (MeV)" instead of "(MeV/nucl)",
  because URL restoration doesn't route through
  `CalculatorState.switchParticle` (the handler that sets `masterUnit`).
  Interactive particle-picker selection is unaffected.
