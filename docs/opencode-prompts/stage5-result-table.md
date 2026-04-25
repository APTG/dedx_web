# opencode prompt — Stage 5.4: Result Table (unified input/result table)

> Paste this entire file into opencode as your first message.
> Branch: `qwen/stage5-result-table`

---

## Context

You are implementing **Stage 5.4** of the dEdx Web v2 rewrite — a SvelteKit + Svelte 5
(runes only) + TypeScript application for stopping-power calculations via a WebAssembly
C library (libdedx).

Start by reading these files in full before writing a single line of code:

- `docs/00-redesign-plan.md` — overall plan, stage map, commit conventions
- `docs/04-feature-specs/calculator.md` — primary spec for this task (the unified
  input/result table is the centrepiece of the Calculator page)
- `docs/04-feature-specs/unit-handling.md` — all unit conversion rules, SI prefix
  auto-scaling, stopping power defaults, Appendix A numeric fixtures
- `docs/06-wasm-api-contract.md` — LibdedxService interface and types
- `CHANGELOG-AI.md` (top 20 rows) — recent session history

Also skim these to understand what is already built:

- `src/lib/wasm/types.ts` — `EnergyUnit`, `StpUnit`, `RangeUnit`, `CalculationResult`,
  `LibdedxService`, `MaterialEntity`, `ParticleEntity`
- `src/lib/utils/energy-parser.ts` — `ParseResult`, per-row text parsing (reuse it)
- `src/lib/utils/energy-conversions.ts` — `convertEnergyToMeVperU()`, `convertEnergyFromMeVperU()` (reuse these)
- `src/lib/state/energy-input.svelte.ts` — `EnergyInputState`, `EnergyRow` (rows with
  text + error, masterUnit, isPerRowMode, getParsedEnergies()) — you will extend this
- `src/lib/state/entity-selection.svelte.ts` — `EntitySelectionState` interface:
  `selectedParticle`, `selectedMaterial`, `resolvedProgramId`, `isComplete`
- `src/lib/state/ui.svelte.ts` — `wasmReady` reactive flag
- `src/lib/wasm/loader.ts` — `getService()` returns `Promise<LibdedxService>`
- `src/lib/wasm/__mocks__/libdedx.ts` — mock service used in Vitest tests; check what
  data is available (programs, particles, materials, calculate() output)
- `src/routes/calculator/+page.svelte` — current calculator page (you will rewrite part of it)
- `src/tests/unit/` — existing test files (follow the same patterns)

---

## Svelte 5 rules (NON-NEGOTIABLE)

Use **runes only**. Never use Svelte 4 patterns.

| Use | Never use |
|-----|-----------|
| `$state`, `$derived`, `$effect`, `$props`, `$bindable` | `export let`, `$:` reactive statements |
| `$effect` for side effects & lifecycle | `onMount` / `onDestroy` |
| Module-level fine-grained reactivity | `svelte/store` / `$` auto-subscriptions |
| | `createEventDispatcher()` |

State files live in `src/lib/state/*.svelte.ts` — they use `$state`/`$derived` at
function scope (inside a factory function), NOT at module scope.

---

## What you are building

A **unified input/result table** on the Calculator page. The table has 5 columns:

| Col | Header | Editable? | Content |
|-----|--------|-----------|---------|
| 1 | Energy ({unit}) | **Yes** — `<input type="text">` | User types energy value, optionally with unit suffix |
| 2 | → MeV/nucl | No | Normalized energy in MeV/nucl (4 sig figs) |
| 3 | Unit | Via dropdown (per-row mode only) | Base unit for this row |
| 4 | Stopping Power ({unit}) | No | keV/µm (non-gas) or MeV·cm²/g (gas), 4 sig figs |
| 5 | CSDA Range | No | Auto-scaled length (nm/µm/mm/cm/m), 4 sig figs, unit inline |

The table replaces the existing `<EnergyInput>` component on the calculator page.
`EnergyInputState` (which manages the text rows) stays unchanged — you extend the
Calculator page to also run calculations and display results.

---

## Task breakdown

Work through the tasks in order. **TDD for every task that involves logic** — write
failing tests first, make them pass, then commit. Commit after each complete task.
Use Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`).

---

### Task 0 — Housekeeping (commit immediately, no tests needed)

Update `docs/00-redesign-plan.md` Stage 5 list to mark the unit selector as complete:

Find this line (around line 508):
```
  3. Unit selector — radio/segmented control
