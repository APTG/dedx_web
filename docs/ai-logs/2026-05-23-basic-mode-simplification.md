# 2026-05-23 — Basic mode simplification (issue #556)

## Session Narrative

### Prompt 1: Implement issue #556 — Basic mode simplification

**AI response**: Implemented the full scope of issue #556 in four files, plus two new files.

**Key decisions:**

- `switchParticle` in `calculator.svelte.ts` now branches on `isAdvancedMode.value`: Advanced mode keeps the existing KE-conservation `convertRowsForNewParticle` logic; Basic mode preserves typed values and auto-sets `masterUnit` to `"MeV"` (proton/electron) or `"MeV/nucl"` (heavy ions). This is the "drop the Basic-only branch of masterUnit writes" mentioned in the issue — the label is now fully derived from the auto-set `masterUnit`, no explicit Basic-specific write cascade needed elsewhere.

- Ghost note uses a plain JS `prevIsHeavyIon` variable (not `$state`) inside the `$effect` to track previous particle type without creating a reactive self-dependency cycle.

- Single-row card vs multi-row table is driven by `calcState.rows.length === 1` exactly as specified.

- `EnergyUnitSelector` is now wrapped in `{#if isAdvancedMode.value}` in `+page.svelte` — it only renders in Advanced mode.

- Basic mode in `+page.svelte` now uses `<TableBasic>` instead of `<ResultTable>`. Advanced mode (multi-program, multi-entity, single-program) continues to use `<ResultTable>` unchanged.

- KE-conservation unit tests were moved into an `"Advanced mode only"` describe block (with `beforeEach/afterEach` toggling `isAdvancedMode.value`) and two new Basic-mode tests were added verifying value preservation + `masterUnit` auto-switch.

## Tasks

### Issue #556 — Basic mode simplification

- **Status**: completed
- **Stage**: Basic mode · PR bundle #B (with #557)
- **Files changed**:
  - `src/lib/components/results/value-formatters.ts` (NEW)
  - `src/lib/components/results/table-basic.svelte` (NEW)
  - `src/lib/state/calculator.svelte.ts` (switchParticle Basic/Advanced branch)
  - `src/routes/calculator/+page.svelte` (import TableBasic, gate EnergyUnitSelector)
  - `src/tests/unit/calculator-state.test.ts` (update KE-conservation tests to Advanced mode)
- **Decision**: Value preservation in Basic mode (no KE conversion on particle switch) follows the acceptance criterion "value unchanged". Typed values are reinterpreted under the new `masterUnit` rather than converted, which is simpler and matches the UX intent.
- **Issue**: The ghost note uses `sessionStorage` for per-tab dismissal persistence; SSR environments have no `sessionStorage`, so the code guards with `typeof sessionStorage !== "undefined"`.

### Prompt 2: Fix 14 E2E test failures on PR #567

**AI response**: Fixed all 14 failing E2E tests in two files.

**Root causes and fixes:**

1. `responsive.spec.ts` + `inverse-lookups.spec.ts` — both wait for `[data-testid="result-table"]` which was missing from the `table-basic.svelte` outer wrapper. Added `data-testid="result-table"` to the outer `<div>` in `table-basic.svelte`.

2. `particle-unit-switching.spec.ts` — three separate issues:
   - `waitForTable` used `thead th` (no `<thead>` in card mode) → changed to `[data-testid="energy-input-0"]` which exists in both card and table layouts.
   - "E_nucl conservation" and "Per-row unit dropdown" describe blocks test Advanced-only features (KE conversion on particle switch, `→ MeV/nucl` column, per-row unit select). These now navigate to `/calculator?advanced=1` in `beforeEach`.
   - "Add row UX" tests counted `tbody tr` (0 in card mode, always wrong starting point) → changed to `input[data-row-index]` which works in both card and table layouts.

- **Status**: completed
- **Files changed**:
  - `src/lib/components/results/table-basic.svelte` (add data-testid="result-table" to outer div)
  - `tests/e2e/particle-unit-switching.spec.ts` (waitForTable selector, advanced mode URL, row count selectors)
