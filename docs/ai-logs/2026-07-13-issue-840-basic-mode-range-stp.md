# 2026-07-13 — Basic-mode Energy→/Range→/STP→ selector (issue #840)

## Session Narrative

### Prompt 1: Add a Basic-mode Energy→/Range→/STP→ selector, move Add Row to Advanced-only

The user wanted Basic mode to expose all three calculator directions
(Energy →, Range →, STP →) through a new selector, matching Advanced mode's
existing tab strip, while keeping "+ Add row" as an Advanced-only affordance.
Requested order: plan → file a GitHub issue → implement.

**AI response**: Explored the codebase (three parallel Explore agents) and
found that Range →/STP → were **already fully built** in Advanced mode
(`table-advanced.svelte` mode="range", `table-inverse-stp.svelte`, WASM
plumbing in `inverse-range-calc.svelte.ts`/`inverse-stp-calc.svelte.ts`) but
hard-gated to Advanced-only via `inverseLookupState.activeTab` and a
`setupModeFallbacks()` effect that reset the tab to "forward" whenever
Advanced mode was off. This meant the work was mostly about un-gating +
re-skinning rather than new calculation logic. Asked clarifying questions
(selector reuse vs. new widget, gas-material STP-unit handling, row-count
behavior once Add Row moves to Advanced-only) — user picked the recommended
option for all three: reuse the existing tab strip/shared state, fall back to
MeV·cm²/g for gas materials, and make Basic mode always exactly one row.

### Prompt 2: Ensure tests, docs, and formal grammar sync are part of the plan

