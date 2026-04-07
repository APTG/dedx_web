# Feature Specifications

Detailed per-feature specs for the dEdx Web redesign (Stage 1).
Each spec follows the template defined in
[`00-redesign-plan.md`](../00-redesign-plan.md) §7.

## Spec Files

| File | Status | Summary |
|------|--------|---------|
| [entity-selection.md](entity-selection.md) | Final v5 | Particle → Material → Program selection with bidirectional filtering, compatibility matrix, two layout modes (full panels / compact comboboxes), greyed-out items, Auto-select |
| [calculator.md](calculator.md) | Draft v5 | Landing page: unified input/result table, debounced live calculation, per-row unit detection, compact entity selection, responsive layout, URL state, CSV export |
| [unit-handling.md](unit-handling.md) | Draft v2 | Energy unit selector (particle-dependent), inline unit detection from typed text, SI prefix handling, conversion formulas, output unit defaults (keV/µm vs MeV·cm²/g), CSDA range auto-scaling |

## Planned Specs (not yet written)

- `plot.md` — Interactive stopping-power-vs-energy chart (JSROOT)
- `multi-program.md` — Compare results across multiple programs
- `inverse-lookups.md` — Find energy from stopping power or range
- `advanced-options.md` — MSTAR modes, aggregate state, interpolation, density/I-value override
- `export.md` — CSV/PDF export details
- `shareable-urls.md` — Full URL encoding contract
- `custom-compounds.md` — User-defined materials
