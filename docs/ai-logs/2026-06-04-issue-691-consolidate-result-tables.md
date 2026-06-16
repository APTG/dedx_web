# 2026-06-04 — Consolidate twin result-table folders (Issue #691)

## Session Narrative

### Prompt 1: Work on issue 691, make PR when ready

**AI response**: Issue #691 is an organizational/naming cleanup: two
sibling, near-identically named result-table locations existed under
`src/lib/components/` —

- `result-table.svelte` + `result-table/` (the multi-program comparison table
  and its cell/header partials), and
- `results/` (the basic/advanced/multi/inverse tables used by the calculator
  page).

The names gave no hint of the split and the two trees already cross-imported
(`result-table/*-header.svelte` → `results/stp-unit-header-menu.svelte`).

Consolidated everything into the canonical `results/` directory:

- `result-table.svelte` → `results/table-multi-program.svelte`
- `result-table/` partials → `results/multi-program/` (9 files), renaming
  `result-table-footer.svelte` → `footer.svelte` so no file carries the old
  ambiguous `result-table` name.
- Updated the multi-program table's relative imports (`./result-table/*` →
  `./multi-program/*`) and simplified the cross-folder header imports to
  `../stp-unit-header-menu.svelte` (now siblings under `results/`).
- Updated `src/routes/calculator/+page.svelte` import.
- Renamed the two test files (`result-table.test.ts` →
  `table-multi-program.test.ts`, `result-table-advanced.test.ts` →
  `table-multi-program-advanced.test.ts`) and their imports.
- Updated the component tree in `docs/03-architecture.md`.

All moves used `git mv` to preserve history. The `data-testid="result-table"`
DOM attribute was intentionally left unchanged — it's a behavioural contract
relied on by E2E specs, and the issue scopes out behavioural changes.

## Tasks

### Consolidate result-table/ + result-table.svelte into results/

- **Status**: completed
- **Stage**: Stage 8 (code-health / complexity review of `src/`)
- **Files changed**:
  - `src/lib/components/result-table.svelte` → `src/lib/components/results/table-multi-program.svelte`
  - `src/lib/components/result-table/{advanced-header,advanced-result-cells,basic-header,basic-result-cells,input-row-cells,multi-entity-cells,multi-entity-header,types}` → `src/lib/components/results/multi-program/`
  - `src/lib/components/result-table/result-table-footer.svelte` → `src/lib/components/results/multi-program/footer.svelte`
  - `src/routes/calculator/+page.svelte`
  - `src/tests/components/result-table.test.ts` → `src/tests/components/table-multi-program.test.ts`
  - `src/tests/components/result-table-advanced.test.ts` → `src/tests/components/table-multi-program-advanced.test.ts`
  - `docs/03-architecture.md`
- **Decision**: Used a `results/multi-program/` subfolder (rather than a flat
  `multi-program-` prefix) so the partials stay grouped and the folder name
  documents that they belong to the multi-program comparison table. Renamed the
  footer to `footer.svelte` to remove the last `result-table` filename.
- **Verification**: `pnpm check` (svelte-check + tsc) → 0 errors; `pnpm lint`
  clean; the moved table tests pass (21/21). The only failing unit tests are in
  `guard-forbidden-files.test.ts`, which fail because git commit signing is
  unavailable in the sandbox (signing server returns 400) — unrelated to this
  change.
- **Issue**: none.
