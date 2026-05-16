# Session Log: Stage 6.12 — Multi-program Polish (Delta Tooltip + Column Reorder)

**Date:** 2026-05-11  
**Model:** Qwen3.5-397B-A17B-FP8 via opencode  
**Branch:** `qwen/stage6-12-multi-program-polish`  
**Spec:** `docs/04-feature-specs/multi-program.md` Final v3

---


## Completion Addendum — PR review follow-up

Stage 6.12 is complete after PR #452 review follow-up (`73f63fe`). The follow-up fixed zero-delta formatting, the Calculator `ResultTable` prop wiring, drag/drop null/default handling, spec-aligned aria-live announcements, static Tailwind cursor classes, unique STP/CSDA tooltip IDs, corrected E2E program selectors, and archived the raw opencode transcript in `docs/ai-logs/2026-05-11-stage6-12-multi-program-polish-qwen-session.md`.

Validation after the follow-up: `pnpm test` (1059 passed), `pnpm lint`, `pnpm build`, targeted Playwright advanced column tests (4 passed), code review, and CodeQL all passed.

---

## Task 1 — Delta / % difference tooltip

### Implementation

1. **Created `src/lib/utils/delta.ts`** with:
   - `formatSigFigsFixed(value, sigFigs)`: formats to exactly n significant figures, preserving trailing zeros
   - `computeDelta(displayValue, defaultDisplayValue, unit, defaultName)`: returns `{ delta, pct, label }` or null
   - Label format: `"Δ = +0.840 keV/µm (+1.8% vs ICRU 90)"` using U+2212 (−) for negative values

2. **Created `src/tests/unit/delta-tooltip.test.ts`** with 7 test cases:
   - Basic positive delta
   - Basic negative delta
   - Zero delta
   - Small values
   - Large percentage difference
   - Null inputs
   - Division by zero protection

3. **Wired up in `result-table.svelte`**:
   - Added `hoveredCell` state for hover tracking
   - Added `getStpDisplayValue()` and `getCsdaDisplayCm()` helper functions
   - Computed `delta` and `csdaDelta` for each comparison cell
   - Tooltip shows on hover with `aria-describedby` for accessibility

4. **Bug fixes during implementation**:
   - Renamed `state` prop to `calcState` to avoid Svelte 5 `$state` rune conflict
   - Fixed `canShowPerRowUnitSelector()` logic (was inverted during prop rename)
   - Made helper functions handle `undefined | LibdedxError | CalculationResult`

### Tests
- 7 new unit tests in `delta-tooltip.test.ts`
- Updated `result-table.test.ts` and `result-table-advanced.test.ts` for `calcState` prop
- All 1058 tests pass

---

## Task 2 — Drag-and-drop + keyboard column reorder

### Implementation

1. **Added drag state** in `result-table.svelte`:
   - `draggingProgramId`: currently dragged program
   - `dragOverProgramId`: drop target indicator
   - `reorderAnnouncement`: aria-live announcement text
   - `showColumnsDropdown`: column visibility dropdown state

2. **Drag-and-drop handlers**:
   - `handleDragStart()`: set drag state, data transfer
   - `handleDragOver()`: show drop target indicator
   - `handleDrop()`: call `multiProgramState.reorderPrograms()`
   - `handleDragEnd()`: cleanup state

3. **Keyboard handler**:
   - `handleColumnKeydown()`: Alt+ArrowLeft/Right for column reordering
   - Calls `multiProgramState.reorderPrograms()` with new position

4. **Column visibility**:
   - `handleToggleColumnVisibility()`: call `multiProgramState.toggleColumnVisibility()`
   - `toggleColumnsDropdown()`: toggle dropdown visibility
   - `handleOutsideClick()`: close dropdown on outside click
   - `$effect()`: attach/detach document click listener

5. **Template updates**:
   - Added toolbar with "Columns..." button in advanced mode
   - Column visibility dropdown with checkboxes
   - STP and CSDA sub-headers:
     - `draggable={programId !== defaultProgramId ? "true" : "false"}`
     - `aria-disabled={programId === defaultProgramId ? "true" : "false"}`
     - `tabindex={programId !== defaultProgramId ? "0" : "-1"}`
     - `cursor-grab` / `cursor-not-allowed`
     - `opacity-50` when dragging
     - `border-l-2 border-blue-400` on drop target
   - Added `aria-live="polite"` region for announcements

### E2E Tests (`tests/e2e/calculator-advanced.spec.ts`)

Added 4 new E2E tests:
1. **Column drag-and-drop reordering**: drag MSTAR column, verify default (PSTAR) stays first
2. **Keyboard column reordering**: Alt+Arrow triggers move, aria-live announcement visible
3. **Default program column cannot be dragged**: verify `draggable="false"`, `aria-disabled="true"`
4. **Column visibility toggle**: "Columns..." button opens dropdown, uncheck hides column, URL contains `hidden_programs=`

### Tests
- All 1058 unit tests pass
- Lint passes
- Fixed E2E tests to not use banned `waitForTimeout()` (use `waitForSelector` instead)

---

## Commits

```
29f2168 feat(result-table): add delta/% difference tooltip on comparison cells
```

All changes committed in a single commit (delta tooltip + column reorder are tightly coupled).

---

## Validation

- `pnpm lint` ✓
- `pnpm test` — 1058/1058 tests pass ✓
- Branch ready for PR

---

## Notes

- Delta tooltip uses U+2212 (−) minus sign, not ASCII hyphen (-)
- `formatSigFigsFixed()` preserves trailing zeros (unlike existing `formatSigFigs()`)
- Column reorder state (`programDisplayOrder`) is shared between STP and CSDA groups
- Default program column is always first and cannot be moved or hidden
- Column visibility dropdown uses `data-columns-dropdown` for outside click detection
