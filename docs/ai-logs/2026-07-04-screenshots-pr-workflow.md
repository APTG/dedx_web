# 2026-07-04 — Screenshots workflow: fresh branch + new PR per run

## Session Narrative

### Prompt 1: Improve automatic screenshot production — they always push to the same branch and no new PR gets created

**AI response**: Investigated `.github/workflows/screenshots.yml` and the live
repo state. Confirmed the root cause with current data: the workflow reused a
single fixed branch `screenshots/auto-update` and gated PR creation on
`gh pr view "$BRANCH"`. That command matches **any** PR for the branch,
including already-merged ones — so once the first screenshot PR had merged,
`gh pr view` kept succeeding and the `if ! gh pr view` guard was always false,
meaning **no new PR was ever opened**. The regenerated PNGs were force-pushed
onto the branch and left orphaned. Evidence: branch `screenshots/auto-update`
sat at commit `8aeebd0` ("docs: update screenshots [skip ci]", 3 PNGs, dated
2026-07-04) with no open PR, while the last PR on that branch (#822) had merged
on 2026-07-02.

Rewrote the workflow to open a **fresh, uniquely-named branch per run**
(`screenshots/auto-update-<run-id>`) and **always create a new PR** for it, per
the user's suggestion. Because the branch is new every time, `gh pr view`'s
stale-match problem disappears entirely. Added a best-effort
"Retire prior screenshot branches" step that runs before opening the new PR: it
lists every `screenshots/auto-update*` branch, closes any still-open PR, and
deletes the branch. This sweeps up (a) superseded PRs from earlier commits,
(b) orphan branches from runs the concurrency guard cancelled mid-flight, and
(c) the pre-existing `screenshots/auto-update` leftover — so no manual cleanup
is needed and the branch list self-heals. Kept the squash auto-merge, the
`concurrency` guard, and the `if:` anti-loop guard (the squash-merge commit
still starts with "docs: update screenshots", so the merge does not retrigger
the job). Validated the YAML parses and both embedded shell scripts pass
`bash -n`.

### Prompt 2: File an issue for this problem, then implement a solution and make a PR

**AI response**: Filed issue #825 (root cause + evidence + acceptance
criteria) documenting the reused-branch / `gh pr view` matching-a-merged-PR
bug, then opened a pull request from `claude/screenshot-pr-workflow-fl2okg`
(base `master`) carrying the already-implemented fix, with `Closes #825` in
the body. No PR/issue templates exist in the repo, so both were written from
scratch.

## Tasks

### Screenshots workflow: unique branch + new PR per run

- **Status**: completed
- **Stage**: CI / tooling (not a redesign-plan stage)
- **Files changed**:
  - `.github/workflows/screenshots.yml`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-07-04-screenshots-pr-workflow.md`
  - `docs/ai-logs/README.md`
- **Decision**: Unique branch name per run keyed on `${{ github.run_id }}`
  rather than fixing the single-branch flow (e.g. filtering `gh pr list
  --state open --head`). A fresh branch is more robust — it also avoids
  force-pushing over an in-flight branch and gives each PR a 1:1 mapping to the
  master commit it was rendered from. The retire step keeps the branch/PR list
  tidy despite the per-run branches.
- **Issue**: Merge behaviour depends on the existing repo settings ("Allow
  auto-merge" enabled; no required status check that the `[skip ci]` screenshot
  commit would block). Both held historically (bot PR #752 and PR #822 merged),
  and this change does not alter the token, checks, or `[skip ci]`, so the
  merge path is unchanged — only branch naming and PR creation differ.
