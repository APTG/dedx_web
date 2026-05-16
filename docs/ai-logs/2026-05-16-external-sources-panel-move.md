# 2026-05-16 — Move external-sources-panel under entity-selection; per-source × Remove

## Session Narrative

### Prompt 1: Move component + add collapsible rows + Remove button (issue #510)

User asked to move `src/lib/components/external-sources-panel.svelte` into
`src/lib/components/entity-selection/`, make each source row individually
collapsible, and add a per-source × Remove button calling `ExternalDataService`.

**AI response**:

- Created branch `feat/issue-510-external-sources-entity-selection`.
- Wrote new component at `src/lib/components/entity-selection/external-sources-panel.svelte`:
  - Outer `<details>` for the whole section (unchanged UX).
  - Each source `<li>` replaced with its own `<details group/src>` — label + name
    visible in the summary; Author/License/Description/Coverage/URL only shown when
    expanded.
  - × Remove button in every source summary row: calls
    `externalDataService.evict(label)` then invokes optional `onRemove` prop callback.
- Deleted the old `src/lib/components/external-sources-panel.svelte`.
- Updated imports in `src/routes/calculator/+page.svelte` and
  `src/routes/plot/+page.svelte` to the new path.
- Added `handleRemoveExternalSource` in both pages: filters evicted label from
  `loadedExternalSources` reactive state.
- Updated test import path in `src/tests/unit/external-sources-panel.test.ts`.
- Added 3 new unit tests: Remove button calls `onRemove`, evicts via service,
  per-source collapse works independently.

All 1329 tests pass.

## Tasks

### Move external-sources-panel.svelte + add Remove button

- **Status**: completed
- **Stage**: entity-selection (issue #510)
- **Files changed**:
  - `src/lib/components/entity-selection/external-sources-panel.svelte` (new)
  - `src/lib/components/external-sources-panel.svelte` (deleted)
  - `src/routes/calculator/+page.svelte`
  - `src/routes/plot/+page.svelte`
  - `src/tests/unit/external-sources-panel.test.ts`
- **Decision**: Used optional `onRemove` prop so the component stays stateless; the
  pages own `loadedExternalSources` and decide how to react. `evict()` is called
  inside the component so it always runs regardless of whether `onRemove` is provided.
- **Issue**: None — no URL sync on remove (removing a source doesn't rewrite the URL
  parameters; a follow-up could do that if desired).
