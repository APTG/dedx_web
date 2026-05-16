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

## Review-round fixes (PR #511)

Addressed the reviewer thread + user comment on PR #511:

- **Removed `<MultiList>` rendering branch from `program-tab.svelte`** —
  the multi-list had no consumers (multi-program comparison still flows
  through `MultiProgramState`/`<MultiProgramPicker>`), and rendering it
  hid the normal `picker-program-item-*` rows that the custom-compounds
  E2E suite depends on. The `multiSelected` state setters stay so the
  follow-up issue can light up the UI later without re-deriving data.
- **Deleted `multi-list.svelte`** — no longer referenced; was flagged by
  the reviewer for `<button>` containing `<input type=checkbox>`
  (invalid HTML), `role="listbox"` without `role="option"` children,
  and selected rows disappearing when filtered out by search.
- **`AdvancedToolbar` hidden on Plot** (user feedback: Plot's Advanced
  mode only needs part+mat+program selection for the next "Add series",
  no Compare-across needed). New `showAdvancedToolbar` prop on
  `<EntitySelection>` defaults to `collapsible`, so Calculator shows it
  and Plot hides it.
- **`+ New custom material` pill moved from above the Material columns
  to below them** (user feedback: less-important feature, columns are
  the primary path).
- **`handleReset` re-applies the collapse rule** on Calculator
  (`collapsible=true`) so reset both restores defaults and collapses
  the panel — fixes the failing
  `tests/e2e/entity-selection-tabbed.spec.ts:91` assertion.
- **Tab-bar empty `!` badge** now uses `role="img"` + `aria-label` with
  a `aria-hidden` text child, instead of `aria-label` on a plain
  `<span>` — silences the a11y-tool warning.
- **Reverted formatting-only changes** to ~30 unrelated files that
  `pnpm format` rewrote (AI logs, prototype lockfiles, unrelated
  components). The PR now only touches files relevant to the chrome +
  state rework.
- **Updated state-comment** in `entity-selection.svelte.ts` to reflect
  that the multi-list rendering branch is no longer present and that
  `multiSelected` is reserved for the follow-up issue.

## Follow-up issues — final list

Filed (or to-file) as separate GitHub issues. The numbering here matches
the order in the AI log above; details unchanged unless noted.

1. **Persistent picker-level search row + chevron + dynamic placeholder**
2. **Move `external-sources-panel.svelte` into `entity-selection/`** with
   collapsible attribution rows + per-source remove buttons.
3. **`load-external-modal.svelte`** with URL paste + drag-drop + recents.
4. **`<MultiList>` UI** — recreate the component with proper a11y
   (separate options list, no nested interactive controls, selected
   rows preserved across search) **and** wire its reorder
   interactions. Combined into one issue because the previous
   component shouldn't be revived; it should be redesigned alongside
   the consumer wiring.
5. **Compare across = Materials / Particles end-to-end** through
   `calculator-state` / `plot-state`. Also covers wiring
   `multiSelected.program` so that the Compare-across=Programs
   dropdown actually drives the results table — i.e. the consumer
   side of follow-up #4.
6. **Retire `selected-pill.svelte` + `multi-program-picker.svelte`**
   (depends on #4 and #5).
7. **Mobile Material-tab card polish.**
