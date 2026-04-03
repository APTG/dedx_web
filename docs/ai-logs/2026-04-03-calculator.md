# 2026-04-03 — Calculator Page Feature Spec

## Session Narrative

### Prompt 1: Write the calculator.md feature spec
**User request**: Read redesign plan, project vision, WASM API contract, entity-selection spec, and old calculator code. Then write `docs/04-feature-specs/calculator.md`.

**AI response**: Read all specified docs and old code files:
- `docs/00-redesign-plan.md` — full plan, feature spec template (§7), stage plan
- `docs/01-project-vision.md` — range calculation as 80% use case (§3.1), unit design principles (§4.1), minimum clicks (§4.2), auto-select (§4.3), progressive disclosure (§4.4), app structure (§5)
- `docs/06-wasm-api-contract.md` — `LibdedxService.calculate()`, `CalculationResult`, `EnergyUnit`, `AdvancedOptions`, `convertEnergy()`, `getMinEnergy()`/`getMaxEnergy()`
- `docs/04-feature-specs/entity-selection.md` — compact mode layout, `EntitySelectionState`, centered form wireframes
- `src/Components/Pages/Data/Calculator.js` — old React class component with `componentDidUpdate` live recalc, `transformInputs()` parsing, textarea input, dynamic/performance mode toggle
- `src/Components/Pages/Data/CalculatorInput.js` — textarea with newline separator, "Generate default energies" button, density toggle
- `src/Components/Pages/Data/CalculatorOutput.js` — thin wrapper around `ResultTable`
- `src/Components/Pages/Data/CalculatorSettings.js` — dropdowns for program/ion/material/stp-unit
- `src/Backend/WASMWrapper.js` — `getCalculatorData()` returning `{energies, stoppingPowers, csdaRanges}`

Key decisions in the spec:
- **Per-line validation**: each line validated independently; invalid lines excluded but don't block valid ones (improvement over old app which threw on any invalid input)
- **Debounce at 300ms**: replaces old app's Dynamic/Performance mode toggle with a single debounced approach
- **Energy unit selector as segmented control**: context-aware (MeV only for proton, MeV + MeV/nucl for heavy ions), per project vision §4.1–4.2
- **Default state**: Proton / Water / Auto-select / 100 MeV with result shown immediately
- **v1 output units**: native C units only (MeV·cm²/g, g/cm²); output unit selectors deferred to unit-handling.md
- **Per-line highlighting deferred**: v1 uses summary-below-textarea approach; inline line highlighting is an open question
- **No "Generate default energies" button in v1**: pre-filled "100" is sufficient
- **State modeled with Svelte 5 runes**: `$state`, `$derived`, `$effect` with clear reactivity chain

## Tasks

### Write calculator.md feature spec
- **Status**: completed
- **Stage**: Stage 1 (Requirements & Specifications)
- **Files changed**: `docs/04-feature-specs/calculator.md` (created), `CHANGELOG-AI.md` (updated)
- **Decision**: Per-line validation uses summary below textarea in v1 (not inline highlighting) — simplest implementation, can enhance later
- **Decision**: Fixed 300ms debounce replaces old Dynamic/Performance toggle
- **Decision**: Output units fixed to native C units in v1; unit selectors deferred to unit-handling.md spec
- **Issue**: None
