# 2026-04-21 — Stage 4 review-thread fixes

## Session Narrative

### Prompt 1: Apply PR review thread changes and update AI logs/changelog
**AI response**: Investigated current branch and review comments, checked GitHub Actions history for `develop` first and then `qwen/stage-4-scaffolding` (no relevant failing CI baseline found), then implemented requested fixes across routing/state/WASM/units/tests/assets with minimal scope.

### Prompt 2: Validate and finalize
**AI response**: Installed dependencies, ran lint/tests before and after edits, adjusted event-handler syntax to match current Svelte 5 lint rules, and documented pre-existing environment issues (`pnpm build` still fails because `vite` binary is missing from dependencies; `pnpm check` also traverses prototype configs with missing adapter dependency).

## Tasks

### PR review thread fixes
- **Status**: completed
- **Stage**: Stage 4
- **Files changed**:
  - `src/routes/+layout.svelte`
  - `src/routes/+error.svelte`
  - `src/routes/+page.ts`
  - `src/lib/state/calculation.svelte.ts`
  - `src/lib/state/selection.svelte.ts`
  - `src/lib/state/url-sync.ts`
  - `src/lib/units/energy.ts`
  - `src/lib/wasm/libdedx.ts`
  - `src/lib/export/csv.ts`
  - `src/tests/unit/energy-parser.test.ts`
  - `tests/e2e/basic.spec.ts`
  - `static/apple-touch-icon.png`
- **Decision**:
  - Kept `onclick` (not `on:click`) because current Svelte lint in this repo flags `on:click` as deprecated.
  - Switched URL writing to canonical keys (`particle`, `material`, `program`, `energies`, `eunit`, `urlv`) while keeping fallback reads for prior short keys.
  - Reworked WASM module typing to use `HEAP32`/`HEAPF64` and the returned program-list pointer; moved particle/material float fields to dedicated C API calls.
- **Issue**:
  - `pnpm build` remains blocked by missing `vite` binary in current dependency graph (pre-existing).
  - `pnpm check` still reports unrelated workspace/prototype config issues outside the PR review scope.
