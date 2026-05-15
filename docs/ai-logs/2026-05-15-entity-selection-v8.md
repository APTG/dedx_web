# 2026-05-15 — Entity-selection v8 redesign (PR #1)

## Session Narrative

### Prompt 1: implement issue #504 plan (PR #1)

**User request**: Implement the plan published for issue #504 — v8 redesign of
the particle / material / program selector. Issue author wants two PRs:

- **PR #1** — most of the redesign work (Stages 1, 2, 3, 5 of the prompts in
  the issue comments): outer chrome, particle/material/program tabs,
  Basic/Advanced toggle, custom-compound modal, inline multi-program list.
- **PR #2** — adaptive compatibility overlay (Stage 4 of the prompts) plus
  flipping the feature flag default.

User also requires the existing unit / component / E2E suite to keep the same
functionality and scope. So PR #1 ships the v8 picker behind a `?v8=1` URL flag
and leaves the v7 components as the default render path. Every existing test
keeps running and stays green; v8 gets net-new parallel coverage.

**AI response**: Built the foundation behind the feature flag — pre-work items
(spec doc section, AI log, changelog row, `?v8=1` flag helper, `pickerMode`
store) plus Stage 1 chrome (recipe bar + tab bar + keyboard nav) plus Stage 2
basic Particle/Material tab content plus Stage 3 Program tab with TAB/FN/EXT
tag pills. Hooked the new component into both `/calculator?v8=1` and
`/plot?v8=1` with conditional rendering so v7 stays the default and all
existing tests keep passing untouched. Added new unit and component test files
covering the new code paths. Stage 5 polish items (Basic/Advanced toggle UI,
periodic-grid view, inline multi-program list, custom-compound modal editor)
are scoped as follow-up commits.

### Prompt 2: fix failing v8 E2E test from PR review

**User request**: PR comment reported failing CI for
`tests/e2e/v8-entity-selection.spec.ts`, where the reset test expected
`v8-material-item-267` (Air) to be visible. In the real WASM-backed CI data the
row was not present for the default v8 selection, causing the Playwright shard
to fail.

**AI response**: Investigated the CI run with GitHub Actions MCP, confirmed the
failure was isolated to the v8 E2E reset test, and changed that test to mutate
the selection via the always-visible alpha particle instead of assuming Air has
id 267. Downloaded the CI `wasm-binaries` artifact for local validation, copied
it to `static/wasm/`, rebuilt the app, installed Chromium, and validated the
targeted Playwright spec: `pnpm exec playwright test
tests/e2e/v8-entity-selection.spec.ts --project=chromium` (10 passed).

## Tasks

### Pre-work — v8 spec section + AI log + feature flag + picker-mode store

- **Status**: completed
- **Stage**: entity-selection v8 PR #1 prep
- **Files changed**:
  - `docs/04-feature-specs/entity-selection.md` (added `## v8 (draft)` section, kept v7 intact)
  - `docs/ai-logs/2026-05-15-entity-selection-v8.md` (this file)
  - `CHANGELOG-AI.md` (new row)
  - `src/lib/state/picker-flag.svelte.ts` (new)
  - `src/lib/state/picker-mode.svelte.ts` (new)
- **Decision**: keep v7 spec content under a clearly-labelled "Previous
  behaviour (v7)" anchor so reviewers can diff. The v8 section explicitly notes
  that the compatibility-matrix data model from v7 is unchanged — only the
  rendering layer is replaced.
- **Decision**: the `?v8=1` flag is opt-in only; default render path stays v7
  for the whole of PR #1 so the existing test suite is fully preserved.

### Stage 1 — Outer chrome (recipe bar + tab bar + keyboard nav)

- **Status**: completed
- **Files changed**:
  - `src/lib/components/v8/entity-selection-v8.svelte`
  - `src/lib/components/v8/recipe-bar.svelte`
  - `src/lib/components/v8/tab-bar.svelte`
  - `src/lib/components/v8/selected-pill.svelte`
  - `src/lib/components/v8/search-input.svelte`
  - `src/routes/calculator/+page.svelte` (conditional render)
  - `src/routes/plot/+page.svelte` (conditional render)
- **Decision**: `⊞ explore compat` link in the recipe bar is rendered but
  disabled (`title="coming soon"`) — wiring happens in PR #2 with the
  adaptive compatibility overlay.

### Stage 2 — Particle + Material tabs (Basic)

- **Status**: completed (Basic-mode behaviour only — Advanced extras come in Stage 5)
- **Files changed**:
  - `src/lib/components/v8/particle-tab.svelte`
  - `src/lib/components/v8/material-tab.svelte`
- **Decision**: electron (id 1001) is dropped from the v8 particle list
  entirely per the v8 spec ("re-add once ESTAR ships in libdedx ≥ 2.0").

### Stage 3 — Program tab + TAB/FN/EXT tags

- **Status**: completed (single-select Basic behaviour — multi-program
  inline list is a Stage 5 follow-up)
- **Files changed**:
  - `src/lib/utils/program-kind.ts`
  - `src/lib/components/v8/program-tag.svelte`
  - `src/lib/components/v8/program-tab.svelte`

### Tests

- **Status**: completed for the implemented surface
- **Files changed**:
  - `src/tests/unit/picker-mode.test.ts`
  - `src/tests/unit/picker-flag.test.ts`
  - `src/tests/unit/program-kind.test.ts`
  - `src/tests/unit/entity-selection-v8.test.ts`
  - `tests/e2e/v8-entity-selection.spec.ts`
- **Decision**: kept the existing v7-targeted tests untouched (the v7 path is
  still the default). The new tests assert v8 behaviour against
  `?v8=1`.

### Deferred to follow-up commits / sessions (still within PR #1 scope)

- Stage 5 Basic/Advanced toggle UI (segmented control in the recipe bar)
- Stage 5 periodic-grid scan view inside Particle tab
- Stage 5 inline multi-program SELECTED / AVAILABLE list inside Program tab
- Stage 5 custom-compound modal editor (atoms↔% mode, autosave, mobile sheet)
- Advanced search operators (`z=N`, `ρ>1.5`, `tag=FN`)

### PR review follow-up — v8 E2E reset fixture

- **Status**: completed
- **Stage**: entity-selection v8 PR #1 review/CI fix
- **Files changed**:
  - `tests/e2e/v8-entity-selection.spec.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-05-15-entity-selection-v8.md`
- **Decision**: Keep the reset test's intent (mutate from defaults, click
  reset, assert defaults and active Particle tab) but mutate with alpha particle
  instead of Air. Alpha is part of the v8 Common particles section and is stable
  across WASM datasets; Air id 267 was brittle in CI.
- **Issue**: none unresolved.
