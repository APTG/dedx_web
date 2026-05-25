# 2026-05-25 — PR #581 footer responsive follow-up

## Session Narrative

### Prompt 1: Fix the still-failing shard-3 E2E responsive tests

**AI response**: Investigated the newest PR #581 CI run for commit `303060b`
with the GitHub Actions tools, confirmed the failure had moved back to shard 3/3
responsive tests, and downloaded the latest WASM/test-result artifacts to
reproduce locally. Verified that the failure was no longer rounding drift: the
mobile overflow was real and persisted at `16px` in CI.

### Prompt 2: Reproduce and identify the actual overflow source

**AI response**: Reproduced the `mobile-chrome` responsive failures locally,
then inspected the rebuilt app in a Pixel 5 Playwright context. Traced the
overflow to the shared footer: `BuildInfoBadge` rendered branch metadata from
`deploy.json` as an always-nowrap line inside a single-row footer layout, which
forced horizontal overflow on narrow screens once the footer metadata loaded.

### Prompt 3: Fix and revalidate

**AI response**: Updated the shared footer layout to stack on mobile and made
the build-info badge wrap on small screens while preserving the compact one-line
desktop presentation. Revalidated with `tests/e2e/responsive.spec.ts` on the
`mobile-chrome` project and with the exact shard command
`pnpm test:e2e --grep-invert @nightly --shard=3/3` after installing Firefox
locally so the shard matched CI coverage.

## Tasks

### Fix real mobile overflow from footer build metadata

- **Status**: completed
- **Stage**: CI / E2E
- **Files changed**: `src/routes/+layout.svelte`, `src/lib/components/build-info-badge.svelte`, `.opencode/lessons-learned.md`, `CHANGELOG-AI.md`, `docs/ai-logs/2026-05-25-pr581-footer-responsive.md`, `docs/ai-logs/README.md`
- **Decision**: Fixed the shared footer instead of weakening the responsive assertion again, because the latest failures were caused by real layout overflow from long branch/build metadata values loaded from `deploy.json`.
- **Issue**: None.
