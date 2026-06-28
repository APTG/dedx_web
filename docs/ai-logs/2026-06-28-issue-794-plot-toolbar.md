# 2026-06-28 — App toolbar + Reset zoom (#794)

## Session Narrative

### Prompt 1: Work on issue #794, make PR when ready

**AI response**: Implemented the plot-chrome redesign from epic #800, PR bundle
B (#794): replaced JSROOT's native on-canvas toolbar and right-click context
menu with an app-level toolbar above the canvas (− / + / Reset zoom / Export)
plus a transient "Zoomed" hint.

Key decisions and findings:

- **Disabling native chrome.** Read the bundled jsroot 7.11.0 source to confirm
  the mechanism: `addPadButton` early-returns when `!settings.ToolBar`, so
  `settings.ToolBar = false` means the on-canvas button layer (`g.btns_layer`)
  is never populated — the toolbar simply does not render. `settings.ContextMenu
  = false` makes the pad bind a `null` contextmenu handler (TPadPainter:807), so
  right-click opens nothing. Both are global JSROOT settings; they are
  snapshotted and restored on teardown alongside the existing
  `ZoomWheel`/`ZoomTouch`/`DragGraphs` flags so the change never leaks to the
  off-screen export pad or other plots.

- **Zoom controls + state.** The frame painter (`painter.getFramePainter()`)
  owns axis ranges and `zoom`/`unzoom`. `resetZoom` calls `unzoom("xyz")` (both
  axes; JSROOT redraws the pad, re-applying the #795/#801 title offsets and pad
  margins). `−`/`+` read the current visible range (`scale_{x,y}{min,max}`,
  `logx`/`logy`) and call `zoom(...)` with a range scaled toward the centre via
  the new pure `zoomRange()` helper (log-aware). The `jsroot-plot.svelte`
  component exposes `resetZoom`/`zoomIn`/`zoomOut` and a `zoomed` boolean via
  `$bindable` (same pattern as the existing `requestExportSvg`).

- **Hint detection.** A pure `isZoomed(current, full)` helper in `plot-utils.ts`
  compares the displayed scale range against the full data range (covers
  zoom-in, pan, and single-bound cases, with a relative tolerance for
  floating-point round-trips). The signal is refreshed on every interactive zoom
  path — box-zoom, wheel-zoom, double-click reset, touch, and our toolbar
  buttons — by wrapping the frame painter's `zoom`/`unzoom` after each draw. The
  hint persists until the view returns to full range (no auto-hide timer, per
  the issue's recommendation / epic open question 3) and is `pointer-events:
  none`.

- **Export relocation.** The existing "Export image ▾" dropdown (SVG/PNG, the
  PNG entry Advanced-mode-only) moved verbatim from the controls bar into the
  new `plot-toolbar.svelte` — same `data-testid`s and behaviour. The dropdown
  *contents* and legend-in-export work remain out of scope (#797).

- **Double-click reset** is retained as the power-user shortcut; the labelled,
  coral-accented Reset zoom button is the discoverable primary path.

### Prompt 2: Reply to review comments, fix failing tests, remove the zoom hint

**AI response**: All CI was green; the two items were Copilot review comments
plus a UX request from the repo owner.

- **Removed the transient zoom hint.** The owner found `Zoomed — press Reset
  zoom to fit` wasted vertical space between the plot and the toolbar. Deleted
  the hint element and, since it was the only consumer, the whole zoom-state
  machinery — the `zoomed` bindable, the `isZoomed` helper (+ its unit tests),
  and the `zoom`/`unzoom` wrapping that refreshed it. The toolbar buttons and
  `resetZoom`/`zoomIn`/`zoomOut` are unchanged.
- **Copilot #1 — zoom-out beyond the data range.** `applyZoomStep` now clamps
  the `zoomRange()` result to the frame painter's full `{x,y}{min,max}` before
  calling `fp.zoom(...)`, so zoom-out never expands past the data and is a
  no-op at full range.
- **Copilot #2 — `restore()` leak on draw failure.** Wrapped `JSROOT.draw()` in
  `drawPlot` so `restore()` runs (and rethrows) if the draw rejects — a
  transient failure can no longer leak the flipped `ToolBar`/`ContextMenu`/
  margins into the next draw or other pads.
- **Tests updated.** Dropped the `isZoomed` and hint assertions; the component
  test now also asserts zoom-out is clamped to the full range, and the
  Playwright spec asserts box-zoom / `+` change the axis tick labels and Reset
  restores them (instead of watching the removed hint).

## Tasks

### App toolbar + Reset zoom (#794)

- **Status**: completed
- **Stage**: Plot chrome (epic #800, PR bundle B)
- **Files changed**:
  - `src/lib/components/plot-toolbar.svelte` (new) — − / + / Reset zoom / Export
    above the canvas; owns the relocated export-image dropdown.
  - `src/lib/components/jsroot-plot.svelte` — disable `settings.ToolBar` /
    `settings.ContextMenu` (snapshot/restore); expose `resetZoom`/`zoomIn`/
    `zoomOut`/`zoomed`; wrap frame-painter `zoom`/`unzoom` to track zoom state.
  - `src/routes/plot/+page.svelte` — mount the toolbar above the canvas, remove
    the export dropdown from the controls bar, render the transient zoom hint
    over the (now `relative`) canvas container.
  - `src/lib/utils/plot-utils.ts` — pure `isZoomed`, `zoomRange`, and the
    `ZOOM_STEP_IN`/`ZOOM_STEP_OUT` constants.
  - `src/tests/unit/plot-utils.test.ts` — `isZoomed` (equal/zoomed/panned/
    tolerance) + `zoomRange` (linear/log centre, reciprocal round-trip).
  - `src/tests/components/jsroot-plot.test.ts` — native chrome disabled; exposed
    `resetZoom` calls `unzoom("xyz")`; mock settings widened with
    `ToolBar`/`ContextMenu`.
  - `tests/e2e/plot-toolbar.spec.ts` (new) — toolbar renders; no native toolbar;
    no ROOT context menu on right-click; box-zoom shows hint → Reset clears it;
    − / + reflect state.
  - `docs/04-feature-specs/plot.md` — app toolbar, native-chrome removal,
    reset/hint behaviour, export relocation, layout overview.
- **Decision**: Detect zoom by comparing the frame painter's `scale_*` range to
  its full `{x,y}{min,max}` range rather than relying on JSROOT's internal
  `zoom_*` flags, and refresh via a thin wrapper around `zoom`/`unzoom` — robust
  across all interaction paths without patching JSROOT internals more deeply.
- **Issue**: E2E (`plot-toolbar.spec.ts`) was not run locally — it needs built
  WASM in `static/wasm/`, which is CI-only here (and the `canvas` dev dep cannot
  be native-built in this container). Unit + component tests, `svelte-check`,
  ESLint, and Prettier all pass locally.
