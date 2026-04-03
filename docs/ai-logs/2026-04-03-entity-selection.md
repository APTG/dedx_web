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
1. **Auto-select is a frontend construct** — displays as a synthetic "Auto-select" entry with resolved program name (e.g., "Auto-select → ICRU 90"). `DEDX_ICRU` (ID 9) is used internally only for **resolution** (mapping ion type to concrete ICRU dataset), **not** for building the full ion/material lists.
2. **Cascading: Program → {Ions, Materials}** (v1 design) — ion and material were siblings, not cascaded from each other. This matched the old code pattern. **Superseded in v2** by bidirectional filtering via a compatibility matrix (all programs iterated at init).
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
- **Decision**: Auto-select sentinel ID is -1 (never sent to C API). `DEDX_ICRU` (ID 9) is used only for **program resolution** (mapping ion→concrete ICRU dataset), not for building ion/material lists — those come from iterating all programs via the compatibility matrix (added in v2). Ion aliases defined as a static TS config file rather than embedded in WASM.
- **Issue**: Three open questions at end of spec (auto-select display style, material grouping, dropdown max height) — needs user input. Material grouping resolved in v3 (split panel).

### Review v3 spec for consistency
- **Status**: completed
- **Stage**: Stage 1
- **Files changed**: none (analysis only)
- **Decision**: Identified 6 consistency issues: (1) ICRU 90 is not a separate program in libdedx — `DEDX_ICRU` meta-program resolves internally; (2) `DEDX_ICRU` and `DEDX_DEFAULT` overlap with Auto-select; (3) `DEDX_BETHE_EXT00` not enumerated in spec; (4) "Liquid Water" vs "Water (liquid)" naming inconsistency; (5) `IonEntity` lacks `symbol` field for display format; (6) project vision §4.2 says "typeahead/autocomplete" but v3 uses always-visible panels.
- **Issue**: All raised as questions to user. Proposed 3 alternative layouts (A: narrower program panel, B: collapsible program, C: compact calculator mode).

### Update spec to v4 with two layout modes
- **Status**: completed
- **Stage**: Stage 1
- **Files changed**: `docs/04-feature-specs/entity-selection.md` (updated UI Layout section + Acceptance Criteria)
- **Decision**: Full panels for Plot page (sidebar ~40% + canvas ~60%), compact dropdown comboboxes for Calculator page (centered form, max 720px). Program panel de-emphasized with narrower width (~180px in compact, shorter height ~150px in full panels). Both modes share same `EntitySelectionState` store. Layout mode determined by route, not user toggle. UX rationale added citing Fitt's Law, context-appropriate density (NNG), progressive disclosure, F-pattern scanning.

### Prompt 4: Resolve open questions (v5)
**User request**: (1) Use "ICRU 90" enriched name, (2) hide `DEDX_ICRU` from program panel, (3) add `symbol` to `IonEntity`, (4) update project vision §4.2.

**AI response**: Applied all four changes across three files.

### Update spec to v5 — resolve open questions
- **Status**: completed
- **Stage**: Stage 1
- **Files changed**: `docs/04-feature-specs/entity-selection.md`, `docs/06-wasm-api-contract.md`, `docs/01-project-vision.md`
- **Decision**: (1) Resolved label shows frontend-enriched "ICRU 90" not raw C name "ICRU". (2) `DEDX_ICRU` (ID 9) hidden from program panel — Auto-select covers its function. (3) `IonEntity.symbol: string` added to WASM API contract. (4) Project vision §4.2 updated to describe dual-mode entity selection (panels for Plot, dropdowns for Calculator).
