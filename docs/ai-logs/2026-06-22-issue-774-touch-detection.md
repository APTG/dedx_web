# 2026-06-22 — Harden touch detection for JSROOT plot (#774)

## Session Narrative

### Prompt 1: Fix touch detection issue #774

**AI response**: Some mobile browsers return `false` for the `(pointer: coarse)` media query even though the device is touch-capable, leaving JSROOT's `DragGraphs` enabled and allowing one-finger swipe to drag data series instead of scrolling the page. Combined the condition in `jsroot-plot.svelte` with `navigator.maxTouchPoints > 0` so any touch-capable device is covered regardless of which signal is accurate. Added a regression test that stubs `matchMedia` to return `false` while setting `maxTouchPoints = 5`, asserting both JSROOT settings (`ZoomTouch`, `DragGraphs`) are disabled.

### Prompt 2: Address PR review comments

**AI response**: Addressed three Copilot review comments on PR #777:
1. Captured the original `maxTouchPoints` property descriptor (via `Object.getOwnPropertyDescriptor`) instead of just the raw value, so restore logic handles prototype/getter cases correctly.
2. Restored the property in the `finally` block by reinstating the full original descriptor if it existed, or deleting the own-property override if no original descriptor was present — preventing test state leakage.
3. Created this session log and linked it from the CHANGELOG entry.

## Tasks

### Fix touch detection condition (#774)

- **Status**: completed
- **Stage**: bug fix / plot
- **Files changed**:
  - `src/lib/components/jsroot-plot.svelte`
  - `src/tests/components/jsroot-plot.test.ts`
  - `CHANGELOG-AI.md`
- **Decision**: Used `|| navigator.maxTouchPoints > 0` as an OR guard alongside the existing `(pointer: coarse)` check — minimal change, handles the known failure mode, avoids UA-sniffing.

### Address PR #777 review comments

- **Status**: completed
- **Files changed**:
  - `src/tests/components/jsroot-plot.test.ts` — descriptor-based save/restore for `navigator.maxTouchPoints`
  - `CHANGELOG-AI.md` — added `**Log:**` link
  - `docs/ai-logs/README.md` — added entry for this log
