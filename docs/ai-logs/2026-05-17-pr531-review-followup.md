# 2026-05-17 — PR #531 review follow-up (adaptive picker)

## Session Narrative

### Prompt 1: Apply PR review thread changes, fix failing mobile E2E, and add Stage 8 table entry

**AI response**: Investigated the failing CI run via GitHub Actions MCP (`list_workflow_runs` + failed job logs) and confirmed the failure was Playwright strict-mode ambiguity for `picker-particle-item-6` (duplicate match in base panel + mobile sheet). Applied all actionable review comments from the PR thread:

- `picker-sheet.svelte`: paired history `pushState` with cleanup `history.back()` on UI close; guarded popstate close path to avoid double-back; removed duplicated trailing `Z={z}` badge from particle rows.
- `entity-selection.svelte.ts`: removed unused `materialSubtab`, `scrollPositions`, and `setMaterialSubtab` API/state.
- `material-tab.svelte`: made Compounds/Elements (and Custom) pill counts consistent when searching; replaced lint-suppressing placeholder variable with `void filteredActive`.
- `grouped-result-list.svelte`: removed redundant always-true conditional for Custom section.
- `program-inline-list.svelte` + `program-tab.svelte`: removed hard-coded auto-select object cast and wired auto-select through `selectionState.selectProgram(-1)` callback.
- `tests/e2e/mobile-picker.spec.ts`: scoped the carbon result locator to `picker-sheet` to avoid strict-mode duplicate matches.
- `docs/00-redesign-plan.md`: added PR #531 row to Stage 8 PR table.
- `.opencode/lessons-learned.md`: added entry on overlay test-id scoping for strict Playwright selectors.

Validation performed:

- `corepack pnpm lint` ✅
- `corepack pnpm test` ✅ (1368 total tests: 1365 passed, 3 skipped)
- `corepack pnpm build` ✅
- `corepack pnpm exec playwright test tests/e2e/mobile-picker.spec.ts --project=chromium` ⚠️ local run blocked by missing `static/wasm/libdedx.mjs` in this environment (continuous 404s from preview server), so full E2E confirmation relies on CI where WASM artifacts are downloaded.

## Tasks

### PR #531 review thread remediation

- **Status**: completed
- **Stage**: Stage 8 / mobile
- **Files changed**:
  - `src/lib/components/entity-selection/picker-sheet.svelte`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/components/entity-selection/grouped-result-list.svelte`
  - `src/lib/components/entity-selection/program-inline-list.svelte`
  - `src/lib/components/entity-selection/program-tab.svelte`
  - `src/lib/state/entity-selection.svelte.ts`
  - `tests/e2e/mobile-picker.spec.ts`
  - `docs/00-redesign-plan.md`
  - `.opencode/lessons-learned.md`
  - `CHANGELOG-AI.md`
- **Decision**: kept duplicated `data-testid` values in UI but fixed E2E by explicit container scoping (`picker-sheet`) because overlay + base panel are intentionally both mounted.
- **Issue**: local Playwright verification was constrained by missing WASM static artifacts; no app-code workaround added.
