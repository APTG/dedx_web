# 2026-05-13 — Stage 7.4 WASM Error Handling

## Session Narrative

### Prompt 1: Investigate Stage 7.4

**AI response**: Launched two parallel Explore agents. Found that most infrastructure was
already in place: `LibdedxError` class, global `wasmError`/`wasmReady` state, WASM load
failure panel in the calculator, validation summary, large-input warning, per-program errors
in multi-program mode. Identified three gaps: (1) `calcState.error` was tracked in state but
never rendered; (2) plot preview WASM errors were silently swallowed via `console.error`;
(3) out-of-range energies (DEDX_ERR_ENERGY_OUT_OF_RANGE=101) caused the whole batch to fail
with no per-row feedback.

### Prompt 2: Implement autonomously, handle 100 TeV case

**AI response**: Created branch `feature/stage-7-4-wasm-error-handling`. Implemented:

1. **Per-row retry (calculator.svelte.ts)**: Added `outOfRangeRowIds` reactive state.
   Refactored `performCalculation()` to move context resolution before try/catch so the
   per-row retry path can reuse it. When a batch call throws LibdedxError(101), falls back
   to individual per-row calls to identify which energies are out of range vs. valid.
   `parseRow()` now checks `outOfRangeRowIds` and returns `status: "out-of-range"` with
   message "Energy out of tabulated range". This makes "100 TeV for PSTAR" show a red cell
   for that row while rows with valid energies still display results.

2. **Fatal error panel (result-table.svelte)**: After validation summary, renders a
   destructive-coloured error panel when `calcState.error` is non-null, with a
   `<details>` toggle showing `LibdedxError code: N`.

3. **Plot preview errors (plot/+page.svelte)**: Added `previewError` state. The catch
   block now sets it instead of calling `console.error`. An inline `<p>` renders
   "Preview failed: …" above the series legend.

All 1076 unit tests pass. No new TypeScript errors introduced (pre-existing TS errors
in `compatibility-matrix.ts` and the inline `materialId` type narrowing were already present).

## Tasks

### Stage 7.4: WASM error handling

- **Status**: completed
- **Stage**: 7.4 (from docs/00-redesign-plan.md)
- **Files changed**:
  - `src/lib/state/calculator.svelte.ts`
  - `src/lib/components/result-table.svelte`
  - `src/routes/plot/+page.svelte`
  - `docs/00-redesign-plan.md`
  - `docs/progress/stage-7.4.md`
- **Decision**: Per-row retry is the only way to identify which energies are out of range
  because the C library returns a single error code for the whole batch. The retry adds
  N WASM calls when a batch fails, but this only happens when at least one energy is
  out of range (a rare user error), not on normal calculation paths.
- **Issue**: none unresolved
