# 2026-05-10 — PR #445 workflow guard initial-push range fix

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Investigate CI guard failure from PR review comment and fix it

User asked for investigation of GitHub Actions job `75085361570`, which failed
with forbidden vendor gitlink errors on PR #445.

**AI response**: Fetched the failing job log from GitHub Actions, confirmed the
error was coming from the `workflow-guards` step, and reproduced the same
failure locally by running `node scripts/guard-forbidden-files.cjs --range
4b825dc642cb6eb9a060e54bf8d69288fbee4904..HEAD`. Compared the branch against
`origin/master` and confirmed there were no actual vendor gitlink changes in the
PR diff, so the failure was a false positive caused by initial-push range
selection.

### Prompt 2: Apply the minimal fix and validate it

**AI response**: Updated `.github/workflows/ci.yml` so first-push `push` events
fetch the default branch and diff from `git merge-base` instead of the empty
tree, with an empty-tree fallback only if no merge-base exists. Added a
lessons-learned entry documenting the failure mode and recorded the session in
the AI changelog and log index.

## Tasks

### Fix initial-push guard range selection

- **Status**: completed
- **Stage**: process follow-up
- **Files changed**:
  - `.github/workflows/ci.yml`
  - `.opencode/lessons-learned.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-05-10-pr445-workflow-guard-initial-push-fix.md`
- **Decision**: Fixed the workflow shell logic instead of the guard script
  because the guard implementation was correct for the supplied range; the bad
  input was the empty-tree fallback on first branch push.
- **Issue**: local `corepack pnpm lint` could not run because `node_modules` are
  absent in this sandbox checkout; validation focused on reproducing and
  verifying the guard-range behavior directly with the repo script.

### Validation

- **Status**: completed
- **Commands run**:
  - `node scripts/guard-forbidden-files.cjs --range 4b825dc642cb6eb9a060e54bf8d69288fbee4904..HEAD` ❌ reproduces false-positive vendor gitlink failures
  - `BASE=$(git merge-base origin/master HEAD) && node scripts/guard-forbidden-files.cjs --range "$BASE..HEAD"` ✅ passes on the real branch diff
  - `corepack pnpm guard:staged` ✅
  - `corepack pnpm lint` ❌ missing local dependencies (`eslint: not found`; `node_modules` absent)
  - `corepack pnpm test` not run because dependency install is unavailable in this sandbox state
- **Issue**: dependency-based validations require an installed workspace; the CI
  workflow itself installs dependencies, so the critical verified behavior here
  is the guard-range correction that reproduces the exact failing job.