```
Replace with:
```
  3. ✅ Unit selector — radio/segmented control (merged PR #370, Apr 2026)
```

Also update the entry below it to show Stage 5.4 is in progress:
```
  4. Result table — reactive rendering
```
→
```
  4. 🚧 Result table — unified input/result table (Stage 5.4, in progress)
```

Commit: `docs: mark unit selector complete, start result table in redesign plan`

---

### Task 1 — Unit conversion utilities (TDD)

Create `src/lib/utils/unit-conversions.ts` with these pure functions:

```typescript
/** Convert mass stopping power (MeV·cm²/g) to linear stopping power (keV/µm).
 *  Formula: S_kevum = S_mass × ρ / 10   where ρ in g/cm³.
 *  Returns null when density is missing or ≤ 0. */
export function stpMassToKevUm(stpMass: number, densityGcm3: number): number | null

/** Convert mass stopping power (MeV·cm²/g) to MeV/cm.
 *  Formula: S_linear = S_mass × ρ */
export function stpMassToMeVcm(stpMass: number, densityGcm3: number): number | null

/** Convert CSDA range from g/cm² to cm.
 *  Formula: range_cm = range_gcm2 / ρ
 *  Returns null when density ≤ 0. */
export function csdaGcm2ToCm(csdaGcm2: number, densityGcm3: number): number | null

/** Auto-scale a length in cm to the most human-readable SI prefix.
 *  Returns { value, unit } where unit is one of: 'nm' | 'µm' | 'mm' | 'cm' | 'm'.
 *  Rule: choose prefix so the displayed number is in [1, 9999].
 *  Table (from unit-handling.md §6):
 *    ≥ 100 cm  → m
 *    ≥ 1 cm    → cm
 *    ≥ 0.1 cm  → mm  (i.e. ≥ 1 mm)
 *    ≥ 1e-4 cm → µm  (i.e. ≥ 1 µm)
 *    < 1e-4 cm → nm
 */
export function autoScaleLengthCm(cm: number): { value: number; unit: 'nm' | 'µm' | 'mm' | 'cm' | 'm' }

/** Format a number to n significant figures, no scientific notation, no grouping separators. */
export function formatSigFigs(value: number, sigFigs: number): string
```

Write tests first in `src/tests/unit/unit-conversions.test.ts`.
Use the **normative numeric fixtures** from `unit-handling.md` Appendix A §A.2 and §A.3:

```
// Stopping power fixtures (S_mass=25, ρ=1.0):
stpMassToKevUm(25, 1.0)  → 2.5
stpMassToMeVcm(25, 1.0)  → 25
// gas fixture (S_mass=25, ρ=0.0012):
stpMassToKevUm(25, 0.0012) → 0.003

// CSDA range fixtures (range_mass=0.2, ρ=1.0):
csdaGcm2ToCm(0.2, 1.0) → 0.2
autoScaleLengthCm(0.2)  → { value: 2, unit: 'mm' }
autoScaleLengthCm(0.00012) → { value: 1.2, unit: 'µm' }
autoScaleLengthCm(250) → { value: 2.5, unit: 'm' }

// formatSigFigs:
formatSigFigs(45.7623, 4)  → '45.76'
formatSigFigs(0.001234, 4) → '0.001234'
formatSigFigs(12340, 4)    → '12340'
```

Confirm all tests pass: `pnpm test -- unit-conversions`
Commit: `test: add unit-conversions tests (RED→GREEN)`

---

### Task 2 — Calculator state (TDD)

Create `src/lib/state/calculator.svelte.ts`.

This file owns the full reactive state for the Calculator page, bridging entity
selection, energy input, and WASM calculation results.

**Interface to export:**

```typescript
export interface CalculatedRow {
  id: number;                   // from EnergyInputState row
  rawInput: string;             // user-typed text
  normalizedMevNucl: number | null;   // for the "→ MeV/nucl" column
  unit: EnergyUnit;             // effective unit for this row
  unitFromSuffix: boolean;      // true when suffix was typed
  status: 'valid' | 'invalid' | 'out-of-range' | 'empty';
  message?: string;             // validation error text
  stoppingPower: number | null; // in display unit (stpDisplayUnit)
  csdaRangeCm: number | null;   // in cm (before auto-scaling for display)
}

export interface CalculatorState {
  rows: CalculatedRow[];
  stpDisplayUnit: StpUnit;          // 'keV/µm' for solid/liquid, 'MeV·cm²/g' for gas
  masterUnit: EnergyUnit;
  isPerRowMode: boolean;
  isCalculating: boolean;
  error: LibdedxError | null;
  validationSummary: { valid: number; invalid: number; outOfRange: number; total: number };
  setMasterUnit(unit: EnergyUnit): void;
  setRowUnit(index: number, unit: EnergyUnit): void;
  updateRowText(index: number, text: string): void;
  handleBlur(index: number): void;
}

export function createCalculatorState(
  entitySelection: EntitySelectionState,
  service: LibdedxService
): CalculatorState
```

**Implementation notes:**

1. Internally reuse `createEnergyInputState()` from `energy-input.svelte.ts` for
   row management (text, masterUnit, isPerRowMode, getParsedEnergies()).

2. Use `parseEnergyInput()` from `energy-parser.ts` to parse each row's text.
   Use `convertEnergyToMeVperU()` from `energy-conversions.ts` to normalize to
   MeV/nucl (the C API always takes MeV/nucl for ions; for electron, the C API
   takes MeV, but `massNumber=1` so the conversion is identity).

3. `stpDisplayUnit` is `$derived` from `entitySelection.selectedMaterial.isGasByDefault`:
   - `true` → `'MeV·cm²/g'`
   - `false` (or null) → `'keV/µm'`

4. Debounced `$effect` (300ms) watches valid energies. When
   `entitySelection.isComplete` and there are valid energies:
   - Call `service.calculate(resolvedProgramId, particleId, materialId, validMevNuclEnergies)`
   - Map results back to `CalculatedRow.stoppingPower` (converted via `stpMassToKevUm`
     or leave as MeV·cm²/g depending on `stpDisplayUnit`) and `csdaRangeCm` (via
     `csdaGcm2ToCm`).
   - Use material density from `entitySelection.selectedMaterial.density`.

5. Entity selection changes (particle/material/program) trigger **immediate**
   recalculation (no debounce) — use a separate `$effect` that tracks
   `entitySelection.resolvedProgramId`, `entitySelection.selectedParticle?.id`,
   `entitySelection.selectedMaterial?.id`.

6. `isCalculating` is set to `true` when a debounce is pending or a WASM call is
   running, `false` when done.

7. The `rows` getter returns `CalculatedRow[]` — always has at least one empty row at
   the end (the "always-empty-row" pattern from `EnergyInputState`).

Write tests in `src/tests/unit/calculator-state.test.ts`.
Use the existing mock service from `src/lib/wasm/__mocks__/libdedx.ts`.
Use `vi.useFakeTimers()` to control debounce timing.

Key test cases:
- On init: one pre-filled row `100`, stpDisplayUnit = 'keV/µm' (water is non-gas).
- After 300ms debounce: `calculate()` called with `[100]`, row gains stoppingPower and csdaRangeCm.
- Changing master unit to MeV/nucl for a heavy ion: `normalizedMevNucl` changes, calc retriggers.
- Gas material (air): `stpDisplayUnit` switches to `'MeV·cm²/g'`.
- Invalid row (abc): status = 'invalid', excluded from calculation call.
- Entity selection change triggers immediate recalculation (no 300ms wait).

Confirm: `pnpm test -- calculator-state`
Commit: `feat(stage5.4): calculator state with debounced calculation`

---

### Task 3 — ResultTable component (TDD)

Create `src/lib/components/result-table.svelte`.

**Props:**

```typescript
interface Props {
  state: CalculatorState;
  entitySelection: EntitySelectionState;
  class?: string;
}
```

**Structure:**

```html
<div class="overflow-x-auto">
  <table class="w-full text-sm">
    <thead class="sticky top-0 bg-background">
      <tr>
        <th scope="col" class="text-left ...">Energy ({masterUnit})</th>
        <th scope="col" class="text-right ...">→ MeV/nucl</th>
        <th scope="col" class="text-right ...">Unit</th>
        <th scope="col" class="text-right ...">
          Stopping Power ({stpUnitLabel})
        </th>
        <th scope="col" class="text-right ...">CSDA Range</th>
      </tr>
    </thead>
    <tbody>
      {#each state.rows as row, i (row.id)}
        <!-- one <tr> per row -->
      {/each}
    </tbody>
  </table>
</div>
```

**Per-row rendering:**

- Column 1 (Typed Value): `<input type="text" value={row.rawInput} ...>`.
  Red outline when `row.status === 'invalid'` or `'out-of-range'`.
  Paste handler: split pasted text by newline → create multiple rows.
  Enter/Tab: focus next row's input (or always-empty-row).

- Column 2 (→ MeV/nucl): show `row.normalizedMevNucl` formatted to 4 sig figs.
  Empty when row is invalid/empty. Use monospace font.

- Column 3 (Unit): 
  - In **master mode** (`!state.isPerRowMode`): plain text label showing `row.unit`.
  - In **per-row mode**: a small `<select>` dropdown with options `['MeV', 'MeV/nucl']`
    (or just `['MeV']` for proton/electron). On change: call `state.setRowUnit(i, newUnit)`.

- Column 4 (Stopping Power): `row.stoppingPower` formatted to 4 sig figs.
  Empty when null. Monospace, right-aligned.

- Column 5 (CSDA Range): call `autoScaleLengthCm(row.csdaRangeCm)` → show
  `{value} {unit}` (e.g., "7.718 cm"). Empty when null. Monospace, right-aligned.

**Below the table:**

- Validation summary line (when any errors): 
  "N of M values excluded (N invalid, N out of range)"

- Loading indicator when `state.isCalculating`: a subtle spinner or pulsing text
  "Calculating…" on the result columns.

- Empty state when `!entitySelection.isComplete`:
  "Select a particle and material to calculate."

**Styling (Tailwind):**

- `font-mono` on all numeric cells.
- `text-right` on columns 2–5.
- `text-left` on column 1.
- Alternating row background: `even:bg-muted/30`.
- Sticky header: `sticky top-0 bg-background`.
- Horizontal scroll on overflow: `overflow-x-auto` on the wrapper div.
- Invalid row input: `border-red-500 bg-red-50` (or use `dark:bg-red-950` for dark mode).

Write component tests in `src/tests/components/result-table.test.ts`.
Use `@testing-library/svelte` (same pattern as `entity-selection-comboboxes.test.ts`).

Key test cases:
- Renders 5 column headers including the master unit in col-1 header.
- A row with stoppingPower=2.5 and csdaRangeCm=0.002 shows "2.500" and "2.000 mm".
- A row with status='invalid' has red styling on the input.
- Shows "Select a particle and material to calculate" when `isComplete = false`.
- In per-row mode, shows a `<select>` in the Unit column.

Confirm: `pnpm test -- result-table`
Commit: `feat(stage5.4): ResultTable component`

---

### Task 4 — Wire into Calculator page

Update `src/routes/calculator/+page.svelte` to use the new `CalculatorState` and
`ResultTable` component.

Replace the current page content (which uses `EnergyInput` standalone) with:

```svelte
<script lang="ts">
  import { wasmReady } from "$lib/state/ui.svelte";
  import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { createCalculatorState } from "$lib/state/calculator.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import EnergyUnitSelector from "$lib/components/energy-unit-selector.svelte";
  import ResultTable from "$lib/components/result-table.svelte";
  import { getService } from "$lib/wasm/loader";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { CalculatorState } from "$lib/state/calculator.svelte";

  let entityState = $state<EntitySelectionState | null>(null);
  let calcState = $state<CalculatorState | null>(null);

  $effect(() => {
    if (wasmReady.value && !entityState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        entityState = createEntitySelectionState(matrix);
        calcState = createCalculatorState(entityState, service);
      });
    }
  });
