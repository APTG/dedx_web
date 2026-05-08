# 2026-05-08 — PR #439 submodule pointer revert

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Revert committed submodule changes and keep PR scope to core repo files

**AI response**: Identified that PR #439 included unintended gitlink updates for three vendor submodules and reverted them to match `origin/master`:

- `vendor/shadcn-svelte`
- `vendor/svelte`
- `vendor/zarrita`

Verified each reverted gitlink SHA in index equals base branch SHA before committing.

Validation:

- `pnpm test -- src/tests/unit/inverse-lookups-conversion.test.ts` (suite execution completed successfully in current repo configuration)

## Tasks

### Revert accidental submodule pointer updates

- **Status**: completed
- **Stage**: housekeeping
- **Files changed**:
  - `vendor/shadcn-svelte` (gitlink)
  - `vendor/svelte` (gitlink)
  - `vendor/zarrita` (gitlink)
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-05-08-submodule-pointer-revert.md`
- **Decision**: reset gitlinks directly to base branch SHAs to preserve all core-repo feature changes while removing unrelated submodule churn.
- **Issue**: none.
