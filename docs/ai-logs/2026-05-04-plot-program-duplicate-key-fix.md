# 2026-05-04 — Plot page: fix each_key_duplicate when selecting a program

## Session Narrative

### Prompt 1: Fix each_key_duplicate Svelte error after changing program in Plot mode

**AI response**: Traced the crash through the stack:

1. User clicked a program (PSTAR) in the ③ Program panel on the Plot page.
2. `state.selectProgram(2)` was called from `entity-selection-panels.svelte`.
3. Svelte re-ran the `$derived` block for `programItems`.
4. `programItems` always pushed `state.selectedProgram` as the **first** entry
   in the list. When `selectedProgramId === -1` (Auto-select) this returned an
   entity with `id === -1` — safe. But once a concrete program was selected,
   `state.selectedProgram` returned the actual `ProgramEntity` (e.g. PSTAR with
   `id === 2`).
5. That same entity (`id === 2`) was also returned by `state.availablePrograms`.
6. The `{#each group.items as item (item.entity.id)}` loop in `entity-panel.svelte`
   saw two items with key `2` (and similarly two with key `7` for ICRU49) and
   threw `each_key_duplicate`.

**Fix** (`entity-selection-panels.svelte`): Always push a synthetic
`{ id: -1, name: "Auto-select" }` object as the first entry, regardless of what
`state.selectedProgram` currently is. The label is derived by reading
`selectedProgram` to decide whether to show `"Auto-select → ICRU49"` or plain
`"Auto-select"` — but the `entity` is always the synthetic `id=-1` stub.
This is correct because:

- `selectedId={state.selectedProgram?.id ?? null}` still works (returns 2 for
  PSTAR, -1 for Auto-select).
- `onItemSelect` still passes the entity's id to `state.selectProgram`.
- `availablePrograms` never contains an entity with `id === -1`, so no collision.

**Tests added**:

- `src/tests/unit/entity-selection-panels.test.ts` — 4 unit tests via
  `@testing-library/svelte`:
  - "selecting PSTAR does not produce duplicate program buttons"
  - "Auto-select button is always present with its own entry after selecting PSTAR"
  - "PSTAR button is marked as selected after clicking it"
  - "program panel shows Auto-select, PSTAR, and ICRU 49 after selecting PSTAR"
- `tests/e2e/plot.spec.ts` — 2 E2E tests (Playwright):
  - "selecting a concrete program does not throw each_key_duplicate" —
    captures `pageerror` events and asserts none contain `each_key_duplicate`
  - "each program appears exactly once in the panel after switching programs"

**Outcome**: 539 unit tests pass.

## Tasks

### Fix each_key_duplicate in Plot page program panel

- **Status**: completed
- **Stage**: Stage 6 — Plot export / Plot page
- **Files changed**:
  - `src/lib/components/entity-selection-panels.svelte` — fixed `programItems` derivation
  - `src/tests/unit/entity-selection-panels.test.ts` — new regression tests
  - `tests/e2e/plot.spec.ts` — new E2E regression tests
- **Decision**: Always use a synthetic `{ id: -1, name: "Auto-select" }` entity as
  the first programItems entry. The label string still reflects the current resolved
  program, but the entity object's `id` is always `-1` so it can never clash with
  any real program ID from `availablePrograms`.
- **Issue**: none
