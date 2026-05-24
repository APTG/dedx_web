# 2026-05-24 — PR #572 CI/export follow-up

## Session Narrative

### Prompt 1: Fix the new failing CI E2E job, check all E2E tests, and also implement issue #573

**AI response**: Investigated the cited Actions job and confirmed the fresh CI failures came from `tests/e2e/export-advanced.spec.ts` still targeting the old single-program Advanced DOM (`energy-input-0`, `result-table`, `stp-cell-*`) after `TableAdvanced` became the single-program Advanced view. Read issue #573 and confirmed the user-guide example links still emitted `urlv=1`, causing the newer-version warning the issue described.

### Prompt 2: Reproduce and widen validation

**AI response**: Reinstalled repo dependencies, redownloaded the `wasm-binaries` CI artifact into `static/wasm`, installed Playwright browsers locally, and reran the failing export suite. After the initial export fix passed, ran the full Playwright matrix and used the live `test-results/` failures to isolate additional stale single-program Advanced selectors and one real Advanced single-program recalculation regression.

### Prompt 3: Apply the smallest complete fix set

**AI response**: Updated `export-advanced.spec.ts`, `calculator.spec.ts`, `advanced-options.spec.ts`, `calculator-advanced.spec.ts`, `complex-interactions.spec.ts`, `particle-unit-switching.spec.ts`, and `url-parser.spec.ts` to the current Advanced single-table contract (`advanced-*` selectors / current inline-unit behavior). Fixed a production regression in `src/routes/calculator/+page.svelte` so Advanced single-program mode still uses `calcState.triggerCalculation()` for advanced-option changes while true multi-program compare continues to use the multi-program effect. Updated `src/lib/utils/external-data-example-urls.ts` and `src/routes/docs/user-guide/+page.svelte` to emit `urlv=2` example URLs and added extra basic/advanced examples for issue #573.

### Prompt 4: Final validation

**AI response**: Rebuilt the app, reran the previously failing targeted suites, installed Firefox, and ran the full Playwright matrix successfully. The final local E2E result was **245 passed, 13 skipped**; the repeated `/deploy.json` 404 log from `BuildInfoBadge` remained benign and unchanged.

## Tasks

### PR #572 CI/export follow-up + issue #573 docs URLs

- **Status**: completed
- **Stage**: Stage 8 / #559 and issue #573
- **Files changed**: `.opencode/lessons-learned.md`, `src/lib/utils/external-data-example-urls.ts`, `src/routes/calculator/+page.svelte`, `src/routes/docs/user-guide/+page.svelte`, `tests/e2e/advanced-options.spec.ts`, `tests/e2e/calculator-advanced.spec.ts`, `tests/e2e/calculator.spec.ts`, `tests/e2e/complex-interactions.spec.ts`, `tests/e2e/export-advanced.spec.ts`, `tests/e2e/particle-unit-switching.spec.ts`, `tests/e2e/url-parser.spec.ts`, `CHANGELOG-AI.md`, `docs/ai-logs/README.md`
- **Decision**: Fixed the Advanced single-program recalculation bug in production code instead of only weakening tests, because density-override assertions revealed `TableAdvanced` was no longer receiving recalculated values when advanced options changed.
- **Issue**: The footer `BuildInfoBadge` still logs a preview-only `/deploy.json` 404 during Playwright runs; it is noisy but does not fail tests and was intentionally left out of scope for this PR.
