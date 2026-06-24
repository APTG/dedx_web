# 2026-06-23 — Contextual help PR 3: advanced-mode & workflow hints (#771)

## Session Narrative

### Prompt 1: Work on issue #771, make a PR when ready

**AI response**: Implemented the third and final contextual-help PR. Read the
issue, the PR 1/2 foundation (`HelpHint`, `help-text.ts`, the user guide and the
`contextual-help.md` spec), and the glossary (`docs/10-terminology.md`) for the
canonical wording of each term.

Added the PR 3 concept keys to `HELP_TEXT` in
`src/lib/config/help-text.ts` (all ≤150 chars, glossary-sourced, each with a
`/docs/user-guide#…` deep-link):

- Advanced controls: `aggregateState`, `densityOverride`, `iValueOverride`,
  `mstarMode`, `interpolation`.
- Inverse lookups (parity + validity): `inverseRange`, `inverseStp`,
  `braggPeak`.
- Workflow affordances: `advancedMode`, `shareExport`, `customCompound`,
  `compoundComposition`, `compoundIValue`, `externalData`.

Surfaced the hints as siblings of (never nested in) the controls they explain:

- `advanced-options-panel.svelte` — replaced the raw lucide `Info` + Bits UI
  tooltip with `HelpHint` and dropped the now-unused `TooltipProvider`. Density
  keeps its context-sensitive `getDensityTooltip` copy via `text=` plus a
  deep-link; I-value / aggregate-state / interpolation / MSTAR use registry
  `term`s. Aggregate-state and MSTAR hints render only when their control does.
- `results/table-advanced.svelte` (mode `range`) — `inverseRange` hint beside
  the range unit strip.
- `results/table-inverse-stp.svelte` — `inverseStp` + `braggPeak` hints beside
  the STP unit strip (wrapped the strip in a flex row).
- `routes/+layout.svelte` — `advancedMode` beside the Basic/Advanced toggle and
  `shareExport` beside the Share URL button (both hidden on `/docs`).
- `compound-editor/desktop-sheet.svelte` — `compoundComposition` beside the
  Formula / Weight-fraction switch, `aggregateState` beside the Phase radios,
  `compoundIValue` beside the optional I-value field.
- `entity-selection/load-external-modal.svelte` — `externalData` (CORS hosting
  requirement) beside the URL field.

Added a `#advanced-options` user-guide section (covering advanced mode, the
overrides, and the full **MSTAR mode table** so the tooltip can link out rather
than inline it), plus `#inverse-lookups` and `#custom-compounds` subsections as
the deep-link targets, and three new on-page nav chips.

## Tasks

### Advanced-mode control & workflow contextual help

- **Status**: completed
- **Stage**: Stage 8 / contextual-help (PR 3 of 3, #771)
- **Files changed**:
  - `src/lib/config/help-text.ts` (14 new concept keys + doc comment)
  - `src/lib/components/advanced-options-panel.svelte` (standardise on `HelpHint`)
  - `src/lib/components/results/table-advanced.svelte` (Range→ hint)
  - `src/lib/components/results/table-inverse-stp.svelte` (STP→ + Bragg-peak hints)
  - `src/routes/+layout.svelte` (advanced-mode + share/export hints)
  - `src/lib/components/compound-editor/desktop-sheet.svelte` (composition / phase / I-value hints)
  - `src/lib/components/entity-selection/load-external-modal.svelte` (CORS hint)
  - `src/routes/docs/user-guide/+page.svelte` (`#advanced-options`, `#inverse-lookups`, `#custom-compounds`)
  - `src/tests/unit/help-text.test.ts` (PR 3 coverage + inverse-branch parity)
  - `src/tests/components/advanced-options-panel.test.ts` (hint tests)
  - `src/tests/components/inverse-lookup-help.test.ts` (new — both inverse branches)
  - `tests/e2e/contextual-help.spec.ts` (advanced-mode + inverse-branch hints)
  - `docs/04-feature-specs/contextual-help.md` (v3), `docs/04-feature-specs/README.md`, `CHANGELOG-AI.md`
- **Decision**: Kept the density control's existing context-sensitive copy
  (`getDensityTooltip`) instead of replacing it with the generic
  `densityOverride` gloss — the contextual text (gas at STP, powders/pellets) is
  richer at the point of use — but routed it through `HelpHint` for the WCAG
  behaviours and added the `#advanced-options` deep-link. Phase in the compound
  editor reuses `aggregateState` rather than a near-duplicate key, since the
  phase radio _is_ the aggregate-state choice. The MSTAR mode table lives in the
  user guide; the tooltip links to it (issue requirement: don't inline tables).
- **Issue**: E2E (`contextual-help.spec.ts`) not run locally — Playwright needs
  built WASM in `static/wasm/`; the hints are static, and the unit + component
  suites pass. `pnpm check` / `lint` / `format:check` and the full Vitest suite
  (1850 tests) pass.
