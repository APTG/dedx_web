# 2026-05-11 — PR #452 Stage 6.12 Review Follow-ups

**Model:** (GPT-5.5 via GitHub Copilot coding agent)

## Session Narrative

### Prompt 1: Apply PR review comments and clean committed artifacts

**AI response**: Investigated the PR review feedback for Stage 6.12 multi-program polish, checked recent CI workflow state, reproduced the local validation baseline, removed stray committed root files, moved the raw opencode session transcript into `docs/ai-logs/`, and applied the ResultTable/E2E fixes requested in the review thread.

## Tasks

### ResultTable review fixes

- **Status**: completed
- **Stage**: 6.12
- **Files changed**: `src/lib/components/result-table.svelte`, `src/lib/utils/delta.ts`, `src/routes/calculator/+page.svelte`, `src/tests/unit/delta-tooltip.test.ts`
- **Decision**: Kept the default program header focusable with `aria-disabled="true"`, but made drag/drop handlers return early for the default column and for null `dataTransfer`.
- **Issue**: None.

### E2E and artifact cleanup

- **Status**: completed
- **Stage**: 6.12
- **Files changed**: `tests/e2e/calculator-advanced.spec.ts`, `docs/ai-logs/2026-05-11-stage6-12-multi-program-polish-qwen-session.md`, `docs/ai-logs/README.md`, `.opencode/lessons-learned.md`, `CHANGELOG-AI.md`
- **Decision**: Reworked the Stage 6.12 E2E coverage to use the real runtime program IDs and observable outcomes (header order, URL state, and aria-live text) instead of placeholder IDs or invented drag state attributes.
- **Issue**: Local pre-change Playwright execution was blocked until browsers were installed in the sandbox; validation after fixes installed them and ran the targeted spec.
