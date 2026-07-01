# 2026-07-01 — Issue #812: three plot/mobile UX feedback fixes

## Session Narrative

### Prompt 1: Work on issue #812, make a PR when ready

**AI response**: Issue #812 ("Yet Another User Feedback") bundled three
independent UX papercuts. Implemented all three plus tests and doc updates.

1. **Unzoom button active when already unzoomed.** Added a pure
   `isRangeZoomed(fp)` helper to `plot-utils.ts` that compares the frame
   painter's displayed range (`scale_*`) to its full data range (`*min/*max`),
   in log10 space for log axes, with a relative tolerance for float noise.
   `JsrootPlot` now exposes a bindable `isZoomed` flag: after each (re)draw it
   wraps the frame painter's `zoom()` / `unzoom()` so the flag stays in sync
   across every zoom path — box-drag, double-click, and the toolbar `−` / `+` /
   Reset — and re-reads on each draw (a data/scale change redraws to full range,
   clearing the flag). `plot-toolbar.svelte` gained a `canReset` prop that
   `disable`s Reset zoom (with `aria-disabled` + muted styling) when
   `!isZoomed`; `plot/+page.svelte` binds the two together.

2. **No feedback after Add Series.** The plot-page orchestrator now calls a new
   `announceSeriesFeedback(text)` on a successful add — "Added _{label}_ to the
   plot" for a single add, "Added _N_ series to the plot" for a multi-select
   add, and "That series is already on the plot" for a duplicate (previously a
   silent `console.warn`). A new `plot-toast.svelte` renders the message as a
   transient `role="status"` live region (auto-dismiss ~4 s, manually
   dismissible), driven by a `{ text, token }` signal so re-adding the same
   label re-triggers it.

3. **Misleading "×" in the mobile search sheet.** In `picker-sheet.svelte` the
   Clear (×) button was always rendered, so on an empty freshly-opened field it
   read as a close affordance. It now renders **only when the field has text**
   (`data-testid="picker-sheet-clear"`), and the input suppresses the browser's
   native `::-webkit-search-cancel-button` so a filled field never shows two
   ×'s.

## Tasks

### Reset zoom disabled at full range (#812.1)

- **Status**: completed
- **Stage**: plot-redesign (epic #800 follow-up)
- **Files changed**: `src/lib/utils/plot-utils.ts`,
  `src/lib/components/jsroot-plot.svelte`,
  `src/lib/components/plot-toolbar.svelte`, `src/routes/plot/+page.svelte`
- **Decision**: Detect zoom by comparing `scale_*` to the full range (fields
  already used by the toolbar) rather than JSROOT's undocumented `zoom_*`
  fields — works against both the real bundle and the test mock. Keep the flag
  live by wrapping `zoom()`/`unzoom()` (the pattern the #794 PR had prototyped
  and dropped) instead of polling, since every zoom path funnels through them.
- **Tests**: `isRangeZoomed` unit cases (`plot-utils.test.ts`); `isZoomed`
  binding sync in `jsroot-plot.test.ts`; e2e disabled→enabled→disabled in
  `plot-toolbar.spec.ts`.

### Add-series confirmation toast (#812.2)

- **Status**: completed
- **Stage**: plot-redesign
- **Files changed**: `src/lib/state/plot-page-orchestrator.svelte.ts`,
  `src/lib/components/plot-toast.svelte` (new), `src/routes/plot/+page.svelte`
- **Decision**: New minimal `plot-toast.svelte` rather than a full toast system
  (none existed); the toast is its own live region so the visible confirmation
  and the screen-reader announcement are the same element.
- **Tests**: `plot-toast.test.ts` (new — render, auto-dismiss, manual dismiss,
  token re-arm); e2e toast-after-add in `plot-add-series.spec.ts`.

### Mobile search Clear-button only when filled (#812.3)

- **Status**: completed
- **Stage**: entity-selection (mobile picker sheet)
- **Files changed**: `src/lib/components/entity-selection/picker-sheet.svelte`
- **Decision**: Suppress the native search-clear glyph only on the sheet input
  (scoped `<style>`), leaving the desktop `search-input.svelte` untouched so it
  keeps its native clear affordance.
- **Tests**: e2e clear-button visibility + clear behaviour in
  `mobile-picker.spec.ts`.

### Docs

- Updated `docs/04-feature-specs/plot.md` (App Toolbar & Reset Zoom; Add Series
  Flow) and `docs/04-feature-specs/entity-selection.md` (mobile sheet).
- **Verification**: `svelte-check` (0 errors), `tsc --noEmit`, ESLint, and
  Prettier all clean; full Vitest suite 1909 passed / 3 skipped. E2E specs added
  but not run locally (require built WASM + browsers).
