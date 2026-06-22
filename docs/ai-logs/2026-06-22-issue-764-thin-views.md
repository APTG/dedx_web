# 2026-06-22 — Issue #764: thin the remaining three view components

## Session Narrative

### Prompt 1: Work on the next component(s), one PR is fine, changes aren't large

**AI response**: Issue #764 (part of #761) lists four 500+ LOC view
components that have become logic sinks. The **material-tab** child landed
earlier in PR #778; this session takes the remaining three in a single PR,
each via a colocated, unit-tested helper. Structure-only, no behaviour change.

**advanced-options-panel** (524 → 435 LOC) → `utils/advanced-options-fields.ts`:

- `formatDensityForDisplay`, `getDensityPlaceholder`, `getDensityTooltip`
- `validateDensity`, `validateIValue`, `buildHeaderText`
- `scaleToSelectValue` / `methodToSelectValue` and the interpolation
  transition logic as pure `nextInterpolationForScale` /
  `nextInterpolationForMethod` (component applies the result to the
  singleton). The scale-select sync `$state`+`$effect` collapsed to a
  `$derived` (matching the existing `methodSelectValue`), which also cleared
  a `svelte/prefer-writable-derived` lint.

**load-external-modal** (552 → 485 LOC) → `external-data/load-form.ts`:

- `sanitizeLabel`, `labelFromUrl`, `validateLabelValue`,
  `validateExternalUrl`, `nextAvailableLabel`
- `firstDroppedUrl` (drag-and-drop URL fallback parse)
- recents: pure `appendRecent` plus `loadRecents` / `recordRecent`
  (localStorage). `ExternalRecent` type moved to the module.

**table-advanced** (531 → 500 LOC) → `results/table-advanced-helpers.ts`:

- `RANGE_ANCHOR_OPTIONS`, `ENERGY_UNIT_TOOLTIPS`, `buildEnergyAnchorOptions`
- `inputClass`, `cellClass`, `rangeUnitLabel` (now takes the master unit as
  a param instead of reading the state object), `splitPasteLines`.
  The `<table>` markup and DOM-coupled keyboard navigation stay in the
  component, as the issue requested.

Verification: 48 new unit tests across the three helper files; affected
component tests (`advanced-options-panel.test.ts`,
`load-external-modal.test.ts`) pass unchanged; full suite 1821 passed / 3
skipped; `svelte-check` 0/0; `pnpm lint` clean; `prettier --check` clean.

## Tasks

### Extract logic from the three remaining #764 components

- **Status**: completed
- **Stage**: architecture refactor (#761 → #764, children 2–4 of 4)
- **Files changed**:
  - `src/lib/utils/advanced-options-fields.ts` (new)
  - `src/lib/external-data/load-form.ts` (new)
  - `src/lib/components/results/table-advanced-helpers.ts` (new)
  - `src/lib/components/advanced-options-panel.svelte`
  - `src/lib/components/entity-selection/load-external-modal.svelte`
  - `src/lib/components/results/table-advanced.svelte`
  - `src/tests/unit/advanced-options-fields.test.ts` (new)
  - `src/tests/unit/load-form.test.ts` (new)
  - `src/tests/unit/table-advanced-helpers.test.ts` (new)
- **Decision**: Kept the extractions as pure plain-`.ts` helpers rather than
  rune-based `.svelte.ts` state factories. The components' reactive `$state`
  and the async service/DOM glue stay in place; only the testable
  pure logic moved. This keeps the diff structure-only and the helpers
  trivially unit-testable. Interpolation handlers were made pure by computing
  the *next* `interpolation` object and letting the component apply it
  (preserving the singleton's add/delete semantics exactly).
- **Issue**: None. #764 fully addressed across #778 (material-tab) and this PR.
