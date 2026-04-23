# 2026-04-23 — Stage 5 E2E timeout investigation (compact selector overlap)

## Session Narrative

### Prompt 1: Investigate stalled E2E timeout and suspicious screenshot state

**AI response**: Inspected GitHub Actions runs for `develop` (all green) and then the branch `qwen/stage-5-tdd` (CI failed in Playwright). Pulled failed job logs and identified root cause: Playwright clicks on Particle timed out because the Material combobox was intercepting pointer events due selector overlap in desktop layout.

### Prompt 2: Verify WASM usage and provide corrected UI evidence

**AI response**: Reproduced locally with CI WASM artifacts and verified failing cases were pointer-intercept related. Reworked compact selector container layout to a 3-column desktop grid (still one row, no overlap), added a unit regression test for layout classes, reran unit/build checks, reran the previously failing E2E scenarios with WASM present, and captured an updated screenshot with populated combobox values.

## Tasks

### CI failure diagnosis

- **Status**: completed
- **Stage**: 5
- **Files changed**: none (diagnostic)
- **Decision**: used job logs from failing workflow run `24844009839` and focused on `E2E Tests (Playwright)` job `72728581169` to isolate the exact pointer intercept chain.
- **Issue**: local sandbox occasionally resolves WASM module as `/wasm/libdedx` (without extension), so a temporary local shim was needed for E2E replay only.

### Overlap fix for compact selector row

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `src/lib/components/entity-selection-comboboxes.svelte`
  - `src/tests/unit/entity-selection-comboboxes.test.ts`
- **Decision**: replaced flex-nowrap row with `lg:grid-cols-3` desktop grid to keep one-row layout while eliminating overlap-induced pointer interception.
- **Issue**: none.

## Validation

- `corepack pnpm test -- entity-selection-comboboxes` ✅ (175 tests)
- `corepack pnpm build` ✅
- `pnpm exec playwright test tests/e2e/entity-selection.spec.ts -g "typing carbon|selecting Carbon|Reset all link|Electron \(ESTAR\)"` ✅ (with CI WASM artifacts present)
