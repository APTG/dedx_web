# 2026-05-24 — Combined Advanced result table (issue #559)

## Session Narrative

### Prompt 1: Implement issue #559 — combined Advanced result table for Energy → and Range → modes

**AI response**: Created `table-advanced.svelte` — a single combined input+output grid
component for Advanced mode in single-entity configuration. Applied the same component
for the Range → mode (different column headers, different state source). Removed the
standalone `UnitAnchorStrip` that appeared between the entity picker and results for
single-entity Advanced mode; unit selection moved inside the new component. The inline
Range → grid in `+page.svelte` (≈90 lines) was replaced by a single `<TableAdvanced>`
call.

Key design decisions:

- `table-advanced.svelte` uses a discriminated-union-style props interface: `mode="energy"`
  requires `calcState` + `entitySelection`; `mode="range"` requires `inverseLookupState`.
  Svelte 5 `$props()` with type-narrowed derived values handles both branches.

- The `→ MeV/nucl` column is fully conditional: it is only rendered (both `<th>` and
  `<td>`) when `calcState.isPerRowMode` is true, i.e. when at least one row has an inline
  unit suffix (e.g. "10 keV"). This matches the acceptance criterion.

- Row 1 (index 0) always carries `bg-amber-50/50 dark:bg-amber-950/20` — the faint yellow
  tint. Sticky-left `≡` handle column with `position: sticky; left: 0` backed by
  `bg-card`-equivalent classes.

- The `×` delete button calls the new `removeRow` / `removeRangeRow` methods added to
  `CalculatorState` and `InverseLookupState` respectively. Both are no-ops when only one
  row remains.

- `value-formatters.ts` (created in #556) was extended with `formatStpValue` (re-exported
  from `calculator.svelte.ts`) and `formatEnergy` (wrapper around
  `formatEnergyWithUnit(mev, "MeV")` from `energy-autoscale.ts`). This gives
  `table-advanced.svelte` a single import point for all display formatters.

- The standalone `UnitAnchorStrip` in `+page.svelte` is now conditionally shown only when
  `multiProgState !== null || multiEntityState !== null` — i.e. multi-program and
  multi-entity Advanced modes, which still use the existing `ResultTable`. This is the last
  step before the `energy-unit-selector` concept disappears entirely; the file itself will
  be deleted in #563.

## Tasks

### Create `src/lib/components/results/table-advanced.svelte`

- **Status**: completed
- **Stage**: Advanced mode — combined input+output grid
- **Files changed**: `src/lib/components/results/table-advanced.svelte` (NEW)
- **Decision**: Single component for both Energy → and Range → modes via `mode` prop; avoids
  duplicating sticky-column and row-1-tint logic.

### Extend `value-formatters.ts`

- **Status**: completed
- **Files changed**: `src/lib/components/results/value-formatters.ts`
- **Decision**: Re-export `formatStpValue` from `calculator.svelte.ts` and add `formatEnergy`
  wrapper; keeps result components from importing directly from state modules.

### Add `removeRow` / `removeRangeRow` to state

- **Status**: completed
- **Files changed**:
  - `src/lib/state/calculator.svelte.ts` — `CalculatorState` interface + implementation
  - `src/lib/state/inverse-lookups.svelte.ts` — `InverseLookupState` interface + implementation
- **Decision**: `removeRow` delegates to the existing `EnergyInputState.removeRow` which
  already guards against removing the last row.

### Wire up `+page.svelte`

- **Status**: completed
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Replaced the ≈90-line inline Range → grid and the single-entity Advanced
  `ResultTable` call with `<TableAdvanced>`. Conditioned the standalone `UnitAnchorStrip`
  to only render for multi-program/multi-entity — this is the moment the legacy
  `energy-unit-selector.svelte` Advanced call sites disappear from single-entity mode;
  the file itself can be deleted in #563.

### Create Playwright E2E tests

- **Status**: completed
- **Files changed**: `tests/e2e/advanced-combined-table.spec.ts` (NEW)
- **Issue**: Snapshot test (`toMatchAriaSnapshot`) requires WASM binary and will skip in
  CI until the WASM artifact is available.
