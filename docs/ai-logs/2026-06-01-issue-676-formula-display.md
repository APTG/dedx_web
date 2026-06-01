# 2026-06-01 — Custom Compounds Formula Fallback

## Session Narrative

### Prompt 1: Work on https://github.com/APTG/dedx_web/issues/676, read issue description and the comment with implementation plan. Use gh tool to read github. Create branch first, then make commits. I will push. Ensure E2E tests pass. Add proper E2E tests for implemented features. Add AI logs. Ensure also static tests pass. work autonomously

**AI response**: Read issue #676. Created branch `qwen/issue-676-formula-display`. Modified `compound-derive.ts` to implement integer-ratio searches for derived formulas and fallback states. Updated `compound-editor-modal.svelte`, `mobile-sheet.svelte` and `formula-footer.svelte` to use raw atom counts inside weight fraction mode so they display derived formulas correctly and properly fallback to "no simple formula" when complex. Updated E2E test assertions to match the new visibility behavior. Fixed static typing issues. Ensured that `FormulaFooter` rendering logic correctly handles components conditionally based on mode without overriding the base elements themselves. All tests pass successfully.

## Tasks

### Implement formula display for mass-fraction compounds

- **Status**: completed
- **Stage**: Custom Compounds UI refinement (Issue #676)
- **Files changed**:
  - `src/lib/utils/compound-derive.ts`
  - `src/lib/components/compound-editor/formula-footer.svelte`
  - `src/lib/components/compound-editor-modal.svelte`
  - `src/lib/components/compound-editor/mobile-sheet.svelte`
  - `src/tests/unit/compound-derive.test.ts`
  - `tests/e2e/custom-compounds.spec.ts`
- **Decision**: Passed raw element entries (using their atomic ratios converted from mass percent) into `FormulaFooter` instead of previously normalized elements, allowing the heuristic to either find a scaled multiplier or gracefully fallback to "no simple formula". Exposed this logic via `displayElements` inside both the desktop modal and mobile sheet editors.
- **Issue**: None
