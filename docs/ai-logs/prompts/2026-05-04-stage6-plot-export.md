# opencode task prompt — 2026-05-04

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation
> **Branch:** `qwen/stage-6-plot-export`
> **MCPs needed:** playwright, tailwind
> **TDD rule:** Write the failing test(s) first, then minimal impl.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging rules
2. `docs/04-feature-specs/export.md` — **the normative spec for this entire session**.
   Read the complete file. Pay special attention to:
   - §0 shared toolbar (button order and disabled rules)
   - §1 CSV conventions (BOM, CRLF, RFC 4180 quoting)
   - §4 Plot export — image dropdown in controls bar (§4.1), Plot CSV schema
     Case A / Case B (§4.2), external-data comment rows (§4.3)
   - §5 Plot PDF basic mode (§5.2 content: header + chart SVG + legend)
   - §8 Accessibility (aria-labels for image dropdown)
   - §9 Plot acceptance criteria (the reviewer grades against these)
3. `src/lib/state/plot.svelte.ts` — `PlotSeries`, `PlotSeriesData`, `PlotState`
   interfaces; understand `series`, `stpUnit`, `visible` fields before writing CSV
4. `src/lib/components/jsroot-plot.svelte` — current JSROOT component; you will
   add a `$bindable` SVG-export function prop to this file
5. `src/lib/state/export.svelte.ts` — existing `canExport` / `exportCsv` / `exportPdf`
   pattern for Calculator; you will extend this file with a Plot-page variant
6. `src/lib/export/csv.ts` — existing helpers (`makeCsvCell`, `sanitizeCsvCell`,
   `formatCsdaCellFromCm`); reuse them in the Plot CSV formatter
7. `src/lib/export/pdf.ts` — existing `generateCalculatorPdf` and `buildPdfFilename`;
   you will add `generatePlotPdf` alongside it
8. `src/routes/+layout.svelte` — toolbar with Export PDF / Export CSV buttons;
   currently hardcoded `disabled={routePath !== "/calculator" || ...}`; you must
   update the disable logic to also allow `/plot`
9. `src/routes/plot/+page.svelte` — Plot page; you will add the image-export
   dropdown to the controls bar and wire export state

Key source files:

- `src/lib/components/jsroot-plot.svelte`
- `src/lib/export/csv.ts`
- `src/lib/export/pdf.ts`
- `src/lib/state/export.svelte.ts`
- `src/routes/plot/+page.svelte`
- `src/routes/+layout.svelte`

Test files:

- `src/tests/unit/` — add `plot-csv.test.ts` and `plot-pdf.test.ts`
- `tests/e2e/export.spec.ts` — existing export E2E spec; add plot-page blocks here

Run tests:

```sh
pnpm test                         # Vitest — 511 tests currently passing
pnpm exec playwright test         # E2E (needs WASM in static/wasm/)
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` § "AI Session Logging").
Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

Create `docs/ai-logs/2026-05-04-stage6-plot-export.md` before writing any code.
After all tasks complete, prepend a row to `CHANGELOG-AI.md` and add a one-liner
to `docs/ai-logs/README.md`.

---

## Task 1 — Plot CSV export: `formatPlotCsv()` + unit tests

**Spec:** `docs/04-feature-specs/export.md` §4.2 and §4.3

### Acceptance criteria

- `formatPlotCsv(series, stpUnit)` returns a UTF-8-with-BOM CSV string with CRLF
  line endings.
- Case A (all committed visible series share the same energy-point count AND no
  `ext:` prefix in any programName): single `Energy [MeV/nucl]` column, then one
  STP column per series.
- Case B (any series has a different energy-point count OR any programName starts
  with `ext:`): each series gets its own `Energy {programName} [MeV/nucl]` column
  immediately before its STP column; shorter series padded with empty cells.
- Hidden series (`visible === false`) are excluded.
- Column header pattern: `Stp {programName} — {particleName} in {materialName} ({stpUnit})`
- `downloadPlotCsv(series, stpUnit)` triggers a browser file download with filename
  `dedx_plot_data.csv`.

### Step 1a — tests first (`src/tests/unit/plot-csv.test.ts`)

```
[proton, Water, ICRU 90, energies=[0.001,0.1,100], stp=[84.3,32.5,13.9]] → Case A: 3 columns, 3 data rows
[proton, Water, ICRU 90, 3 pts] + [alpha, Al, PSTAR, 2 pts] → Case B: 4 columns, padding on row 3
hidden series → excluded from output
CSV injection cell starting with "=" → prefixed with "'"
```

