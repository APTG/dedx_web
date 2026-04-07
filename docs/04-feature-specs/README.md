# Feature Specifications

Detailed per-feature specs for the dEdx Web redesign (Stage 1).
Each spec follows the template defined in
[`00-redesign-plan.md`](../00-redesign-plan.md) §7.

## Spec Files

| File | Status | Summary |
|------|--------|---------|
| [entity-selection.md](entity-selection.md) | Final v5 | Particle → Material → Program selection with bidirectional filtering, compatibility matrix, two layout modes (full panels / compact comboboxes), greyed-out items, Auto-select |
| [calculator.md](calculator.md) | Final v6 | Landing page: unified input/result table, debounced live calculation, per-row unit detection, compact entity selection, responsive layout, URL state, CSV export; aligned to canonical unit conversion contract |
| [unit-handling.md](unit-handling.md) | Draft v3 | Canonical conversion contract: internal units, density usage, conversion formulas, default behavior split (Calculator vs Plot), output formatting, export-unit rules, and numeric fixtures |
| [plot.md](plot.md) | Final v2 | Plot page: multi-series JSROOT chart with canonical per-series density conversion, explicit calculator-vs-plot default split, normalized URL unit tokens, PNG/CSV export |

## Planned Specs (not yet written)
- `multi-program.md` — Compare results across multiple programs
- `inverse-lookups.md` — Find energy from stopping power or range
- `advanced-options.md` — MSTAR modes, aggregate state, interpolation, density/I-value override
- `export.md` — CSV/PDF export details
- `shareable-urls.md` — Full URL encoding contract
- `custom-compounds.md` — User-defined materials
