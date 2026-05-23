# 2026-05-16 — Retire SelectedPill + MultiProgramPicker; add collapseToSingle

## Session Narrative

### Prompt 1: Retire deprecated components and add basic-mode truncation

User asked to implement follow-up issue #6 from the entity-selector rework log:
- Delete `selected-pill.svelte` and its callsites (particle-tab, material-tab, program-tab), inlining its markup
- Delete `multi-program-picker.svelte` and its callsite in `calculator/+page.svelte`
- Delete `src/lib/state/multi-program.svelte.ts` only if no other consumer remains (kept — result-table.svelte still uses it)
- Fix basic-mode behavior: when returning from advanced mode, only one particle/material/program should remain selected (the anchor/first)
- Add multi-select UI to program-tab (replacing MultiProgramPicker functionality)
- Wire `entityState.multiSelected.program` ↔ `multiProgState`
- Create a git branch before committing

**AI response**: Implemented all of the above across two sessions (split due to context limit). Key decisions:

1. **collapseToSingle() keeps the anchor (first element)** — the anchor is always index 0 in multi arrays, and it's semantically the "primary" selection the user started with before adding comparisons. This is consistent with the anchor-cannot-be-deselected rule already in `toggleMulti`.

2. **Circular reactive dependency avoided with `untrack()`** — the multiProgState creation `$effect` would re-run every program toggle if it read `entityState.multiSelected.program`. Using `untrack()` to seed the entity state from the newly created multiProgState avoids creating that dependency.

3. **program-tab multi-mode gated on `showAdvancedToolbar`** — since `across` defaults to `"program"`, the program-tab would incorrectly enter multi-mode on every initial render without this gate. The fix passes `showAdvancedToolbar` from entity-selection.svelte and requires both conditions: `showAdvancedToolbar && selectionState.across === "program"`.

4. **multi-program.svelte.ts kept** — result-table.svelte and calculator/+page.svelte both use `MultiProgramState` for the comparison table columns/display; only the picker dropdown UI was removed.

## Tasks

### Delete selected-pill.svelte and inline its markup

- **Status**: completed
- **Stage**: entity-selection rework (issue #510 follow-up)
- **Files changed**:
  - `src/lib/components/entity-selection/selected-pill.svelte` (deleted)
  - `src/lib/components/entity-selection/particle-tab.svelte` (inlined button)
  - `src/lib/components/entity-selection/material-tab.svelte` (inlined button with gas/ext glyphs)
  - `src/lib/components/entity-selection/program-tab.svelte` (inlined button)
- **Decision**: Inline rather than extract to a new local pattern — the markup is short and each tab has slight variants (glyphs differ), making inlining cleaner.

### Add multi-select UI to program-tab

- **Status**: completed
- **Files changed**: `src/lib/components/entity-selection/program-tab.svelte`
- **Decision**: Mirror particle-tab pattern exactly: chips row at top, checkmarks in list, anchor chip has distinct styling and no remove button. Multi-mode gated on `showAdvancedToolbar && across === "program"` rather than just `across === "program"` to avoid false activation.

### Delete multi-program-picker.svelte and its test

- **Status**: completed
- **Files changed**:
  - `src/lib/components/multi-program-picker.svelte` (deleted, 443 lines)
  - `src/tests/unit/multi-program-picker.test.ts` (deleted, 256 lines)

### Add collapseToSingle() and setMultiProgram() to EntitySelectionState

- **Status**: completed
- **Files changed**: `src/lib/state/entity-selection.svelte.ts`
- **Decision**: `collapseToSingle()` truncates all three arrays to their first element; `setMultiProgram()` sets the program array directly (no `setAcross` side effects) for seeding from multiProgState after creation.

### Wire entityState.multiSelected.program ↔ multiProgState

- **Status**: completed
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Two separate effects: (1) creation effect seeds entity state from freshly created multiProgState using `untrack()`; (2) sync effect watches entity state and updates multiProgState (adds/removes programs). Guards `desired.length === 0` to avoid wiping multiProgState when entity state is uninitialised.

### Add collapseToSingle() call on basic-mode entry

- **Status**: completed
- **Files changed**: `src/routes/calculator/+page.svelte`

### Unit tests for collapseToSingle

- **Status**: completed
- **Files changed**: `src/tests/unit/entity-selection-tabbed.test.ts`
- **Issue**: Initial test attempts called `selectX(id)` after `setAcross()`, which means the multi-array was seeded before the selection was updated. Fixed by reversing the order: `selectX(id)` first, then `setAcross()` (which seeds the multi-array from the current single-selection).
