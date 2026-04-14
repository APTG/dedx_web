# AI Session Logs

Detailed session logs for AI-assisted coding sessions. Each file captures
the prompt→response narrative and task outcomes for one session.

See [`CHANGELOG-AI.md`](../../CHANGELOG-AI.md) in the repo root for a
summary table of all sessions.

## Log Files

| File | Date | Topic |
|------|------|-------|
| [2026-04-13-custom-compounds.md](2026-04-13-custom-compounds.md) | 13 Apr 2026 | custom-compounds.md Draft v1: compound library (localStorage, StoredCompound), modal editor (Formula + Weight-fraction modes, n_i = w_i / M_i conversion, live sum), program compatibility filter (Bragg additivity, Z-based element check, greyed-out with tooltip), `mat_*` shareable URL parameter design (`material=custom` sentinel + `mat_name/mat_density/mat_elements/mat_ival/mat_phase`, step 9 canonicalization, shareable-urls-formal.md updated to v6), inverse lookup C wrappers (`getInverseStpCustomCompound`, `getInverseCsdaCustomCompound`, `getBraggPeakStpCustomCompound` via `dedx_extra.{h,c}`), `getPlotDataCustomCompound` (JS-side), PDF elemental composition table (Element, Z, Atom count, Weight %), 06-wasm-api-contract.md updated with 4 new service methods |
| [2026-04-13-export.md](2026-04-13-export.md) | 13 Apr 2026 | export.md Final v6: User Stories section added; "authoritative" language removed from Scope; toolbar order `[Export PDF][Export CSV ↓][Share URL]`; Calculator CSV column order (Normalized Energy first, STP last); advanced-mode CSV config modal (§1.1); PNG export advanced-mode only; BUILD moved to bottom of advanced PDF metadata; `Page n / N` PDF footer; export.md v1–v5; calculator.md v8, plot.md v5; 09-non-functional-requirements.md Draft v1 |
| [2026-04-12-inverse-lookups.md](2026-04-12-inverse-lookups.md) | 12 Apr 2026 | Inverse Lookups Draft v3 → Final v4: Inverse STP multi-program layout changed to one column pair per program (no sub-rows); build-info.md Final v1 created (commit hash link, ISO date, branch in footer); consistency fixes (stale AC lines, project-vision TODO links); spec marked Final |
| [2026-04-10-inverse-lookups.md](2026-04-10-inverse-lookups.md) | 10 Apr 2026 | Inverse Lookups spec Draft v1→v3: Range tab (renamed from Inverse CSDA, priority position); Inverse STP (two branches); getBraggPeakStp() WASM helper; multi-program support (Range: column per program; Inverse STP: sub-rows); electron (ESTAR); tab state persistence; shareable-urls-formal.md v5 (imode/ivalues/iunit ABNF + 6 conformance vectors); all Open Questions resolved |
| [2026-04-10-advanced-options.md](2026-04-10-advanced-options.md) | 10 Apr 2026 | Advanced Options spec Draft v1→Final v5: accordion gating, density/I-value/aggregate state/interpolation (two orthogonal controls)/MSTAR mode overrides, CSDA interpolation clarification, shareable-urls-formal.md ABNF update |
| [2026-04-09-shareable-urls-external-data.md](2026-04-09-shareable-urls-external-data.md) | 9 Apr 2026 | Finalization pass: ABNF overhaul (entity-id grammar, extdata integration, url-value charset), PDG/ICRU merge keys, size limits, interpolation policy, Share button spec, all three specs marked Final |
| [2026-04-08-external-data.md](2026-04-08-external-data.md) | 8 Apr 2026 | External data spec Draft v1: user-hosted stopping-power/range data via `.webdedx` binary format, `extdata` URL parameter, entity merging, validation, converter tooling |
| [2026-04-08-shareable-urls.md](2026-04-08-shareable-urls.md) | 8 Apr 2026 | Shareable URLs spec Draft v1→v3 plus formal companion Draft v1: canonical URL contract, `urlv` versioning/warnings, ABNF grammar, semantic rules, canonicalization algorithm, and conformance vectors |
| [2026-04-08-multi-program.md](2026-04-08-multi-program.md) | 8 Apr 2026 | Multi-program spec Final v3: grouped-by-quantity comparison with quantity-focus toggle, drag-and-drop reorder, delta tooltip, onboarding hint, app-wide Advanced toggle alignment, and cross-spec consistency sync |
| [2026-04-07-unit-handling.md](2026-04-07-unit-handling.md) | 7 Apr 2026 | Stage 1 unit conversion finalization across specs: canonical conversion contract, mismatch audit, density/default/export consistency fixes, numeric acceptance fixtures |
| [2026-04-07-plot.md](2026-04-07-plot.md) | 7 Apr 2026 | Plot page feature spec v1–v2: multi-series JSROOT chart, UX evaluation, 9 UX improvements (palette, series list, mobile layout, segmented controls, export, etc.) |
| [2026-04-07-unified-table-redesign.md](2026-04-07-unified-table-redesign.md) | 7 Apr 2026 | Major UX redesign: unified input/result table, keV/µm output default, SI prefix auto-scaling, per-row unit detection, material phase badge. unit-handling.md v2, calculator.md v5. |
| [2026-04-03-calculator.md](2026-04-03-calculator.md) | 3–7 Apr 2026 | Calculator spec v1–v4, entity-selection Final v5, unit-handling stub v1, cross-spec terminology fixes |
| [2026-04-03-entity-selection.md](2026-04-03-entity-selection.md) | 3 Apr 2026 | Entity-selection spec v2–v5: selection order, greyed-out items, two layout modes, open question resolution |
| [2026-04-03-project-vision.md](2026-04-03-project-vision.md) | 3 Apr 2026 | Draft project vision (01-project-vision.md), units design principle, redesign plan updates |
| [2026-04-03-ai-changelog-setup.md](2026-04-03-ai-changelog-setup.md) | 3 Apr 2026 | Set up AI session logging infrastructure (CHANGELOG-AI.md, session log format, copilot-instructions) |
