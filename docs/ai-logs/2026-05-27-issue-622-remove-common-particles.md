# 2026-05-27 — Remove "common particles" concept (#622)

## Session Narrative

### Prompt 1: Remove the "common particles" concept

User requested resolving issue #622: drop the bold/star highlighting for proton
and alpha particle, and render all particles uniformly sorted by Z.

**AI response**: Identified all locations where `NAMED_IDS`, `isNamed`, and the
"Common particles" group were used. Removed the concept from:

- `particle-tab-helpers.ts` — deleted `NAMED_IDS` export and `isNamed` helper
- `particle-list-view.svelte` — removed star `★` icon and `font-semibold` for named particles
- `particle-tab.svelte` — replaced named/ions split sort with a single Z-sorted pass
- `picker-sheet.svelte` — removed `NAMED_IDS`, `isNamed`, star icon, and semibold class
- `entity-selection-comboboxes.svelte` — removed "Common particles" / "Ions" sections; flat Z-sorted list
- `entity-selection-panels.svelte` — replaced `commonParticles` + `ionParticles` groups with a single "Particles" group sorted by Z

Updated the spec (`docs/04-feature-specs/entity-selection.md`) and the test
file (`entity-selection-comboboxes.test.ts`) to match the new flat structure.

## Tasks

### Remove common particles concept

- **Status**: completed
- **Stage**: Stage 5 — entity-selection
- **Files changed**:
  - `src/lib/components/entity-selection/particle-tab-helpers.ts`
  - `src/lib/components/entity-selection/particle-list-view.svelte`
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/entity-selection/picker-sheet.svelte`
  - `src/lib/components/entity-selection-comboboxes.svelte`
  - `src/lib/components/entity-selection-panels.svelte`
  - `src/tests/unit/entity-selection-comboboxes.test.ts`
  - `docs/04-feature-specs/entity-selection.md`
- **Decision**: Kept electron (id 1001) in the combobox/panels list (unavailable, with description) since its exclusion is a different concern (ESTAR not yet shipped). In the picker tab it remains excluded entirely per existing spec.
- **Issue**: None