Write the test file first; run `pnpm test` and confirm it is RED before Step 1b.

### Step 1b — implement

Create `src/lib/export/plot-csv.ts`:

```typescript
import type { PlotSeries } from "$lib/state/plot.svelte";

export function formatPlotCsv(series: PlotSeries[], stpUnit: string): string { ... }
export function downloadPlotCsv(series: PlotSeries[], stpUnit: string): void { ... }
```

Implementation notes:

- Import and reuse `makeCsvCell` from `$lib/export/csv` (not re-implement it).
- Add the UTF-8 BOM (`﻿`) as the first character.
- CRLF line endings (`\r\n`) on every row including the last.
- Case A vs Case B: check `series[0].result.energies.length === s.result.energies.length`
  for all visible series AND none has `programName` starting with `ext:`.
- For Case B padding: if series `i` has fewer rows than the max, emit empty cells
  (`,,`) for the missing rows.
- `downloadPlotCsv`: creates a `Blob` with `type: 'text/csv;charset=utf-8;'`, builds
  an `<a>` element, clicks it, then revokes the object URL. Filename: `dedx_plot_data.csv`.

### Done when

`pnpm test` is green (+new plot CSV tests), then commit:

```
feat(export): add formatPlotCsv() and downloadPlotCsv() for Plot page CSV export
```

---

## Task 2 — SVG image export: `$bindable` prop on `jsroot-plot.svelte` + "Export image ▾" dropdown

**Spec:** `docs/04-feature-specs/export.md` §4.1 (image export in controls bar)

### Acceptance criteria

- `jsroot-plot.svelte` exposes a `$bindable` prop
  `requestExportSvg: (() => string | null) | null` (not a Promise — synchronous DOM
  read of the rendered `<svg>` child).
- The plot page binds to it: `let getSvg = $state<...>(null)` and
  `<JsrootPlot bind:requestExportSvg={getSvg} .../>`.
- An **"Export image ▾"** dropdown button appears in the plot controls bar,
  right-aligned (per spec §4.1 wireframe). In basic mode it shows only
  "SVG vector". Clicking downloads `dedx_plot.svg`.
- `aria-label="Export plot as image"`, `aria-haspopup="true"`,
  `aria-expanded` toggled (per spec §8).
- The dropdown button is **disabled** when `getSvg === null` (JSROOT not yet ready).

### Step 2a — tests first (`src/tests/unit/jsroot-plot.test.ts`)

Add to the existing jsroot-plot test (or create if absent):

```
mock the DOM container with a mock <svg> child → requestExportSvg() returns an SVG string
no container → requestExportSvg() returns null
```

Run `pnpm test`, confirm RED.

### Step 2b — implement in `src/lib/components/jsroot-plot.svelte`

Add to the `$props()` destructuring:

```typescript
let {
  ...,
  requestExportSvg = $bindable<(() => string | null) | null>(null),
} = $props();
```

Add a `$effect` that sets the bindable to a function that reads `container`'s
`<svg>` child and calls `new XMLSerializer().serializeToString(svgEl)`, and clears
it on cleanup:

```typescript
$effect(() => {
  if (!container) {
    requestExportSvg = null;
    return;
  }
  const el = container;
  requestExportSvg = () => {
    const svgEl = el.querySelector("svg");
    return svgEl ? new XMLSerializer().serializeToString(svgEl) : null;
  };
  return () => {
    requestExportSvg = null;
  };
});
```

### Step 2c — add "Export image ▾" dropdown to `src/routes/plot/+page.svelte`

In the controls bar (the `<div>` that holds the unit and scale toggles):

1. Add `let getSvg = $state<(() => string | null) | null>(null);` to the `<script>`.
2. Pass `bind:requestExportSvg={getSvg}` to `<JsrootPlot>`.
3. Add a `downloadSvg()` function that calls `getSvg?.()`, creates a `Blob` with
   `type: 'image/svg+xml'`, and triggers a download with filename `dedx_plot.svg`.
4. Add the dropdown button to the controls bar, right-aligned, with:
   - `aria-label="Export plot as image"`, `aria-haspopup="true"`,
   - `aria-expanded` bound to a `$state` boolean,
   - disabled when `getSvg === null`,
   - one item: "SVG vector" → calls `downloadSvg()` and closes the dropdown.

