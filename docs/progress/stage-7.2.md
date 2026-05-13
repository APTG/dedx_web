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

### Explicit 14 pt-equivalent font sizes

**Files changed:**
- `src/lib/components/jsroot-plot.svelte` — added `fLabelSize`/`fTitleSize` to `buildMultigraph()`
- `docs/04-feature-specs/plot.md` — added font-size lines to JSROOT Integration code block and new AC item

JSROOT/ROOT font sizes are specified as NDC fractions of the pad height. `0.04` corresponds to approximately 14 pt at a ~500 px canvas height (midpoint of the `min(60vh, 600px)` range) and is the standard value for physics ROOT plots.

```typescript
hist.fXaxis.fLabelSize = 0.04;
hist.fXaxis.fTitleSize = 0.04;
hist.fYaxis.fLabelSize = 0.04;
hist.fYaxis.fTitleSize = 0.04;
```

### Redesign plan contradiction resolved

The redesign plan task 7.2 notes mentioned "legend top-right," which contradicts `plot.md`'s acceptance criterion: "No JSROOT-rendered legend on the canvas (the series list below the canvas serves as the legend)." The spec is authoritative; the redesign plan note has been corrected. The current implementation (no canvas legend) is correct.

---

## Verification

```sh
pnpm test            # unit tests pass (no logic changes)
```

Visual check: load the plot page and confirm axis tick labels and titles are clearly readable at physics-publication quality.
