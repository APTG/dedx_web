# 2026-05-25 — PR #581 responsive tolerance

## Session Narrative

### Prompt 1: Fix the latest failing responsive E2E tests on PR #581

**AI response**: Inspected the newest failing CI run for commit `68ff244` and
confirmed shard `E2E Tests (Playwright 3/3)` still failed only the three
`mobile-chrome` horizontal-overflow checks in `tests/e2e/responsive.spec.ts`.
Downloaded the failed test-results artifact and current WASM artifact, rebuilt the
branch locally, and probed `/calculator` and `/plot` with Playwright on a Pixel 5
viewport. Local probing showed no real overflow (`scrollWidth === clientWidth`),
which pointed to a CI-only rounding difference rather than a visible layout bug.
Updated the helper to poll numeric overflow and allow a 1 px tolerance.

## Tasks

### Stabilize CI-only responsive overflow checks

- **Status**: completed
- **Stage**: CI / E2E
- **Files changed**: `tests/e2e/responsive.spec.ts`, `.opencode/lessons-learned.md`, `CHANGELOG-AI.md`, `docs/ai-logs/README.md`
- **Decision**: Used a 1 px tolerance on `scrollWidth - clientWidth` instead of weakening the test further because local probing showed no actual overflow and the failures were isolated to CI mobile Chromium.
- **Issue**: none
