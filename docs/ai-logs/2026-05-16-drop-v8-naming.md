# 2026-05-16 — Drop "v8" codename from the entity-selection picker

## Session Narrative

### Prompt 1: rename out "v8" everywhere and remove the picker-flag switch

User asked to get rid of the `v8` codename across the source. They explained
that the tabbed picker is just an improvement to the entity selector — the
generic naming should reflect what the thing does, not which version it is.
They explicitly called out that `src/lib/state/picker-flag.svelte.ts` and
similar switches are no longer needed, and asked for the specs to be
adjusted accordingly.

**AI response**: Inventoried every `v8` / `V8` reference under `src`, `tests`,
and `docs`, then performed a coordinated rename:

- Moved `src/lib/components/v8/` → `src/lib/components/entity-selection/`.
- Renamed the wrapper component `entity-selection-v8.svelte` →
  `entity-selection.svelte` and the import `EntitySelectionV8` →
  `EntitySelection` in both pages.
- Renamed types: `V8Tab` → `PickerTab`, `V8_TAB_ORDER` →
  `PICKER_TAB_ORDER`.
- Replaced every `data-testid="v8-*"` with `data-testid="picker-*"`
  (including default test-id fallbacks in `search-input.svelte` and
  `selected-pill.svelte`).
- Updated internal aria IDs `v8-tab-{X}` / `v8-tab-panel-{X}` to
  `picker-tab-{X}` / `picker-panel-{X}`.
- Deleted `src/lib/state/picker-flag.svelte.ts` and
  `src/tests/unit/picker-flag.test.ts` outright — the calculator and plot
  pages no longer reference the flag, so it was orphan code.
- Renamed the dedicated tests:
  - `src/tests/unit/entity-selection-v8.test.ts` →
    `entity-selection-tabbed.test.ts`.
  - `tests/e2e/v8-entity-selection.spec.ts` →
    `entity-selection-tabbed.spec.ts` (the existing
    `entity-selection.spec.ts` covers the same picker from a different
    angle, so a "tabbed" suffix avoids collision while keeping intent
    clear).
- Updated `data-testid^="v8-*"` attribute-prefix selectors in the rest of
  the Playwright suite (`custom-compounds`, `plot`, `responsive`,
  `complex-interactions`, etc.).
- Cleared `v8` comment references in `picker-mode.svelte.ts`,
  `program-kind.ts`, `particle-tab.svelte`, and the main
  `entity-selection.svelte` wrapper.
- Rewrote the head of `docs/04-feature-specs/entity-selection.md`: dropped
  the `?v8=1` flag bullet and "delta from v7" framing, renamed the
  "Why a v8" section heading, and collapsed the long "Previous behaviour
  — v7" prose into a short `Historical changelog` bulleted list (kept
  for context). The behavioural and compatibility-matrix sections lower
  in the doc still apply and were not rewritten.

Validation:

- `pnpm build` — production build succeeded.
- `pnpm exec vitest run` — full unit suite: 1324 passed, 3 skipped.
- Spot-check `entity-selection-tabbed.test.ts` (23) + `picker-mode.test.ts`
  (7) + `program-kind.test.ts` (5) — 35/35 pass.

## Tasks

### Rename `v8` namespace → `entity-selection` / `picker`

- **Status**: completed
- **Stage**: entity-selection (post-v8)
- **Files changed**:
  - Renames: `src/lib/components/v8/` → `src/lib/components/entity-selection/`,
    `entity-selection-v8.svelte` → `entity-selection.svelte`,
    `src/tests/unit/entity-selection-v8.test.ts` → `entity-selection-tabbed.test.ts`,
    `tests/e2e/v8-entity-selection.spec.ts` → `entity-selection-tabbed.spec.ts`.
  - Deletions: `src/lib/state/picker-flag.svelte.ts`,
    `src/tests/unit/picker-flag.test.ts`.
  - Edits: 8 picker components (test IDs, types), `src/routes/calculator/+page.svelte`,
    `src/routes/plot/+page.svelte`, 10 Playwright specs, the
    `entity-selection.md` spec, `CHANGELOG-AI.md`.
- **Decision**: Used `picker-*` as the `data-testid` prefix (matches the
  existing `picker-mode` store and the user's "general naming" guidance
  better than dropping the prefix entirely, which would risk colliding
  with global testids).
- **Decision**: Folded the v7 history into a `Historical changelog`
  section rather than deleting it — the behavioural sections below it
  (compatibility matrix, search rules, accessibility) still describe the
  shared model and are referenced by other specs.
- **Issue**: None outstanding. The two related dead-code components
  (`entity-selection-comboboxes.svelte`, `entity-selection-panels.svelte`)
  are still on disk but unreferenced by routes; cleaning those up is a
  separate task outside the scope of this rename.
