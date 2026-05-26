# 2026-05-26 — Issue #604: Decompose UI of God Components (PR 3)

## Session Narrative

### Prompt 1: Work on issue #604; ensure static checks (and E2E) pass; open a PR

**AI response**: Read issue #604 (parent #574) for scope. Inspected the three
"God Components": `result-table.svelte` (1024 lines), `calculator/+page.svelte`
(1792 lines), and `plot/+page.svelte` (1280 lines). Most of the
calculator/plot files are state-setup and orchestration logic that PRs #602
(URL sync extraction) and #603 (async bootstrap extraction) already trimmed —
the remaining biggest chunk and the file explicitly called out in the issue
description is `result-table.svelte`. Focused the refactor there for this PR.

Decomposition:

1. **`src/lib/actions/draggable-column.svelte.ts`** — new Svelte 5 action
   `draggableColumn` plus a `createColumnReorder<T>(...)` factory that
   bundles the reactive drag state and handlers. Reusable for any column
   reorder pattern; the action is generic over the column identifier type.

2. **`src/lib/components/result-table/`** — new sub-components extracted from
   the orchestrator:
   - `types.ts` — `ColumnDef` interface (was inline in the god component).
   - `basic-header.svelte` — single-row header for basic mode.
   - `advanced-header.svelte` — multi-program two-row grouped header; uses
     `use:draggableColumn`.
   - `multi-entity-header.svelte` — multi-material/particle two-row header.
   - `input-row-cells.svelte` — energy `<input>`, mev-nucl display, unit
     `<select>`/label (the three input columns shared by all modes).
     Includes paste, keyboard-nav, unit-change handlers.
   - `basic-result-cells.svelte` — single result column per quantity for basic
     mode.
   - `multi-entity-cells.svelte` — STP + CSDA cells for multi-entity mode.
   - `advanced-result-cells.svelte` — STP + CSDA cells with delta tooltips and
     hover/focus state propagation for multi-program mode.
   - `result-table-footer.svelte` — validation summary, calculation error,
     add-row button.

3. **`src/lib/components/result-table.svelte`** — rewrote as a thin
   orchestrator (234 lines, down from 1024) that picks the right header /
   cell components based on `isAdvanced` / `isMultiEntity` and threads a
   `createColumnReorder` controller into the advanced header.

## Tasks

### Decompose result-table.svelte

- **Status**: completed
- **Stage**: Refactoring (issue #574 / PR 3 of 3)
- **Files added**:
  - `src/lib/actions/draggable-column.svelte.ts`
  - `src/lib/components/result-table/types.ts`
  - `src/lib/components/result-table/basic-header.svelte`
  - `src/lib/components/result-table/advanced-header.svelte`
  - `src/lib/components/result-table/multi-entity-header.svelte`
  - `src/lib/components/result-table/input-row-cells.svelte`
  - `src/lib/components/result-table/basic-result-cells.svelte`
  - `src/lib/components/result-table/multi-entity-cells.svelte`
  - `src/lib/components/result-table/advanced-result-cells.svelte`
  - `src/lib/components/result-table/result-table-footer.svelte`
- **Files changed**: `src/lib/components/result-table.svelte` (rewrite)
- **Decision**: Preserved every `data-testid`, `data-program-id`,
  `data-entity-id`, `data-row-index` attribute exactly so existing unit tests
  (21 in `result-table*.test.ts`) and E2E selectors continue to work.
  Re-export of `ColumnDef` from the orchestrator `.svelte` module was tried
  but tripped the ESLint `no-import-assign` rule; since no caller imports
  `ColumnDef` from `result-table.svelte` (only the default component
  export), dropped the re-export and kept the type in
  `result-table/types.ts`.
- **Verification**: `pnpm run check` clean (0 errors, 0 warnings),
  `pnpm lint` clean, `pnpm run format:check` clean, `pnpm build`
  succeeds, the 21 result-table unit tests all pass.
- **Issue**: E2E tests not run — no WASM artifacts available in this
  container and Docker-based Emscripten build isn't reproducible here. The
  refactor preserves all DOM testids and the unit tests cover every mode
  (basic, advanced multi-program, multi-entity) at component level.
  The three `guard-forbidden-files` unit tests fail with `git commit failed`
  due to the same environment git-signing restriction noted in the 2026-05-25
  pnpm-v11 log — unrelated to this change.

### Page-level cleanups (calculator / plot) — deferred

- **Status**: not in this PR
- **Reason**: After #602 and #603 already extracted URL sync and async
  bootstrap, the remaining `$state` declarations in
  `calculator/+page.svelte` and `plot/+page.svelte` are mostly genuine page
  state (URL-init flags, mode states, references to created store
  instances). The few transient UI flags (`showLoadExternalModal`,
  `showAdvancedHint`, `editingSeriesId`, `showResetConfirm`,
  `showExportMenu`) are tightly coupled to nearby JSX and benefit less from
  abstraction than the table god component. Keeping this PR focused on the
  largest, explicitly-named target from the issue description.