User rejected the first `ExitPlanMode` attempt with feedback to add explicit
test-writing and doc-update steps, and to check whether the formal URL
grammar needs syncing. Re-researched `shareable-urls-formal.md` and found it
explicitly encodes the Advanced-only gate as ABNF/semantic rules (not just
prose) for `calc=`/`lookups=`/`istpbranch=`, and discovered a genuine
pre-existing implementation gap: the formal contract (normative — "wins on
syntax conflicts") specifies `calc=`/`runit=`/`sunit=` as canonical, but the
shipped `calculator-url.ts` never completed that migration and still uses
the retired v1 names `imode=`/`iunit=` directly (only `ivalues=`→`lookups=`
was migrated). Filed that as a separate tracking issue (#841) rather than
folding a large URL-param rename into this feature. Updated the plan with a
dedicated formal-grammar-sync step and a concrete test-file list, then got
approval.

### Prompt 3: Implementation

Implemented per the approved plan (see Tasks below), verified manually in a
real browser via a throwaway Playwright driver script (screenshots + console
error checks), then worked through the full test suite.

### Prompt 4: Disk went read-only mid-session; resume

The user's disk briefly went read-only, interrupting a background
build/preview process used to debug a test failure. Confirmed via
`git status` that all working-tree changes survived, confirmed issue #840
was still open, and resumed exactly where the session left off (debugging an
accessibility test regression — see Tasks below).

## Tasks

### Share Energy→/Range→/STP→ tab state between Basic and Advanced

- **Status**: completed
- **Stage**: 8 (Open Beta & User Feedback)
- **Files changed**: `src/routes/calculator/+page.svelte`,
  `src/lib/state/calculator-page-orchestrator.svelte.ts`,
  `src/lib/state/calculator-url-sync.svelte.ts`
- **Decision**: removed the `isAdvancedMode.value` gate on the tab strip and
  on the `imode`/`lookups`/`iunit` URL sync/hydration paths, and deleted the
  `setupModeFallbacks()` effect that reset `activeTab` to `"forward"` on
  Basic mode. The active tab and its row(s) are shared state
  (`InverseLookupState`) between Basic and Advanced — switching modes
  mid-session, or opening a shared link, keeps the same tab. Fixed a latent
  bug surfaced by this change: the URL-restore code unconditionally cleared
  **both** `rangeRows` and `stpRows` whenever any lookup values were present,
  leaving the inactive tab with zero rows and (in Basic mode, which has no
  Add Row) no way to recover; now only the array for the active `imode` is
  cleared.

### Move Add Row to Advanced-only; Basic mode always exactly one row

- **Status**: completed
- **Files changed**: `src/lib/components/results/table-basic.svelte`,
  `src/lib/state/calculator-page-orchestrator.svelte.ts`
- **Decision**: removed the multi-row table branch and "+ Add row" button
  from Basic's Energy tab entirely — the hero row (issue #823) is now
  unconditional. Simplified keyboard handling to just Escape/Enter (no row
  navigation/reorder/delete — there's only ever one row). Paste now keeps
  only the first line. URL restoration caps both `energies=` and inverse
  `lookups=` to one value in Basic mode (extras silently dropped); Advanced
  mode is unaffected.

### New Basic Range→ and STP→ hero-card components

- **Status**: completed
- **Files changed**: new `src/lib/components/results/table-basic-range.svelte`,
  new `src/lib/components/results/table-basic-stp.svelte`,
  `src/routes/calculator/+page.svelte` (routing)
- **Decision**: both mirror `table-basic.svelte`'s hero-card visual style
  (orange input, sky outputs). Range → adds a unit-anchor strip
  (nm/µm/mm/cm/m) above the card but no per-row "Unit" column or "(per-row
  mode active)" text — Basic is always one row, so per-row mode is moot. STP
  → has no unit anchor/dropdown at all; the unit is fixed to the
  material-phase default (keV/µm non-gas, MeV·cm²/g gas), and a low-energy
  branch card reveals conditionally when the Bragg-peak lookup resolves to
  two solutions. Both components compute their fixed STP unit directly from
  an `isGas` prop (derived from `material.isGasByDefault` in `+page.svelte`),
  deliberately bypassing the `stpOutputUnit` global override so a leftover
  Advanced-mode STP-unit choice can't violate the fixed-unit requirement —
  this is a deliberate divergence from the (unchanged) Energy tab, which
  still follows that override.

### Formal URL grammar + feature-spec docs

- **Status**: completed
- **Files changed**: `docs/04-feature-specs/shareable-urls-formal.md`,
  `docs/04-feature-specs/shareable-urls.md`, `docs/04-feature-specs/calculator.md`,
  `docs/04-feature-specs/inverse-lookups.md`, `docs/04-feature-specs/README.md`
- **Decision**: updated the Advanced-only-mode-gate language in both URL docs
  (ignore-list, canonical param order, one new conformance vector) using the
  formal doc's own normative vocabulary (`calc=`/`runit=`/`sunit=`), with an
  explicit implementation-gap callout pointing at issue #841 rather than
  silently glossing over it. Rewrote `inverse-lookups.md` §1 from "Feature
  Gate — Advanced Mode Only" to "Basic vs. Advanced Layout"; updated its
  Scenario 4, Acceptance Criteria, and Cross-Page Parity Checklist
  accordingly. Version-bumped all four touched specs plus the README status
  table.
- **Issue**: filed #841 (separate, not fixed here) — `calculator-url.ts`
  still uses retired v1 `imode=`/`iunit=` instead of the formal contract's
  canonical `calc=`/`runit=`/`sunit=`.

### Tests

- **Status**: completed
- **Files changed**: new `src/tests/components/table-basic-range-stp.test.ts`
  (8 cases); rewrote/updated `tests/e2e/inverse-lookups.spec.ts` ("Advanced
  Mode Gate" → "Basic vs Advanced Layout"), `tests/e2e/energy-input-keyboard.spec.ts`
  (Basic describe block simplified to match single-row behavior),
  `tests/e2e/particle-unit-switching.spec.ts` ("Add row UX" moved to Advanced
  mode; deleted one test whose Basic-vs-Advanced-typing-behavior premise no
  longer exists), `tests/e2e/calculator.spec.ts`, `tests/e2e/complex-interactions.spec.ts`
  (hero-card assertion replacing an obsolete `<thead>` check),
  `tests/e2e/calculator-url.spec.ts` (added Basic-mode URL round-trip case;
  fixed/moved multi-row and linkifier-separator tests to Advanced mode, since
  multiple rows are now Advanced-only), `tests/e2e/accessibility.spec.ts`.
- **Decision**: sweeping the full e2e suite after the Add-Row change
  surfaced 5 additional pre-existing tests with hidden Basic-mode multi-row
  assumptions beyond the ones the plan anticipated; fixed each by either
  moving to Advanced mode (where the behavior still applies) or rewriting
  the assertion to match the new single-row Basic behavior.
- **Issue (found and fixed)**: the full-suite run surfaced a real, if
  narrow, accessibility regression: `accessibility.spec.ts`'s calculator-page
  WCAG check started intermittently failing on Export PDF/CSV button color
  contrast. Root-caused via a computed-style debug script: the header's
  Export buttons use `transition-all` when animating from disabled
  (50%-opacity) to enabled; this feature's larger initial render (always-on
  tab strip) shifted timing enough that axe-core's one-shot scan now
  sometimes samples mid-transition, catching a transiently-blended color
  that dips below 4.5:1 even though the settled state is compliant. Fixed by
  waiting for the Export button to be both `aria-disabled="false"` and at
  `opacity: 1` (transition settled) before running axe on `/calculator`
  specifically (not `/plot`, whose Export buttons legitimately stay disabled
  with no series loaded).
- **Verification**: full Playwright suite (chromium) 348 passed / 0 failed /
  16 skipped (pre-existing); full Vitest suite 1932 passed; `pnpm lint`,
  `pnpm format:check`, `pnpm run check` (svelte-check + tsc) all clean.

## Follow-up issues filed

- [#841](https://github.com/APTG/dedx_web/issues/841) — reconcile shipped
  `imode=`/`iunit=` with the formal contract's canonical `calc=`/`runit=`/
  `sunit=` (discovered while scoping #840, not fixed here).
