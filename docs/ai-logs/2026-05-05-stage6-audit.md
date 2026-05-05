# 2026-05-05 — Stage 6 Audit & Plan Update

**Model:** Claude Sonnet 4.6 via Claude Code

## Session Narrative

### Prompt 1: Audit Stage 6 progress and rewrite the plan section

**AI response:**

Audited Stage 6 completion status by cross-referencing:

- `git log --oneline --since=2026-04-21` — all commits and merged PRs in the last 2 weeks
- `docs/ai-logs/` — session logs for each Stage 6 sub-stage
- `CHANGELOG-AI.md` — top entries
- `docs/04-feature-specs/README.md` — spec status table
- Source tree (`src/lib/`, `src/routes/`) — grep for inverse lookups, custom compounds,
  advanced options, external data implementations

**Findings:**

#### Completed in Stage 6 (PRs merged since 21 April 2026)

| Sub-stage                               | PR(s)            | Summary                                                                                                                                                                                               |
| --------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 Calculator (basic)                  | #399             | WASM calculation bug fix (float/double mismatch, param order, CSDA call), URL sync (`calculator-url.ts`), toolbar with Share URL + disabled Export buttons, loading skeleton, restore-defaults button |
| 6.2 Live calculation                    | Stage 5.2        | Debounce already wired in `calculator.svelte.ts`                                                                                                                                                      |
| 6.3 Multi-program comparison            | #423, #410       | `calculateMulti()`, Basic/Advanced toggle, multi-program picker, grouped result table, quantity focus, column visibility, onboarding hint, URL round-trip, E2E tests; mobile horizontal scroll (#410) |
| 6.4 Plot page + series comparison       | #394 (Stage 5.5) | JSROOT wrapper, multi-series, color pool, smart labels, plot URL sync                                                                                                                                 |
| 6.5 Shareable URLs                      | #399, #394, #423 | Calculator + Plot URL sync; advanced mode params (`mode`, `programs`, `hidden_programs`, `qfocus`)                                                                                                    |
| 6.6 CSV + PDF + SVG export (basic mode) | #405, #422       | Calculator CSV/PDF via `export.svelte.ts`; Plot CSV/PDF/SVG via `plot-csv.ts` + `generatePlotPdf()` + `$bindable requestExportSvg`                                                                    |

#### Not yet implemented (confirmed by source grep)

- **Advanced Options panel** — `AdvancedOptions` interface exists in `types.ts` and is
  accepted by `calculate()` in the WASM layer, but no UI accordion component, no
  `advanced-options.svelte.ts` state module, no URL encoding for `agg_state` /
  `interp_scale` / `interp_method` / `mstar_mode` / `density` / `ival`.
- **Inverse Lookups** — `getInverseStp` / `getInverseCsda` / `getBraggPeakStp` are NOT
  present in `types.ts` (the service interface). No Range tab, no Inverse STP tab.
- **Custom Compounds** — `CustomCompound` and `StoredCompound` types exist in `types.ts`
  but `calculateCustomCompound()` and the inverse variants are NOT in the interface.
  No compound editor, no localStorage library, no entity-selection integration.
- **Build info badge** — footer has no commit hash / date / branch display. No
  `deploy.json` injection in `deploy.js`.
- **Export: advanced mode additions** — PNG export (advanced mode only), advanced-mode
  PDF metadata block, advanced-mode CSV config modal — all explicitly deferred in the
  plot-export session log (2026-05-04).
- **Multi-program polish** — drag-and-drop column reordering, delta/% tooltip —
  explicitly deferred in the multi-program session log (2026-05-04).
- **Formal URL parser** — `calculator-url.ts` and `plot-url.ts` handle basic params.
  Full ABNF conformance (from `shareable-urls-formal.md`) including `urlv` versioning,
  major-version mismatch warning, `material=custom` + `mat_*` params is NOT implemented.
  This is gated on Custom Compounds (6.10).

**Documents updated:**

1. `docs/00-redesign-plan.md` §8 Stage 6 — rewritten to match Stage 5 format: two
   tables (completed / remaining sub-stages), deferred-items notes, recommended
   implementation order.
2. `docs/ai-logs/prompts/2026-05-05-stage6-advanced-options.md` — detailed opencode
   task prompt for Stage 6.8 Advanced Options panel (6 tasks + AC checklist).

## Tasks

### Stage 6 audit + redesign plan update

- **Status:** completed
- **Stage:** Stage 6 (planning/documentation)
- **Files changed:**
  - `docs/00-redesign-plan.md` — Stage 6 section rewritten
  - `docs/ai-logs/prompts/2026-05-05-stage6-advanced-options.md` — new prompt
  - `docs/ai-logs/2026-05-05-stage6-audit.md` — this file
  - `CHANGELOG-AI.md` — new row prepended
- **Decision:** Recommended implementation order is 6.7 (Build info, standalone) →
  6.8 (Advanced Options) → 6.9 (Inverse Lookups, depends on 6.8) → 6.11 (Export
  advanced mode, depends on 6.8 for metadata block) → 6.10 (Custom Compounds) →
  6.12 (Multi-program polish) → 6.13 (Formal URL parser, depends on 6.10).
- **Issue:** Formal URL parser (6.13) cannot be fully tested without Custom Compounds
  (6.10), since `material=custom` is the only new grammar production. External data
  (`extdata=`) is deferred to Stage 7.
