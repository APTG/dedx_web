# 2026-05-25 — Issue #562 Row keyboard contract + cold-load arrow keys

## Session Narrative

### Prompt 1: Work on issue #562 (row keyboard contract) and fix cold-load arrow key tab switching

**AI response**: Read GitHub issue #562 and explored the codebase. Identified four areas to work on:

1. Row keyboard contract missing pieces: `Shift+Enter` (no new row), `Backspace` on empty (delete row + focus prev), `ArrowUp/Down` (move between rows), `Cmd/Ctrl+ArrowUp/Down` (reorder row).
2. Cold-load arrow key tab switching: the `tab-bar.svelte` `handleKeyDown` only fires when a tab button has keyboard focus. On cold load nothing has focus, so ArrowLeft/ArrowRight did nothing.
3. State layer: `EnergyInputState`/`CalculatorState` had no `moveRow` method.

**Decision on global handler vs. auto-focus**: chose a global keydown handler in `entity-selection.svelte` rather than auto-focusing the first tab button, because auto-focus on mount would be disruptive on any re-expand. The handler explicitly skips elements with `role="tab"` to avoid double-firing with the tab bar's own `onkeydown` (which was confirmed to cause a double-advance bug in the existing test).

## Tasks

### Add `moveRow` to energy-rows state

- **Status**: completed
- **Stage**: Stage 8 / Issue #562
- **Files changed**: `src/lib/state/energy-rows.svelte.ts`, `src/lib/state/calculator.svelte.ts`
- **Decision**: `moveRow` swaps the row at `index` with its neighbour; guards against out-of-bounds silently.

### Keyboard contract — table-basic.svelte

- **Status**: completed
- **Stage**: Stage 8 / Issue #562
- **Files changed**: `src/lib/components/results/table-basic.svelte`
- **Decision**: Full keyboard contract in one `handleInputKeyDown` handler: `Esc` blurs, `Enter` adds row (unless `Shift`), `Tab`/`Shift+Tab` moves between rows, `ArrowUp/Down` moves focus, `Cmd/Ctrl+ArrowUp/Down` reorders + follows focus, `Backspace` on empty row deletes + focuses previous.

### Keyboard contract — table-advanced.svelte

- **Status**: completed
- **Stage**: Stage 8 / Issue #562
- **Files changed**: `src/lib/components/results/table-advanced.svelte`
- **Decision**: Extracted `advancedInputs()` helper (scoped to the `advanced-combined-table` test-id) and `focusAdvancedRow()`. Same keyboard contract as table-basic.

### Cold-load arrow key tab switching

- **Status**: completed
- **Stage**: Stage 8 / Issue #562
- **Files changed**: `src/lib/components/entity-selection/entity-selection.svelte`
- **Decision**: Added `ArrowLeft`/`ArrowRight` branch to `handleGlobalKey`. Fires when `panelOpen` is true and the active element is not an `input`/`textarea`/`select` and not a `role="tab"` button (tab bar owns those). Covers cold-load (body focus) and in-picker non-input focus. The `role="tab"` exclusion was critical — without it the global handler double-fired after the tab button's own handler had already advanced the tab, causing an extra skip.
