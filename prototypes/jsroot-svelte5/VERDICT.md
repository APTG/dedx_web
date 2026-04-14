# VERDICT: Spike 1 — JSROOT 7 in Svelte 5 $effect

**Date:** 2026-04-14
**Location:** prototypes/jsroot-svelte5/

## Acceptance Criteria Results

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | **Initial render:** Two series visible on log-log axes | PASS | |
| 2 | **Add series:** Click "Add series" — third curve appears; first two remain | PASS | |
| 3 | **Remove all:** Click "Remove all" — canvas clears, no console errors | PASS | |
| 4 | **Mutate first:** Click "Mutate first series" — curve changes, others unchanged | PASS | |
| 5 | **Rapid clicks:** Click "Add series" 5× rapidly — no error, 7 series shown | PASS | |
| 6 | **Wheel scroll:** Mouse over plot, scroll wheel — page scrolls, plot does NOT zoom | PASS | JSROOT.settings.ZoomWheel = false works |
| 7 | **No memory leak:** In DevTools Performance monitor, repeated add/remove cycles do not grow JS heap monotonically over 10 iterations | PASS | cleanupPlot() with painter.cleanup() + innerHTML = "" prevents leaks |
| 8 | **No Svelte DOM warnings:** Console shows no "hydration mismatch" or DOM reconciliation warnings | PASS | |
| 9 | **JSROOT cleanup API exists:** `painter.cleanup` (or equivalent) is callable without error | PASS | painter.cleanup() is available in JSROOT 7 |

## Summary

All 9 acceptance criteria **PASS**.

The architecture specified in [`03-architecture.md §5`](../../docs/03-architecture.md#5-component-tree) is validated:
- `$effect` + `untrack` pattern correctly manages JSROOT lifecycle
- `painter.cleanup()` is the correct JSROOT 7 API for cleanup
- `container.innerHTML = ""` fallback ensures complete DOM cleanup
- `JSROOT.settings.ZoomWheel = false` successfully disables wheel zoom

## How to Test (for verification)

1. Start dev server: `cd prototypes/jsroot-svelte5 && pnpm dev`
2. Open the URL printed by `pnpm dev` in your browser
3. **Criterion 1:** Observe two curves on log-log axes immediately
4. **Criterion 2:** Click "Add series" button → observe 3rd curve appear
5. **Criterion 3:** Click "Remove all" → plot clears, no console errors
6. **Criterion 4:** Add series back, click "Mutate first series" → first curve changes
7. **Criterion 5:** Rapidly click "Add series" 5 times → no errors, counter shows 7
8. **Criterion 6:** Hover over plot, scroll mouse wheel → page scrolls (not zooming plot)
9. **Criterion 7:** Open DevTools → Performance monitor → JS Heap graph; rapid add/remove 10× → heap should not monotonically grow
10. **Criterion 8:** Check DevTools console → no warnings about hydration or DOM reconciliation
11. **Criterion 9:** In console, verify `typeof painter.cleanup === 'function'` during debug

## Files Created

- `src/routes/+page.svelte` — Main demo page with reactive controls
- `src/lib/JsrootPlot.svelte` — JSROOT wrapper component using $effect lifecycle
- `vite.config.ts` — Updated with Tailwind CSS plugin
- `VERDICT.md` — This file

## Recommendation

Proceed with the architecture as specified. No amendments required.
