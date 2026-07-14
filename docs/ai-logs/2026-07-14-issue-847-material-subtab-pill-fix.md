# 2026-07-14 — Issue #847: material sub-tab pill click reverted

## Session Narrative

### Prompt 1: Report a bug from live use of the calculator

The user described a concrete repro from the calculator page: search "boro",
select Boron via the Elements pill (range comes out `3.973 cm`, correct),
then try to switch back to water — backspace out "boro", the Elements pill
stays selected (untouched), type "Water" (zero elements match, but the
Elements pill still shows selected), then click the "Compounds 2" pill.
Nothing happens; the two water compounds never show up. The user asked me
to fix the Compounds-pill-disabled problem, reproduce it first, file an
issue for it, and fold in a second requirement: when the active pill has
zero matches, visually attract the user to non-empty pills instead of
auto-switching for them.

**AI response**: Read `material-tab.svelte` and found the `$effect` that
auto-switches the active sub-tab to match a newly selected material. It read
`activeSubTab` in its own reactive dependencies (via `activeSubTab !==
"elements"` / `!== "custom"` checks), so a manual pill click re-armed the
effect; since the selected material (Boron) was still an element, the guard
was immediately true again and the effect called `setSubTab("elements")`,
reverting the user's own click. Reproduced with a disposable Vitest
component test (real Svelte reactivity + DOM via `@testing-library/svelte`
+ `user-event`) mirroring the exact repro steps, confirmed the revert,
deleted the scratch test, and filed **APTG/dedx_web#847** with the root
cause, a code-permalink, the reproduction, a suggested fix direction, and
the attract-highlight scope as a second section with explicit acceptance
criteria.

### Prompt 2: "Work on issue 847, make PR when ready"

**AI response**: See Tasks below.

## Tasks

### Fix the auto-switch effect reverting manual pill clicks

- **Status**: completed
- **Stage**: N/A (bugfix, `entity-selection.md` § Material tab — sub-tab pill controls)
- **Files changed**: `src/lib/components/entity-selection/material-tab.svelte`
- **Decision**: Instead of reading `activeSubTab` in the effect's condition,
  track a plain (non-`$state`) `autoSwitchedForId` snapshot of the last
  material id the effect acted on, and early-return when
  `sel.id === autoSwitchedForId`. Because the read never happens,
  `activeSubTab` is no longer a tracked dependency of the effect at all — a
  manual pill click can no longer re-arm it. The effect now unconditionally
  calls `setSubTab(...)` for the new selection's category (instead of
  guarding on `activeSubTab !== target`), which is behaviourally identical
  (idempotent no-op) when the sub-tab already matches, but no longer needs to
  read `activeSubTab` to decide that.
- **Verified**: new regression test clicks Elements → selects Carbon → tab
  auto-switches to Elements (unchanged, intended behavior) → manual click on
  Compounds now actually activates it (previously reverted) → toggling back
  and forth continues to work (not a one-shot escape).

### Attract-highlight non-empty pills instead of auto-switching

