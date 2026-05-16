# 2026-05-16 — Persistent picker-level search row + chevron + dynamic placeholder

## Session Narrative

### Prompt 1: implement issue "Persistent picker-level search row + chevron + dynamic placeholder"

**AI response**: Implemented the follow-up tracked in the PR #508 deferred
list. The three per-tab `<SearchInput>` instances in
`particle-tab.svelte`, `material-tab.svelte`, and `program-tab.svelte`
were lifted into a single `<EntitySelection>`-owned search row that
sits between the `<TabBar>` and the tab panel. The row is persistent
(visible even when the panel is collapsed) and includes a chevron
button at its right edge that toggles `selectionState.expanded`.

Key design choices:

- **Shared `query` state** lives in `entity-selection.svelte` and is
  passed down to each tab as a `query` prop. Each tab keeps its own
  filtering logic (`matches(...)` against the same shared string) so
  the change is mechanical — no behavior moves out of the tab.
- **Tab-change reset**: a `$effect` clears `query` whenever
  `activeTab` changes (matching the old per-tab `query = $state("")`
  default) and refocuses the lifted search input so keyboard users can
  immediately type after switching tabs. Initial mount intentionally
  does *not* steal focus, which preserves the existing
  `entity-selection-tabbed.test.ts` "arrow keys on tab bar" behavior
  where the test focuses a tab button after render.
- **Dynamic placeholder**: derived from `activeTarget` —
  `"Search particles…"`, `"Search materials…"`, `"Search programs…"`.
- **Dynamic `data-testid`**: the lifted input exposes
  `picker-{activeTab}-search`, matching the existing per-tab testids
  so all existing unit + E2E tests keep passing without churn.
- **Particle keyboard nav preserved**: the picker-level
  `<SearchInput>` still forwards ↑/↓/↵ to particle-tab's list
  highlight logic. This is wired via two `$bindable` props
  (`onArrowKey`, `onEnterKey`) that particle-tab registers in a
  `$effect`. Material/Program tabs do not register them (they didn't
  use arrow/enter navigation before either).
- **Chevron**: `▼` when collapsed, `▲` when expanded; `aria-expanded`
  + `aria-controls` for screen readers; `data-testid="picker-toggle"`.

## Tasks

### Lift SearchInput into entity-selection.svelte

- **Status**: completed
- **Stage**: 8 (Entity-selection picker chrome follow-up)
- **Files changed**:
  - `src/lib/components/entity-selection/entity-selection.svelte`
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/components/entity-selection/program-tab.svelte`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `docs/00-redesign-plan.md` (Stage 8 PRs table)
  - `CHANGELOG-AI.md`
- **Decision**: Particle keyboard nav (↑/↓/↵) reuses the existing
  `<SearchInput>` callbacks by registering the tab's local
  `handleArrow` / `handleEnter` on parent-bound `$bindable` slots.
  This keeps the highlight state local to the tab while letting the
  parent-owned input drive it.
- **Issue**: None.
