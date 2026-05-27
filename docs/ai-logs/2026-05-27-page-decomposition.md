# 2026-05-27 — Decompose `/calculator` and `/plot` page components

## Session Narrative

### Prompt 1: analyse the codebase across three axes

User asked for an audit of (a) code complexity, (b) test coverage, and (c) spec
consistency. Three parallel `Explore` agents reported back. Headline findings:

- `src/routes/calculator/+page.svelte` (1815 lines) and `src/routes/plot/+page.svelte`
  (1280 lines) are by far the largest files in the project and own too many
  concerns: URL decode/restore, state initialisation, calculation orchestration,
  PDF metadata, banners, modals, and rendering.
- Three near-identical copies of `resolveExtLocalIdForLabel` exist in
  `lib/state/calculator.svelte.ts`, `routes/calculator/+page.svelte`, and
  `routes/plot/+page.svelte`.
- State stores (`calculator.svelte.ts`, `entity-selection.svelte.ts`,
  `custom-compounds.svelte.ts`, `inverse-lookups.svelte.ts`) and the WASM
  wrapper (`libdedx.ts`) lack direct unit tests.
- Architecture doc `docs/03-architecture.md` is stale relative to the Stage 8
  component tree; URL schema is v2 in code but v1 test cases still coexist
  without being marked as legacy.

### Prompt 2: start on the page decomposition and ship a PR

This session focuses exclusively on the calculator + plot page decomposition.
The pattern established by recent refactor PRs (#602 URL sync extraction,
#603 async init extraction, #604 result-table god component) is to extract
`$effect`-based logic into **headless setup functions** in dedicated
`$lib/state/*.svelte.ts` modules, called from the page with getter closures.

I applied the same pattern. New modules:

- `$lib/state/multi-program-calc.svelte.ts` — `setupMultiProgramCalculation()`
- `$lib/state/multi-entity-calc.svelte.ts` — `setupMultiEntityCalculation()`
- `$lib/state/inverse-calc.svelte.ts` — `setupInverseRangeCalculation()` +
  `setupInverseStpCalculation()`
- `$lib/state/plot-preview-calc.svelte.ts` — `setupPlotPreviewCalculation()`
- `$lib/state/plot-url-restore.svelte.ts` — `setupPlotUrlRestore()`

Pure helpers moved out of the page scripts:

- `$lib/utils/inverse-units.ts` — `rangeUnitToCmFactor()`, `stpToMevCm2g()`
- `$lib/utils/energy-anchor-options.ts` — `getEnergyAnchorOptions()` +
  `ENERGY_UNIT_TOOLTIPS`
- `$lib/utils/calculator-pdf-metadata.ts` — `buildCalculatorPdfMetadata()`
- `$lib/export/plot-image.ts` — `downloadPlotSvg()`, `downloadPlotPng()`, and
  the JSROOT/DOM fallback chain
- `$lib/external-data/ids.ts` — added `resolveExtLocalIdForLabel()` (was
  duplicated three times across the calculator/plot pages and one state module;
  the page copies are now removed)

The page scripts are now thin wiring layers that hand state getters to setup
functions. Behaviour is identical: every snapshot pattern, race-protection
flag, and reactivity workaround was preserved verbatim during extraction.

## Tasks

### Decompose `routes/calculator/+page.svelte`

- **Status**: completed
- **Stage**: Stage 8 — refactor / code-quality work for open beta
- **Files changed**:
  - `src/routes/calculator/+page.svelte` (1815 → 1055 lines, -42%)
  - new: `src/lib/state/multi-program-calc.svelte.ts`
  - new: `src/lib/state/multi-entity-calc.svelte.ts`
  - new: `src/lib/state/inverse-calc.svelte.ts`
  - new: `src/lib/utils/inverse-units.ts`
  - new: `src/lib/utils/energy-anchor-options.ts`
  - new: `src/lib/utils/calculator-pdf-metadata.ts`
- **Decision**: keep the multi-program / multi-entity *state-creation* effects
  inline on the page (they read multiple page-local `$state` signals and write
  the same signals — easier to keep them where the signals live). Only the
  *calculation* effects move out, which is where the real bulk and complexity
  live.

### Decompose `routes/plot/+page.svelte`

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**:
  - `src/routes/plot/+page.svelte` (1280 → 802 lines, -37%)
  - new: `src/lib/state/plot-preview-calc.svelte.ts`
  - new: `src/lib/state/plot-url-restore.svelte.ts`
  - new: `src/lib/export/plot-image.ts`
- **Decision**: `setupPlotUrlRestore()` exposes an `onComplete` callback rather
  than writing to a local boolean, so the page keeps ownership of
  `urlInitialized`. This matches the pattern of `setupPlotUrlSync` reading
  the flag through a getter.

### Deduplicate `resolveExtLocalIdForLabel`

- **Status**: completed
- **Files changed**: `src/lib/external-data/ids.ts` (added function), three
  call sites consolidated.

### Verification

- `pnpm run check` — 0 errors, 0 warnings, 1183 files
- `pnpm run lint` — clean
- `pnpm run format:check` — clean
- `pnpm run test` — 1471 / 1477 passing; the 3 failures are the pre-existing
  `guard-forbidden-files.test.ts` git-signing failures noted in earlier
  session logs (#595, #591) and are unrelated to this work.
- Manual smoke: `pnpm dev` serves `/calculator` (97 KB SSR response) and
  `/plot` (96 KB SSR response) without errors.

### Out of scope (future work)

The audit identified further extraction opportunities — `compound-editor-modal.svelte`
(555 lines), `material-tab.svelte` (553 lines), `load-external-modal.svelte`
(552 lines), and template chunks like the inverse-mode tab bar, advanced
hint, and shared-URL compound banner. These warrant their own focused PRs
rather than being bundled here.
