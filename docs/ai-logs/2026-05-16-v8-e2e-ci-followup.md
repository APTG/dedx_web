# 2026-05-16 — v8 E2E CI follow-up

## Session Narrative

### Prompt 1: fix PR #508 failing E2E tests

**AI response**: Investigated CI run `25940556416` using GitHub Actions logs.
Both Playwright shards were failing because several tests still used v7
combobox interactions after the v8 picker became default. The failures included
old `Particle` / `Program` role-button selectors, stale Plot program panel
queries, a mobile responsive assertion based on old vertically-stacked
comboboxes, custom-compound tests that clicked unstable autocomplete options,
and axe failures caused by `aria-controls` pointing to a collapsed/unmounted
v8 tab panel.

## Tasks

### Migrate remaining v7 E2E interactions to v8 test IDs

- **Status**: completed
- **Stage**: entity-selection v8
- **Files changed**:
  - `tests/e2e/particle-unit-switching.spec.ts`
  - `tests/e2e/plot.spec.ts`
  - `tests/e2e/calculator-url.spec.ts`
  - `tests/e2e/custom-compounds.spec.ts`
  - `tests/e2e/responsive.spec.ts`
- **Decision**: Replaced old role-button interactions with explicit v8 test IDs:
  `v8-tab-particle`, `v8-particle-search`, `v8-particle-item-*`,
  `v8-tab-program`, and `v8-program-item-*`. The responsive test now asserts
  that v8 tabs are visible and do not create horizontal overflow, rather than
  requiring Material to be vertically below Particle (that was a v7 combobox
  layout property).
- **Issue**: none.

### Stabilize custom-compound modal tests

- **Status**: completed
- **Stage**: entity-selection v8
- **Files changed**: `tests/e2e/custom-compounds.spec.ts`
- **Decision**: Removed clicks on transient Hydrogen autocomplete options in
  modal element fields; the tests now fill the symbol and blur the field, which
  matches other stable modal tests. Density assertions are scoped to the custom
  material row and accept the custom-compound `2.2000` formatting.
- **Issue**: none.

### Fix collapsed tab ARIA references

- **Status**: completed
- **Stage**: entity-selection v8
- **Files changed**:
  - `src/lib/components/v8/tab-bar.svelte`
  - `src/lib/components/v8/entity-selection-v8.svelte`
- **Decision**: Passed `panelOpen` into `TabBar` and only emits `aria-controls`
  for the active tab when the controlled tabpanel is mounted. This removes axe
  `aria-valid-attr-value` failures when Calculator auto-collapses the v8 panel.
- **Issue**: none.

### Validation

- **Status**: completed
- **Commands**:
  - `pnpm build`
  - `pnpm exec playwright test tests/e2e/particle-unit-switching.spec.ts tests/e2e/plot.spec.ts tests/e2e/responsive.spec.ts tests/e2e/calculator-url.spec.ts --project=chromium --reporter=line` → 27 passed, 4 skipped
  - `pnpm exec playwright test tests/e2e/custom-compounds.spec.ts --project=chromium --reporter=line` → 16 passed
  - `pnpm exec playwright test tests/e2e/accessibility.spec.ts --project=chromium --reporter=line` → 4 passed
  - `pnpm test src/tests/unit/entity-selection-v8.test.ts -- --runInBand` → 23 passed
- **Issue**: local Node is v20.20.2 while the project wants Node 24, so `pnpm`
  prints an engine warning; commands still completed successfully.
