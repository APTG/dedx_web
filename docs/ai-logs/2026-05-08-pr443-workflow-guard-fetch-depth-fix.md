# 2026-05-08 — PR #443 workflow guard fetch-depth fix

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Fix PR review thread issue causing guard job failure

User requested applying review-thread feedback and fixing CI failure in
`workflow-guards`:

```
fatal: Invalid revision range <base_sha>..<head_sha>
```

**AI response**: Investigated GitHub Actions run logs for the failing CI run and
confirmed `actions/checkout@v6` was using `fetch-depth: 1` in the
`workflow-guards` job, so required SHA objects for range diff were missing in
the shallow clone. Updated the checkout step to `fetch-depth: 0` to ensure
range SHAs are available for `git diff` on pull requests.

## Tasks

### Fix workflow guard checkout depth for range diffs

- **Status**: completed
- **Stage**: process hardening follow-up
- **Files changed**:
  - `.github/workflows/ci.yml`
- **Decision**: Applied minimal targeted fix (`fetch-depth: 0`) in the
  `workflow-guards` checkout step only.
- **Issue**: none.

### Validation

- **Status**: completed (with known unrelated baseline lint failures)
- **Commands run**:
  - `node scripts/guard-forbidden-files.cjs --range HEAD~1..HEAD` ✅
  - `pnpm lint` ❌ (pre-existing unrelated lint errors)
  - `pnpm test` ✅
  - `pnpm build` ✅
- **Issue**: lint failures pre-exist this change and are outside scope.
