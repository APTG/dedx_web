# 2026-06-17 — Multi-select reorder + ⤢ sheet promotion (#736)

## Session Narrative

### Prompt 1: Work on remaining #736 items; combine topics, right-size for one PR

After the two earlier #736 PRs (#738 squiggle + polish sync, already merged),
the genuinely open items were:
- **Interactive list reorder** (drag + `Alt+ArrowUp/Down` + `aria-live`)
- **⤢ full-screen-sheet promotion** on mobile Material-tab

I chose both together for a cohesive, well-scoped PR.

**Implementation:**

*State layer:* Added `reorderMulti(dim, id, newIndex)` to `MultiSelectionState`
and `EntitySelectionState`. The method moves `id` within the dimension's array
to `newIndex`, clamping to [1, length-1] and leaving the anchor (index 0)
locked.

*UI — picker-summary-bar:* When `onReorder` and `ids` are provided, the bar
switches from its compact truncated-text display to a row of individual
draggable chips. Each non-anchor chip shows:
- A ⠿ drag handle `<button>` that carries the HTML5 drag-and-drop event
  handlers and `Alt+ArrowUp/Down` keyboard shortcuts.
- A truncated label (max 10ch).
- ▲/▼ buttons (disabled when movement is impossible).

The anchor chip is visually distinguished (orange ⚓, no controls).
A dedicated `role="status" aria-live="polite" aria-atomic="true"` span
announces each move to assistive technology.

*Wiring:* `material-tab.svelte` and `program-tab.svelte` pass `ids` and
`onReorder` to the summary bar in multi-select mode via the conditional spread
pattern required by `exactOptionalPropertyTypes`.

*⤢ button:* `material-tab.svelte` gained an `onOpenSheet` prop; when provided
a small `sm:hidden` button (⤢) is rendered after the sub-tab pills, opening
the full-screen `picker-sheet.svelte`. The button is visible on mobile but
hidden on ≥sm. `entity-selection.svelte` passes `onOpenSheet={openSheet}` to
`<MaterialTab>`.

**Tests:** 7 new unit tests — `reorderMulti` state logic (anchor lock, clamping,
move), chip rendering in multi-mode, ▼ button click triggers reorder, ⤢ button
opens the sheet.

## Tasks

### `reorderMulti` state method

- **Status**: completed
- **Files changed**:
  - `src/lib/state/multi-selection.svelte.ts`
  - `src/lib/state/entity-selection.svelte.ts`

### Picker summary-bar chip reorder UI

- **Status**: completed
- **Files changed**:
  - `src/lib/components/entity-selection/picker-summary-bar.svelte`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/components/entity-selection/program-tab.svelte`
- **Decision**: drag events on the ⠿ handle `<button>` (interactive element)
  rather than on the chip container, satisfying Svelte's a11y linter.

### ⤢ full-screen-sheet promotion on Material-tab

- **Status**: completed
- **Files changed**:
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/components/entity-selection/entity-selection.svelte`

### Tests

- **Status**: completed (7 new unit tests)
- **Files changed**: `src/tests/unit/entity-selection-tabbed.test.ts`