- **Status**: completed
- **Stage**: N/A (same spec section, new scope requested by the user)
- **Files changed**: `src/lib/components/entity-selection/material-tab.svelte`
- **Decision**: Added `filteredCountFor(tab)` + derived `attractOthers =
  hasQuery && activeFilteredCount === 0` + `isAttracted(tab)` (true when
  `attractOthers` and `tab` isn't active and has a non-zero filtered count).
  Applied as an accent ring/background (`border-orange-400 ring-orange-300`
  + dark variants — same accent family already used for selected-item rows
  elsewhere in this component) on the non-active pill(s), plus a
  `data-attract="true"|"false"` attribute on every pill for reliable test
  assertions. No forced switch — the user always clicks manually.
- **Verified**: new tests cover the highlight appearing only on the
  non-empty pill while the empty one stays plain, clearing once the active
  tab's own query has a match, and staying off entirely with no query or
  when the active tab already has matches.

### Fixed a pre-existing test-isolation gap surfaced by the new tests

- **Status**: completed
- **Files changed**: `src/tests/unit/entity-selection-tabbed.test.ts`
- **Issue found while adding tests**: `activeSubTab` is persisted to
  `localStorage["webdedx.materialSubtab"]`, and jsdom's `window` (and thus
  `localStorage`) survives across tests in the same file. The suite's
  `beforeEach` already resets `isAdvancedMode` for exactly this reason
  (comment references #816) but never cleared `localStorage`, so a test
  that switched to Elements without switching back leaked that choice into
  whichever test ran next and assumed the "compounds" default. This was
  latent before (`material anchor option is disabled in multi-select
  compare mode` already ends on the Elements pill) but my new tests changed
  which test absorbed the leak, surfacing it as 3 failures on a full suite
  run. **Decision**: added `localStorage.clear()` to `beforeEach`, mirroring
  the existing `isAdvancedMode` reset pattern exactly. All 68 tests in the
  file pass afterward, run in any order.

### Documentation

- **Status**: completed
- **Files changed**: `docs/04-feature-specs/entity-selection.md`,
  `CHANGELOG-AI.md`, `docs/ai-logs/README.md`
- **Decision**: Reworded the "Auto-switch" bullet to state it's keyed on
  selection identity (not active sub-tab) and added an "Attract highlight"
  bullet with the same acceptance framing as the GitHub issue. Checked
  `calculator.md` for related sub-tab-pill text (none present, so no
  cross-spec edit needed there per CLAUDE.md's consistency rule).

### Verification

- **Status**: completed with one disclosed gap
- **svelte-check**: 0 errors, 0 warnings (sanity-checked the tool itself
  wasn't silently no-op-ing by smoke-testing a deliberately broken scratch
  `.svelte` file first — it correctly caught that error in ~9s before I
  trusted its clean result on the real codebase).
- **tsc --noEmit -p tsconfig.json**: clean.
- **ESLint / Prettier**: clean on both changed files.
- **Vitest**: full suite 1958 passed (was 1955; +3 new tests, net of the
  4 added minus 1 pre-existing scratch test deleted before commit).
- **Live-browser verification attempted, not achieved**: per CLAUDE.md's
  instruction to exercise UI changes in a real browser, I tried to get a
  real `libdedx.wasm` so the calculator page could actually boot. Local
  Docker build: got `dockerd` running in this environment (not started by
  default) but `docker pull emscripten/emsdk:5.0.5` failed — the egress
  proxy returned a policy-denial 403 on CONNECT to
  `production.cloudfront.docker.com`, confirmed via
  `$HTTPS_PROXY/__agentproxy/status`'s `recentRelayFailures`, not a client
  TLS/proxy misconfiguration. Fallback: downloaded-artifact metadata for the
  latest successful `build-wasm` CI run (`29281421704`, matching base commit
  `c3da7e4`) via the GitHub MCP server's `download_workflow_run_artifact`,
  but the signed Azure Blob Storage URL it returned
  (`productionresultssa2.blob.core.windows.net`) was *also* policy-denied by
  the same proxy. Both documented WASM-acquisition paths are blocked by this
  environment's network policy, not by anything fixable client-side, so per
  the instruction to say so explicitly rather than claim success: **I did
  not verify this change in an actual running browser.** Confidence instead
  rests on the component tests, which render real Svelte 5 reactivity and a
  real DOM via `@testing-library/svelte` + `user-event` (real click/keydown/
  type dispatch, real derived/effect re-evaluation) and directly reproduce
  the user's exact reported click sequence — this bug and its fix are
  entirely within picker UI state and never touch libdedx/WASM, so the gap
  is judged low-risk, but it is a gap.
- **Issue**: none outstanding for this bug; #847 addresses both the pill
  bug and the attract-highlight scope in one PR.
