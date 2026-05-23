# 2026-05-23 — PR #568 url-parser E2E follow-up

## Session Narrative

### Prompt 1: @copilot fix failing E2E tests in `url-parser.spec.ts`

**AI response**: Investigated CI run `26341049696` and the failed E2E shard `E2E Tests (Playwright 3/3)` via GitHub Actions logs. Reproduced the failure locally and confirmed tests still expected `urlv=1` to be current after `CURRENT_URL_MAJOR` was bumped to `2`.

### Prompt 2: Apply minimal fix for the failing assertions

**AI response**: Updated `tests/e2e/url-parser.spec.ts` to treat `urlv=2` as current, changed URLs in related scenarios to `urlv=2`, and refreshed scenario labels for missing-`urlv` legacy behavior. Re-ran the full URL parser Playwright suite with WASM artifacts present; all tests passed.

## Tasks

### URL parser E2E expectation alignment

- **Status**: completed
- **Stage**: Stage 8 (Open Beta & User Feedback)
- **Files changed**:
  - `tests/e2e/url-parser.spec.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-05-23-pr568-url-parser-e2e-followup.md`
- **Decision**: Kept the fix test-only and minimal. Updated URL version tokens in test inputs to match runtime negotiation (`CURRENT_URL_MAJOR = 2`) instead of changing production version behavior again.
- **Issue**: None.
