# 2026-06-16 — Issue #608 rescope: flat-list program picker + parity toggle

## Session Narrative

### Prompt 1: "work on issue 608, but check all comments, the instructions are in the rescope comment, make PR"

**AI response**: Read issue #608 ("Advanced Program Picker: Multi-Select
Layout (Stage 5)") and its single comment — a maintainer **rescope
proposal**. The issue as written asked for a bespoke SELECTED/AVAILABLE
split with in-picker drag handles. The rescope comment argues against
building that, because:

1. The shipped program and particle pickers are already identical flat
   multi-select lists; giving programs a bespoke layout would be an
   inconsistency.
2. Reordering already exists in the comparison-column headers
   (`advanced-header.svelte` — drag + Alt+←/→), so an in-picker reorder
   UI would duplicate it.
3. The SELECTED/AVAILABLE wireframe came from the #504 design sketch, not
   a hard requirement in the final `multi-program.md` spec.

The comment lists the actual work: (a) keep the flat list for both
pickers; (b) restore picker parity by enabling the summary bar's
"only selected" filter toggle in `program-tab.svelte` (it passed
`onToggleOnlySelected={undefined}` while particle/material wired it up);
(c) reconcile the spec to describe the flat-list picker.

Implemented exactly that:

- **Parity fix** (`program-tab.svelte`): added `showOnlySelected` `$state`,
  a `passesOnlySelected(id)` helper, and applied it to the `filteredBuiltin`
  / `filteredExternal` derivations (so it works in both the tiny-bucket
  inline list and the medium+ scroll list). Wired the summary bar with
  `onlySelected={showOnlySelected}` and a multi-mode-only toggle handler —
  mirroring `particle-tab.svelte` / `material-tab.svelte`.
- **Spec reconciliation** (`docs/04-feature-specs/multi-program.md`): added
  a v5 status note, rewrote the "Multi-Select Program Picker" table to
  describe the flat list (✓/○ markers, anchor row, summary-bar filter,
  reordering lives in the column headers), and updated the Program
  Selection acceptance criteria.
- **Test** (`entity-selection-tabbed.test.ts`): added a case that renders
  the program tab in Calculator (collapsible) advanced mode with two
  selected programs, flips the "All shown" → "Selected only" toggle, and
  asserts the unselected compatible program disappears.

## Tasks

### Rescope #608 — keep flat picker, restore parity toggle, update spec

- **Status**: completed
- **Stage**: Stage 5 (multi-program) — see `docs/00-redesign-plan.md`
- **Files changed**:
  - `src/lib/components/entity-selection/program-tab.svelte`
  - `docs/04-feature-specs/multi-program.md`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-06-16-issue-608-rescope-program-picker.md`
- **Decision**: Followed the rescope comment rather than the original issue
  body. The "only selected" toggle is the lightweight equivalent of the
  SELECTED group's "see only my active programs" affordance, with zero new
  layout and full particle/program/material parity. Reordering is
  intentionally left to the comparison-column headers.
- **Issue**: None outstanding. The original SELECTED/AVAILABLE + in-picker
  drag-handle scope is dropped by design.
