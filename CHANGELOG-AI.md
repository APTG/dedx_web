# AI Changelog

> This changelog tracks all AI-assisted coding sessions on this project.
> Each entry links to a detailed session log in `docs/ai-logs/`.
>
> **Note:** AI-assisted work on this project began on 1 April 2026 with
> the creation of the redesign plan (`docs/00-redesign-plan.md`). Those
> early planning sessions pre-date this changelog and are not recorded here.
> This log starts from 3 April 2026 when the AI changelog system was introduced.

| Date | Stage | Description | Log |
|------|-------|-------------|-----|
| 2026-04-08 | 1 | Add multi-program feature spec skeleton and sync spec/log indexes | [log](docs/ai-logs/2026-04-08-multi-program.md) |
| 2026-04-07 | 1 | Mark unit-conversion specs final: set unit-handling.md to Final v3 and sync docs/04-feature-specs/README.md status table | — |
| 2026-04-07 | 1 | Unit-contract clarification follow-up: ion vs electron WASM energy-call rule, calculator CSV schema wording cleanup, explicit no-thousands-separator formatting for normative fixtures | — |
| 2026-04-07 | 1 | Stage 1 unit conversion finalization: canonical conversion contract across unit-handling/calculator/plot/WASM docs, fixed formula/default/export inconsistencies, added numeric acceptance fixtures | [log](docs/ai-logs/2026-04-07-unit-handling.md) |
| 2026-04-07 | 1 | Plot page spec Final v1: fix 6 issues (README status, typo, resolvedProgramId→programId, mobile wireframe unit, acceptance criteria wording, a11y swatch) and mark as final | [log](docs/ai-logs/2026-04-07-plot.md) |
| 2026-04-07 | 1 | Plot page spec v2: 9 UX improvements — palette starts at red, series list below canvas, mobile collapsed panels, stp unit segmented control, post-add hint, reset confirmation, export in controls bar, 360px sidebar, 16px swatches | [log](docs/ai-logs/2026-04-07-plot.md) |
| 2026-04-07 | 1 | Plot page spec v1: multi-series JSROOT chart, preview series, smart labels, color palette, full panel entity selection, 500-point log grid, keV/µm default, axis scale controls, PNG/CSV export, URL-encoded series | [log](docs/ai-logs/2026-04-07-plot.md) |
| 2026-04-07 | 1 | Spec consistency fixes: fix keV/µm conversion factor (×10→/10), fix CSDA auto-scaling thresholds, fix wireframe values, fix emoji/typos, sync wireframes across specs, clarify dropdown vs suffix behavior, add cross-spec consistency rule to copilot-instructions | — |
| 2026-04-07 | 1 | Major UX redesign: unified input/result table, keV/µm default output, SI prefix auto-scaling, per-row unit detection, material phase badge. Rewrote unit-handling.md v2 and calculator.md v5. | [log](docs/ai-logs/2026-04-07-unified-table-redesign.md) |
| 2026-04-07 | 1 | Rename `IonEntity` → `ParticleEntity` across all specs/contract, rename `ionId` → `particleId` in `LibdedxService`, rewrite terminology note, add Terminology doc TODO | [log](docs/ai-logs/2026-04-03-calculator.md) |
| 2026-04-07 | 1 | Spec cleanup: rename state fields/URL params/wireframe labels `ion`→`particle`, add docs READMEs, migrate changelog to table | [log](docs/ai-logs/2026-04-03-calculator.md) |
| 2026-04-07 | 1 | Cross-spec terminology fix: "ion" → "particle" across all specs for electron/proton/heavy-ion inclusivity | [log](docs/ai-logs/2026-04-03-calculator.md) |
| 2026-04-07 | 1 | Calculator spec v3: extract unit logic to unit-handling.md stub, add electron support, inline unit detection | [log](docs/ai-logs/2026-04-03-calculator.md) |
| 2026-04-07 | 1 | Calculator spec v2: fix energy-unit recalc contradiction, align per-line validation, clarify URL vs textarea format | [log](docs/ai-logs/2026-04-03-calculator.md) |
| 2026-04-03 | 1 | Entity-selection spec marked Final v5 after cross-review with calculator.md | [log](docs/ai-logs/2026-04-03-calculator.md) |
| 2026-04-03 | 1 | Calculator page spec v1: energy input, live calculation, result table, compact entity selection, responsive layout | [log](docs/ai-logs/2026-04-03-calculator.md) |
| 2026-04-03 | 1 | Entity-selection spec v3: Particle→Material→Program order, greyed-out items, split material panel, bidirectional filtering | [log](docs/ai-logs/2026-04-03-entity-selection.md) |
| 2026-04-03 | 1 | Entity-selection spec v5: resolve open questions (ICRU 90 display, hide DEDX_ICRU, add IonEntity.symbol) | [log](docs/ai-logs/2026-04-03-entity-selection.md) |
| 2026-04-03 | 1 | Entity-selection spec v4: two layout modes (full panels for Plot, compact comboboxes for Calculator) | [log](docs/ai-logs/2026-04-03-entity-selection.md) |
| 2026-04-03 | 1 | Write entity-selection feature spec (docs/04-feature-specs/entity-selection.md) | [log](docs/ai-logs/2026-04-03-entity-selection.md) |
| 2026-04-03 | 1 | Draft project vision (01-project-vision.md), units design principle, update redesign plan | [log](docs/ai-logs/2026-04-03-project-vision.md) |
| 2026-04-03 | 0 | Set up AI session logging (CHANGELOG-AI.md, session log format, copilot-instructions update) | [log](docs/ai-logs/2026-04-03-ai-changelog-setup.md) |