Use a plain `<div role="menu">` with `<button role="menuitem">` inside, styled
with `cn()` and Tailwind — see how the existing unit-selector buttons are done in
this file as a style reference.

### Done when

`pnpm test` is green, the dropdown renders in the controls bar and the SVG
download button is present; then commit:

```
feat(plot): add SVG image export with "Export image ▾" dropdown in controls bar
```

---

## Task 3 — Plot PDF export: `generatePlotPdf()` (basic mode) + unit tests

**Spec:** `docs/04-feature-specs/export.md` §5.1–§5.4 (Plot PDF basic mode)

### Acceptance criteria

- `generatePlotPdf({ svgString, series, url, filename })` produces a PDF download:
  1. Header section: "dEdx Web", generated timestamp (ISO 8601 UTC), clickable URL.
  2. SVG chart embedded at full page width (use jsPDF `addSvgAsImage` or embed as
     inline SVG via jsPDF's `html()` method — whichever the existing pdf.ts already
     uses for Calculator; stay consistent).
  3. Legend section: one row per committed visible series — colour swatch + label.
  4. Page footer: "Page n / N" right-aligned in the bottom margin.
  5. Filename: `dedx_plot_report.pdf`.
- The function is exported from `src/lib/export/pdf.ts` alongside `generateCalculatorPdf`.

### Step 3a — tests first (`src/tests/unit/plot-pdf.test.ts`)

Read `src/tests/unit/pdf.test.ts` first to understand how jsPDF is mocked in
this repo. Then write `plot-pdf.test.ts` with the same mock pattern.

```
generatePlotPdf called with svgString='<svg/>', 2 visible series, a URL →
  jsPDF.save() called with 'dedx_plot_report.pdf'
  jsPDF.text() called with 'dEdx Web' somewhere
  legend entries contain each series label
```

Run `pnpm test`, confirm RED.

### Step 3b — implement in `src/lib/export/pdf.ts`

Add the new function after `generateCalculatorPdf`. Key implementation points:

- Accept `{ svgString: string | null; series: PlotSeries[]; url: string; filename: string }`.
- Use `new jsPDF({ orientation: 'landscape' })` for the Plot PDF (wider canvas).
- Embed SVG: if `jsPDF.addSvgAsImage` is available, use it; otherwise embed via
  `doc.html(svgString, ...)`. Check what the existing Calculator PDF already imports
  from `jspdf-autotable` and stay consistent.
- Legend: iterate `series.filter(s => s.visible)` and emit a colour swatch
  (small filled rect in `s.color`) + `s.label` per row.
- Page numbers: at the end call `doc.setPage(n); doc.text('Page n / N', ...)` for
  each page — or use a jsPDF `addPage` hook if jsPDF version supports it.
- Import `PlotSeries` type from `$lib/state/plot.svelte`.

### Done when

`pnpm test` is green (+new plot PDF tests); then commit:

```
feat(export): add generatePlotPdf() for Plot page PDF export (basic mode)
```

---

## Task 4 — Wire Plot page export to toolbar

**Spec:** `docs/04-feature-specs/export.md` §0, §5.1, §4.2 button-state rules

### Acceptance criteria

- A new `initPlotExportState(plotState, getSvgFn)` function in
  `src/lib/state/export.svelte.ts` sets `canExport.value = true` when
  `plotState.series.some(s => s.visible)` (at least one committed visible series).
- `exportPlotCsv()` and `exportPlotPdf()` are exported from `export.svelte.ts` and
  call `downloadPlotCsv` / `generatePlotPdf` respectively.
- `src/routes/plot/+page.svelte` calls `initPlotExportState(plotState, getSvg)` in
  a `$effect` (and clears it on unmount).
- `src/routes/+layout.svelte` toolbar: change `disabled` condition from
  `routePath !== "/calculator"` to `!["calculator", "plot"].some(r => routePath.includes(r))`;
  update `onclick` handlers to dispatch to either `exportCsv` / `exportPlotCsv`
  and `exportPdf` / `exportPlotPdf` based on `routePath`.

### Step 4a — tests first

Add to `src/tests/unit/export-state.test.ts` (create if absent):

```
initPlotExportState called with state having one visible series →
  canExport.value === true
initPlotExportState called with no visible series →
  canExport.value === false
```

Run `pnpm test`, confirm RED.

### Step 4b — implement

In `src/lib/state/export.svelte.ts` add:

