# 2026-04-07 — unit-handling

## Session Narrative

### Prompt 1: Start Stage 1 unit conversion finalization for dEdx Web
**User request summary**:
- Compare unit-related docs: `unit-handling.md`, `calculator.md`, `plot.md`, `06-wasm-api-contract.md`.
- List inconsistencies in unit naming/symbols, formulas, density usage, defaults, rounding/formatting, export behavior.
- Define one canonical conversion contract and apply it to affected specs.
- Add explicit numeric acceptance examples for each conversion path.
- Keep Calculator and Plot behavior intentionally separated where needed, but mathematically consistent.
- Update changelog/session logs.

**AI response/actions**:
1. Read all requested specs and API contract, plus required logging/index docs.
2. Identified key contradictions:
   - `unit-handling.md` had conflicting per-row→master transition wording.
   - `calculator.md` claimed SI auto-scaling for stopping power while `unit-handling.md` specified fixed selected units.
   - `calculator.md` export section said CSV matches table but listed only 3 columns.
   - `plot.md` used non-canonical URL unit tokens and had a mobile wireframe unit label typo (`cm²/g` missing `MeV`).
   - `06-wasm-api-contract.md` contradicted itself on electron `massNumber` (0 vs 1).
3. Applied a canonical Stage 1 conversion contract in `unit-handling.md` and synchronized related specs.
4. Added explicit numeric fixtures for energy, stopping power, and CSDA range conversion paths.
5. Updated changelog and AI log indexes.

## Tasks

### Canonical conversion contract finalization across specs
- **Status**: completed
- **Stage**: 1
- **Files changed**:
  - `docs/04-feature-specs/unit-handling.md`
  - `docs/04-feature-specs/calculator.md`
  - `docs/04-feature-specs/plot.md`
  - `docs/06-wasm-api-contract.md`
  - `docs/04-feature-specs/README.md`
- **Decision**:
  - Keep intentional default split:
    - Calculator: phase-based automatic stopping-power default.
    - Plot: user-selected global stopping-power unit with fixed default.
  - Keep formulas identical across pages and density-aware per material/series.
  - Adopt canonical plot URL `stp_unit` tokens: `kev-um`, `mev-cm`, `mev-cm2-g`.
- **Issue**:
  - `unit-handling.md` remains Draft pending product decisions in open questions (MeV/u exposure, advanced aggregate override interaction).

### Acceptance fixtures and export/formatting alignment
- **Status**: completed
- **Stage**: 1
- **Files changed**:
  - `docs/04-feature-specs/unit-handling.md`
  - `docs/04-feature-specs/calculator.md`
  - `docs/04-feature-specs/plot.md`
- **Decision**:
  - Added normative numeric examples for:
    - all energy conversion paths,
    - all stopping-power display paths,
    - CSDA range conversion and auto-scaling checks.
  - Clarified calculator CSV schema to exactly match the 5-column unified table.
- **Issue**:
  - Dedicated `export.md` still pending for broader cross-page export policy details.

### Session logging updates
- **Status**: completed
- **Stage**: 1
- **Files changed**:
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-04-07-unit-handling.md`
- **Decision**:
  - Added detailed log (non-trivial multi-file decision-heavy session).
- **Issue**:
  - None.