</script>

<svelte:head>
  <title>Calculator - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">Calculator</h1>

  {#if !wasmReady.value || !entityState || !calcState}
    <div class="rounded-lg border bg-card p-6 text-center">
      <p class="text-muted-foreground">Loading calculation engine…</p>
    </div>
  {:else}
    <div class="mx-auto max-w-2xl space-y-4">
      <SelectionLiveRegion state={entityState} />

      <div class="flex flex-wrap items-end gap-4">
        <EntitySelectionComboboxes state={entityState} />
        <EnergyUnitSelector
          masterUnit={calcState.masterUnit}
          availableUnits={/* derive from entityState.selectedParticle */}
          disabled={calcState.isPerRowMode}
          onValueChange={(u) => calcState!.setMasterUnit(u)}
        />
      </div>

      <div class="rounded-lg border bg-card">
        <ResultTable state={calcState} entitySelection={entityState} />
      </div>
    </div>
  {/if}
</div>
```

For `availableUnits` derive from `entityState.selectedParticle`:
- massNumber === 1 (proton) or id === 1001 (electron): `['MeV']`
- massNumber > 1: `['MeV', 'MeV/nucl']`

After wiring: run `pnpm dev` and manually verify:
- Default load shows Proton / Water / 100 MeV with stopping power ≈ 45.76 keV/µm and range ≈ 7.718 cm.
- Typing `200` in the second row adds a new empty row below and shows results after ~300ms.
- Switching to Carbon (A=12) shows MeV/nucl option in the unit selector.
- Selecting Air switches stopping power column header to MeV·cm²/g.

Commit: `feat(stage5.4): wire ResultTable into calculator page`

---

### Task 5 — AI session logging (no code, mandatory)

**5a.** Prepend a row to `CHANGELOG-AI.md` (top of the table body):

```
| 2026-04-25 | 5.4 | Stage 5.4: Result table — unified input/result table, unit conversions, calculator state, ResultTable component (opencode + Qwen3.5-397B via opencode) | [log](docs/ai-logs/2026-04-25-stage5-result-table.md) |
```

Replace the date with today's actual date.

**5b.** Create `docs/ai-logs/YYYY-MM-DD-stage5-result-table.md` (replace date):

```markdown
# YYYY-MM-DD — Stage 5.4: Result Table

**Model:** opencode + Qwen3.5-397B via opencode (PLGrid llmlab)

## Session Narrative

### Prompt 1: implement Stage 5.4 result table
**AI response**: <what was done, key decisions>

## Tasks

### Task 0: Housekeeping — mark unit selector ✅ in redesign plan
- **Status**: completed
- **Stage**: 5 housekeeping
- **Files changed**: docs/00-redesign-plan.md

### Task 1: unit-conversions.ts utility functions
- **Status**: completed
- **Stage**: 5.4
- **Files changed**: src/lib/utils/unit-conversions.ts, src/tests/unit/unit-conversions.test.ts
- **Decision**: pure functions, no class — easier to test and import

### Task 2: calculator.svelte.ts state
- **Status**: completed | partial | blocked
- **Stage**: 5.4
- **Files changed**: src/lib/state/calculator.svelte.ts, src/tests/unit/calculator-state.test.ts

### Task 3: ResultTable component
- **Status**: completed | partial | blocked
- **Stage**: 5.4
- **Files changed**: src/lib/components/result-table.svelte, src/tests/components/result-table.test.ts

### Task 4: Wire into calculator page
- **Status**: completed | partial | blocked
- **Stage**: 5.4
- **Files changed**: src/routes/calculator/+page.svelte

### Outstanding issues
- list anything unresolved or deferred
```

**5c.** Update `docs/ai-logs/README.md` to add the new session log entry.

Commit: `docs: add Stage 5.4 session log and changelog entry`

---

### Task 6 — Update progress docs

Update `docs/progress/stage-5-entity-selection.md` (the active Stage 5 progress file):

1. Under the TODO table for "Result table", add a note that Task is now in progress.
2. Update the "## TODO for next session" section to reflect that Task 1–3 of the
   TODO list (layout fix, alias filter, etc.) are still pending.

OR create a new `docs/progress/stage-5-result-table.md` if you believe the scope
warrants its own file (following the pattern of previous stage files).

Commit: `docs: update Stage 5 progress with result table status`

---

## Acceptance gate

Before raising a PR, all of the following must pass:

```sh
pnpm lint         # ESLint must pass clean
pnpm check        # svelte-check + tsc strict mode
pnpm test         # all Vitest unit tests pass (currently 313 tests)
pnpm build        # static build succeeds
```

The PR title should be: `feat(stage5.4): unified input/result table`

---

## Key constraints / don'ts

- **Never use Svelte 4 patterns** — no `export let`, no `$:`, no `onMount`, no stores.
- **Never call the C library directly** from components — always go through `LibdedxService`.
- **Never modify `libdedx.ts`** or `types.ts` — use what is there.
- **Never add `getDensity()` to `LibdedxService`** — density is already on
  `MaterialEntity.density`. Use `entitySelection.selectedMaterial?.density ?? 1`.
- **Don't add MeV/u to the unit selector** — that's Advanced mode only (not in v1).
- **Don't implement export, shareable URLs, or advanced options** — those are Stage 6+.
- **Keep comments minimal** — only where the WHY is non-obvious (physics invariant,
  workaround, hidden constraint).
- **Commit after each task** — don't batch all changes into one giant commit.
- **Fill in the AI log properly** — the attribution line `opencode + Qwen3.5-397B`
  is mandatory for traceability.
