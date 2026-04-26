# Stage 5 Audit — what is *actually* finished?

> **Date:** 2026-04-26
> **Auditor:** Claude Sonnet 4.6 via Copilot coding agent
> **Scope:** Cross-check the "✅" markers in `docs/00-redesign-plan.md §8 Stage 5`
> against `src/` and `tests/`. Identify duplications and refactor candidates
> before the plotting work in Stage 5.5 begins.
>
> Companion documents:
> - UX review: [`docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`](../ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md)
> - Session log: [`docs/ai-logs/2026-04-26-stage5-audit-and-ke-conservation.md`](../ai-logs/2026-04-26-stage5-audit-and-ke-conservation.md)

---

## 1. Stage 5 checklist — claimed vs. actual

`docs/00-redesign-plan.md:504–513` lists five Stage 5 sub-items. Status today:

| #     | Item                                                | Claim    | Reality                                                                                               |
| ----- | --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| 5.1   | Entity selection (cascading dropdowns)              | ✅       | **Mostly done.** Functionally complete. See §1.1 — gaps still listed in `docs/progress/stage-5-entity-selection.md` and not closed. |
| 5.2   | Energy input component (textarea + per-line + debounce) | ✅       | **Superseded.** Replaced wholesale by Stage 5.4 ResultTable; the standalone `energy-input.svelte` is dead code. See §2. |
| 5.3   | Unit selector (radio / segmented control)           | ✅       | **Done in master mode** but no automatic mode-transition wiring in the calculator route; see §1.2.   |
| 5.4   | Result table (unified input/result table)           | ✅       | **Done** — but live calculation is **not debounced**; see §1.3.                                       |
| 5.5   | JSROOT plot wrapper                                 | ⏳       | Not started (acknowledged).                                                                           |

### 1.1 Entity selection (5.1) — open items still real

`docs/progress/stage-5-entity-selection.md:50-70` lists 12 acceptance criteria
"with no tests" of varying priority. Spot-checks against the codebase:

| Criterion                                              | Status                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Notifications on auto-fallback                         | **Still missing** — `selectParticle()` in `entity-selection.svelte.ts:253-276` silently resets program to Auto-select; no toast / live region announcement.   |
| Toggle-deselect (clicking a selected option)           | **Implemented** — `selectParticle(null)` and `clearParticle()` exist; combobox UX wired.                                                                     |
| Loading skeleton                                       | **Missing** — calculator `+page.svelte:35-37` shows a plain "Loading..." string only.                                                                        |
| Error state with retry on WASM failure                 | **Missing** — no retry button in the calculator route; only the LibdedxError chain in `calculator.svelte.ts:227`.                                            |
| Keyboard navigation in the dropdown                    | **Implemented** via Bits UI Combobox primitives.                                                                                                             |

Action: keep `docs/progress/stage-5-entity-selection.md` open; do NOT mark
Stage 5.1 as fully done until notifications + loading-state + WASM-failure
retry land.

### 1.2 Unit selector (5.3) — partial

The `EnergyUnitSelector` component is built and tested, and the `master`
unit selector wires through the legacy `EnergyInput` component. **However,
the active calculator route uses `ResultTable`, which does not render a
master `EnergyUnitSelector` at all.** The user can only change the master
unit by:

- typing a unit suffix on a row (which switches the whole table to per-row
  mode), or
- changing per-row dropdowns one by one (only available for heavy ions).

The visible "Energy ({masterUnit})" column header derives from
`calcState.masterUnit` which can never be changed from the calculator UI in
isolation. The spec wireframe (`entity-selection.md:730-740` and
`calculator.md` §3.6) shows a segmented control for the master unit. That
control is **not present in the calculator route today**.

Action: either re-introduce `EnergyUnitSelector` in `calculator/+page.svelte`
above the ResultTable, or update the spec to remove the master selector
and rely entirely on per-row units.

### 1.3 Result table (5.4) — debounce missing

`calculator.md:266` and `:840` mandate a 300 ms debounce on input. A
`debounce()` utility lives in `src/lib/utils/debounce.ts` (with 8 unit
tests) but **no caller imports it**:

```bash
$ grep -rn "import .*debounce" src/
src/tests/unit/debounce.test.ts:2:import { debounce } from "$lib/utils/debounce";
```

