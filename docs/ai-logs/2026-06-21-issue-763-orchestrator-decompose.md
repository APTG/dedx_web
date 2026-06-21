# 2026-06-21 — Decompose calculator-page-orchestrator (issue #763)

## Session Narrative

### Prompt 1: Work on issue #763, make PR when ready

**AI response**: Issue #763 (part of the #761 architecture refactor) asks to
shrink `src/lib/state/calculator-page-orchestrator.svelte.ts` — the
highest-coupling node in the state graph — by extracting the self-contained
**shared-compound-from-URL** feature into its own module. Structure-only, no
behaviour change.

Steps taken:

1. Read the orchestrator and mapped the shared-compound surface: the
   `sharedUrlCompound` / `sharedUrlWarning` / `sharedUrlPartial` /
   `sharedUrlFromTransient` banner state, the dedicated recovery-editor state
   (`compoundEditorOpen` / `compoundEditorPrefill` / `compoundEditorWarning`),
   and the six methods `restoreCustomCompoundFromUrl`, `openSharedCompoundEditor`,
   `saveSharedCompoundCopy`, `closeSharedCompoundEditor`, `saveSharedToLibrary`,
   `dismissSharedCompound`.
2. Confirmed the consumers: `calculator/+page.svelte` reads all of the above off
   the orchestrator and calls the methods via `onSave*`/`onDismiss` handlers;
   `shared-compound-alert.svelte` only takes props. The `page-init` contract
   test does not reference the shared-compound surface.
3. Created `src/lib/state/shared-compound-from-url.svelte.ts` with a
   `SharedCompoundFromUrl` class (and `createSharedCompoundFromUrl()` factory)
   owning that state + the six methods verbatim. Moved the now-flow-only imports
   (`suggestCopyName`, `StoredCompoundInternal`, `CustomCompoundPartial`,
   `CompoundEditorPrefill`) there.
4. Reworked the orchestrator to hold a `sharedCompound` instance and expose the
   same surface via getters + one-line delegating methods, so
   `calculator/+page.svelte` is untouched. `customCompounds` stays imported in
   the orchestrator (still used by `setupMultiEntityState`).
5. Added `shared-compound-from-url.test.ts` — a focused unit test for the
   restore/prefill/dismiss/close paths (the entity-selection-dependent
   save paths are exercised via existing integration/E2E suites).
6. Ran `vitest` (full), `check`, `lint`, `format` — all green.

**Outcome**: orchestrator down from 702 → 631 LOC. The `< 450` LOC target in
the issue is not reachable by this extraction alone while keeping
`calculator/+page.svelte` usage unchanged (the delegating getters/methods add
back ~50 LOC, and the bulk of the file is the documented `setupEffects()` phase
graph the issue explicitly says to leave as-is). The shared-compound flow now
lives in one cohesive, independently tested module.

## Tasks

### Extract shared-compound-from-URL flow

- **Status**: completed
- **Stage**: architecture refactor (#761 / #763)
- **Files changed**:
  - NEW `src/lib/state/shared-compound-from-url.svelte.ts`
  - NEW `src/lib/state/shared-compound-from-url.test.ts`
  - `src/lib/state/calculator-page-orchestrator.svelte.ts`
  - `CHANGELOG-AI.md`, `docs/ai-logs/README.md`, this log
- **Decision**: Kept the shared-compound surface on the orchestrator via
  delegating getters/methods rather than re-pointing the page at
  `orchestrator.sharedCompound.*`, to satisfy the "page usage unchanged"
  acceptance criterion.
- **Issue**: The `< 450` LOC target is aspirational for this PR; reaching it
  would require restructuring the effect graph, which the issue scopes out.
  Orchestrator is 631 LOC (was 702).
