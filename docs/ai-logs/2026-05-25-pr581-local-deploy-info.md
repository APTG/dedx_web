# 2026-05-25 — PR #581 local deploy.json automation

## Session Narrative

### Prompt 1: Explain `deploy.json` and avoid manual local generation before E2E runs

**AI response**: Reviewed the current local build/test scripts and the newest CI
run for PR #581. Confirmed that `BuildInfoBadge` fetches `/deploy.json` to render
the footer badge with commit/date/branch metadata, and that CI no longer emits the
old `/deploy.json` 404 noise because the workflows now generate the file before
building. Identified the remaining local issue: `pnpm build` did not run
`scripts/deploy.cjs`, so a developer could still build a preview bundle without
`deploy.json` and then see 404s during `pnpm test:e2e`. Fixed that by adding a
`prebuild` hook so normal local builds generate `static/deploy.json`
automatically.

## Tasks

### Automate local deploy.json generation for build + E2E flow

- **Status**: completed
- **Stage**: CI / local dev
- **Files changed**: `package.json`, `.opencode/lessons-learned.md`, `CHANGELOG-AI.md`, `docs/ai-logs/2026-05-25-pr581-local-deploy-info.md`, `docs/ai-logs/README.md`
- **Decision**: Used a `prebuild` lifecycle hook instead of changing Playwright's `webServer.command`, because the file must exist before the static build is produced and this keeps local `pnpm build && pnpm test:e2e` aligned with CI.
- **Issue**: The latest CI run on commit `979e57e` still has separate responsive mobile failures on shard 3/3, but the `/deploy.json` 404 noise is no longer present there.
