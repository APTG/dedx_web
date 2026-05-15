# 2026-05-15 — Vendor Submodule Guard

## Session Narrative

### Prompt 1: Fix vendor Dependabot bump test failures

**AI response**: Investigated the reported CI failure for Dependabot submodule PRs. Used repository search to locate `scripts/guard-forbidden-files.cjs`, then fetched GitHub Actions logs for the failing `vendor/svelte` Dependabot run and confirmed the `Workflow Guards` job rejected a scoped vendor-only gitlink diff.

### Prompt 2: Image URL with failing Dependabot submodule PRs

**AI response**: Used the screenshot context to keep the fix scoped to vendor submodule bump PRs. Updated the guard so a diff containing only vendor gitlink changes is treated as the dedicated submodule-maintenance PR the error message already recommends, while mixed first-party/vendor diffs still fail. Added focused Vitest coverage using temporary git repositories with synthetic gitlink entries.

## Tasks

### Scoped vendor gitlink guard behavior

- **Status**: completed
- **Stage**: maintenance
- **Files changed**:
  - `scripts/guard-forbidden-files.cjs`
  - `src/tests/unit/guard-forbidden-files.test.ts`
  - `.opencode/lessons-learned.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-05-15-vendor-submodule-guard.md`
  - `docs/ai-logs/README.md`
- **Decision**: Allowed only vendor-only gitlink diffs, rather than all Dependabot-authored or branch-name-matched changes, so the guard remains actor-independent and continues to block accidental vendor submodule changes in feature PRs.
- **Issue**: None.

### Validation

- **Status**: completed
- **Stage**: maintenance
- **Files changed**: none
- **Decision**: Validated the exact guard behavior with focused tests and manual guard invocations before broader checks.
- **Issue**: Local validation runs under Node 20 in the sandbox, so `pnpm install` reports the repository's expected Node 24 engine warning.
