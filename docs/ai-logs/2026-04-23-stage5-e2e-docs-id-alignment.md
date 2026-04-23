# 2026-04-23 — Stage 5 E2E + docs + ID alignment follow-up

## Session Narrative

### Prompt 1: Fix failing E2E tests, update stale testing docs, align IDs, and add better TS comments

**AI response**: Investigated CI failures using GitHub Actions logs (develop first, then branch). Confirmed latest failing job was Playwright E2E with strict-locator ambiguity (`getByRole(... /particle/i)` matched both trigger and new clear button).

### Prompt 2: Apply E2E + ID-consistency + documentation corrections

**AI response**: Updated E2E selectors to target exact combobox trigger names (`^Particle$`, `^Material$`, `^Program$`) to avoid strict-mode collisions. Updated stale `docs/07-testing-strategy.md` sections to reflect active CI workflow/jobs and current test composition (Vitest integration scope vs WASM runtime verification in `wasm/verify.mjs`).

### Prompt 3: Align auto-select constants and mocks with runtime IDs from verify.mjs

**AI response**: Normalized Stage 5 state constants and test/mock program IDs to runtime-validated mapping (`ASTAR=1`, `PSTAR=2`, `ESTAR=3`, `MSTAR=4`, ICRU family unchanged). Reworked auto-select chain to runtime-available programs and updated all touched mocks/unit expectations accordingly.

### Prompt 4: Add better TypeScript comments with spec references

**AI response**: Added explicit references in state/matrix TypeScript code to `docs/04-feature-specs/entity-selection.md`, `docs/06-wasm-api-contract.md`, and `wasm/verify.mjs` lines validating program IDs and DEDX_ICRU exclusion behavior.

## Tasks

### Fix Playwright strict-locator failure

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `tests/e2e/entity-selection.spec.ts`
- **Decision**: Use exact trigger-name locators (`/^Particle$/`) instead of broad `/particle/i` matching to avoid collisions with clear-button aria labels.
- **Issue**: Local full Playwright validation is blocked without CI-provided WASM artifact unless submodule build prerequisites are fully available.

### Align runtime program IDs in state + mocks

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `src/lib/state/entity-selection.svelte.ts`
  - `src/lib/wasm/__mocks__/libdedx.ts`
  - `src/tests/unit/compatibility-matrix.test.ts`
  - `src/tests/unit/entity-selection-state.test.ts`
  - `src/tests/unit/entity-selection-comboboxes.test.ts`
- **Decision**: Use runtime-verified IDs from `wasm/verify.mjs` checks (ASTAR=1, PSTAR=2, ESTAR=3, MSTAR=4) and keep ICRU IDs from contract stats.
- **Issue**: Entity-selection spec text still contains historical ICRU90 wording; code now follows runtime-available IDs.

### Update stale testing strategy documentation

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `docs/07-testing-strategy.md`
- **Decision**: Replace outdated "no active CI / Stage 8 target" wording with current CI matrix and real job behavior from `.github/workflows/ci.yml`.
- **Issue**: none.

### Add spec-referenced TS comments

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `src/lib/state/entity-selection.svelte.ts`
  - `src/lib/state/compatibility-matrix.ts`
  - `src/lib/components/entity-selection-comboboxes.svelte`
- **Decision**: Keep comments concise and rationale-focused with explicit doc path references for maintainability.
- **Issue**: none.
