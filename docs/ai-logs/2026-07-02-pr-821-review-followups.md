# 2026-07-02 — PR #821 review follow-ups (program annotation, Basic-mode auto, compact row)

Follow-up session to PR #821 ("move program selection out of Basic mode; add
'Calculated with' annotation", #816). Addresses the Copilot review comment, a
UI-compaction request, and a round-trip behavior request from the maintainer.

## Session Narrative

### Prompt 1: Answer the PR #821 review, tidy docs/grammar, compact the two annotation rows, and make the Basic-mode program always auto after a round-trip

**Context gathered.** PR #821 (head `claude/github-issue-816-7qzgow`) had one
open review thread from `copilot-pull-request-reviewer` on
`src/routes/plot/+page.svelte`: the Basic-mode plot annotation always passed
`autoSelected`, but Basic mode can still hold an explicitly-chosen program (a
series added in Advanced mode, or a `series=` URL restore), so "(auto-selected)"
could be inaccurate. Work was done on the review branch
`claude/pr-821-review-docs-11my7m` (branched off the PR head).

**AI response.** Three code changes + tests + docs.

1. **Plot annotation qualifier (Copilot).** The plot annotation aggregates the
   distinct program names across the _committed set_ of series. That set can mix
   auto-selected and explicitly-chosen curves, and the committed `PlotSeries`
   does not record how each program was chosen (a Basic auto-select and an
   Advanced explicit pick both store the resolved numeric `programId`). Rather
   than thread a per-series "was auto" flag through the whole commit / URL
   round-trip / export pipeline (large surface area, real risk), the qualifier
   was **dropped on the Plot**: it now just names the program(s), which is always
   accurate. The "(auto-selected)" qualifier stays on the **Calculator**, where
   it reflects the single live selection and is provably correct. `+page.svelte`
   comment reworded to explain the asymmetry.

2. **Basic mode always auto-selects (round-trip).** Added a dedicated
   mode-fallback `$effect` in **both** page orchestrators
   (`calculator-page-orchestrator.svelte.ts`, `plot-page-orchestrator.svelte.ts`)
   that calls `entityState.selectProgram(-1)` whenever `!isAdvancedMode.value`.
   This mirrors the existing `collapseToSingle()` / custom-compound fallbacks.
   The effect is keyed only on the **mode + state identity** (it does not read
   the material or the series list), so it fires on the mode switch and on first
   load — not on every selection — which keeps per-series editing on the plot
   (`handleSelectSeriesForEdit` → `selectProgram(series.programId)`) working. Net
   effect: a Basic → Advanced → Basic round-trip discards any program the user
   pinned in Advanced mode and comes back to Auto-select, so Basic never
   silently runs on a hidden explicit choice the user can no longer see. This
   also makes the Calculator's "(auto-selected)" qualifier trivially accurate in
   Basic mode.

3. **Compact single row.** The Calculator previously stacked two muted lines
   below the results — "Valid range: … (program, particle)" and "Calculated with
   {program} (auto-selected)" — repeating the program name. Added an optional
   `detail` prop to the shared `program-annotation.svelte` (rendered inline after
   the program, `·`-separated) and merged the valid range into the annotation:
   "Calculated with **{program}** (auto-selected) · valid range … for
   {particle}". One row instead of two; the program name appears once.

## Tasks

### Answer Copilot review — plot annotation accuracy

- **Status**: completed
- **Stage**: plot-redesign / entity-selection (#816 follow-up, PR #821)
- **Files changed**: `src/routes/plot/+page.svelte`,
  `src/lib/components/program-annotation.svelte`
- **Decision**: Drop the "(auto-selected)" qualifier on the plot rather than add
  per-series auto tracking. The plot annotation describes a heterogeneous
  committed set; naming the program(s) is the only statement that is always
  true. Per-series tracking would have touched the URL codec, exports, preview
  calc, and restore — disproportionate risk for a muted annotation.
- **Issue**: none.

### Basic mode always auto-selects (Basic → Advanced → Basic round-trip)

- **Status**: completed
- **Stage**: entity-selection / calculator / plot (#816 follow-up)
- **Files changed**: `src/lib/state/calculator-page-orchestrator.svelte.ts`,
  `src/lib/state/plot-page-orchestrator.svelte.ts`
- **Decision**: Implement as a mode-reactive `$effect` (consistent with the
  existing `collapseToSingle` / material fallbacks) rather than wiring the
  unused `toggleAdvancedMode(onSwitchToBasic)` callback. The effect also covers
  a fresh load into Basic mode with a URL-pinned program. Keyed only on
  mode + state identity so it never fights per-series editing.
- **Issue**: The round-trip is covered by a new e2e (runs in CI — this
  environment has no built WASM), not a unit test, because the behavior lives in
  an orchestrator `$effect` with no headless harness.

### Compact the valid-range + program rows into one

- **Status**: completed
- **Stage**: calculator (#816 follow-up)
- **Files changed**: `src/lib/components/program-annotation.svelte`,
  `src/routes/calculator/+page.svelte`
- **Decision**: Add a generic `detail` prop to the shared component instead of a
  calculator-only combined component, so the plot keeps using the same component
  with no `detail`. The Advanced inverse-lookup tabs keep their own in-tab range
  line; the merged bottom row is a net reduction there too.
- **Issue**: none.

### Tests + docs

- **Status**: completed
- **Files changed**: `src/tests/unit/program-annotation.test.ts` (new `detail`
  cases), `tests/e2e/plot.spec.ts` (annotation no longer asserts
  "auto-selected"), `tests/e2e/entity-selection-tabbed.spec.ts` (new round-trip
  test), `docs/04-feature-specs/calculator.md`, `docs/04-feature-specs/plot.md`,
  `docs/04-feature-specs/entity-selection.md`, `CHANGELOG-AI.md`,
  `docs/ai-logs/README.md`.
- **Gates**: Vitest 1921 passed / 3 skipped; `svelte-check` 0 errors / 0
  warnings; `tsc --noEmit` clean. Prettier + ESLint run before commit.
- **Issue**: none.
