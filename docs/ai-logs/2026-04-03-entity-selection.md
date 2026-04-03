# 2026-04-03 — Entity Selection Feature Spec

## Session Narrative

### Prompt 1: Write feature spec for entity selection
**User request**: Read `00-redesign-plan.md` and `01-project-vision.md` for context, then write the entity selection feature spec using the `write-spec` prompt template.

**AI response**: Read all relevant context files in parallel:
- `docs/00-redesign-plan.md` — full redesign plan with feature spec template (§7), stage plan, architecture
- `docs/01-project-vision.md` — design principles (auto-select, minimum clicks, typeahead, unit handling)
- `.github/prompts/write-spec.prompt.md` — spec template and rules
- `docs/06-wasm-api-contract.md` — `LibdedxService` interface, entity types, C function exports
- `src/Backend/WASMWrapper.js` — old WASM wrapper showing `getPrograms()`, `getIons()`, `getMaterials()` patterns
- `src/Components/WithLibdedxEntities.js` — old cascading logic (program → ions + materials re-fetch, selection preservation)
- `src/Components/Pages/Plot/Form.js` — old dropdown UI pattern
- `src/Components/Pages/Data/Calculator.js` — old calculator with entity selection integration
- `src/Backend/Utils.js` — stopping power units definition
- `libdedx/include/dedx.h` — program IDs (DEDX_PSTAR=2, DEDX_ICRU=9, etc.), MSTAR modes
- `libdedx/include/dedx_elements.h` — ion/material ID enums

**Key decisions made during drafting:**
1. **Auto-select is a frontend construct** — uses `DEDX_ICRU` (ID 9) for fetching ion/material lists but displays as a synthetic "Auto-select" entry with resolved name.
2. **Cascading: Program → {Ions, Materials}** — ion and material are siblings, not cascaded from each other. This matches the old code pattern.
3. **Selection preservation on program change** — if the previously selected ion/material exists in the new program's list, keep it; otherwise fall back + notify. Taken from `WithLibdedxEntities.findEntities()` pattern.
4. **Typeahead search** — inspired by ATIMA reference from project vision §4.2. Ion aliases ("proton", "alpha") are a frontend config, not from libdedx.
5. **Electron special case** — ion ID 1001 only available under ESTAR (program ID 3).
6. **Auto-select resolved display** — subtle label "Auto-select → ICRU 90" below selector, per progressive disclosure principle.
7. **Mobile layout** — stacked vertical on <768px, matching Tailwind responsive breakpoints.

Wrote `docs/04-feature-specs/entity-selection.md` with all sections from the template plus additional sections for UI layout, accessibility, dependencies, and open questions.

## Tasks

### Write entity-selection.md feature spec
- **Status**: completed
- **Stage**: Stage 1 (Requirements & Specifications)
- **Files changed**: `docs/04-feature-specs/entity-selection.md` (created)
- **Decision**: Auto-select uses DEDX_ICRU (ID 9) for list fetching; the sentinel ID is -1 (never sent to C API). Ion aliases defined as a static TS config file rather than embedded in WASM.
- **Issue**: Three open questions at end of spec (auto-select display style, material grouping, dropdown max height) — needs user input.
