# 2026-05-13 — PR #464 Review Follow-ups

## Session Narrative

### Prompt 1: Apply PR #464 review feedback

**AI response**: Reviewed the PR comment asking for stronger WASM error handling, Playwright exploration of weird inputs, spec/doc consistency updates, redesign-plan PR linkage, and AI logging. Checked recent commits, progress docs, the AI changelog, lessons learned, and current CI state. Downloaded the CI-built WASM artifact for local browser checks and used Playwright to explore calculator advanced-mode out-of-range behavior.

### Prompt 2: Harden multi-program range pre-check behavior

**AI response**: Reproduced the class of issue with alpha + MSTAR/ASTAR comparison: an energy can be safe for MSTAR but outside ASTAR's tabulated range. Updated the multi-program calculation effect so the range pre-check creates per-program `LibdedxError(101, ...)` results for unsafe programs and still calculates safe programs, avoiding stale or unexplained comparison cells. Added an E2E regression covering the safe-program numeric result plus out-of-range comparison-program warning.

### Prompt 3: Synchronize docs and validation

**AI response**: Updated calculator and multi-program specs to describe per-program range pre-check errors, added PR #464 and the behavior summary to the redesign-plan Stage 7 table, extended the Stage 7.4 progress note, and added a lessons-learned entry for pre-checks that must write visible error state. Validated with `pnpm build` and targeted Playwright regression.

## Tasks

### Multi-program WASM error handling review fix

- **Status**: completed
- **Stage**: 7.4
- **Files changed**:
  - `src/routes/calculator/+page.svelte`
  - `tests/e2e/calculator-advanced.spec.ts`
  - `docs/00-redesign-plan.md`
  - `docs/04-feature-specs/calculator.md`
  - `docs/04-feature-specs/multi-program.md`
  - `docs/progress/stage-7.4.md`
  - `.opencode/lessons-learned.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-05-13-pr464-review-followups.md`
- **Decision**: Represent pre-check failures as the same per-program `LibdedxError` shape used by `calculateMulti()` failures, then call WASM only for safe programs.
- **Issue**: None.
