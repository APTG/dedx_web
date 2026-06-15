# 2026-06-04 — State modules: align naming/API conventions (#692)

## Session Narrative

### Prompt 1: Work on issue #692, make a PR when ready

**AI response**: Addressed the two consistency cleanups in `src/lib/state/`
called out by the code-health review.

**A. Inverse `-calc` split convention.** The multi-* families follow "data file
+ a single-effect `*-calc.svelte.ts`" (`multi-entity` + `multi-entity-calc`,
`multi-program` + `multi-program-calc`). Inverse broke the pattern by bundling
two unrelated effects (range lookup + STP lookup) into one
`inverse-calc.svelte.ts`. Split it into `inverse-range-calc.svelte.ts`
(`setupInverseRangeCalculation`) and `inverse-stp-calc.svelte.ts`
(`setupInverseStpCalculation`), each holding exactly one `$effect`, mirroring
the multi-* layout. Import-only changes touched the orchestrator. The combined
test file was renamed `inverse-calculation.test.ts` (it exercises both effects)
with its imports repointed; assertions unchanged.

**B. Duplicate `activeTab` mutation surface.** `inverse-lookups.svelte.ts`
exposed both `set activeTab(v)` and `setActiveTab(tab)`. Removed the setter and
marked the interface field `readonly activeTab`, leaving `setActiveTab(tab)` as
the single mutation entry point — consistent with the method-based mutation used
elsewhere. All existing call sites (orchestrator, `+page.svelte`, tests) already
used `setActiveTab`, so no call-site changes were needed; the `readonly` field
now makes accidental direct assignment a type error.

Verified `pnpm check` (0 errors), `pnpm lint` (clean), and the inverse unit
suites (`inverse-calculation.test.ts` + `inverse-lookups.test.ts`, 42 tests)
pass. The unrelated `guard-forbidden-files.test.ts` failures are a sandbox git
commit-signing limitation, not caused by this change.

## Tasks

### A. Split inverse calc effects into one-file-per-effect

- **Status**: completed
- **Stage**: Stage 8 / code-health
- **Files changed**:
  - `src/lib/state/inverse-range-calc.svelte.ts` (new)
  - `src/lib/state/inverse-stp-calc.svelte.ts` (new)
  - `src/lib/state/inverse-calc.svelte.ts` (removed)
  - `src/lib/state/calculator-page-orchestrator.svelte.ts` (imports)
  - `src/tests/unit/inverse-calc.test.ts` → `inverse-calculation.test.ts`
- **Decision**: Chose the split over a rationale comment because range and STP
  are genuinely unrelated effects; the split matches the multi-* convention and
  makes "where does the inverse X calc live?" predictable.

### B. Single `activeTab` mutation path

- **Status**: completed
- **Stage**: Stage 8 / code-health
- **Files changed**: `src/lib/state/inverse-lookups.svelte.ts`
- **Decision**: Kept `setActiveTab(tab)` (method) and dropped the setter, since
  all call sites already used the method and other state objects mutate via
  methods. Interface field marked `readonly` to enforce the single entry point.
