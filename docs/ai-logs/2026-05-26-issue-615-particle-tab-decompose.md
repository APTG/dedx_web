# 2026-05-26 — Decompose particle-tab.svelte (#615)

## Session Narrative

### Prompt 1: Work on issue #615

**AI response**: Read the issue, then split `particle-tab.svelte` into a thin
orchestrator plus two sub-components:

- `particle-list-view.svelte` — renders the `picker-particle-list` listbox.
- `particle-grid-view.svelte` — renders the periodic-grid + external chips.
- `particle-tab-helpers.ts` — pure helpers (`Particle` type alias, `NAMED_IDS`,
  `isExternal`, `atomicNumber`, `isNamed`, `periodicPosition`) shared by both
  views and the orchestrator.

The orchestrator (`particle-tab.svelte`) retains: query/filter logic, summary
bar, view toggle, keyboard navigation registration (`onArrowKey`/`onEnterKey`),
multi-select state, and the `highlightedId` cursor — then forwards already-
derived arrays + callbacks to whichever view is active.

All existing `data-testid`, `aria-selected`, `aria-pressed`, and
`data-available` contracts are preserved verbatim — only the source location
moves.

## Tasks

### Decompose particle-tab into list + grid sub-components

- **Status**: completed
- **Stage**: Stage 5 — entity-selection
- **Files changed**:
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/entity-selection/particle-list-view.svelte` (new)
  - `src/lib/components/entity-selection/particle-grid-view.svelte` (new)
  - `src/lib/components/entity-selection/particle-tab-helpers.ts` (new)
  - `CHANGELOG-AI.md`
- **Decision**: Pure helpers extracted to a `.ts` module rather than duplicated
  inside each view, since they have no reactive state. Both sub-components keep
  their own `isMultiSelected` / `isAnchor` closures over the `multiIds` prop —
  simpler than threading those as additional props.
- **Issue**: None.
