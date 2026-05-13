# Stage 7.4 — WASM Error Handling

**Status:** ✅ Complete  
**Branch:** `feature/stage-7-4-wasm-error-handling`  
**Specs:** `docs/04-feature-specs/calculator.md`, `docs/06-wasm-api-contract.md`

## What was already done (no changes needed)

- `LibdedxError` class with `code` + `message` in `src/lib/wasm/types.ts`
- Global WASM load error state (`wasmReady` / `wasmError`) in `src/lib/state/ui.svelte.ts`
- Calculator page "Failed to load the calculation engine" panel with Retry button and Show details toggle (`src/routes/calculator/+page.svelte:1082–1097`)
- Skeleton loading state while WASM initialises
- Validation summary (invalid + out-of-range row counts) below result table
- `hasLargeInput` warning
- Per-program errors in multi-program mode
- Inverse lookup row-level error display

## What was implemented

### 1. Per-row retry on DEDX_ERR_ENERGY_OUT_OF_RANGE

**File:** `src/lib/state/calculator.svelte.ts`

When `service.calculate()` throws `LibdedxError(101, ...)` (energy outside the tabulated range),
the new code falls back to calling `callService([energy])` individually for each row:

- Rows that succeed → stored in `calculationResults`, shown normally
- Rows that fail with 101 → added to `outOfRangeRowIds`, rendered as `status: "out-of-range"`
  with message "Energy out of tabulated range" and red border in the input cell

`outOfRangeRowIds` is cleared at the start of each calculation and in `clearResults()` / `resetAll()`.

The `processResults()` helper extracts the batch-to-map conversion so both the batch
and per-row paths share the same display logic.

**Why per-row retry:** The C library (`_dedx_get_stp_table`) processes all energies in one call
and returns a single error code when any energy is out of range — it doesn't tell us which ones.
Per-row retry is the only way to identify the offending rows without changes to the C library.

### 2. Fatal calculation error panel

**File:** `src/lib/components/result-table.svelte`

When `calcState.error` is non-null (a non-101 `LibdedxError` from the WASM layer), a panel
appears below the validation summary with:
- Human-readable error message in destructive colour
- `<details>` / `<summary>` "Show details" toggle revealing `LibdedxError code: N`

The error state is already reset to `null` at the start of each calculation in `performCalculation()`.

### 3. Plot preview error surfaced

**File:** `src/routes/plot/+page.svelte`

The `catch` block in the preview `$effect` no longer silently calls `console.error`.
Instead, `previewError = err instanceof Error ? err.message : String(err)` is set,
and an inline `<p class="text-xs text-destructive">Preview failed: …</p>` appears above
the series legend. The error is cleared (`previewError = null`) at the start of each
preview recalculation.

## Files changed

- `src/lib/state/calculator.svelte.ts` — `outOfRangeRowIds` state, `parseRow()` check, refactored `performCalculation()`
- `src/lib/components/result-table.svelte` — `calcState.error` display panel
- `src/routes/plot/+page.svelte` — `previewError` state + display
- `docs/00-redesign-plan.md` — Stage 7.4 marked ✅
