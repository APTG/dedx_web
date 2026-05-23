# 2026-05-18 — Issue #536: JSROOT plot stuck on "Loading plot engine…" forever

## Session Narrative

### Prompt 1: Read issue #536 and make a plan to fix it

**AI response**: Fetched issue via `gh issue view 536`. Root cause: the JSROOT module evaluation race (`internals.jsroot` undefined in `ObjectPainter.mjs:1828`) is caught but never retried. Commit 2dc1592 only broadened the Firefox error-string match — it still silently swallowed the error and set `jsrootReady = false` without triggering any retry. Since no reactive dependency changes after the failure, Svelte's `$effect` never re-fires, permanently showing the loading placeholder.

Plan approved: add `drawWithRetry` helper, replace `drawPlot` call, simplify catch, strengthen E2E tests.

### Prompt 2: Implement the fix

**AI response**:

- Added `drawWithRetry` function to `jsroot-plot.svelte` — up to 5 attempts with delays `[0, 100, 200, 400, 800]` ms. Only retries on the jsroot module-race error pattern; all other errors are re-thrown immediately. Checks `getCancelled()` before each attempt and after each delay to abort if the effect is torn down mid-retry.
- Replaced `drawPlot(el, snapshot)` call with `drawWithRetry(el, snapshot, () => cancelled)`.
- Simplified the outer `.catch()` — removed the now-redundant jsroot-race branch.
- Updated two `@regression` tests in `plot.spec.ts` to assert `"Loading plot engine"` text count reaches 0 within 20 s (verifying JSROOT actually renders). Added `@firefox` tag to both tests.
- All 1379 unit tests pass.

## Tasks

### Add retry logic for JSROOT module-race error

- **Status**: completed
- **Stage**: Stage 8 / plot
- **Files changed**:
  - `src/lib/components/jsroot-plot.svelte`
  - `tests/e2e/plot.spec.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-05-18-issue536-jsroot-retry.md`
- **Decision**: Retry inside the draw chain (not via reactive state increment) — cleaner, no extra state, cancellation handled via closure.
- **Issue**: None.
