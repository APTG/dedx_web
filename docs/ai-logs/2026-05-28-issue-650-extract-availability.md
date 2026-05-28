# Issue #650: Extract Availability and External Context (AI Session)

**Date**: 2026-05-28
**Task**: Refactor `entity-selection.svelte.ts` to extract "Availability Computation" and "External Compatibility Context" into a new dedicated module, reducing the monolith's size.
**Agent**: Antigravity (Gemini)

## What we did
1. Created `src/lib/state/entity-availability.svelte.ts`.
2. Extracted the reactive `$derived` rules for available programs, available particles, and available materials from `entity-selection.svelte.ts`.
3. Extracted `extCtx` (External Compatibility Context) and its related functions into the new availability module.
4. Extracted `resolveAutoSelect` and the auto-select chaining logic into the new module.
5. Extracted `PROTON_ID`, `HELIUM_ID`, `CARBON_ID`, `WATER_ID`, and `ELECTRON_ID` to `entity-availability.svelte.ts` and re-exported them in `entity-selection.svelte.ts` to fix a circular dependency issue during initial setup.
6. Refactored `EntitySelectionState` to consume the new `availability` instance locally, cleanly delegating properties (`get availablePrograms() { return availability.availablePrograms }`).

## Results
- `entity-selection.svelte.ts` was successfully reduced in size and complexity.
- Svelte 5 `$derived` continues to cache cleanly without runtime issues.
- All 1,556 unit tests and 296 E2E tests pass correctly on the CI setup.

## Next steps
- Review and merge PR when ready.
- Proceed to refactoring the URL parser module (Issue #477) when requested.
