# 2026-04-10 — Advanced Options Spec Draft v1

## Session Narrative

### Prompt 1: Initial brief and file reading
**AI response**: Read six source files as instructed —
`06-wasm-api-contract.md` §§2.3, 2.6, 3; `calculator.md` §4;
`unit-handling.md` §§5, 8; `external-data.md` §8.2; `multi-program.md`
§2; `shareable-urls.md` §7.3 — to build context before asking questions.
Identified five design areas requiring decisions: UI/placement, scope
(per-calculation vs per-series), aggregate state → unit coupling,
density/I-value validation, and URL encoding. Formulated 16 clarifying
questions grouped into 7 topics (A–G).

### Prompts 2–18: Interactive Q&A (one question per prompt)

User answered all 16 questions. Key decisions captured:

**UI / Placement (A)**
- Advanced Options is **gated behind the app-wide Advanced mode toggle**
  (not visible in Basic mode at all).
- Component type: **collapsible accordion**.
- Present on **all calculation pages** (Calculator, Plot, future).

**Scope (B)**
- In multi-program mode, options apply to **all programs simultaneously**;
  MSTAR mode is ignored for non-MSTAR programs.
- On the Plot page: **interpolation is retroactive** (redraws all series);
  aggregate state, density, I-value, and MSTAR mode are **forward-only**
  (frozen in series metadata at commit time).

**Aggregate state → units (C)**
- Overriding a gas material to condensed switches default display unit to
  keV/µm. Overriding a condensed material to gas switches to MeV·cm²/g.
  **Both directions confirmed.**
- Built-in state shown as a **tooltip on the "Default" option**.

**Density and I-value (D)**
- Density override feeds into **both WASM and display-unit conversion**
  (keV/µm and range-to-cm formulas).
- Built-in values shown as **placeholder text** in the input fields.
- **Physics-informed bounds**: density 0 < ρ ≤ 25 g/cm³;
  I-value 0 < I ≤ 10 000 eV.
- Switching material **clears all overrides**.

**MSTAR mode (E)**
- When non-MSTAR program active: **visible but disabled** (tooltip:
  "Only applies to MSTAR").
- Options: **single letters A–H**, B marked "(recommended)".
- Switching away from MSTAR **resets to B**.

**URL encoding (F)**
- Parameter names: `agg_state`, `interp`, `mstar_mode`, `density`, `ival`.
- Position: **after `qfocus`** in canonical ordering.
- **Silently dropped** in Basic mode.

**Reset / persistence (G)**
- **"Reset" button** present; clears all five options.
- Persists via **URL + localStorage**.

### Prompt 19: Spec written
**AI response**: Created `docs/04-feature-specs/advanced-options.md`
(Draft v1) covering:
- Panel overview (accordion, visibility gating, active-override badge)
- Five input controls with full field specs
- Reset button
- Behavior: placement wireframes, reactivity table, aggregate state →
  unit coupling, density scope, input validation tables, material-switch
  clearing rules, MSTAR program dependency, persistence (URL + localStorage)
- Output: effect on calculations, unit display, series metadata, active
  override badge
- URL state encoding: 5 new params, canonical ordering extension,
  round-trip stability rules, 3 canonical URL examples
- 12 acceptance criterion groups (AC-1 through AC-12, ~35 individual checks)
- 3 open questions (plot series URL encoding v2, formal grammar update,
  MSTAR mode descriptions)

### Prompt 20: Consistency review + v2 changes
**AI response**: Read the full spec, checked all cross-spec links (found
`plot.md` missing from related specs — added). Identified four categories
of requested changes:

1. **Density as primary use case** — moved density user story to first;
   density moved to §1 in Inputs; visual prominence via value in accordion
   header when collapsed.
2. **Aggregate state redesign** — removed "Default" option; replaced with
   2-option Gas/Condensed toggle plus a read-only "Built-in: Gas/Condensed"
   label above the toggle. Override is active when selected option differs
   from built-in.
3. **Gas density handling** — asked 5 interactive questions. Decisions:
   accept scientific notation (keep as typed); auto-format placeholder
   (sci notation below 0.01); ⓘ tooltip on label for gas materials only;
   lower bound removed (ρ > 0 only).
4. **Input reordering** — Density → I-value → Aggregate state →
   Interpolation → MSTAR mode.

Updated spec to Draft v2 with all changes applied.

### Prompt 21–22: Draft v3 changes (continued session)

**Prompt 21:** User requested two changes:
1. Density override explicitly available for any material type (gas, solid,
   or liquid) — not just gas. ⓘ tooltip should appear for all materials.
2. Interpolation redesigned from a single toggle into two orthogonal
   controls — **Axis scale** (Log-log / Lin-lin) and **Method** (Linear /
   Spline). Default: Log-log + Linear (matches libdedx C default). User
   asked for good naming for both options.

**Prompt 22 (AI response):** Applied all changes to Draft v3:

**Density changes:**
- Removed the gas-only restriction on the ⓘ tooltip.
- ⓘ now shown for all material types with context-specific messages:
  gas → P/T context; solid/liquid → bulk vs non-standard form (powder,
  pellets).
- AC-6 updated accordingly.

**Interpolation changes:**
- §4 replaced by §4a (Axis scale) + §4b (Method) with full property tables.
- Added a combination table (log-log+linear, lin-lin+linear, log-log+spline,
  lin-lin+spline) explaining each meaning.
- TypeScript `AdvancedOptions` interface: `interpolation` → `interpolationScale`
  + `interpolationMethod`. Omit rules updated.
