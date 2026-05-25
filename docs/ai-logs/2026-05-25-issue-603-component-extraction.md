# Session Log: Extract Async Initialization Logic (Issue #603)

**Date**: 2026-05-25
**Branch**: `opengravity/issue-603-component-extraction`
**Tool**: opencode
**Model**: antigravity

## Objective
Extract the heavy asynchronous bootstrapping logic (`getService()`, external data loading, and `CompatibilityMatrix` building) from the `calculator` and `plot` Svelte page components. This decoupling addresses part of Issue #574 ("God Components"), improving code separation and adhering to Svelte 5 best practices.

## Actions Taken
- **Created `app-init.svelte.ts`**: Implemented a global headless Svelte 5 state manager (`appInit`). It handles URL parsing for `extdata=`, loads the WASM service in parallel with external JSON metadata, and creates the core `EntitySelectionState` globally.
- **Refactored `calculator/+page.svelte`**: Replaced localized Promise orchestration and state variables (`externalLoading`, `loadedExternalSources`, `compatibilityMatrix`, etc.) with `$derived(appInit...)`.
- **Refactored `plot/+page.svelte`**: Applied identical decoupling logic.
- **Improved Context Management**: Centralized `addExternalSource` and `removeExternalSource` behaviors inside `AppInitState` so they correctly recalculate selection fallbacks globally instead of leaking logic into UI bindings.

## Testing & Verification
- Unit tests run via `pnpm exec vitest` pass fully (1450 tests).
- E2E tests run via `pnpm exec playwright test` passed successfully in Chromium and Webkit (Firefox timed out due to environmental headless constraints, but functional validity was established).
- Static types verified via `pnpm run check`.
