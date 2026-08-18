# 2026-08-18 — #207 follow-up: natural units in the out-of-range message

## Session Narrative

### Prompt 1: use natural units instead of always "MeV/nucl"

User feedback on the just-landed #207 fix (`Energy out of tabulated range
(0.001 – 10000 MeV/nucl)`): show natural units instead of raw MeV/nucl
numbers. For protons they expect something like `1 keV – 10 GeV`; for
alpha particles and other heavy ions the `/nucl` qualifier still makes
sense, but the numeric prefix should still auto-scale.

**AI response**: Found the project already has `energy-autoscale.ts`
(`formatEnergyWithUnit`) — used elsewhere (Range→/STP→ tables) to render
an MeV value with an auto-scaled eV/keV/MeV/GeV prefix — and
`available-units.ts`'s `isHeavyIonParticle` (mass number > 1, excluding
the electron sentinel id 1001) which already distinguishes protons/
electrons from heavy ions for the same "/nucl" question elsewhere in the
codebase. Reused both instead of adding new formatting logic:

- `calculator.svelte.ts`'s `outOfRangeMessage()`: base unit is `"MeV"` for
  protons/electrons and `"MeV/nucl"` for heavy ions; each bound is
  auto-scaled independently via `formatEnergyWithUnit`, so a wide range can
  legitimately show two different prefixes (e.g. `1.000 keV – 1.000 GeV`).
  The external-program branch converts its metadata `energyGrid` bounds to
  MeV first via `energyToMev` (already used by `ExternalDataService`) before
  auto-scaling, since external metadata's `energyUnit` isn't always MeV.
- `multi-program-calc.svelte.ts`: same treatment for the per-program range
  pre-check's `LibdedxError(101, ...)` message, reusing the `massASnapshot`
  already computed in that function to decide the base unit.

### Prompt 2: drop the padded trailing zeros

User feedback on the auto-scaled message from Prompt 1 (`Energy out of
tabulated range (1.000 keV – 10.00 GeV)`): the 4-sig-fig padding reads as
noise in prose — they expect `1 keV – 10 GeV`.

**AI response**: `formatEnergyValue` (private to `energy-autoscale.ts`)
pads to exactly 4 significant figures by design, because its other caller
— the Range→/STP→ result table — wants fixed-width columns (`formatStpValue`-
style alignment). Rather than change that shared default and risk
reflowing table columns, added an opt-in `trimTrailingZeros` option to
`formatEnergyValue`/`formatEnergyWithUnit` (strips trailing zeros and a
bare trailing decimal point after `toFixed`, e.g. `"1.000"` → `"1"`,
`"1.200"` → `"1.2"`, `"100.0"` stays `"100"`) and passed
`{ trimTrailingZeros: true }` from both out-of-range message call sites
only. Table formatting is untouched.

## Tasks

### Auto-scale out-of-range energy bounds and drop "/nucl" for protons/electrons

- **Status**: completed
- **Stage**: n/a (bugfix/UX polish, not a redesign-plan stage)
- **Files changed**: `src/lib/state/calculator.svelte.ts`,
  `src/lib/state/multi-program-calc.svelte.ts`,
  `src/tests/unit/calculator-state.test.ts` (updated the three existing
  #207 message assertions to the new auto-scaled strings; added a new test
  asserting the `/nucl` qualifier is kept for Helium),
  `src/tests/unit/multi-program-calc.test.ts` (extended the existing
  out-of-range test to assert the new message text).
- **Decision**: Reused existing `formatEnergyWithUnit`/`isHeavyIonParticle`
  helpers rather than writing bespoke formatting, to stay consistent with
  how energy values are already auto-scaled elsewhere (Range→/STP→ output).
  Each bound is scaled independently (not forced to a shared prefix), which
  matches the user's own example phrasing (`1 keV – 10 GeV`).
- **Issue**: `autoScaleEnergy`'s prefix ladder tops out at GeV (no TeV), so
  a pathological upper bound like `1e10 MeV` renders as `10000000 GeV`
  rather than `10 PeV`. Pre-existing limitation of `energy-autoscale.ts`,
  out of scope here — the affected test case only exists to exercise the
  `LibdedxError(101)` retry path with an artificially huge `getMaxEnergy`.

### Trim padded trailing zeros in the out-of-range message

- **Status**: completed
- **Stage**: n/a (bugfix/UX polish, follow-up to the task above)
- **Files changed**: `src/lib/utils/energy-autoscale.ts` (new opt-in
  `trimTrailingZeros` option on `formatEnergyValue`/`formatEnergyWithUnit`),
  `src/lib/state/calculator.svelte.ts`, `src/lib/state/multi-program-calc.svelte.ts`
  (both out-of-range call sites now pass `{ trimTrailingZeros: true }`),
  `src/tests/unit/energy-autoscale.test.ts` (3 new cases for the option),
  `src/tests/unit/calculator-state.test.ts` and
  `src/tests/unit/multi-program-calc.test.ts` (updated the #207 message
  assertions to the trimmed strings, e.g. `1 keV – 1 GeV`).
- **Decision**: Made trimming opt-in rather than changing
  `formatEnergyValue`'s default, since the Range→/STP→ result table relies
  on the untrimmed fixed-4-sig-fig form for column alignment; only the
  prose out-of-range message wants the trimmed form.
