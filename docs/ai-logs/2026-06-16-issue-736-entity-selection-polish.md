# 2026-06-16 — Entity-selection v8 follow-ups (#736)

## Session Narrative

### Prompt 1: Work on issue #736, make PR when ready

Issue #736 ("Entity-selection: deferred polish items") bundles six
independent v8 follow-ups. I scoped this session to the two well-defined,
low-risk advanced-toolbar items and left the larger features (shared search
row, list reorder, mobile card polish, squiggle SVG) for their own sessions.

**Task — Remove the `⊞ Explore compat` placeholder.** Dropped the disabled
"coming soon" button and the unused `onExploreCompat` prop from
`advanced-toolbar.svelte`. `entity-selection.svelte` never passed the prop,
so removal was clean; only a doc comment referenced it. Updated the unit
test (`entity-selection-tabbed.test.ts`) and the e2e test
(`entity-selection-tabbed.spec.ts`) that asserted the placeholder's
presence/absence, and the spec bullet. The compatibility-overlay issue will
re-introduce the affordance when it lands.

**Task — `🔗 Load external` on the Plot page.** The modal was wired only on
the Calculator page. I replicated the wiring on the Plot page
(`LoadExternalModal` + `handleModalLoad` + `showLoadExternalModal` state).

**Decision (asked the user):** the advanced toolbar that hosts the Load
external button was hidden on Plot desktop by design (`showAdvancedToolbar`
defaults to `collapsible`, and Plot passes `collapsible={isMobile}`). The
user chose to keep the advanced toolbar on Plot but only in Advanced mode,
mirroring the Calculator. I therefore pass `showAdvancedToolbar` explicitly
on the Plot page so the toolbar (and Load external) appears whenever
Advanced mode is on, regardless of viewport. Updated the unit test that
previously asserted "toolbar hidden on Plot" to instead verify the
prop-driven behaviour, and refreshed the spec.

## Tasks

### Remove `⊞ Explore compat` placeholder

- **Status**: completed
- **Stage**: Stage 6–8 / entity-selection
- **Files changed**:
  - `src/lib/components/entity-selection/advanced-toolbar.svelte`
  - `src/lib/components/entity-selection/entity-selection.svelte` (doc comment)
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `tests/e2e/entity-selection-tabbed.spec.ts`
  - `docs/04-feature-specs/entity-selection.md`
- **Decision**: removed `onExploreCompat` plumbing entirely; the overlay
  issue will re-add the affordance.

### `🔗 Load external` on the Plot page

- **Status**: completed
- **Stage**: Stage 6–8 / entity-selection
- **Files changed**:
  - `src/routes/plot/+page.svelte`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `docs/04-feature-specs/entity-selection.md`
- **Decision**: Plot keeps the advanced toolbar but only in Advanced mode
  (like Calculator) — `showAdvancedToolbar` passed explicitly so the Load
  external affordance is reachable on any viewport.
- **Issue**: the four remaining #736 items (shared search row, interactive
  list reorder, mobile Material-tab card polish, availability-bar squiggle
  SVG) are untouched and stay open.
