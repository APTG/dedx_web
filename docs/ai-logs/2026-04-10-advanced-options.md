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

## Files Changed

| File | Change |
|------|--------|
| `docs/04-feature-specs/advanced-options.md` | **Created** — Draft v1; updated to Draft v2 |
| `CHANGELOG-AI.md` | Updated with this session (v1 and v2 entries) |
| `docs/ai-logs/2026-04-10-advanced-options.md` | **Created** — this log |

## Open Questions Raised

1. Plot series URL encoding for per-series advanced options (deferred v2).
2. `shareable-urls-formal.md` ABNF grammar update for 5 new params
   (deferred follow-on).
3. MSTAR mode A–H physical descriptions — consult libdedx source at
   implementation time.
