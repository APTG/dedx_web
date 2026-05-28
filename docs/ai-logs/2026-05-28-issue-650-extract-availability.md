# 2026-05-28 — Extract Availability and External Context (Issue #650)

## Session Narrative

### Prompt 1: Extract Availability and External Context

**AI response**:
- Created `src/lib/state/entity-availability.svelte.ts`.
- Extracted the reactive `$derived` rules for available programs, available particles, and available materials from `entity-selection.svelte.ts`.
- Extracted `extCtx` (External Compatibility Context) and its related functions into the new availability module.
- Extracted `resolveAutoSelect` and the auto-select chaining logic into the new module.
- Extracted `PROTON_ID`, `HELIUM_ID`, `CARBON_ID`, `WATER_ID`, and `ELECTRON_ID` to `entity-availability.svelte.ts` and re-exported them in `entity-selection.svelte.ts` to fix a circular dependency issue during initial setup.
- Refactored `EntitySelectionState` to consume the new `availability` instance locally, cleanly delegating properties (`get availablePrograms() { return availability.availablePrograms }`).

## Tasks

### Refactoring Availability and External Context

- **Status**: completed
- **Stage**: Technical Debt / Maintenance
- **Files changed**:
  - `src/lib/state/entity-availability.svelte.ts`
  - `src/lib/state/entity-selection.svelte.ts`
  - `docs/ai-logs/2026-05-28-issue-650-extract-availability.md`
  - `CHANGELOG-AI.md`
- **Decision**: Extracted availability computation into a dedicated Svelte 5 state module to reduce the monolith's size.
- **Issue**: #650
