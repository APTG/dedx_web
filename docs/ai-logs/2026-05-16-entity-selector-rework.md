# 2026-05-16 — Entity-selector chrome + state rework (option 2)

## Session Narrative

### Prompt 1: "Continue with option two, but write down how to proceed later, do I need to create new issues for followup work?"

**AI response**: User confirmed proceeding with option 2 — chrome + state
model rework, with multi-list adapter for the Program tab when
`across === "program"`. User explicitly asked whether to create follow-up
issues. I implemented the scoped PR and documented the deferred work in
two places: (1) the PR description so the human reviewer sees the
follow-ups inline, and (2) this AI log so future sessions can find them.

**My recommendation on follow-up issues**: yes — file one issue per
deferred bundle below so they can be prioritized, scheduled, and worked
in parallel by different sessions/tools. The issues are independent
(different files, different test surfaces), so a single mega-issue would
slow them down.

## Follow-up issues to file

1. **"Persistent picker-level search row + chevron + dynamic placeholder"**
   - Lift the per-tab `SearchInput` instances out of
     `particle-tab.svelte`, `material-tab.svelte`, `program-tab.svelte`
     into a single `entity-selection.svelte`-owned input.
   - Pass `query` + `onQueryChange` props down so each tab continues to
     do its own filtering against the shared query.
   - Add the chevron toggle (▼/▲) at the right edge of the search row
     to expand/collapse the panel.
   - Placeholder switches based on `state.activeTarget` ("Search particles…",
     "Search materials…", "Search programs…").

2. **"Move external-sources-panel into entity-selection/ and add per-source controls"**
   - Move `src/lib/components/external-sources-panel.svelte` (or wrap it)
     under `src/lib/components/entity-selection/`.
   - Add collapsible attribution rows and a per-source `× Remove` button
     that calls into `ExternalDataService`.

3. **"Load-external modal"**
   - Build `src/lib/components/entity-selection/load-external-modal.svelte`
     with URL paste validator (basic `http(s)://…/*.webdedx` regex) +
     drag-drop file zone.
   - Wire `localStorage` key `webdedx.externalRecents.v1` for a recents
     list (5 most recent successful loads).
   - Wire to `ExternalDataService.loadFromUrl(...)` /
     `loadFromFile(...)`.
   - Enable the disabled `picker-load-external` button when the modal
     ships.

4. **"<MultiList> drag + keyboard reorder"**
   - Add `⋮⋮` drag handle (mouse + touch) on each SELECTED row.
   - Add `Alt+ArrowUp` / `Alt+ArrowDown` keyboard reorder while a row's
     drag handle has focus.
   - Add `aria-live="polite"` announcements ("Moved Program X to
     position N of M").

5. **"Compare across = Materials / Particles end-to-end"**
   - Enable the disabled options in
     `advanced-toolbar.svelte`'s `picker-compare-across` dropdown.
   - Wire `multiSelected.material` / `multiSelected.particle` into
     `calculator-state.svelte.ts` and `plot-state.svelte.ts` so
     multi-material / multi-particle comparisons render in the results
     table / plot.
   - Add the Particle tab and Material tab `<MultiList>` rendering
     branches mirroring the Program-tab one shipped in this PR.

6. **"Retire selected-pill.svelte and multi-program-picker.svelte"**
   - After issue 5 ships, the in-panel `<SelectedPill>` and the
     Calculator-page `<MultiProgramPicker>` dropdown are both fully
     superseded.
   - Delete both components and their callsites.
   - Delete `src/lib/state/multi-program.svelte.ts` if no other consumer
     remains.

7. **"Mobile Material-tab card polish"**
   - Add `overscroll-behavior: contain` and fade-shadow gradients to
     the bounded Elements / Compounds / Custom columns.
   - Add a `⤢` button per card that promotes it to a full-screen sheet
     on `< sm` viewports (matches the wireframe in
     `entity-selection.md`).

## Tasks

### Entity-selector chrome + state rework (this PR)

- **Status**: completed
- **Stage**: Stage 8 (Open Beta & User Feedback)
- **Files changed**:
  - **New**: `src/lib/components/entity-selection/advanced-toolbar.svelte`,
    `src/lib/components/entity-selection/multi-list.svelte`
  - **Deleted**: `src/lib/components/entity-selection/recipe-bar.svelte`
  - **Edited**: `src/lib/state/entity-selection.svelte.ts`,
    `src/lib/components/entity-selection/entity-selection.svelte`,
    `src/lib/components/entity-selection/tab-bar.svelte`,
    `src/lib/components/entity-selection/material-tab.svelte`,
    `src/lib/components/entity-selection/program-tab.svelte`,
    `src/lib/components/entity-selection/search-input.svelte`
  - **Tests**: `src/tests/unit/entity-selection-tabbed.test.ts`,
    `tests/e2e/entity-selection.spec.ts`,
    `tests/e2e/entity-selection-tabbed.spec.ts`
  - **Docs**: `docs/04-feature-specs/entity-selection.md`,
    `docs/00-redesign-plan.md`, `CHANGELOG-AI.md`
- **Decision**: Active-target advance rule A.4 now stays put when all
  three tabs are non-empty instead of cycling to the first empty —
  this matches the spec rule but flips one existing test
  (`selecting a particle … auto-advances`) which I updated to assert
  the new behavior (`stays put`).
- **Decision**: `multiSelected.program` is the canonical state for
  multi-program comparison in the new picker. The existing
  `MultiProgramState` (used by `<MultiProgramPicker>` above the
  Calculator results table) is **not** synced with it in this PR — the
  retire-multi-program-picker issue (follow-up #6) handles the
  consolidation in one step after the results-table rework lands.
- **Decision**: The squiggle/coral underline is implemented as a flat
  rounded coral bar (1.5px) rather than an SVG squiggle for this PR.
  The wireframe-style squiggle is non-functional polish and can be
  swapped in as a CSS background-image without API change.
- **Decision**: Reset moved from the recipe bar into the Advanced
  toolbar. Basic-mode users have no reset button surface; the spec
  doesn't require one, and the previous `picker-recipe-reset` was the
  only Basic-mode reset path. If user feedback shows this matters, the
  follow-up is to render a tiny `↺` in the search row (issue 1 above).
- **Issue**: E2E real-WASM verification only runs on CI — the local
  sandbox cannot build WASM via Docker. Unit tests (1321 passing) +
  build + lint + typecheck (no new errors) confirm the shape.
