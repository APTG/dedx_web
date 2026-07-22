# 2026-07-22 — CI guard-forbidden-files force-push fix

## Session Narrative

### Prompt 1: Fix conflicts on PR #870 after PR #872 merged

**AI response**: Rebased PR #870's branch (`fix/869-basic-mode-program-toast`)
onto `master`, resolving two append-order conflicts in `CHANGELOG-AI.md` and
`docs/ai-logs/README.md` (both PRs added a session entry to the same list).
Verified with `pnpm test` / `pnpm run format:check`, then force-pushed.

### Prompt 2: CI failed with "Invalid revision range" after the force-push

The `workflow-guards` job's push-triggered run failed:

```
fatal: Invalid revision range 6603dcabfe35ced6dfe458c0c792234176c8562c..c8d60c3507e13447581a7ddcefe06a0e457d4bc4
```

**AI response**: Root-caused it to `.github/workflows/ci.yml`'s
`guard-forbidden-files` step. For `push` events it diffs
`github.event.before..github.sha`, but a force-push (from the rebase) leaves
`before` pointing at the branch's pre-rebase tip — a commit no longer
reachable from any ref on the remote. `actions/checkout` with
`fetch-depth: 0` only fetches history reachable from the checked-out ref, so
that dangling commit is never fetched, and `git diff` fails outright instead
of degrading gracefully.

The workflow already had a fallback for the analogous "first push on a new
branch" case (`before` = all-zero SHA → falls back to the merge-base with the
default branch), but nothing covered "before is a real SHA that just isn't
fetchable." Extended the same fallback to also trigger when
`git cat-file -e "${BEFORE}^{commit}"` fails locally, so a rebased/force-pushed
branch degrades to the same merge-base diff as a fresh branch instead of
erroring.

Verified by pushing the fix commit and watching the resulting `push`-event CI
run turn green (`workflow-guards`, unit/integration, and E2E jobs all passed).

### Prompt 3: Address Copilot review comments on PR #870

Copilot's review flagged two issues, both fixed in a follow-up commit on the
same branch:

1. `src/lib/state/calculator-page-orchestrator.svelte.ts` — the URL-hydration
   path called `entityState.selectProgram(urlState.programId)` unconditionally
   before checking Basic vs. Advanced mode. `selectProgram()` retargets
   particle/material selection as a side effect when the new program doesn't
   cover the currently selected particle/material, so a Basic-mode link's
   *ignored* `program=` could still silently swap the user's particle or
   material even though `setupModeFallbacks` immediately reset the program
   itself back to Auto. Fixed by only calling `selectProgram()` when
   `isAdvancedMode.value` is true; Basic mode now just shows the notice and
   leaves entity selection untouched.
2. `CLAUDE.md`'s new "Browser verification" note read as a session-specific
   aside ("the user does not want...") rather than repo-wide guidance.
   Reworded to state the rule directly without referencing an individual
   user.

Replied to both review threads on GitHub with the fixing commit SHA.

### Prompt 4: Address a further round of Copilot review comments

Two more comments after the above push:

1. `.github/workflows/ci.yml` — the CI-guard fix landed inside a PR titled/
   scoped around the `#869` toast feature, with no mention of the CI change.
   Addressed by documenting it explicitly in this log (rather than splitting
   into a separate PR): the CI fix was a direct prerequisite for getting
   *this* PR's own pipeline green after the required rebase, so it stayed on
   the branch, but is now called out here for reviewers reasoning about CI
   risk.
2. `CHANGELOG-AI.md` — the **CI / guard-forbidden-files** entry omitted the
   required `**Log:**` link; per the changelog's own rule, that's only
   allowed for trivial changes (< 3 files, no decisions), and this change
   involved a real decision (how to detect an unfetchable `before` SHA). This
   file is that missing log, now linked from the entry.

## Tasks

### Guard-forbidden-files tolerates force-pushed history

- **Status**: completed
- **Stage**: bug fix / CI infra, not a redesign-plan stage
- **Files changed**:
  - `.github/workflows/ci.yml` — `workflow-guards` job's push-event branch:
    generalized the existing all-zero-SHA fallback into a `NEEDS_FALLBACK`
    check that also fires when `git cat-file -e "${BEFORE}^{commit}"` fails,
    covering both "new branch" and "force-pushed/rebased branch" the same way
    (merge-base with the default branch).
- **Decision**: Chose to detect unfetchability via `git cat-file -e` rather
  than trying to special-case force-pushes specifically — any `before` SHA
  the checkout didn't fetch should degrade the same way, regardless of why.
- **Issue**: none open.

### Basic-mode `program=` no longer mutates particle/material as a side effect

- **Status**: completed
- **Stage**: bug fix, follow-up to #869
- **Files changed**:
  - `src/lib/state/calculator-page-orchestrator.svelte.ts` — gated the
    `selectProgram(urlState.programId)` call on `isAdvancedMode.value`;
    Basic mode now only calls `announceProgramFeedback()`.
  - `CLAUDE.md` — reworded the browser-verification note as project
    guidance.
- **Decision**: none beyond the fix itself — this was a straightforward
  scope-narrowing of an existing conditional, per the review comment.
- **Issue**: none open.

Full Vitest (1968) + `pnpm lint` + `pnpm run format:check` clean after each
change; `svelte-check` has a pre-existing, unrelated `postcss` module
resolution failure in this environment (affects files untouched by this
session — `desktop-sheet.svelte`, `mobile-sheet.svelte`, `picker-sheet.svelte`,
`+layout.svelte`). Verified the CI fix directly by observing a real GitHub
Actions run transition from failing to passing after the push.