- URL params: `interp` → `interp_scale` + `interp_method`.
- localStorage: `advancedOptions.interpolation` →
  `advancedOptions.interpScale` + `advancedOptions.interpMethod`.
- Reset table: "Interpolation mode" row split into "Axis scale" + "Method".
- Reactivity table: "Interpolation mode" row split; both are retroactive on Plot.
- Wireframes updated in Calculator and Plot sections.
- User story updated.
- AC-4, AC-10, AC-11 updated.
- Open Question #2 updated (six params instead of five).

**Cross-spec updates:**
- `docs/06-wasm-api-contract.md`: `InterpolationMode` replaced by
  `InterpolationScale` + `InterpolationMethod`; `INTERPOLATION_MODES`
  split into `INTERPOLATION_SCALES` + `INTERPOLATION_METHODS`; Q5
  resolution rewritten.
- `docs/04-feature-specs/external-data.md`: §8.2 updated to reference
  session-level `interpolationScale` + `interpolationMethod`; §13 Q2
  resolution updated.
- `docs/04-feature-specs/README.md`: summary updated to Draft v3.
- `CHANGELOG-AI.md`: v3 entry prepended.

### Prompts 23–25: Follow-up documentation alignment for Draft v4 and v5
**AI response**: Extended the session log to cover the remaining follow-on
documentation work that landed as Draft v4 and Draft v5 so the narrative
matches the published spec history. Completed the previously deferred
`shareable-urls-formal.md` ABNF update for the six advanced-option
URL parameters (`agg_state`, `interp_scale`, `interp_method`,
`mstar_mode`, `density`, `ival`), added the MSTAR mode A, B, C, D, G, H
descriptions to the Advanced Options spec, and clarified CSDA interpolation
behavior so the interpolation wording stays consistent across the
advanced-options, external-data, and WASM contract docs. Updated the
feature-spec index and changelog to reflect Draft v4 / Draft v5 completion
rather than leaving the work marked as deferred here.

**Additional cross-spec updates for Draft v4 / Draft v5:**
- `docs/04-feature-specs/advanced-options.md`: updated to Draft v4 and
  Draft v5; added MSTAR mode A/B/C/D/G/H physical descriptions; clarified
  CSDA interpolation text; density shown inline in Plot series labels.
- `docs/04-feature-specs/shareable-urls-formal.md`: promoted to Final v4;
  ABNF grammar updated for the six advanced-options query parameters;
  semantic rules, canonicalization step, and conformance vectors added.
- `docs/04-feature-specs/README.md`: shareable-urls-formal.md entry updated
  to Final v4; advanced-options.md summary updated to Draft v5 with
  corrected MSTAR mode set (A/B/C/D/G/H).
- `CHANGELOG-AI.md`: Draft v4/v5 entries aligned with this log.

### Prompt 26: Final review and promotion to Final v5
**AI response**: Performed a cross-spec consistency review of all files
changed in the branch. Found two inconsistencies and one log error:

1. **`docs/06-wasm-api-contract.md` §1 Design Decisions** — Interpolation
   row read "Log-log (default) and linear. Toggle in advanced settings."
   Updated to describe two orthogonal controls (axis scale + fitting method)
   and note that spline method is JS-only with JS-level CSDA integration.

2. **`docs/04-feature-specs/shareable-urls.md` §7.3** — Canonical ordering
   list stopped at step 6 (`mode`, `hidden_programs`, `qfocus`). Added
   step 7 for all six Advanced Options params (`agg_state`, `interp_scale`,
   `interp_method`, `mstar_mode`, `density`, `ival`).

3. **AI log** — duplicate "Prompt 19" heading at the Draft v4/v5 entry
   renumbered to "Prompts 23–25".

After applying fixes, promoted `advanced-options.md` from Draft v5 to
**Final v5** and updated `docs/04-feature-specs/README.md` accordingly.

## Files Changed

| File | Change |
|------|--------|
| `docs/04-feature-specs/advanced-options.md` | **Created** — Draft v1; updated to Draft v2; updated to Draft v3; extended in Draft v4 and Draft v5 with MSTAR mode A/B/C/D/G/H descriptions and CSDA interpolation clarification; promoted to **Final v5** |
| `docs/06-wasm-api-contract.md` | Updated — `InterpolationMode` → `InterpolationScale` + `InterpolationMethod`; interpolation terminology aligned with advanced options; STP vs CSDA comments clarified; §1 Design Decisions Interpolation row updated for two-control design |
| `docs/04-feature-specs/external-data.md` | Updated — §8.2 + §13 Q2 interpolation references; CSDA interpolation wording aligned |
| `docs/04-feature-specs/shareable-urls.md` | Updated — §7.3 canonical ordering extended with step 7 for Advanced Options params |
| `docs/04-feature-specs/shareable-urls-formal.md` | Updated — promoted to Final v4; ABNF grammar for `agg_state`, `interp_scale`, `interp_method`, `mstar_mode`, `density`, and `ival`; semantic rules; canonicalization step 7; 7 new conformance vectors |
| `docs/04-feature-specs/README.md` | Updated — shareable-urls-formal.md version to Final v4; advanced-options.md promoted to Final v5 |
| `CHANGELOG-AI.md` | Updated with this session (v1, v2, v3, v4, v5, and final review entries) |
| `docs/ai-logs/2026-04-10-advanced-options.md` | **Created** — this log; extended to include Draft v4 / Draft v5 follow-up work and final review |

## Open Questions Raised

1. Plot series URL encoding for per-series advanced options (still deferred
   from v2; no change in Draft v4 / Draft v5).
