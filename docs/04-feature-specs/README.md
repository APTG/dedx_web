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
| [shareable-urls.md](shareable-urls.md) | Final v6 | Canonical URL state contract across Calculator and Plot: explicit `urlv` versioning, basic vs advanced precedence, mixed-unit energy/series encoding, normalization policy, deep-link guarantees, major-version mismatch warning/migration behavior, and Share button UI (placement, states, clipboard interaction, discrete URL-change notification) |
| [shareable-urls-formal.md](shareable-urls-formal.md) | Final v4 | Formal URL contract companion: ABNF grammar (incl. `extdata`, `ext-ref` for external entities), semantic enablement/default/precedence rules, canonicalization algorithm, and conformance vectors |
| [advanced-options.md](advanced-options.md) | Final v5 | Advanced Options accordion (density override, I-value override, aggregate state Gas/Condensed toggle, interpolation axis scale + method, MSTAR mode): density override for all material types (gas/solid/liquid), density shown inline in Plot series labels, MSTAR modes A/B/C/D/G/H descriptions, interpolation split into Axis scale (Log-log/Lin-lin) + Method (Linear/Spline), CSDA range via adaptive JS integration when spline active, URL params agg_state/interp_scale/interp_method/mstar_mode/density/ival |
| [inverse-lookups.md](inverse-lookups.md) | Draft v3 | Advanced-mode inverse lookups on Calculator page: **Range** tab (energy from CSDA range — primary use case, listed first; inline length-suffix detection nm/µm/mm/cm/m; `imode=csda`) and **Inverse STP** tab (both branches E low / E high; no-solution `—`; `getBraggPeakStp()` for valid-range hint); energy output auto-scaled eV/keV/MeV/GeV; shared entity selection and Advanced Options; URL params imode/ivalues/iunit at canonical step 8; formal ABNF in shareable-urls-formal.md v5 |

## Planned Specs (not yet written)
- `export.md` — CSV/PDF export details
- `custom-compounds.md` — User-defined materials

## Later-Stage Specs (specified now, implementation deferred)

| File | Status | Summary |
|------|--------|---------|
| [external-data.md](external-data.md) | Final v4 | User-hosted stopping-power/range data: `.webdedx.parquet` (Apache Parquet) format with row-group-level Range Requests, `extdata={label}:{url}` parameter, PDG-code + ICRU-ID entity merging, visual distinction, validation, and converter tooling spec |
