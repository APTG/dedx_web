# 2026-06-04 — Back recompute-on-access getters with `$derived` (Issue #689)

## Session Narrative

### Prompt 1: Work on issue 689, make PR when ready

**AI response**: Issue #689 flags a perf/correctness smell in
`src/lib/state/calculator.svelte.ts`: the public getters `rows`,
`stpDisplayUnit`, and `validationSummary` each called a `compute*()` /
`get*()` function **on every property access**, so the per-row
parse/convert/result-lookup work re-ran several times per frame (table body,
footer, validation banner, export wiring all read them) and every read
returned a fresh object — a latent identity hazard.

Resolution: replaced the recompute-on-access getters with module-level
`$derived` values, matching the existing pattern in
`entity-availability.svelte.ts` (`const x = $derived(computeX())` →
`get x() { return x; }`):

- `const rows = $derived(computeRows())`
- `const stpDisplayUnit = $derived(getStpDisplayUnit())`
- `const validationSummary = $derived.by(...)` — now derives from the
  memoized `rows` value instead of calling `computeRows()` a second time,
  so the validation counts reuse the same parse pass.

The public getter surface is unchanged (each getter just returns its derived
value), so no call sites changed. The `compute*` / `get*` functions were
already pure reads of reactive state (no mutation), so no untangling was
needed.

Verified the `compute*` helpers don't mutate state, ran the checks, and added
the referential-stability test the acceptance criteria asks for.

## Tasks

### Back getters with `$derived`

- **Status**: completed
- **Stage**: Stage 8 (code-health / complexity review)
- **Files changed**:
  - `src/lib/state/calculator.svelte.ts`
  - `src/tests/unit/calculator-state.test.ts`
- **Decision**: `validationSummary` is `$derived.by` reading the `rows`
  derived rather than re-running `computeRows()`, so a single parse pass
  backs both the row view and the validation counts.
- **Tests added**: memoization asserts a getter read twice without an input
  change returns the **same** reference; a complementary test asserts the
  `rows` reference is invalidated after `updateRowText`.
- **Verification**: `pnpm check` (0 errors), `pnpm lint` (clean),
  `calculator-state.test.ts` 59/59 pass. The only full-suite failures are in
  `guard-forbidden-files.test.ts`, which fail because git commit signing is
  unavailable in the sandbox (signing server returns HTTP 400) — unrelated to
  this change.
- **Issue**: none.
