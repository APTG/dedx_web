# 2026-05-13 — PR #463 E2E Sharding and Stage Docs

## Session Narrative

### Prompt 1: PR #463 follow-up

**User request**: Mark the completed redesign-plan stage with a PR link, inspect the latest E2E logs showing a 3–4 minute run, and consider whether runtime can be shortened without weakening test coverage.

**AI response**: Inspected the current redesign-plan Stage 7 table and found the mobile responsive polish work in this PR is Stage 7.3, while Stage 7.4 is WASM error handling and remains outside this PR's implementation scope. To keep docs aligned with the net merged behavior, marked Stage 7.3 complete with the PR #463 link and left Stage 7.4 pending.

**AI response**: Investigated the latest CI run using GitHub Actions job metadata and the attached E2E log. The successful E2E job ran 186 tests using 1 worker; 178 passed, 8 skipped; the Playwright test phase took 3.2 minutes and the full E2E job took about 4 minutes 20 seconds. The dominant remaining bottleneck is one-runner serial execution, not missing filtering.

**AI response**: Preserved the full Playwright suite and shortened wall-clock time by splitting the E2E job into two GitHub Actions shards (`--shard=1/2` and `--shard=2/2`). Artifact names now include the shard number so both reports can upload safely.

## Tasks

### Stage docs

- **Status**: completed
- **Stage**: 7.3
- **Files changed**: `docs/00-redesign-plan.md`
- **Decision**: Marked Stage 7.3, not Stage 7.4, because the current redesign document defines 7.3 as "Mobile responsive polish" and 7.4 as "WASM error handling".
- **Issue**: None.

### E2E runtime

- **Status**: completed
- **Stage**: 7.3 / CI
- **Files changed**: `.github/workflows/ci.yml`
- **Decision**: Used Playwright sharding across two GitHub-hosted runners instead of reducing test selection, preserving the full E2E coverage while reducing wall-clock time.
- **Issue**: GitHub-hosted runner setup time is duplicated per shard, so the improvement is bounded by install/build overhead.
