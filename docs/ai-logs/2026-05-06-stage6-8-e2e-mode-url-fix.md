# 2026-05-06 — Stage 6.8: Fix plot page `?mode=advanced` URL param not activating Advanced mode

**Model:** Claude Sonnet 4.5 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Fix failing E2E tests reported in CI

**User request**: Fix failing E2E test — `plot.spec.ts:103` times out waiting for
`button:has-text("Advanced Options")`.

**AI response**: Investigated the root cause. The test navigates to `/plot?mode=advanced`
via `test.beforeEach`, then tries to click the Advanced Options accordion button.
The button was never found within the 10-second timeout.

**Root cause identified**: The plot page never called `initAdvancedModeFromUrl`. The
calculator page correctly calls it (line 56 of `calculator/+page.svelte`), but the
equivalent URL initialization effect in `plot/+page.svelte` only decoded entity
selection and series URL params — it never read the `mode=advanced` parameter to
activate `isAdvancedMode.value = true`.

Since `localStorage` is empty in CI (fresh browser context per test), `isAdvancedMode.value`
starts as `false` and is never set to `true`. The `AdvancedOptionsPanel` is gated with
`{#if isAdvancedMode.value && entityState.selectedMaterial}`, so it was never rendered,
and the button was never findable.

**Fix applied**: Added `initAdvancedModeFromUrl` to the import line and called it
synchronously (before the async `getService().then(...)`) inside the URL init effect in
`plot/+page.svelte`, mirroring the calculator page pattern.

## Tasks

### Fix plot page not reading `?mode=advanced` URL parameter

- **Status**: completed
- **Stage**: 6.8 (Advanced Options)
- **Files changed**:
  - `src/routes/plot/+page.svelte` — added `initAdvancedModeFromUrl` import and call in
    the URL initialization `$effect`
- **Decision**: Called `initAdvancedModeFromUrl(params)` synchronously at the start of the
  URL init block (before the async series-loading). This ensures `isAdvancedMode.value` is
  set immediately when the URL is parsed, so the AdvancedOptionsPanel renders in the same
  tick as entity selection, before any async work begins.
- **Issue**: None. 717 unit tests pass.
