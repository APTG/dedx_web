# 2026-05-16 — Drag Handle Reorder in multi-program-picker

## Session Narrative

### Prompt 1: Add drag handle + keyboard + touch + aria-live to selected rows

**AI response**: Implemented ⋮⋮ drag handles on each selected (non-default) program row in
`multi-program-picker.svelte`. Changes:

- **Drag handle element**: `<span role="button" draggable="true" tabindex="0">` visible only
  on selected, non-default rows. Shows `⋮⋮` with `cursor-grab` and focus-ring styling.
- **Mouse drag-and-drop**: `ondragstart` on the handle sets `draggingId`; wrapper `<div
role="presentation">` rows receive `ondragover` / `ondrop` / `ondragleave`. Drop calls
  `multiState.reorderPrograms(draggedId, targetIndex)` only when target is a selected,
  non-default row.
- **Touch drag**: `ontouchstart` / `ontouchmove` / `ontouchend` on the handle. `touchmove`
  uses `document.elementFromPoint` to track the row under the finger via `[data-program-id]`
  data attributes; `touchend` resolves the target EntityId from `programDisplayOrder` and
  calls `reorderPrograms`.
- **Keyboard reorder**: `onkeydown` on the handle — `Alt+ArrowUp` decreases index (blocked
  at position 1 to preserve default-first invariant), `Alt+ArrowDown` increases index.
- **aria-live announcements**: always-present `<div aria-live="polite" aria-atomic="true"
class="sr-only">` at component root (outside the `{#if isOpen}` block) announces "Moved
  Program X to position N of M." after every reorder.
- **Drag opacity**: dragged row gets `opacity-40` while the drag is in flight; drop-target
  row gets a `border-l-2 border-primary` highlight for both mouse and touch drag.
- Helper `reorderAndAnnounce(programId, newIndex)` centralises the reorder + announcement
  logic to avoid repetition across mouse, keyboard, and touch paths.
- Added `role="presentation"` to wrapper divs to fix Svelte a11y lint warnings about
  interactive handlers on static elements.

### Prompt 2: Add tests

**AI response**: Created `src/tests/unit/multi-program-picker.test.ts` with 14 tests across
three describe blocks:

- **Drag handle visibility** (5 tests): handle appears/disappears with selection state.
- **Keyboard reorder** (6 tests): Alt+ArrowDown, Alt+ArrowUp, edge-case blocking, no-modifier
  no-op, multiple sequential reorders.
- **Aria-live announcements** (4 tests): region always in DOM, correct text after up/down,
  updates on successive reorders.

All 1359 tests pass, ESLint clean.

### Prompt 3: Address PR #522 review comments on drag handles/a11y/layout

**AI response**: Applied targeted follow-up fixes in `multi-program-picker.svelte` and the
unit test file:

- Converted drag handles from `<span role="button" tabindex="0">` to semantic
  `<button type="button">` handles to avoid mismatched button-key expectations.
- Added `aria-describedby="multi-picker-reorder-hint"` on every handle so assistive
  tech announces the Alt+Arrow keyboard instructions on focus.
- Moved the `aria-live="polite"` node under the picker wrapper (`data-multi-program-picker`)
  so announcements remain tied to each widget instance.
- Aligned drop-highlight classes between built-in and external rows by adding `pl-0`
  for external highlights (removes tiny drag-over layout shift).
- Updated keyboard up-boundary logic to derive the minimum movable index from whether
  the default program currently occupies index `0`, rather than hard-coding `> 1`.
- Added unit assertions for handle→hint association and live-region scoping.

Targeted unit tests pass (`16/16` in `multi-program-picker.test.ts`), and changed-file
ESLint is clean.

## Tasks

### Drag handle + reorder UX (issue #510 follow-up)

- **Status**: completed
- **Stage**: entity-selection (Stage 8)
- **Files changed**:
  - `src/lib/components/multi-program-picker.svelte`
  - `src/tests/unit/multi-program-picker.test.ts` (new)
- **Decision**: placed the aria-live region as a second root element (outside the dropdown
  `{#if}`) so it persists in the DOM regardless of open/closed state, which is required for
  screen readers to reliably pick up announcements.
- **Decision**: touch drag resolves the drop target by walking up the DOM from
  `document.elementFromPoint` to the nearest `[data-program-id]` ancestor, then matches
  against `programDisplayOrder` to get the typed EntityId — avoids re-parsing branded ExtRef
  strings.
