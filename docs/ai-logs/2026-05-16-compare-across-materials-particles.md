# 2026-05-16 — Compare-across Materials / Particles end-to-end

## Session Narrative

### Prompt 1: Enable compare-across Materials/Particles end-to-end

**AI response**: Implemented the full compare-across materials/particles feature (follow-up issue #5 from the entity-selector rework session). Removed `disabled: true` from the Materials and Particles entries in `ACROSS_OPTIONS` in `advanced-toolbar.svelte` and dropped the "(soon)" suffix. Created a new `MultiEntityState` abstraction (`src/lib/state/multi-entity.svelte.ts`) as a lightweight analog to `MultiProgramState` — it holds `comparisonResults` keyed by `EntityId` and a display-name resolver; the ordered ID list comes from `entityState.multiSelected[dim]` rather than being managed internally. Added multi-select rendering to `particle-tab.svelte` and `material-tab.svelte`: dismissible pills at the top for selected entities, ✓ indicators on each list row, anchor entity shown as non-deselectable with "(anchor)" label, `aria-multiselectable` on the `<ul role="listbox">`. Wired debounced WASM calculation effects in `calculator/+page.svelte` that iterate over `entityState.multiSelected[dim]` and call `service.calculate()` for each entity, storing results in `MultiEntityState`. The `ResultTable` component gained a new `isMultiEntity` branch rendering a grouped two-row header (STP + CSDA group headers, per-entity sub-headers with ◆ anchor marker highlighted in blue) and per-entity STP/CSDA cells. `MultiProgramPicker` is now conditionally rendered only when `across === "program"` so switching away from Programs hides the picker.

Fixed one failing unit test in `entity-selection-tabbed.test.ts` that expected Material/Particle dropdown options to be `disabled: true` — updated to `false` with a clarifying comment.

### Prompt 2: Commit on new branch

**AI response**: User clarified mid-session that commits should go on a new branch. All changes were staged for commit on the `feat/issue-510-drag-handle-reorder` branch (user created PR #523 from this).

### Prompt 3: Update Stage 8 table in redesign plan

**AI response**: Updated `docs/00-redesign-plan.md` Stage 8 PRs table: changed PR #522 status from 🚧 to ✅ (it was already merged per git log), and added PR #523 row with a full description of the compare-across materials/particles feature.

## Tasks

### Enable Materials/Particles in compare-across dropdown

- **Status**: completed
- **Stage**: Stage 8 (Open Beta & User Feedback)
- **Files changed**:
  - `src/lib/components/entity-selection/advanced-toolbar.svelte`
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/state/multi-entity.svelte.ts` (new)
  - `src/routes/calculator/+page.svelte`
  - `src/lib/components/result-table.svelte`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
- **Decision**: Used a simpler `MultiEntityState` (no drag-and-drop, no column visibility) compared to `MultiProgramState`, since material/particle comparison only needs results + name resolver. The ordered ID list comes from `entityState.multiSelected[dim]` directly.
- **Issue**: Per-material density is not yet supported — all multi-material columns use the anchor entity's density. This is a known simplification, deferred as a follow-up.
