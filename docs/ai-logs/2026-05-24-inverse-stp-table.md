# 2026-05-24 — Issue #560: Inverse-STP table (high-E default, sticky low-E reveal, 2-series plot)

## Session Narrative

### Prompt 1: Plan and implement issue #560

**User request**: Implement issue #560 — inverse-STP table with high-E branch default, sticky low-E column reveal, and 2-series plot integration. No whitespace changes in unrelated files. Add AI logs and ensure E2E tests pass.

**AI response**: Researched the issue via GitHub MCP, audited existing state files, built a plan covering 9 implementation steps. Then executed:

1. **`src/lib/utils/inverse-stp.ts`** (NEW) — branch side constants (`HIGH_E_SIDE = 1`, `LOW_E_SIDE = 0`) and `StpBranchState` type. Single source of truth replacing magic numbers scattered across the calculator page.

2. **`src/lib/state/inverse-lookups.svelte.ts`** — added `stpBranchState: StpBranchState` field, `setStpBranchState()` and `removeStpRow()` methods to `InverseLookupState`. Default branch state is `"hi"`.

3. **`src/lib/components/results/table-inverse-stp.svelte`** (NEW) — full table component:
   - High-E column shown by default; low-E column conditionally rendered when `stpBranchState === "both"` OR any row has 2 solutions
   - One-time tint animation (amber-100 background, 600 ms) on low-E column reveal using `loEColumnJustRevealed` state
   - `$effect` syncs `stpBranchState` ↔ `showLowEColumn` (auto-encodes to URL)
   - Plot button shown only on 2-solution rows; calls `onPlotRow` prop
   - All existing testids preserved: `inverse-stp-input-{i}`, `inverse-stp-result-high-{i}`, `inverse-stp-result-low-{i}`, `inverse-stp-row-error-{i}`
   - New testids: `inverse-stp-table`, `col-hi-e`, `col-lo-e`, `inverse-stp-delete-{i}`, `inverse-stp-plot-{i}`

4. **`src/lib/utils/calculator-url.ts`** — added `istpBranchState?: StpBranchState` to `CalculatorUrlState`; encode emits `istpbranch=both` when imode=stp and state is both; decode reads `istpbranch` param.

5. **`src/routes/calculator/+page.svelte`** — replaced ≈85-line inline STP grid with `<TableInverseStp>` component; wired `onPlotRow` to navigate to `/plot?…&inv_stp_branch=both`; fixed pre-existing `ivalues:` → `lookups:` bug in URL encoding; replaced magic `side: 0/1` with `LOW_E_SIDE`/`HIGH_E_SIDE`; removed now-unused `STP_ANCHOR_OPTIONS` and `formatEnergy`.

6. **`src/lib/state/plot.svelte.ts`** — added `labelSuffix?: string` to `PlotSeriesData`; included it in `addSeries` dedup check; appended it in `recomputeLabels`. Enables two legend entries for the same entity triple.

7. **`src/routes/plot/+page.svelte`** — detect `inv_stp_branch=both` URL param on init; when present, add two series with `labelSuffix: " high-E"` and `labelSuffix: " low-E"` respectively.

8. **`src/tests/unit/inverse-stp-utils.test.ts`** (NEW) — 3 unit tests verifying `LOW_E_SIDE === 0`, `HIGH_E_SIDE === 1`, `HIGH_E_SIDE > LOW_E_SIDE`.

9. **`src/tests/unit/calculator-url.test.ts`** — added 4 round-trip tests for `istpbranch=both` encode/decode, default `"hi"`, `hi` not emitted in URL, not emitted when `imode=csda`.

10. **`tests/e2e/inverse-stp.spec.ts`** (NEW) — 8 E2E tests covering: single column default, 2-solution reveals low-E, single-solution shows `—`, auto-collapse, `?istpbranch=both` load, URL encoding, Plot button navigation, plot page 2-series creation.

**Notable fix**: Pre-existing bug in `calculator/+page.svelte` where `ivalues:` was used instead of `lookups:` in the URL state for both csda and stp inverse-lookup modes. Fixed as part of this session.

## Tasks

### Issue #560 — Inverse-STP table

- **Status**: completed
- **Stage**: Stage 8 / #560
- **Files changed**:
  - `src/lib/utils/inverse-stp.ts` (NEW)
  - `src/lib/state/inverse-lookups.svelte.ts`
  - `src/lib/components/results/table-inverse-stp.svelte` (NEW)
  - `src/lib/utils/calculator-url.ts`
  - `src/routes/calculator/+page.svelte`
  - `src/lib/state/plot.svelte.ts`
  - `src/routes/plot/+page.svelte`
  - `src/tests/unit/inverse-stp-utils.test.ts` (NEW)
  - `src/tests/unit/calculator-url.test.ts`
  - `tests/e2e/inverse-stp.spec.ts` (NEW)
- **Decision**: `stpBranchState` is stored on `InverseLookupState` (not in a Svelte store or URL-only) so the table component can derive column visibility reactively. The `$effect` in the table syncs back to state for URL encoding.
- **Decision**: `labelSuffix` on `PlotSeriesData` was the minimal change needed to bypass the per-entity dedup logic without breaking existing single-series behavior.
- **Issue**: E2E computation tests require real WASM binary in `static/wasm/`; they are guarded with `test.skip(!wasmPresent)` so they skip cleanly in CI without WASM.
