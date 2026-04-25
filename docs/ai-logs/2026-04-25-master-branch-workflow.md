# 2026-04-25 — Drop develop branch; deploy straight to master

**Model:** Claude Sonnet 4.6 via Claude Code

## Session Narrative

### Prompt 1: Drop develop branch strategy, update CI and docs, improve README deployment links
**AI response**: The project had a two-branch strategy (`develop` → `master`) inherited
from legacy planning documents, but the team decided to merge feature branches directly to
`master` (as opencode was already doing successfully). Updated all GitHub Actions workflows
and documentation to reflect the single-branch workflow.

Changes made:
- `deploy.yml` trigger changed from `branches: [develop]` to `branches: [master]`;
  removed the Phase 1/Phase 2 comment scaffolding since the transition is complete.
- `ci.yml` removed `develop` from both `push.branches` and `pull_request.branches`.
- `docs/08-deployment.md` §1 table trigger updated; §5.1 rewritten to describe the
  current `master`-triggered continuous deployment rather than the old develop-branch
  placeholder phase.
- `docs/00-redesign-plan.md` Stage 3.8 rationale updated to reflect `master → web_dev`
  pipeline.
- `docs/07-testing-strategy.md` CI matrix description updated.
- `README.md` deployment links replaced with a table showing both environments, their
  URLs, update triggers, and a live CI badge for the deploy workflow.

## Tasks

### Drop develop branch from CI/deploy workflows
- **Status**: completed
- **Stage**: cross-cutting (workflow hygiene)
- **Files changed**:
  - `.github/workflows/deploy.yml`
  - `.github/workflows/ci.yml`
  - `docs/08-deployment.md`
  - `docs/00-redesign-plan.md`
  - `docs/07-testing-strategy.md`
  - `README.md`
- **Decision**: Merged straight to `master` — no `develop` branch maintained. The two-branch
  plan was written before the team evaluated actual workflow patterns; opencode's direct-to-master
  merges proved the simpler model works.