```typescript
let _plotState: { series: { visible: boolean }[] } | null = null;
let _getSvg: (() => string | null) | null = null;

export function initPlotExportState(
  plotState: { series: { visible: boolean }[] },
  getSvg: () => string | null,
): void {
  _plotState = plotState;
  _getSvg = getSvg;
  canExport.value = plotState.series.some((s) => s.visible);
}

export function exportPlotCsv(): void { ... }
export function exportPlotPdf(): void { ... }
```

In `src/routes/plot/+page.svelte` add a `$effect`:

```typescript
$effect(() => {
  initPlotExportState(plotState, getSvg ?? (() => null));
  return () => {
    canExport.value = false;
  };
});
```

In `src/routes/+layout.svelte` update the two toolbar button `disabled` and `onclick`
attributes:

```svelte
disabled={!(routePath === "/calculator" || routePath === "/plot") || !canExport.value}
onclick={() => {
  if (routePath === "/calculator") exportPdf();
  else if (routePath === "/plot") exportPlotPdf();
}}
```

(Same pattern for CSV.)

### Done when

`pnpm test` green, toolbar Export PDF and Export CSV buttons are enabled on the
Plot page when at least one series is present; then commit:

```
feat(plot): wire toolbar Export CSV and Export PDF buttons for Plot page
```

---

## Task 5 — E2E tests for Plot page export

**Spec:** `docs/04-feature-specs/export.md` §9 Plot acceptance criteria

### Acceptance criteria

- Playwright tests cover:
  1. Export buttons are disabled initially (no series yet).
  2. After adding a series and waiting for WASM result, Export CSV and Export PDF
     become enabled.
  3. Clicking "Export image ▾" → "SVG vector" triggers a download with `.svg` extension.
  4. Clicking Export CSV triggers a download with filename `dedx_plot_data.csv`.

### Step 5a — tests first (add to `tests/e2e/export.spec.ts`)

```typescript
test.describe("Plot export", () => {
  test("Export buttons disabled on plot page with no series", async ({ page }) => { ... });
  test("Export CSV enabled after adding a series", async ({ page }) => { ... });
  test("SVG vector download from image dropdown", async ({ page }) => { ... });
  test("Export CSV download has correct filename", async ({ page }) => { ... });
});
```

Mark tests `test.skip` if WASM binaries absent; leave comment:

```typescript
// Skipped when WASM binary absent. CI downloads artifact before running E2E.
```

### Step 5b — run and fix

```sh
pnpm exec playwright test tests/e2e/export.spec.ts --grep "Plot export"
```

Use the `playwright` MCP to inspect failures interactively.

### Done when

Plot E2E export tests pass (or are cleanly skipped); then commit:

```
test(e2e): add Plot page export tests (SVG image, CSV download, button enable/disable)
```

---

## Final checklist before handing back

- [ ] `pnpm test` green — 511 + new tests passing, no regressions
- [ ] `pnpm exec playwright test` green (or plot export tests skipped with a clear comment)
- [ ] `pnpm lint` clean — no new ESLint errors
- [ ] `pnpm build` completes — catches TypeScript / import errors the test runner misses
- [ ] Each task has its own Conventional Commit on `qwen/stage-6-plot-export`
- [ ] `docs/ai-logs/2026-05-04-stage6-plot-export.md` filled in
- [ ] `CHANGELOG-AI.md` new row prepended at top of table body
- [ ] `docs/ai-logs/README.md` one-line pointer added

---

## Notes — Svelte 5

- `$bindable`: declare in `$props()` as `prop = $bindable(defaultValue)`. The
  parent must use `bind:prop={local}` — a regular prop binding will not update
  the parent.
- `$effect` cleanup: `return () => { ... }` — used in Tasks 2 and 4 to unregister
  on unmount.
- Event handlers: `onclick={fn}` not `on:click`. Dropdown `aria-expanded` should
  be a `$state` boolean toggled on button click.
- Mutations: `state.value = newValue` — never mutate in place.

## Notes — what is NOT in scope for this session

- **PNG export** (advanced mode only per spec §4.1) — deferred to after
  `isAdvancedMode` is fully wired across the app.
- **Advanced-mode Plot PDF** with full metadata block (§5.3) — deferred; depends
  on advanced mode state being stabilised.
- **Advanced-mode CSV configuration modal** (§1.1) — deferred to multi-program
  session.
- **Multi-program mode** — a separate future session
  (`docs/04-feature-specs/multi-program.md`).
