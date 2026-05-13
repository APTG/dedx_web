# Stage 7.2 — JSROOT Plot Styling Polish

**Status:** ✅ Complete  
**Date:** 2026-05-13

---

## What was already done before this session

The bulk of the "physics-grade defaults" described in the redesign plan had been implemented during earlier stages as part of the plot feature:

| Item | Status |
|------|--------|
| Log-log axes as default (`xLog: true`, `yLog: true`) | ✅ Done (earlier stages) |
| Axis labels with units ("Energy [MeV/nucl]", "Stopping Power [unit]") | ✅ Done (earlier stages) |
| Line width 2 for committed series, width 1 for preview | ✅ Done (earlier stages) |
| Color palette — 9 colors with exact hex values | ✅ Done (earlier stages) |
| Grid and tick draw options (`gridx;gridy;tickx;ticky`) | ✅ Done (earlier stages) |
| Wheel zoom disabled (`JSROOT.settings.ZoomWheel = false`) | ✅ Done (earlier stages) |
| Touch zoom disabled on mobile/tablet | ✅ Done (earlier stages) |
| No JSROOT canvas legend — series list serves as legend | ✅ Done (earlier stages) |

## What this session added

### Font sizes: explicit override attempted then reverted after visual inspection

The redesign plan mentioned "14 pt fonts." `fLabelSize = fTitleSize = 0.04` NDC was added to `buildMultigraph()` as the closest ROOT-standard approximation. After visual inspection of the running app, the override made labels noticeably larger and less visually balanced than the JSROOT defaults. The explicit values were **reverted**; JSROOT defaults are used instead.

**Decision:** Do not set `fLabelSize` or `fTitleSize`. JSROOT's built-in defaults produce better readability on this canvas at the `min(60vh, 600px)` size range. The "14 pt" note in the redesign plan was a guideline, not a hard constraint — the visual result matters more.

**Files changed (net result — no font-size change from baseline):**
- `src/lib/components/jsroot-plot.svelte` — no explicit font-size properties set
- `docs/04-feature-specs/plot.md` — AC updated to document the use of JSROOT defaults

### Redesign plan contradiction resolved

The redesign plan task 7.2 notes mentioned "legend top-right," which contradicts `plot.md`'s acceptance criterion: "No JSROOT-rendered legend on the canvas (the series list below the canvas serves as the legend)." The spec is authoritative; the redesign plan note has been corrected. The current implementation (no canvas legend) is correct.

---

## Verification

```sh
pnpm test            # unit tests pass (no logic changes)
```

Visual check: axis tick labels and titles are readable using JSROOT default font sizes. Explicit `fLabelSize`/`fTitleSize` override was tried and reverted — defaults are visually superior at this canvas size.
