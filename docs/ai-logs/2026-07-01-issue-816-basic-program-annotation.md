# 2026-07-01 — Move program selection out of Basic mode; show a "Calculated with …" annotation (#816)

## Session Narrative

### Prompt 1: Work on issue #816, make PR when ready

**Issue summary.** Basic mode exposed the program/model selector alongside
particle and material. For most users that is one control too many — they don't
know what a "program" is or which to pick. The ask:

- **Basic mode:** remove the program selector entirely; auto-select the
  recommended program behind the scenes (existing default logic, unchanged);
  add a small "Calculated with **PSTAR** (auto-selected)" annotation near the
  results, on both the Calculator and Plot pages.
- **Advanced mode:** no changes.
- No changes to auto-selection logic, program list, or calculation methods —
  UI-placement + annotation only.

**AI response / approach.**

1. **Mode-aware visible tabs.** `entity-selection.svelte` computes a derived
   `visibleTabs`: Advanced → `[particle, material, program]`, Basic →
   `[particle, material]`. This single source of truth scopes:
   - Tab rendering (passed to `tab-bar.svelte`'s new `visibleTabs` prop, which
     filters its spec list).
   - Keyboard `ArrowLeft`/`ArrowRight` cycling — both the tab-bar's own
     `handleKeyDown` and the global handler in `entity-selection.svelte`.
   - The `nextEmptyTab` auto-advance after a selection (never targets Program
     in Basic).
   - A guard `$effect` that retargets `activeTarget` to the first visible tab
     if the Program tab is active when the user drops to Basic mode.

   The program itself stays at the Auto-select default (`selectedProgramId = -1`)
   — no selection/auto-select logic changed, matching "existing default logic,
   unchanged". The mobile `picker-sheet.svelte` needed no change: it renders by
   `activeTab`, which can never be `"program"` in Basic mode.

2. **Shared annotation.** New `program-annotation.svelte` renders
   "Calculated with **{name}**" with an optional "(auto-selected)" qualifier.
   - **Calculator:** replaced the existing inline `programLabel` (which already
     showed "Results calculated using …" in both modes) with the component,
     reworded to "Calculated with …". Shows in both modes (Basic: the
     auto-selected program; Advanced: the user's explicit choice, no qualifier)
     — so Advanced behaviour is effectively unchanged.
   - **Plot:** added below the series strip, **Basic mode only**. It lists the
     distinct program names across committed series joined by ", "
     (`autoSelected` always true in Basic). Advanced mode gets no page-level
     annotation — a single one is ambiguous with multiple series, and the smart
     labels already carry the program when it varies.

3. **Tests.** All program-tab unit/e2e tests assumed Basic mode showed the
   Program tab (default). Reworked them to opt into Advanced mode for
   program-tab interactions, and added Basic-mode coverage for the tab's
   absence + the new annotation.

## Tasks

### Hide the Program tab in Basic mode

- **Status:** completed
- **Stage:** entity-selection (post-Stage 8)
- **Files changed:**
  - `src/lib/components/entity-selection/tab-bar.svelte` — `visibleTabs` prop
    (defaults to `PICKER_TAB_ORDER`); filter spec list; cycle within visible.
  - `src/lib/components/entity-selection/entity-selection.svelte` — derived
    `visibleTabs`; pass to `<TabBar>`; scope `nextEmptyTab` + global arrow nav;
    guard `$effect` retargeting a hidden active tab.
- **Decision:** Did **not** force the program back to Auto-select on
  Advanced→Basic. The default is already Auto, so fresh Basic users get
  auto-select; a shared Advanced URL with an explicit program simply shows
  "Calculated with X" (no "(auto-selected)"), which is still accurate. This
  honours "existing default logic, unchanged" and avoids touching URL/mode
  fallback code.

### Shared "Calculated with …" annotation

- **Status:** completed
- **Files changed:**
  - `src/lib/components/program-annotation.svelte` (new)
  - `src/routes/calculator/+page.svelte` — replace `programLabel` with the
    component (`{ name, autoSelected }` derived).
  - `src/routes/plot/+page.svelte` — Basic-mode annotation from distinct series
    program names.
- **Decision:** Plot annotation is Basic-only and derived from committed series
  (not the preview), so it reads as a footnote to the plotted result set.

### Tests

- **Status:** completed
- **Files changed:**
  - `src/tests/unit/entity-selection-tabbed.test.ts` — Advanced-mode opt-in for
    every program-tab test; new Basic-mode "no Program tab" + Advanced→Basic
    retarget cases; defensive `isAdvancedMode` reset in `beforeEach`.
  - `src/tests/unit/program-annotation.test.ts` (new)
  - `tests/e2e/tab-cycling.spec.ts` — 3-tab cycling → Advanced; new Basic 2-tab
    describe.
  - `tests/e2e/entity-selection.spec.ts`, `entity-selection-tabbed.spec.ts` —
    Basic-mode assertions (Program tab absent, annotation present) + Advanced
    program-tab describe.
  - `tests/e2e/plot.spec.ts` — program-selection tests → `?mode=advanced`; new
    Basic/Advanced annotation cases.
  - `tests/e2e/mobile-picker.spec.ts`, `contextual-help.spec.ts` — program-tab
    interactions → Advanced mode.
- **Verification:** full Vitest suite 1919 passed / 3 skipped; `svelte-check`
  0 errors; `tsc --noEmit` clean; ESLint clean; Prettier formatted. E2E not run
  locally (no built WASM in this environment) — updated by reasoning; relies on
  CI.

### Docs

- **Status:** completed
- **Files changed:** `docs/04-feature-specs/entity-selection.md` (Basic/Advanced
  table + footnote, Program tab Advanced-only note, ACs), `calculator.md`
  (Resolved Program Label + AC), `plot.md` (new annotation section),
  `CHANGELOG-AI.md`, this log, `docs/ai-logs/README.md`.
- **Issue:** E2E specs updated but not executed locally — WASM artifacts are not
  built in this environment (per `CLAUDE.md`, downloaded from CI for local E2E).
