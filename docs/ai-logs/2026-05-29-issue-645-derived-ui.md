# 2026-05-29 — Compound editor live derived UI & mass-% validation (Issue #645)

## Session Narrative

### Prompt 1: Investigate the failing E2E test in PR #653 and reimplement the feature more simply

**User request**: The `AC-3: Validation — duplicate Z blocks Save` Playwright
test in `tests/e2e/custom-compounds.spec.ts` was failing on PR #653
(`qwen/issue-645-derived-ui`): the duplicate banner ("appears twice") showed
but the Save button stayed **enabled** (`toBeDisabled()` timed out). The user
asked whether the functionality of PR #653 (Issue #645 — live derived UI &
mass-% validation) could be reimplemented in a simpler way that doesn't have
the E2E problem, and to open a fresh PR from master if so.

**AI response**:

- **Root cause of PR #653's failure.** PR #653 added a new
  `formula-footer.svelte` that rendered the formula with a keyed
  `{#each formulaParts as part (part.sym)}`. When the composition contains a
  duplicate element (two H rows), two parts share the key `"H"`, which throws
  Svelte 5's `each_key_duplicate` error during the formula-mode render pass.
  That aborted the DOM commit that should have swapped the enabled Save button
  for the disabled one — so the banner painted but Save stayed enabled. PR #653
  also replaced the robust single `disabled={…}` binding with two
  mutually-exclusive `{#if}` Save buttons (mount/unmount), which widened the
  window for the crash to leave a stale enabled button on screen. The gating
  boolean itself was actually correct.

- **Reimplementation approach (simpler, on master).** Started from the working
  master modal (which already hard-blocked Save on duplicates via a single
  `disabled` binding) and layered the Issue #645 features on top, keeping all
  logic as **pure `$derived`** with **no imperative writes** and rendering the
  formula as a **single Unicode string** (no keyed each), which structurally
  removes the crash.

- **What was built:**
  - `compound-derive.ts` — pure helpers `deriveMassPercents`,
    `deriveFormulaString` (Unicode + ASCII), `deriveTotalAtoms`,
    `deriveBraggIValue`, `rescaleTo100`.
  - `element-data.ts` — `ELEMENT_I_VALUES` (ICRU 37 mean excitation energies,
    Z = 1–92) and `getElementIValue()`.
  - `compound-editor/formula-footer.svelte` — formula string · atom count ·
    Bragg I-value (computed) / override, with a Copy button. Atoms mode only.
  - `compound-editor/sum-tracker.svelte` — live weight-fraction sum bar (grey
    stacked segments, fixed 100% tick), green/red status, and an
    `auto-rescale to 100%` link. Weight mode only.
  - `compound-editor-modal.svelte` — replaced the imperative `validate()` +
    `errors` `$state` with a pure `errors` `$derived`; added `canSave` /
    `saveBlockReason` deriveds; single `disabled={!canSave}` Save binding with
    an explanatory `title`; per-row live mass-% in atoms mode; wired in the
    footer/tracker; added `handleRescale`.

- **Gating contract.** Save is disabled whenever name/density/I-value are
  invalid, the weight-fraction sum is outside 100 ± 0.5%, an atom count is
  ≤ 0 / > 1000, or a duplicate element is present (banner up). Inline errors and
  the disabled-button tooltip explain which condition is active. This matches
  the Issue #645 / spec §3.3 acceptance criteria.

- **Verification.** Added `compound-derive.test.ts` (17 unit tests, incl. water
  Bragg I-value ≈ 69 eV and PMMA mass fractions matching the spec) and
  `compound-editor-modal.test.ts` (6 component tests that reproduce the exact
  regression: duplicate → banner shown **and** Save disabled, footer renders
  without crashing). Updated the three E2E validation tests (empty name,
  density > 25, weight-sum ≠ 100%) to assert the disabled Save state and added
  two E2E tests for the formula footer and the sum-tracker auto-rescale.
  `pnpm check`, `pnpm lint`, `pnpm format:check`, and `pnpm build` are clean;
  the full Vitest suite passes (the only failures are the pre-existing
  environmental `guard-forbidden-files` git-signing cases). E2E was not run
  locally — the repo has no built WASM — but the modal behaviour is covered by
  the new component tests, which run WASM-free.

## Tasks

### Reimplement Issue #645 (compound editor live derived UI & % validation)

- **Status**: completed
- **Stage**: 6.10 (custom compounds)
- **Files changed**:
  - `src/lib/utils/element-data.ts` (ICRU 37 I-values + `getElementIValue`)
  - `src/lib/utils/compound-derive.ts` (new — pure derivations)
  - `src/lib/components/compound-editor/formula-footer.svelte` (new)
  - `src/lib/components/compound-editor/sum-tracker.svelte` (new)
  - `src/lib/components/compound-editor-modal.svelte` (pure derived gating +
    derived UI integration)
  - `src/tests/unit/compound-derive.test.ts` (new)
  - `src/tests/components/compound-editor-modal.test.ts` (new)
  - `tests/e2e/custom-compounds.spec.ts` (updated gating assertions + new
    derived-UI tests)
- **Decision**: Render the formula as a single Unicode string instead of a
  keyed `{#each}` to make the footer crash-proof when the composition
  transiently contains duplicate elements. Keep a single `disabled={!canSave}`
  Save binding (node mutation) rather than two `{#if}` buttons. Store the
  elemental I-values as a separate `ELEMENT_I_VALUES` map rather than rewriting
  the 118-row `ELEMENTS` array (smaller, isolated diff).
- **Issue**: The Bragg additivity preview uses pure electron-weighted
  additivity over ICRU-37 elemental I-values; it is labelled "(computed)" and
  is a preview that may differ from libdedx's value for compounds where the
  library applies phase/molecular corrections. WASM parity was not asserted in
  tests (no WASM in unit/component runs).
