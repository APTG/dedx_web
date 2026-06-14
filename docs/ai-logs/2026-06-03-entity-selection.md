# 2026-06-03 — Remove dead legacy entity-selection component tree

## Session Narrative

### Prompt 1: Analyse code complexity and architecture, summarise maintenance tasks

**AI response**: Performed a read-only complexity/architecture pass over `src/`.
Overall health is strong (clean lint, strict TS, ~13 `any`/disables total, zero
TODO/FIXME, runes throughout, ~0.7 test:source ratio, acyclic state model).
Identified refinements, most serious first. The top finding was an entire
pre-Stage-8 entity-selection implementation still present in the tree but never
imported by the running app.

### Prompt 2: Create detailed GitHub issues for the findings

**AI response**: Filed issues #688–#694 (findings) plus a tracking issue #695,
in the repo's house style (Why / Scope / Acceptance criteria / Files / Test plan
/ AI logging), cross-linked to related issues (#631, #477/#659).

### Prompt 3: Work on #688, open a PR, ensure static tests pass, add AI logs

**AI response**: Implemented #688 on branch
`claude/code-complexity-architecture-29w6a`.

- Re-confirmed the four components are dead: the only non-test, non-self
  references were `entity-selection-comboboxes` → a stale comment in
  `program-kind.ts:5`, and the two `-panels`/`-comboboxes` wrappers importing
  their `entity-panel` / `entity-combobox` children (themselves dead).
- Deleted four components and their four test files (`git rm`).
- Rewrote the `program-kind.ts` doc comment to describe the program-grouping
  rule directly instead of pointing at the deleted component (the spec reference
  to `docs/04-feature-specs/entity-selection.md` remains as the source of truth).
- Left `docs/progress/` and `docs/ai-logs/` references intact — those are
  point-in-time historical records of completed stages and should not be
  rewritten.
- Ran static checks: `pnpm format`, `pnpm lint` (0 errors), `pnpm check`
  (svelte-check + tsc, 0 errors), `pnpm test` (1639 passed).

## Tasks

### Remove dead legacy entity-selection component tree (#688)

- **Status**: completed
- **Stage**: Post-Stage-8 code-health cleanup
- **Files changed**:
  - Deleted: `src/lib/components/entity-combobox.svelte`,
    `src/lib/components/entity-selection-comboboxes.svelte`,
    `src/lib/components/entity-selection-panels.svelte`,
    `src/lib/components/entity-panel.svelte`
  - Deleted: `src/tests/components/entity-combobox.test.ts`,
    `src/tests/components/entity-panel.test.ts`,
    `src/tests/unit/entity-selection-comboboxes.test.ts`,
    `src/tests/unit/entity-selection-panels.test.ts`
  - Edited: `src/lib/utils/program-kind.ts` (doc comment)
  - Logged: `CHANGELOG-AI.md`, this file
- **Decision**: Kept the grouping-logic description inline in `program-kind.ts`
  rather than pointing at any component, so the comment can't go stale against a
  UI file again; the canonical reference stays the feature spec.
- **Issue**: `guard-forbidden-files.test.ts` reports 3 failures in this
  environment, but they are unrelated to this change — the test creates a temp
  git repo and runs `git commit`, which fails on the sandbox's commit-signing
  server (`signing server returned status 400: missing source`). Reproduced
  identically with a plain `git commit` in a throwaway repo. The test does not
  reference entity-selection. Not caused by this change.
