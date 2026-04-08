# Feature Specifications

Detailed per-feature specs for the dEdx Web redesign (Stage 1).
Each spec follows the template defined in
[`00-redesign-plan.md`](../00-redesign-plan.md) §7.

## Spec Files

| File | Status | Summary |
|------|--------|---------|
| [entity-selection.md](entity-selection.md) | Final v5 | Particle → Material → Program selection with bidirectional filtering, compatibility matrix, two layout modes (full panels / compact comboboxes), greyed-out items, Auto-select |
| [calculator.md](calculator.md) | Final v6 | Landing page: unified input/result table, debounced live calculation, per-row unit detection, compact entity selection, responsive layout, URL state, CSV export; aligned to canonical unit conversion contract |
| [unit-handling.md](unit-handling.md) | Final v3 | Canonical conversion contract: internal units, density usage, conversion formulas, default behavior split (Calculator vs Plot), output formatting, export-unit rules, and numeric fixtures |
| [plot.md](plot.md) | Final v2 | Plot page: multi-series JSROOT chart with canonical per-series density conversion, explicit calculator-vs-plot default split, normalized URL unit tokens, PNG/CSV export |
| [multi-program.md](multi-program.md) | Final v3 | Advanced-mode multi-program comparison: columns grouped by quantity (all stopping powers, then all CSDA ranges), quantity-focus toggle (Both/STP-only/CSDA-only), drag-and-drop column reordering synced across groups, Excel-style show/hide, default program highlighting, delta/% tooltip on hover, onboarding hint, `calculateMulti()`, partial failure, responsive horizontal scroll with sticky columns, URL-encoded mode/programs/visibility/qfocus |
| [shareable-urls.md](shareable-urls.md) | Draft v3 | Canonical URL state contract across Calculator and Plot: explicit `urlv` versioning, basic vs advanced precedence, mixed-unit energy/series encoding, normalization policy, deep-link guarantees, and major-version mismatch warning/migration behavior |
| [shareable-urls-formal.md](shareable-urls-formal.md) | Draft v1 | Formal URL contract companion: ABNF grammar, semantic enablement/default/precedence rules, canonicalization algorithm, and conformance vectors for parser/validator implementation |

## Planned Specs (not yet written)
- `inverse-lookups.md` — Find energy from stopping power or range
- `advanced-options.md` — MSTAR modes, aggregate state, interpolation, density/I-value override
- `export.md` — CSV/PDF export details
- `custom-compounds.md` — User-defined materials
