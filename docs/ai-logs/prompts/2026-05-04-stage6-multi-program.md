# opencode task prompt — 2026-05-04

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation
> **Branch:** `qwen/stage-6-multi-program`
> **MCPs needed:** playwright, tailwind
> **TDD rule:** Write the failing test(s) first, then minimal impl.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging rules
2. `docs/04-feature-specs/multi-program.md` — **the normative spec for this entire session**.
   Read the complete file. Pay special attention to:
   - §Scope / Out of Scope (drag-and-drop and delta tooltips are **NOT in scope** here)
   - §State Model — `MultiProgramState` TypeScript shape
   - §Behavior — advanced mode toggle, program picker, grouped columns, column show/hide,
     quantity focus, partial failure, returning to basic mode
   - §Column Layout — Grouped by Quantity (wireframe table structure)
   - §URL Persistence — `mode`, `programs`, `hidden_programs`, `qfocus` parameters
   - §Acceptance Criteria (the reviewer grades against these)
3. `docs/06-wasm-api-contract.md` §`calculateMulti` — the JS contract for the new
   WASM call (lines around 453–459). `calculateMulti()` loops `calculate()` per program
   internally; it must **not** call any new C function — it is pure JS glue.
4. `src/lib/wasm/types.ts` — `LibdedxService` interface; you will add `calculateMulti()`.
5. `src/lib/wasm/libdedx.ts` — `LibdedxServiceImpl`; you will implement `calculateMulti()`.
6. `src/lib/wasm/__mocks__/libdedx.ts` — mock classes (`LibdedxServiceImpl`,
   `MockLibdedxServiceWithElectron`); you will add `calculateMulti()` to both.
7. `src/lib/state/calculator.svelte.ts` — existing Calculator state (500 lines);
   understand `calculateState`, `calcState`, debounce wiring before touching it.
8. `src/routes/calculator/+page.svelte` — Calculator page (228 lines); you will add
   the advanced-mode multi-picker and wire `calculateMulti()`.
9. `src/routes/+layout.svelte` — toolbar with Export/Share buttons; you will add
   the Basic/Advanced segmented control before the existing export buttons.
10. `src/lib/components/result-table.svelte` — existing result table (323 lines);
    you will add grouped-column support for advanced mode.
11. `src/lib/utils/calculator-url.ts` — URL encode/decode; you will add `mode`,
    `programs`, `hidden_programs`, `qfocus` round-trip.
12. `src/tests/unit/calculator-url.test.ts` — existing URL tests; add new cases here.

Key source files:

- `src/lib/wasm/types.ts`
- `src/lib/wasm/libdedx.ts`
- `src/lib/wasm/__mocks__/libdedx.ts`
- `src/lib/state/calculator.svelte.ts`
- `src/lib/state/advanced-mode.svelte.ts` (create new)
- `src/lib/state/multi-program.svelte.ts` (create new)
- `src/lib/components/multi-program-picker.svelte` (create new)
- `src/lib/components/result-table.svelte`
- `src/routes/calculator/+page.svelte`
- `src/routes/+layout.svelte`
- `src/lib/utils/calculator-url.ts`

Test files:

- `src/tests/unit/wasm-calculate-multi.test.ts` (create new)
- `src/tests/unit/advanced-mode.test.ts` (create new)
- `src/tests/unit/multi-program-state.test.ts` (create new)
- `src/tests/unit/calculator-url.test.ts` (add cases)
- `tests/e2e/calculator-advanced.spec.ts` (create new)

Run tests:

```sh
pnpm test                         # Vitest — 544 tests currently passing
pnpm exec playwright test         # E2E (needs WASM in static/wasm/)
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` § "AI Session Logging").
Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

Create `docs/ai-logs/2026-05-04-stage6-multi-program.md` before writing any code.
After all tasks complete, prepend a row to `CHANGELOG-AI.md` and add a one-liner
to `docs/ai-logs/README.md`.

---

## Task 1 — `calculateMulti()` WASM wrapper + unit tests

**Spec:** `docs/06-wasm-api-contract.md` §calculateMulti (lines ~453–459)

### Acceptance criteria

- `LibdedxService` interface in `src/lib/wasm/types.ts` declares
  `calculateMulti(params: { programIds: number[]; particleId: number; materialId: number; energies: number[]; options?: AdvancedOptions }): Map<number, CalculationResult | LibdedxError>`.
