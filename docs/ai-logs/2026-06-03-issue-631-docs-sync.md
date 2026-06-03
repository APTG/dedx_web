# 2026-06-03 — Sync Architecture & Specs with Stage 8 state (Issue #631)

## Session Narrative

### Prompt 1: Work on issue 631, ensure docs are in sync with current code, add AI logs, open a PR when ready

**AI response**: Issue #631 reports that `docs/03-architecture.md` and the
feature specs drifted from the Stage 8 codebase. I audited the live source tree
(`src/lib/state/`, `src/lib/components/`, `src/routes/`, `src/tests/`) against
the docs and rewrote the stale sections.

Key reality checks that drove the edits:

- **State topology evolved** from module-level `{ value: T }` singletons named
  `entities.svelte.ts` / `selection.svelte.ts` / `calculation.svelte.ts` /
  `url-sync.ts` to a mix of:
  - global singletons (`ui`, `advanced-mode`, `advanced-options`,
    `custom-compounds`, `stp-unit`, `appInit`), and
  - per-page **factory functions** (`createEntitySelectionState`,
    `createCalculatorState`, `createInverseLookupState`, `createPlotState`,
    `createEnergyInputState`) wired by page orchestrators
    (`calculator-page-orchestrator`, `plot-page-orchestrator`).
- **WASM bootstrap** moved into `AppInitState` (`app-init.svelte.ts`) +
  `compatibility-matrix.ts` + `external-compatibility.ts`.
- **URL sync** is now a layered parser (`url-grammar.peggy` → `url-ast.ts` →
  `url-parse.ts`, `url-shared.ts`, `url-diagnostics.ts`) plus reactive
  `calculator-url-sync` / `plot-url-sync` / `plot-url-restore` modules. Emitted
  version is `urlv=2`; `urlv=1` is rejected (not migrated).
- **Components** were renamed/reorganised: the tabbed `entity-selection/`
  subtree replaced `EntityDropdown`/`EntityPanel`; results moved to
  `results/table-*.svelte` + `result-table/` partials; the standalone energy
  unit selector became `results/unit-anchor-strip.svelte`; advanced controls
  live in `advanced-toolbar.svelte` / `advanced-options-panel.svelte`.
- **Error handling** uses `<svelte:boundary>` + `layout/page-error-fallback.svelte`
  on the pages — there are no per-route `calculator/+error.svelte` /
  `plot/+error.svelte` files.
- **Units** utilities moved from `lib/units/` to `lib/utils/`
  (`energy-conversions.ts`, `unit-conversions.ts`).
- **Tests** live in `src/tests/` (Vitest) and `tests/e2e/` (Playwright).

`docs/04-feature-specs/calculator.md` had already been updated to the
unit-anchor strip during the Stage 8 STP-output-unit work, so no stale
`energy-unit-selector.svelte` reference remained. In
`docs/04-feature-specs/entity-selection.md` I updated the "Deferred to
follow-up issues" list: items #2/#3/#5/#6 shipped during Stage 6–8 (external
sources panel moved into `entity-selection/`, `load-external-modal` built,
compare-across wired, legacy `selected-pill`/`multi-program-picker` deleted),
so the list no longer presents deleted components as current.

## Tasks

### Sync `docs/03-architecture.md` with Stage 8

- **Status**: completed
- **Stage**: Stage 8 (documentation)
- **Files changed**: `docs/03-architecture.md`
- **Decision**: Kept the valuable conceptual prose (debounce correctness,
  no-infinite-loop URL reasoning, JSROOT DOM ownership, SSG constraints) but
  repointed every code/file reference at the real modules. Documented the
  singleton-vs-factory dual pattern explicitly in §4.
- **Issue**: None outstanding.

### Clean up `docs/04-feature-specs/entity-selection.md`

- **Status**: completed
- **Files changed**: `docs/04-feature-specs/entity-selection.md`
- **Decision**: Annotated the follow-up list with Done/Deferred rather than
  deleting it, to preserve the historical record while removing references to
  deleted components.

### `docs/04-feature-specs/calculator.md`

- **Status**: completed (no change needed)
- **Decision**: Already references `unit-anchor-strip.svelte`; verified no stale
  `energy-unit-selector.svelte` reference remains.
