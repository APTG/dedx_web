# 2026-06-18 — Plot touch scroll-hijack

## Session Narrative

### Prompt 1: Analyse plot touch/scroll/zoom behaviour, file an issue

Researched the JSROOT integration (`src/lib/components/jsroot-plot.svelte`)
and the plot spec. Found a spec-vs-implementation gap: the spec
(`docs/04-feature-specs/plot.md` §Disabled Interactions, acceptance criterion
~L1141) requires touch zoom/pan to be disabled on touch devices so gestures
pass through to native page scroll/zoom, but in practice a one-finger swipe
over the canvas drags a data series and pinch zooms the plot. Filed issue
[#753](https://github.com/APTG/dedx_web/issues/753) describing the problem
(scroll hijack, no discoverable reset, tiny/cryptic JSROOT controls) without a
prescribed solution, cross-linking #144 (unzoom button) and #665 (plot
feedback).

### Prompt 2: Generate a Claude Design prompt + implement the scroll-hijack fix

Implemented the scroll-hijack part of #753 in this branch and produced a
separate Claude Design brief (delivered in chat) for the interaction-model work
(page-vs-plot toggle, reset affordance, JSROOT control removal).

**Root cause:** JSROOT's `settings.DragGraphs` ("Interactive dragging of TGraph
points") defaults to `true` in every environment and was never disabled. On a
touch device a one-finger drag therefore moves a series. Pinch-zoom is governed
by `settings.ZoomTouch`, which was already disabled on coarse pointers but is
now also backstopped by CSS.

**Fix:**

1. `jsroot-plot.svelte` — on coarse-pointer devices disable `ZoomTouch` **and**
   `DragGraphs` (snapshot + restore on cleanup). `ZoomWheel` stays disabled
   everywhere; `DragGraphs`/`ZoomMouse` stay enabled on desktop.
2. Canvas container declares `touch-action: pan-x pan-y pinch-zoom` so the
   browser owns page scroll and pinch-zoom even if JSROOT's non-passive touch
   handlers call `preventDefault()`.
3. Updated `docs/03-architecture.md` (the snippet was outdated — wrong import,
   missing `DragGraphs`/`touch-action`) and added a note to
   `docs/04-feature-specs/plot.md`.
4. Tests in `src/tests/components/jsroot-plot.test.ts`: touch-action present on
   the canvas; `DragGraphs` kept on fine pointer; `ZoomTouch`+`DragGraphs`
   disabled on coarse pointer.

### Prompt 3: Middle-button drag still moves the series — study JSROOT source

The maintainer found that on desktop, holding the **middle mouse button** and
dragging slides the series sideways. Studied JSROOT 7.11.0
`modules/gpad/TFramePainter.mjs`: `startRectSel()` is bound to `mousedown` only
when `settings.Zooming && settings.ZoomMouse`, and its first branch
`(evnt.buttons === 3) || (evnt.button === 1)` starts a viewBox-shift pan
(middle button, or left+right together). There is **no** dedicated setting to
disable just that pan without also disabling `ZoomMouse` (which would remove the
desired left-drag rectangular zoom). Fixed by adding a capture-phase `mousedown`
listener on the container that calls `preventDefault()` + `stopPropagation()`
for `button === 1 || buttons === 3`, so JSROOT's handler (bound on the inner
`<svg>`) never receives those events. Left-drag zoom and double-click reset are
unaffected. Added a unit test and updated `plot.md` / `03-architecture.md`.

(Copilot had added one doc-only commit to the PR, `7833895`; merged it forward.)

## Tasks

### Fix plot touch scroll-hijack

- **Status**: completed
- **Stage**: Stage 6 (Plot) — bug fix
- **Files changed**:
  - `src/lib/components/jsroot-plot.svelte`
  - `src/tests/components/jsroot-plot.test.ts`
  - `docs/03-architecture.md`
  - `docs/04-feature-specs/plot.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-06-18-plot-touch-scroll-hijack.md`
- **Decision**: Disable `DragGraphs` only on coarse pointers (keep desktop
  behaviour) and rely on `touch-action` as a second line of defence rather than
  binding custom touch handlers, since CSS makes the browser-owned gestures
  non-cancelable and is robust against JSROOT internals.
- **Issue**: The remaining parts of #753 (discoverable reset/unzoom control,
  page-vs-plot interaction toggle, removing tiny JSROOT controls) are UX
  decisions handed to Claude Design — out of scope here.
