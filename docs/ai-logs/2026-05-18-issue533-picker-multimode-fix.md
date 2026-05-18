# 2026-05-18 — Issue #533 follow-up: isMultiMode gating + anchor label removal

## Session Narrative

### Prompt: Fix ghost ○ circles and (anchor) label after returning to basic mode

User observed that empty ○ circles and "(anchor)" text still appeared in the
particle list after switching from "Compare across particles" back to basic mode.
Also requested removing the "(anchor)" label from all picker lists.

**Root cause**: `isMultiMode` in `particle-tab.svelte` and `material-tab.svelte`
was computed as `selectionState.across === "particle/material"` with no guard on
`isAdvancedMode`. The state function `collapseToSingle()` truncates the multi-select
arrays when returning to basic mode, but it intentionally does not reset the `across`
dimension (by design, for re-entry into advanced mode). Since `isMultiMode` only checked
`across`, it remained `true` and the ○ circle and `(anchor)` spans continued rendering.

`program-tab.svelte` already had the correct pattern: `isMultiMode = $derived(showAdvancedToolbar && selectionState.across === "program")`. Particle and material tabs lacked the equivalent gate.

**Fix**: Added `isAdvancedMode.value &&` to the `isMultiMode` derivation in both
particle-tab and material-tab. Removed `(anchor)` labels from all 6 affected files.
Updated 3 unit tests that call `setAcross()` to also set `isAdvancedMode.value = true`
for the test duration.

## Tasks

### Fix ghost ○ circles + anchor label (issue #533 follow-up)

- **Status**: completed
- **Stage**: Stage 8 / picker
- **Files changed**:
  - `src/lib/components/entity-selection/particle-tab.svelte` — import + gate isMultiMode + remove (anchor) span
  - `src/lib/components/entity-selection/material-tab.svelte` — gate isMultiMode + remove (anchor) spans (×2)
  - `src/lib/components/entity-selection/grouped-result-list.svelte` — remove (anchor) span
  - `src/lib/components/entity-selection/program-tab.svelte` — remove (anchor) spans (×2)
  - `src/lib/components/entity-selection/program-inline-list.svelte` — remove (anchor) spans (×2)
  - `src/tests/unit/entity-selection-tabbed.test.ts` — set isAdvancedMode.value in 3 tests
  - `docs/00-redesign-plan.md` — added PR #540 row to Stage 8 table
- **Decision**: Gating on `isAdvancedMode.value` mirrors the existing pattern in program-tab (`showAdvancedToolbar` prop). Using the global singleton avoids adding a new prop to particle-tab and material-tab.
- **Issue**: none — all 1379 tests pass.