`result-table.svelte:148-149` calls `state.triggerCalculation()`
synchronously on every keystroke. For typical proton+water calculations
this is harmless (the WASM call is sub-millisecond), but the spec calls it
out specifically (`calculator.md:840`: "Debounce interval is 300ms for
input"), and removing the requirement would also break the assumption in
`calculator.md:267` ("prevents excessive WASM calls during rapid typing").

Action: wire the existing `debounce` util into `triggerCalculation` (or
into the `oninput` handlers), or drop the requirement from the spec. Track
as **Open Issue #1** in the UX review.

### 1.4 No retroactive E2E coverage of switching sequences

Existing E2E suites (`tests/e2e/complex-interactions.spec.ts`) cover:

- default state + simple edits (proton/water/100)
- single particle switch ("Proton → Carbon", does-not-crash)
- single material switch
- inline error display

They do **not** cover:

- `He @ 20 MeV/nucl → proton → He` round-trips (kinetic energy semantics)
- `Carbon 12 MeV → toggle row unit MeV → MeV/nucl` (per-row dropdown's
  numeric behaviour)
- multi-row state when the master particle changes
- electron switch when the existing rows have per-nucleon units
- the absence of an explicit "Add row" button (today rows auto-append)

This audit ships a new spec `tests/e2e/particle-unit-switching.spec.ts`
that:
1. **Asserts** the current spec'd behaviour ("typed number is preserved
   verbatim across particle switches").
2. **Documents** the desired KE-conservation behaviour as `test.fixme()`
   placeholders the implementation can flip to active once the spec is
   updated.

---

## 2. Code/test duplications found

### 2.1 Dead component: `src/lib/components/energy-input.svelte`

`grep -rn "import .*energy-input.svelte['\"]" src/` shows only its own test
imports it. The calculator route uses `ResultTable` (Stage 5.4) and the
plot route does not yet exist. Recommended action: **delete the file and
its test** (`src/tests/components/energy-input.test.ts`) once Stage 5
closes — keeping it around makes every later refactor more expensive
because both copies must be updated.

The component contains useful patterns that are NOT present in
`result-table.svelte`:

- **Explicit "Add row" button** (`energy-input.svelte:242-248`) — see
  the UX review on whether to port this back.
- **`bind:this` ref array + tick-based focus management** — slightly more
  robust than `result-table.svelte`'s `querySelector('input[data-row-index]')`
  approach.
- **Per-row unit dropdown using the shadcn-svelte `EnergyUnitSelector`
  component** — `result-table.svelte` uses a raw `<select>`.

Document the patterns worth porting before deleting.

### 2.2 Dead module: `src/lib/units/energy.ts`

```bash
$ grep -rn "import .* from .*units/energy" src/
src/tests/unit/energy.test.ts:2:import { parseEnergyInput, convertEnergy } from "$lib/units/energy";
```

`parseEnergyInput` here returns `number[]` and silently drops invalid
lines — a much weaker contract than the one in `src/lib/utils/energy-parser.ts`
which returns a discriminated `ParseResult` with structured errors. `convertEnergy`
duplicates the conversion functions in `src/lib/utils/energy-conversions.ts`.

Recommended action: **delete `src/lib/units/energy.ts` and its test
(`src/tests/unit/energy.test.ts`, 30 tests)**. The only reason to keep
either is historical — they were the Stage 5.0 prototypes, replaced
without removal in Stage 5.2.

### 2.3 Test overlap: `formatSigFigs`

- `src/tests/unit/unit-conversions.test.ts` — `describe('formatSigFigs')`
  with 6 sub-tests covering ints, decimals, sig-fig override, NaN/Infinity,
  scientific-notation fallback.
- `src/tests/unit/energy-input-format.test.ts` — 6 tests on the same
  function with overlapping fixtures.

The second file's docstring even admits its purpose: "lock in the formatter
contract shared by `energy-input.svelte`, `result-table.svelte`, and the
calculator." Recommended action: fold `energy-input-format.test.ts` into
the existing `unit-conversions.test.ts` (or delete the redundant cases),
**after** the legacy `energy-input.svelte` is removed.

### 2.4 Test overlap: `parseEnergyInput`

`energy.test.ts` (legacy) and `energy-parser.test.ts` (current) both test
parse semantics on overlapping fixtures. Removing `units/energy.ts` (§2.2)
also removes 30 tests' worth of duplication.

### 2.5 Per-row unit selector logic copied between components

`canShowPerRowUnitSelector()` and the heavy-ion vs. proton/electron rule
appears in both `energy-input.svelte:105-121` and `result-table.svelte:90-102`,
plus equivalent logic in the spec (`unit-handling.md:75-82`). Once the
legacy component is deleted, the duplication disappears for free.

### 2.6 Duplicated CSDA / range formatting helpers

`formatRangeValue` in `calculator.svelte.ts:341-346` and the inline
auto-scale block in `result-table.svelte:77-84` perform the same
auto-scale + `formatSigFigs` composition. Recommended: pick one, export it,
and call it from both.

---

## 3. Recommended end-of-stage refactor plan

| # | Refactor                                                                                                       | Risk   | Saves       |
| - | -------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1 | Delete `src/lib/components/energy-input.svelte` + its 13 component tests                                       | Low    | ~268 LOC    |
| 2 | Delete `src/lib/units/energy.ts` + `src/tests/unit/energy.test.ts`                                             | Low    | ~165 LOC    |
| 3 | Fold `energy-input-format.test.ts` into `unit-conversions.test.ts`                                             | Low    | ~49 LOC     |
| 4 | Wire `debounce()` into `result-table.svelte`'s `triggerCalculation` → meets spec §calculator.md:840            | Medium | restores spec compliance |
| 5 | Either re-add `EnergyUnitSelector` to `calculator/+page.svelte`, or delete master unit fields from spec        | Medium | resolves §1.2 inconsistency |
| 6 | Extract the `formatRangeValue` block from `calculator.svelte.ts` and use it from `result-table.svelte` too     | Low    | ~10 LOC + clarity |
| 7 | Replace `result-table.svelte`'s `document.querySelector('input[data-row-index]')` with `bind:this` ref array   | Low    | matches existing pattern |

Total deletions: roughly **~480 LOC** of dead/duplicated code and tests
without changing any user-visible behaviour.

---

## 4. Summary

- **5.1 Entity selection:** functionally done; long tail of nice-to-haves
  still open in `docs/progress/stage-5-entity-selection.md`.
- **5.2 Energy input:** the original `energy-input.svelte` was replaced
  by 5.4 but never deleted. It is the **#1 source of duplication** in
  Stage 5.
- **5.3 Unit selector:** the component exists and has tests, but the
  calculator route does **not render** the master selector. Either ship
  the wiring or update the spec.
- **5.4 Result table:** done, but **debounce is missing** — direct
  contradiction with `calculator.md:840`.
- **5.5 Plot wrapper:** not started (the only Stage 5 item correctly
  marked as "to do").

Stage 5 should not close until items 4 and 5 above are resolved (either
implementation lands or spec is amended) and the dead code from items 1–2
is deleted.
