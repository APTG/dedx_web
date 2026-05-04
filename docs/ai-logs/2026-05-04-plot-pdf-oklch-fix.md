# 2026-05-04 — Plot PDF export: fix oklch crash in html2canvas

## Session Narrative

### Prompt 1: Fix "unsupported color function oklch" error in Export PDF on the plot page

**AI response**: Traced the crash:

1. `exportPlotPdf()` in `export.svelte.ts` calls `generatePlotPdf()` in `pdf.ts`.
2. `generatePlotPdf()` used `doc.html(svgString, {...})` to embed the chart SVG.
3. jsPDF's `html()` method internally delegates to **html2canvas**, which walks the
   page's computed styles to reproduce them on a canvas.
4. Tailwind CSS v4 emits colors in `oklch()` format (e.g.
   `oklch(0.208 0.042 265.755)`). html2canvas 1.x does not support `oklch` and
   throws `"Attempting to parse an unsupported color function oklch"`.

**Fix**: Replaced `doc.html()` with a new `svgToPng()` helper that converts the
SVG string to a PNG data URL using only native browser APIs — `Blob` + `Image` +
offscreen `<canvas>` — and then calls `doc.addImage()` to embed the PNG. html2canvas
is never invoked, so oklch values in the page CSS are irrelevant.

`svgToPng` is exported so it can be unit-tested in isolation.

**Tests updated** (`plot-pdf.test.ts`):

- Added `addImage: vi.fn()` to the jsPDF mock (was missing).
- Added `setupSvgToPngMocks()` called in `beforeEach` to stub `URL.createObjectURL`,
  `URL.revokeObjectURL`, `Image` (triggers `onload` asynchronously), and
  `document.createElement("canvas")` with a canvas returning a stable PNG data URL.
- Rewrote "embeds SVG content in the PDF" → "embeds SVG via addImage (not doc.html)
  to avoid oklch crash": asserts `addImage` called, `html` **not** called.
- New test: `svgToPng returns a PNG data URL for a valid SVG string` — verifies the
  mocked canvas path resolves to `"data:image/png;base64,mockedpng"`.
- New test: `svgToPng returns null when canvas context is unavailable` — regression
  for headless / test environments where `getContext("2d")` returns `null`.

**Outcome**: 535 unit tests pass.

## Tasks

### Fix html2canvas oklch crash in Plot PDF export

- **Status**: completed
- **Stage**: Stage 6 — Plot export
- **Files changed**:
  - `src/lib/export/pdf.ts` — replaced `doc.html()` with `svgToPng()` + `addImage()`; exported `svgToPng`
  - `src/tests/unit/plot-pdf.test.ts` — updated mocks and tests
- **Decision**: canvas-based SVG→PNG instead of `doc.html()` to avoid html2canvas entirely; rendering at 150 DPI (≈5.91 px/mm) for reasonable print quality without excessive memory use.
- **Issue**: none
