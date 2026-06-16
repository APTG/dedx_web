# 2026-06-16 — Tame the calculator-page orchestrator's effect soup (#693)

## Session Narrative

### Prompt 1: Work on issue #693, make a PR when ready

**AI response**: Issue #693 flagged two maintainability problems in
`src/lib/state/calculator-page-orchestrator.svelte.ts`:

- **A.** `setupEffects()` declared 13+ inline `$effect` blocks with implicit,
  declaration-order sequencing.
- **B.** Advanced-options persistence (and every delegated calc effect) was
  driven by a `$derived advOptsKey = JSON.stringify([...six enumerated
  fields])`, registered via `void advOptsKey` boilerplate. Adding a new option
  but forgetting to add it to the array would silently break persistence.

**Part B — change-detection.** Added `advancedOptionsSnapshot()` to
`advanced-options.svelte.ts`: `return $state.snapshot(advancedOptions.value)`.
Calling it inside a `$derived`/`$effect` deep-reads the whole reactive proxy, so
it registers a dependency on **every** field — nested (`interpolation.scale`) and
any future ones — with no hand-maintained list. This matters because the
advanced-options panel mutates fields **in place**
(`advancedOptions.value.densityOverride = …`), which is exactly what the old
stringify enumeration existed to catch.

- The persistence `$effect` now calls `advancedOptionsSnapshot()` directly
  (a call statement, so no `void` and no ESLint `no-unused-expressions` issue).
- A new orchestrator field `advancedOptionsDep = $derived(advancedOptionsSnapshot())`
  is threaded into the five delegated setups (`setupCalculatorUrlSync`,
  `setupMultiProgramCalculation`, `setupMultiEntityCalculation`,
  `setupInverseRangeCalculation`, `setupInverseStpCalculation`) as
  `() => this.advancedOptionsDep`. Their param was renamed `getAdvOptsKey:
  () => string` → `getAdvOptsDep: () => unknown` and the
  `const _advOptsKey = …; void _advOptsKey;` pair collapsed to `void
  getAdvOptsDep();`. The plot-page consumers (`plot-preview-calc`,
  `plot-url-sync`) were left untouched — out of scope per the issue.

**Part A — effect grouping.** Decomposed `setupEffects()` into a short sequence
of named private phases, each holding the related `$effect`(s):
`setupAppBootstrap` → `setupUrlHydration` → `setupAdvancedOptionsPersistence` →
`setupSingleEntityCalculation` → `setupDelegatedCalculations` →
`setupModeFallbacks` → `setupEnergyRangeLabel` → `setupMultiProgramState` →
`setupMultiEntityState`. The one **hard** ordering requirement (Phase 1
negotiates `urlVersionMismatch`, which Phase 2 reads to gate hydration; Phase 1's
`appInit.initialize()` produces the entityState/service Phase 2 waits for) is now
documented at the top of `setupEffects()`. The remaining phases are independent
reactive guards that converge to the same fixpoint regardless of order; the three
scattered mode-exit fallbacks (custom-compound → water, inverse tab → forward,
collapse-to-single) are grouped under `setupModeFallbacks`.

**Tests.** Added two reactivity tests in `advanced-options-state.test.ts`
asserting `advancedOptionsSnapshot()` re-runs a tracking effect on a nested
in-place mutation and on a field absent at first read (proving no enumerated
list). Added a `registerEffect()` helper to `effect-root.svelte.ts` so a plain
`.test.ts` can register a `$effect`.

## Tasks

### Decompose orchestrator effects + robust advanced-options change-detection

- **Status**: completed
- **Stage**: Stage 8 / code-health (`src/lib/state/`)
- **Files changed**:
  - `src/lib/state/calculator-page-orchestrator.svelte.ts`
  - `src/lib/state/advanced-options.svelte.ts`
  - `src/lib/state/calculator-url-sync.svelte.ts`
  - `src/lib/state/multi-program-calc.svelte.ts`
  - `src/lib/state/multi-entity-calc.svelte.ts`
  - `src/lib/state/inverse-range-calc.svelte.ts`
  - `src/lib/state/inverse-stp-calc.svelte.ts`
  - `src/tests/unit/advanced-options-state.test.ts`
  - `src/tests/helpers/effect-root.svelte.ts`
- **Decision**: Used `$state.snapshot` for deep dependency tracking rather than a
  structured `$derived` object literal — snapshot auto-covers nested + future
  fields, which is precisely the footgun the issue called out. Kept the effects as
  private methods on the orchestrator class (closing over `this`) instead of new
  `calculator-*-setup.svelte.ts` files; the file already coordinates this state and
  per-method `$effect`s register fine during synchronous construction.
- **Decision**: Grouping the three mode-exit fallbacks reorders effect *creation*
  relative to the original. Effects converge to a fixpoint, so this is behaviour-
  preserving; verified by the full unit suite incl. `calculator-url`,
  `advanced-options-state`, `multi-program-calc`, `multi-entity-calc`,
  `inverse-calculation`, `calculator-state` (226 tests green).
- **Issue**: The pre-existing `guard-forbidden-files.test.ts` fails in this
  sandbox because git commit signing is unavailable (signing server 400) — not
  related to this change.
