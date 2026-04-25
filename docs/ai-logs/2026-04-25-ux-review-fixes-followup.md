# 2026-04-25 — PR review fixes + spec/inverse-calculator audit

**Model:** (Claude Sonnet 4.6 via Copilot coding agent)
**Branch:** `fix/ux-review-and-bugs`
**Builds on:** previous session [`2026-04-25-full-ux-review-and-bugs.md`](2026-04-25-full-ux-review-and-bugs.md)

## Session Narrative

### Prompt 1: "@copilot+claude-opus-4.7 apply changes based on the comments in this thread; ensure E2E tests work properly after your fixes; cross-check with spec feature doc; extend heavily the UX review or change it; check also if implemented energy selection is flexible enough for inverse calculator"

**AI response**: Addressed all seven reviewer comments on PR commit `73410bb`,
ran the unit-test suite (405 / 405 pass), then ran a read-only research pass to
cross-check the changes against the calculator + entity-selection feature
specs, evaluate inverse-calculator reusability, and scan other planned features
for blockers.  Findings appended to `docs/ux-reviews/2026-04-25-calculator-full-review.md`
as new sections §A–§D.  No production-code changes from the audit (refactors are
listed as open issues for follow-up sessions).

## Tasks

### 1. Address seven reviewer comments

- **Status**: completed
- **Stage**: 5.4
- **Files changed**:
  - `src/lib/config/libdedx-version.ts` (new) — single source of truth for the
    libdedx version string and the four user-facing copy variants.
  - `src/lib/components/result-table.svelte` — uses `ELECTRON_UNSUPPORTED_MESSAGE`;
    "no-program" CTA now reads *"Change the particle or material selection to
    continue."*
  - `src/lib/components/entity-selection-comboboxes.svelte`,
    `src/lib/components/entity-selection-panels.svelte`,
    `src/lib/components/entity-combobox.svelte` — use the new constants.
  - `src/lib/utils/unit-conversions.ts` — `formatSigFigs` docstring corrected
    to explain the real `toFixed` 100-digit cap and the magnitude guards.
  - `src/tests/unit/entity-selection-state.test.ts` — `selectionSummary`
    fallback test now asserts the resolved program name (`MSTAR`) is present
    instead of comparing against an impossible exact string.
  - `tests/e2e/complex-interactions.spec.ts` — `waitForTable` waits on the
    `Energy` header with `WASM_TIMEOUT`; `typeInRow` no longer dispatches a
    duplicate `input` event after `fill()`.
  - `docs/ux-reviews/README.md` — open-issue count for the calculator review
    updated.
  - `docs/ux-reviews/2026-04-25-calculator-full-review.md` — issue #5 fix
    description updated to match the new CTA copy.
- **Decision**: Centralised the libdedx version into a `config/` module with
  three pre-formatted copy variants (electron unsupported message, short
  description, tooltip title) rather than just a bare version constant. The
  reviewer comment specifically asked to centralise the *version* but the
  duplication cost is in the *messages* — three slightly different phrasings
  across four call sites.  Pre-formatted constants prevent message drift on the
  next libdedx upgrade.
- **Validation**: `pnpm vitest run` → 405/405 pass.

### 2. Cross-check spec compliance

- **Status**: completed
- **Stage**: 5.4
- **Files changed**: `docs/ux-reviews/2026-04-25-calculator-full-review.md` §A.
- **Finding (key)**: `formatSigFigs`'s scientific-notation fallback **violates**
  `calculator.md:381` *"Scientific notation is NOT used for output (stopping
  power, CSDA range)"* for the `magnitude ≥ 15` branch.  The fix is correct
  defensively (avoids RangeError) but the spec needs an explicit "extreme
  magnitude exception" clause; the alternative (cap output at "999…") is
  arguably worse UX.  Listed as open issue #9 — needs a spec PR, not a code
  revert.
- **Decision**: Did not modify the production code to match the strict spec
  reading, because the tradeoff is real and a spec update is the right call.
  Documented in §A so the next maintainer can decide.

### 3. Inverse-calculator reusability assessment

- **Status**: completed (audit only; no refactors yet)
- **Stage**: 5.4 → preparing for inverse-lookups stage
- **Files changed**: `docs/ux-reviews/2026-04-25-calculator-full-review.md` §B.
- **Three blocking design choices** that must be addressed *before* the inverse
  calculator can reuse the result-table machinery:
  1. `calculationResults: Map<number, …>` keyed on `normalizedMevNucl` cannot
     hold the two-energy-per-input-STP values needed by Inverse STP
     (`inverse-lookups.md:325-328`).  Refactor to row-id-keyed map.
  2. The `ELECTRON_UNSUPPORTED_MESSAGE` guard is hard-wired in
     `result-table.svelte`; inverse tabs explicitly support electrons
     (`inverse-lookups.md:172-180`).
  3. The 5-column `<thead>` is literal markup; multi-program (grouped columns)
     and the inverse Range tab (3 columns) need a column-data-driven table.
- These are recorded as open issues #10–#12 in the priority table.

### 4. Cross-cutting feature blocker scan

- **Status**: completed
- **Files changed**: `docs/ux-reviews/2026-04-25-calculator-full-review.md` §C.
- **Notable finding**: the auto-select fallback is **not recorded** in
  shareable URLs.  Two users with the same
  `?program=auto&particle=H&material=Urea` URL on different libdedx versions
  will silently see different programs.  Filed as open issue #14.

### 5. E2E test cleanup

- **Status**: completed (changes only — full E2E suite needs the WASM artifact
  and was not run locally).
- **Stage**: 5.4
- **Files changed**: `tests/e2e/complex-interactions.spec.ts`.
- **Decision**: kept the existing test names and assertions; only the helper
  internals were tightened so the suite is less flaky and doesn't double-call
  `triggerCalculation` per edit.

## Issue
- The `formatSigFigs` spec divergence (issue #9) and the auto-select URL drift
  (issue #14) both warrant a follow-up spec PR before the next user-facing
  release.
- The inverse-calculator refactors (issues #10–#12) are real and should be
  scheduled as the *first* increment of the inverse-lookups stage to avoid a
  larger rewrite later.
