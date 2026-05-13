# 2026-05-13 — PR #463 E2E Shard Command Fix

## Session Narrative

### Prompt 1: Failing sharded E2E jobs

**User request**: Investigate and fix the failing E2E CI jobs, which now report `Error: No tests found` when running `pnpm test:e2e -- --shard=1/2`.

**AI response**: Inspected the failing GitHub Actions run and confirmed both E2E matrix jobs expanded the script invocation to `playwright test -- --shard=N/2`. The literal `--` separator caused Playwright to treat `--shard=N/2` as a positional test-file pattern rather than an option, so no tests matched.

**AI response**: Updated the workflow to call `pnpm test:e2e --shard=${{ matrix.shard }}/2`, which expands to `playwright test --shard=N/2`. Validated the exact pnpm script form locally with `--list` for both shards.

## Tasks

### Fix E2E shard invocation

- **Status**: completed
- **Stage**: 7.3 / CI
- **Files changed**: `.github/workflows/ci.yml`
- **Decision**: Removed the extra pnpm argument separator instead of replacing the npm script with `pnpm exec playwright`, keeping the workflow aligned with the existing package script.
- **Issue**: None.