- `LibdedxServiceImpl` in `libdedx.ts` implements it by looping over `programIds`,
  calling `this.calculate()` for each; a `LibdedxError` thrown for one program is
  caught and stored for that key — other programs continue.
- Both mock classes in `__mocks__/libdedx.ts` implement `calculateMulti()`:
  return a `Map` with `CalculationResult` entries for every requested program ID
  using the same logic as the mock `calculate()`.
- TypeScript compiles clean (`pnpm check`).

### Step 1a — tests first (`src/tests/unit/wasm-calculate-multi.test.ts`)

```
service.calculateMulti({ programIds:[1,2], particleId:2, materialId:1, energies:[10,100] })
  → Map with keys 1 and 2, each a CalculationResult with energies.length === 2
service.calculateMulti({ programIds:[1,999], ... })
  → key 1: CalculationResult; key 999: LibdedxError
service.calculateMulti({ programIds:[], ... })
  → empty Map
```

Write the test using the mock `LibdedxServiceImpl` from `__mocks__/libdedx.ts`.
Run `pnpm test`, confirm RED.

### Step 1b — implement

In `src/lib/wasm/types.ts`, add to `LibdedxService`:

```typescript
calculateMulti(params: {
  programIds: number[];
  particleId: number;
  materialId: number;
  energies: number[];
  options?: AdvancedOptions;
}): Map<number, CalculationResult | LibdedxError>;
```

In `src/lib/wasm/libdedx.ts`, add to `LibdedxServiceImpl` (after `calculate()`):

```typescript
calculateMulti({ programIds, particleId, materialId, energies, options }) {
  const results = new Map<number, CalculationResult | LibdedxError>();
  for (const programId of programIds) {
    try {
      results.set(programId, this.calculate(programId, particleId, materialId, energies, options));
    } catch (e) {
      results.set(programId, e instanceof LibdedxError ? e : new LibdedxError(-1, String(e)));
    }
  }
  return results;
}
```

In `src/lib/wasm/__mocks__/libdedx.ts`, add the same `calculateMulti()` body to
both `LibdedxServiceImpl` and `MockLibdedxServiceWithElectron`.

### Done when

`pnpm test` is green (+new calculateMulti tests), `pnpm check` clean, then commit:

```
feat(wasm): add calculateMulti() to LibdedxService — loop calculate() per program, collect errors
```

---

## Task 2 — Advanced mode app-wide state + toolbar Basic/Advanced toggle

**Spec:** `docs/04-feature-specs/multi-program.md` §Inputs §1 (Advanced Mode Toggle),
§URL Persistence (`mode` param)

### Acceptance criteria

- `src/lib/state/advanced-mode.svelte.ts` exports:
  - `isAdvancedMode: { value: boolean }` — module-level `$state` wrapper
  - `toggleAdvancedMode()` — flips `isAdvancedMode.value`, persists to `localStorage('dedx_advanced_mode')`
  - `initAdvancedModeFromUrl(searchParams: URLSearchParams)` — reads `mode=advanced` from URL and syncs state
- The toolbar in `src/routes/+layout.svelte` shows a **Basic / Advanced** segmented
  control immediately before the existing export-buttons wrapper `<div>`. The active
  segment is highlighted. Clicking a segment calls `toggleAdvancedMode()` (if changing).
- Tailwind classes only (no custom CSS). Match the button style used for scale/unit
  toggles on the plot page — look at `src/routes/plot/+page.svelte` for reference.
- `aria-label="Switch to Advanced mode"` / `aria-label="Switch to Basic mode"` on each
  segment button; `aria-pressed` reflects the active state.

### Step 2a — tests first (`src/tests/unit/advanced-mode.test.ts`)

```
initial value → isAdvancedMode.value === false
toggleAdvancedMode() → value flips to true; localStorage key set
toggleAdvancedMode() again → value false; localStorage key cleared
initAdvancedModeFromUrl(new URLSearchParams("mode=advanced")) → value true
initAdvancedModeFromUrl(new URLSearchParams("")) → value false
```

Use `vi.stubGlobal('localStorage', ...)` for the localStorage mock.
Run `pnpm test`, confirm RED.

### Step 2b — implement

Create `src/lib/state/advanced-mode.svelte.ts`:

