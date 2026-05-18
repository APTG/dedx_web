# 2026-05-18 — Issue #533: Compact Sticky Summary Bar for Picker

## Session Narrative

### Prompt 1: Read issue, read code, propose UX solutions

**AI response**: Read GitHub issue #533 and the full picker component tree. Proposed three options (A: orange token, B: labeled badge, C: inverted pill) with a JSFiddle-ready HTML snippet for side-by-side comparison.

### Prompt 2: Implement the new design from Perplexity screenshot

User shared a screenshot of the desired design (teal checkmarks + bordered selected rows + compact summary bar) and pointed to the detailed spec in the issue comments. Asked to adapt colors to the existing app palette and work autonomously.

**AI response**: Implemented the full feature:

1. **Root cause**: The old `bg-primary/10 border-primary/40` selected badge and `bg-primary/15` list row highlight were nearly identical visually, causing confusion about which was the "current choice" vs "position in list".

2. **New `picker-summary-bar.svelte`**: A shared compact bar that appears only when something is selected. Shows an orange count badge, truncated labels (max 3 + "+N"), an optional "All shown / Sel. only" toggle (multi-select only), and a Clear button. Uses `bg-orange-50 border-orange-200` with `bg-orange-500` badge — matching the tab active underline color (`#f97316`) to create a unified selection language.

3. **List item styling**: Selected items now get `ring-1 ring-inset ring-orange-400 bg-orange-50/60 font-semibold` (outline ring, subtle warm bg) + `✓` checkmark in `text-orange-500`. Multi-select unselected items get `○` in muted. This is visually distinct from the old filled grey boxes.

4. **`showOnlySelected` toggle**: Added to particle-tab and material-tab — filters the scrollable list to show only selected items (multi-select mode). The toggle button in the summary bar switches between "All shown" and "Sel. only".

5. **Scope**: Applied consistently across all 7 files:
   - `picker-summary-bar.svelte` (new)
   - `particle-tab.svelte`
   - `material-tab.svelte`
   - `grouped-result-list.svelte` (mobile sheet material list)
   - `program-tab.svelte`
   - `program-inline-list.svelte` (tiny-bucket programs)
   - `picker-sheet.svelte` (full-screen mobile sheet particle + program rows)

6. **Test fix**: One test referenced `picker-material-multi-selected` (old pills container) — updated to use `picker-material-selected` (new summary bar testId).

## Tasks

### Compact sticky summary bar (issue #533)

- **Status**: completed
- **Stage**: Stage 8 / picker
- **Files changed**:
  - `src/lib/components/entity-selection/picker-summary-bar.svelte` (new)
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/components/entity-selection/grouped-result-list.svelte`
  - `src/lib/components/entity-selection/program-tab.svelte`
  - `src/lib/components/entity-selection/program-inline-list.svelte`
  - `src/lib/components/entity-selection/picker-sheet.svelte`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
- **Decision**: Used orange family (`orange-50/200/400/500`) to match the existing tab underline (`#f97316`). Teal from the reference screenshot was not used because it introduced a new unrelated accent color; orange creates a unified "selection" semantic across tabs and list rows.
- **Decision**: `{@const isChecked}` must be placed before `<li>` elements (Svelte 5 constraint: `{@const}` is only valid as a direct child of block-level constructs, not HTML elements). Fixed a compile error where I initially placed it inside `<li>`.
- **Issue**: none — all 1379 tests pass.
