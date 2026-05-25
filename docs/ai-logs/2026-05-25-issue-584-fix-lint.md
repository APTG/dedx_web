# 2026-05-25 — Fix lint errors (issue #584)

## Session Narrative

### Prompt 1: Fix all lint errors reported in issue #584

**AI response**: Five ESLint problems were fixed across four files:

1. `particle-tab.svelte` — removed unused `getParticleLabel` import (only `getParticleListLabel` and `getParticleSearchText` are used).
2. `jsroot-plot.svelte` (×2) — replaced `delete g[JSROOT_PROMISE_KEY]` with `Reflect.deleteProperty(g, JSROOT_PROMISE_KEY)` to satisfy `@typescript-eslint/no-dynamic-delete`; semantics are identical.
3. `+page.svelte` — removed unused `RANGE_ANCHOR_OPTIONS` constant (range unit anchor strip is not yet wired up in the page).
4. `calculator-advanced.spec.ts` — removed unused `ICRU73_OLD_ID` constant.

`pnpm lint` exits 0 after the fix. The three pre-existing `guard-forbidden-files` unit test failures are unrelated.

## Tasks

### Fix ESLint errors and warnings from issue #584

- **Status**: completed
- **Stage**: CI / infra
- **Files changed**:
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/jsroot-plot.svelte`
  - `src/routes/calculator/+page.svelte`
  - `tests/e2e/calculator-advanced.spec.ts`
- **Decision**: Used `Reflect.deleteProperty` instead of disabling the rule — it is the standard lint-clean alternative for dynamic property deletion.
- **Issue**: none