```typescript
import { browser } from "$app/environment";

export const isAdvancedMode = $state({ value: false });

export function toggleAdvancedMode(): void {
  isAdvancedMode.value = !isAdvancedMode.value;
  if (browser) {
    if (isAdvancedMode.value) localStorage.setItem("dedx_advanced_mode", "1");
    else localStorage.removeItem("dedx_advanced_mode");
  }
}

export function initAdvancedModeFromUrl(searchParams: URLSearchParams): void {
  isAdvancedMode.value = searchParams.get("mode") === "advanced";
}
```

In `src/routes/+layout.svelte`, after the `script` imports, import `isAdvancedMode`
and `toggleAdvancedMode`. Then, before the export-buttons `<div class="hidden sm:flex ...">`,
add:

```svelte
<div class="flex items-center rounded-md border border-border overflow-hidden text-sm">
  <button
    type="button"
    class={`px-3 py-1.5 transition-colors ${!isAdvancedMode.value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
    aria-pressed={!isAdvancedMode.value}
    aria-label="Switch to Basic mode"
    onclick={() => {
      if (isAdvancedMode.value) toggleAdvancedMode();
    }}>Basic</button
  >
  <button
    type="button"
    class={`px-3 py-1.5 transition-colors ${isAdvancedMode.value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
    aria-pressed={isAdvancedMode.value}
    aria-label="Switch to Advanced mode"
    onclick={() => {
      if (!isAdvancedMode.value) toggleAdvancedMode();
    }}>Advanced</button
  >
</div>
```

### Done when

`pnpm test` is green, Basic/Advanced toggle renders in toolbar, `pnpm lint` clean;
then commit:

```
feat(ui): add Basic/Advanced mode toggle to toolbar; advanced-mode state with localStorage
```

---

## Task 3 — Multi-select program picker component + multi-program state + Calculator wiring

**Spec:** `docs/04-feature-specs/multi-program.md` §Inputs §3 (Multi-Select Program Picker),
§State Model, §Behavior §Adding Comparison Programs, §Calculation Flow

### Acceptance criteria

- `src/lib/state/multi-program.svelte.ts` exports:
  - `createMultiProgramState(defaultProgramId: number, availablePrograms: ProgramEntity[]): MultiProgramState`
  - `MultiProgramState` has: `selectedProgramIds: number[]` (first = default, always locked),
    `columnVisibility: Map<number, boolean>`, `quantityFocus: 'both' | 'stp' | 'csda'`,
    `comparisonResults: Map<number, CalculationResult | LibdedxError>` — all as `$state`.
  - Methods: `selectProgram(id)`, `deselectProgram(id)`, `setColumnVisible(id, v)`,
    `setQuantityFocus(f)`, `setResults(results: Map<number, CalculationResult | LibdedxError>)`.
- `src/lib/components/multi-program-picker.svelte` renders a dropdown button
  ("Programs ▾") that opens a checkbox list:
  - The default program is always checked and its checkbox `disabled`.
  - `props: { state: MultiProgramState; availablePrograms: ProgramEntity[]; compatibleIds: Set<number> }`.
  - Incompatible programs (not in `compatibleIds`) are greyed out with `disabled` attribute.
  - `aria-label="Select comparison programs"`, `role="listbox"`, `aria-multiselectable="true"`.
- In `src/routes/calculator/+page.svelte`, when `isAdvancedMode.value`:
  - A `MultiProgramState` is created/updated when `state.resolvedProgramId` changes.
  - `MultiProgramPicker` is shown below `EntitySelectionComboboxes`.
  - A debounced `$effect` calls `service.calculateMulti(...)` with all `selectedProgramIds`
    whenever the selected programs or energy rows change.
  - `ResultTable` receives a new `comparisonResults` prop (Task 4 will use it).
  - In basic mode, `comparisonResults` is `undefined` and the table is unchanged.

### Step 3a — tests first (`src/tests/unit/multi-program-state.test.ts`)

```
createMultiProgramState(9, [...]) → selectedProgramIds[0] === 9 (locked default)
selectProgram(2) → selectedProgramIds === [9, 2]
deselectProgram(9) → no-op (default cannot be removed)
deselectProgram(2) → selectedProgramIds === [9] only
setColumnVisible(2, false) → columnVisibility.get(2) === false
setQuantityFocus('stp') → quantityFocus === 'stp'
setResults(map) → comparisonResults updated
```

Run `pnpm test`, confirm RED.

### Step 3b — implement `src/lib/state/multi-program.svelte.ts`

```typescript
import type { ProgramEntity, CalculationResult, LibdedxError } from "$lib/wasm/types";

export interface MultiProgramState {
  selectedProgramIds: number[];
  columnVisibility: Map<number, boolean>;
  quantityFocus: "both" | "stp" | "csda";
  comparisonResults: Map<number, CalculationResult | LibdedxError>;
  selectProgram(id: number): void;
  deselectProgram(id: number): void;
  setColumnVisible(id: number, visible: boolean): void;
  setQuantityFocus(f: "both" | "stp" | "csda"): void;
  setResults(results: Map<number, CalculationResult | LibdedxError>): void;
}

export function createMultiProgramState(
  defaultProgramId: number,
  _availablePrograms: ProgramEntity[],
): MultiProgramState {
  const selectedProgramIds = $state<number[]>([defaultProgramId]);
  const columnVisibility = $state(new Map<number, boolean>());
  const quantityFocus = $state<{ value: "both" | "stp" | "csda" }>({ value: "both" });
  const comparisonResults = $state(new Map<number, CalculationResult | LibdedxError>());
  return {
    get selectedProgramIds() {
      return selectedProgramIds;
    },
    get columnVisibility() {
      return columnVisibility;
    },
    get quantityFocus() {
      return quantityFocus.value;
    },
    get comparisonResults() {
      return comparisonResults;
    },
    selectProgram(id) {
      if (!selectedProgramIds.includes(id)) selectedProgramIds.push(id);
    },
    deselectProgram(id) {
      if (id === selectedProgramIds[0]) return; // default locked
      const idx = selectedProgramIds.indexOf(id);
      if (idx !== -1) selectedProgramIds.splice(idx, 1);
    },
    setColumnVisible(id, visible) {
      columnVisibility.set(id, visible);
    },
    setQuantityFocus(f) {
      quantityFocus.value = f;
    },
    setResults(results) {
      comparisonResults.clear();
      for (const [k, v] of results) comparisonResults.set(k, v);
    },
  };
}
```

### Step 3c — implement `src/lib/components/multi-program-picker.svelte`

Create a button that toggles a dropdown `<div role="listbox">`. For each program in
`availablePrograms`:

- `role="option"`, `aria-selected={state.selectedProgramIds.includes(p.id)}`.
- Checked (checkbox visual) when selected; if `p.id === state.selectedProgramIds[0]`
  then the checkbox is disabled.
- If not in `compatibleIds`: `disabled`, greyed out, tooltip "Not available for current selection".
- Clicking an unchecked, enabled program calls `state.selectProgram(p.id)`.
- Clicking a checked, non-default program calls `state.deselectProgram(p.id)`.

### Step 3d — wire into `src/routes/calculator/+page.svelte`

In the `<script>`:

```typescript
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import { createMultiProgramState, type MultiProgramState } from "$lib/state/multi-program.svelte";
import MultiProgramPicker from "$lib/components/multi-program-picker.svelte";

let multiProgState = $state<MultiProgramState | null>(null);

$effect(() => {
  const defaultId = state?.resolvedProgramId;
  if (isAdvancedMode.value && defaultId !== null && defaultId !== undefined) {
    multiProgState = createMultiProgramState(defaultId, state?.availablePrograms ?? []);
  } else {
    multiProgState = null;
  }
});
```

Add a debounced `$effect` that, when `isAdvancedMode.value && multiProgState !== null`,
calls `service.calculateMulti(...)` with all `selectedProgramIds` and calls
`multiProgState.setResults(...)`.

In the template, below `<EntitySelectionComboboxes ...>`:

```svelte
{#if isAdvancedMode.value && multiProgState}
  <MultiProgramPicker
    state={multiProgState}
    availablePrograms={state?.availablePrograms ?? []}
    compatibleIds={new Set(state?.availablePrograms.map((p) => p.id) ?? [])}
  />
{/if}
```

Pass `comparisonResults={multiProgState?.comparisonResults ?? undefined}` and
`multiProgramState={multiProgState ?? undefined}` to `<ResultTable>` as new props
(no-op until Task 4 reads them).

### Done when

`pnpm test` is green (+new multi-program-state tests), `pnpm lint` clean; then commit:

```
feat(calculator): add multi-program state, multi-program picker, and calculateMulti() wiring
```

---

## Task 4 — Advanced-mode grouped result table + column show/hide + quantity focus + onboarding hint

**Spec:** `docs/04-feature-specs/multi-program.md` §Column Layout, §Column Show/Hide,
§Quantity Focus Toggle, §Visual Highlighting, §Partial Failure, §Inputs §2 (Onboarding Hint)

### Acceptance criteria

- `result-table.svelte` accepts optional props:
  - `multiProgramState?: MultiProgramState` — if present, table switches to advanced layout.
  - `comparisonResults?: Map<number, CalculationResult | LibdedxError>` — per-program data.
- In **advanced mode** (props present), the table shows:
  - A two-row group header: first row spans "Stopping Power ({stpUnit})" and "CSDA Range";
    second row has one sub-header per program within each group.
  - The default (first) program's sub-header is **bold** with `bg-blue-50` tint
    and a 2px left-border in accent color.
  - Column order within each group follows `multiProgramState.selectedProgramIds`.
  - Programs with `columnVisibility.get(id) === false` are hidden (column not rendered).
  - Quantity focus: `quantityFocus === 'stp'` → CSDA columns hidden; `'csda'` → STP columns hidden.
  - Partial failure: if `comparisonResults.get(id)` is a `LibdedxError`, that program's
    cells show "—" with a `⚠` icon; the icon has `title={error.message}`.
- A **table toolbar** above the table (in advanced mode) contains:
  - **"Columns…"** button — opens a `<div role="dialog">` checklist of programs
    (default program's checkbox is disabled); toggling calls `state.setColumnVisible()`.
  - **Quantity focus** segmented control: `Both | STP only | CSDA only` → calls
    `state.setQuantityFocus()`.
- An **onboarding hint banner** appears in `src/routes/calculator/+page.svelte` the
  first 2 times the user enters advanced mode:
  - Content: "Advanced mode enabled. You can now select multiple programs to compare
    stopping power and range side by side."
  - Dismiss: × button or any interaction with the program picker.
  - Auto-dismiss after 8 seconds.
  - Suppressed after 2 showings (tracked via `localStorage('dedx_adv_hint_count')`).
- In **basic mode** (no multi-program props), the table renders exactly as before.

### Step 4a — tests first (add to `src/tests/unit/result-table.test.ts` or create

`src/tests/unit/result-table-advanced.test.ts`)

```
table with multiProgramState (2 programs, both visible, quantityFocus='both')
  → two group header spans rendered; 4 result data cells per row (2 stp + 2 csda)
table with quantityFocus='stp'
  → CSDA group header and cells absent; STP group present
table with comparisonResults having LibdedxError for program 2
  → program 2 cells show "—" text; ⚠ icon present
default program column sub-header has bold class applied
hidden program (columnVisibility.get(id)===false) → column not in DOM
```

Run `pnpm test`, confirm RED.

### Step 4b — implement in `src/lib/components/result-table.svelte`

Add to `$props()`:

```typescript
let {
  state,
  entitySelection,
  multiProgramState = undefined,
  comparisonResults = undefined,
}: {
  state: CalculateState;
  entitySelection: EntitySelectionState | null;
  multiProgramState?: MultiProgramState;
  comparisonResults?: Map<number, CalculationResult | LibdedxError>;
} = $props();
```

Add derived helper:

```typescript
const isAdvanced = $derived(multiProgramState !== undefined);
const visibleProgramIds = $derived(
  isAdvanced
    ? multiProgramState!.selectedProgramIds.filter(
        (id) => multiProgramState!.columnVisibility.get(id) !== false,
      )
    : [],
);
const showStp = $derived(!isAdvanced || multiProgramState!.quantityFocus !== "csda");
const showCsda = $derived(!isAdvanced || multiProgramState!.quantityFocus !== "stp");
```

In the template: wrap the `<thead>` conditional on `isAdvanced` — if advanced, emit
the two-row group header; else emit the existing single-row header unchanged.

For data cells: if advanced, emit a `<td>` for each `visibleProgramId` in each group;
look up `comparisonResults.get(programId)` — if `LibdedxError`, show `— ⚠`; if
`CalculationResult`, apply the same `convertStpForDisplay()` / `autoScaleLengthCm()`
conversions already used in basic mode.

### Step 4c — table toolbar + onboarding hint in `src/routes/calculator/+page.svelte`

Above `<ResultTable>` add:

```svelte
{#if isAdvancedMode.value && multiProgState}
  <!-- Onboarding hint -->
  {#if showHint}
    <div role="status" class="...">
      <p>Advanced mode enabled. You can now select multiple programs to compare stopping power and range side by side.</p>
      <button onclick={dismissHint} aria-label="Dismiss hint">×</button>
    </div>
  {/if}
  <!-- Table toolbar -->
  <div class="flex items-center gap-3 ...">
    <button onclick={() => (columnsOpen = !columnsOpen)}>Columns…</button>
    {#if columnsOpen}
      <div role="dialog" ...>
        {#each multiProgState.selectedProgramIds as id}
          <label class={id === multiProgState.selectedProgramIds[0] ? "opacity-50" : ""}>
            <input
              type="checkbox"
              disabled={id === multiProgState.selectedProgramIds[0]}
              checked={multiProgState.columnVisibility.get(id) !== false}
              onchange={e => multiProgState!.setColumnVisible(id, e.currentTarget.checked)}
            />
            {programName(id)}
          </label>
        {/each}
      </div>
    {/if}
    <!-- Quantity focus segmented control -->
    {#each [['both','Both'],['stp','STP only'],['csda','CSDA only']] as [val, label]}
      <button
        onclick={() => multiProgState!.setQuantityFocus(val as 'both'|'stp'|'csda')}
        aria-pressed={multiProgState.quantityFocus === val}
        class={...}>{label}</button>
    {/each}
  </div>
{/if}
<ResultTable
  {state}
  entitySelection={state}
  multiProgramState={isAdvancedMode.value ? multiProgState ?? undefined : undefined}
  comparisonResults={isAdvancedMode.value ? multiProgState?.comparisonResults : undefined}
/>
```

For the onboarding hint: use two `$state` variables `showHint` and `hintDismissed`.
A `$effect` on `isAdvancedMode.value` reads `localStorage('dedx_adv_hint_count')`,
increments it (up to 2), and sets `showHint = count <= 2`.
Auto-dismiss: inside the same `$effect`, schedule `setTimeout(() => { showHint = false; }, 8000)`
(cancel on unmount via return cleanup).

### Done when

`pnpm test` is green (+new advanced table tests), `pnpm lint` clean; then commit:

```
feat(calculator): advanced-mode grouped result table, column show/hide, quantity focus, onboarding hint
```

---

## Task 5 — URL state round-trip for advanced mode + E2E tests

**Spec:** `docs/04-feature-specs/multi-program.md` §URL Persistence, §Acceptance Criteria §URL State

### Acceptance criteria

- `encodeCalculatorUrl()` in `src/lib/utils/calculator-url.ts` emits `mode=advanced`
  and `programs=9,2,101` (IDs in `selectedProgramIds` order) when advanced mode is on.
  In basic mode these params are absent.
- `hidden_programs=101` is emitted only when at least one program is hidden.
- `qfocus=stp|csda` is emitted when not "both"; `qfocus=both` is also emitted in
  canonical form (always present in advanced mode for determinism — per spec §URL Persistence).
- `decodeCalculatorUrl()` restores `isAdvancedMode.value`, selected program IDs,
  hidden programs, and quantity focus from the URL.
- URL round-trip: `encodeCalculatorUrl(decodeCalculatorUrl(url)) === url` for all
  valid advanced-mode URLs.
- Invalid program IDs in `programs=` are silently dropped (no crash); if all are invalid,
  only the auto-selected program is used.

### Step 5a — tests first (add to `src/tests/unit/calculator-url.test.ts`)

```
encodeCalculatorUrl({ ..., isAdvanced:true, selectedProgramIds:[9,2], hiddenPrograms:[], qfocus:'both' })
  → URL contains 'mode=advanced&programs=9%2C2&qfocus=both'
encodeCalculatorUrl({ ..., isAdvanced:true, selectedProgramIds:[9,2], hiddenPrograms:[2], qfocus:'stp' })
  → URL contains 'hidden_programs=2' and 'qfocus=stp'
encodeCalculatorUrl({ ..., isAdvanced:false, ... })
  → URL does NOT contain 'mode=' or 'programs='
decodeCalculatorUrl('?...&mode=advanced&programs=9,2&qfocus=stp')
  → { isAdvanced: true, selectedProgramIds: [9, 2], quantityFocus: 'stp' }
decodeCalculatorUrl('?...&mode=advanced&programs=9,999&qfocus=both')
  → selectedProgramIds contains 9 but not 999 (invalid dropped silently)
```

Run `pnpm test`, confirm RED.

### Step 5b — implement in `src/lib/utils/calculator-url.ts`

Extend the `CalculatorUrlState` type with optional fields:

```typescript
isAdvancedMode?: boolean;
selectedProgramIds?: number[];
hiddenProgramIds?: number[];
quantityFocus?: "both" | "stp" | "csda";
```

In `encodeCalculatorUrl()`: after existing params, when `isAdvancedMode`:

- `params.set("mode", "advanced")`
- `params.set("programs", selectedProgramIds.join(","))`
- if `hiddenProgramIds.length > 0`: `params.set("hidden_programs", hiddenProgramIds.join(","))`
- `params.set("qfocus", quantityFocus ?? "both")`

In `decodeCalculatorUrl()`: read `mode`, `programs`, `hidden_programs`, `qfocus` and
return them in the decoded state object. For `programs`, split on `,`, parse to `int`,
validate against a known program list if available (or defer validation to the page).

In `src/routes/calculator/+page.svelte`, inside the existing URL-restore `$effect`:
call `initAdvancedModeFromUrl(page.url.searchParams)` and, if advanced mode, also
restore `selectedProgramIds` / `hiddenProgramIds` / `quantityFocus` into `multiProgState`.

### Step 5c — E2E tests (`tests/e2e/calculator-advanced.spec.ts`)

```typescript
test.describe("Advanced mode", () => {
  test("Basic/Advanced toggle is visible in toolbar", async ({ page }) => { ... });
  test("Clicking Advanced reveals multi-program picker on Calculator page", async ({ page }) => { ... });
  test("Selecting second program adds columns to result table", async ({ page }) => { ... });
  test("URL contains mode=advanced and programs= when advanced mode is on", async ({ page }) => { ... });
  test("Loading a URL with mode=advanced restores advanced mode state", async ({ page }) => { ... });
});
```

Mark tests `test.skip` if WASM absent, with comment:

```typescript
// Skipped when WASM binary absent. CI downloads artifact before running E2E.
```

### Done when

`pnpm test` is green (+new URL encode/decode tests), `pnpm lint` clean, E2E tests
added and passing (or cleanly skipped); then commit:

```
feat(calculator): advanced-mode URL state — mode, programs, hidden_programs, qfocus encode/decode
```

---

## Final checklist before handing back

- [ ] `pnpm test` green — 544 + new tests passing, no regressions
- [ ] `pnpm exec playwright test` green (or advanced-mode E2E tests skipped with a clear comment)
- [ ] `pnpm lint` clean — no new ESLint errors
- [ ] `pnpm build` completes — catches TypeScript / import errors the test runner misses
- [ ] Each task has its own Conventional Commit on `qwen/stage-6-multi-program`
- [ ] `docs/ai-logs/2026-05-04-stage6-multi-program.md` filled in
- [ ] `CHANGELOG-AI.md` new row prepended at top of table body
- [ ] `docs/ai-logs/README.md` one-line pointer added

---

## Notes — Svelte 5

- `$state` in `.svelte.ts` modules: use `$state({ value: ... })` wrapper for
  primitive values that need to be passed by reference across modules.
- For `Map` in `$state`: mutate via `.set()` / `.clear()` — Svelte 5 tracks
  Map mutations reactively.
- `$derived` in plain `.ts` files (not `.svelte.ts`): not available — use
  `$derived` only in `.svelte.ts` or `.svelte` files.
- `$effect` lifecycle: `return () => { ... }` for cleanup — used in the onboarding
  hint auto-dismiss timer.
- Event handlers: `onclick={fn}` not `on:click`. `onchange` not `on:change`.
- Props: `$props()` destructuring, not `export let`.

## Notes — what is NOT in scope for this session

- **Drag-and-drop column reordering** (complex touch/keyboard handling) — deferred.
- **Delta / % difference tooltip** (hover on comparison cells) — deferred.
- **Advanced mode CSV export** (multi-program grouped columns per `export.md §3`) — deferred.
- **Advanced mode PDF export** — deferred.
- **Plot page advanced features** — out of scope per spec §Out of Scope.
