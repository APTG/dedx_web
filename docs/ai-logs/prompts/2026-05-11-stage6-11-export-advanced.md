# opencode task prompt — 2026-05-11

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation (TDD)
> **Branch:** `feat/stage6-11-export-advanced`
> **MCPs needed:** playwright, tailwind, svelte
> **TDD rule:** Write the failing test(s) first, then minimal impl. Fix all
> lint/type errors before committing.

---

## Meta-prompt

Stage 6.11 adds three focused export additions that were deferred from the
basic-mode export work in Stage 6.6:

1. **CSV config modal** — in advanced mode (Calculator + Plot), "Export CSV ↓"
   opens a configuration dialog (separator, line endings, editable filename)
   instead of downloading immediately. Settings persist to `localStorage`.
   Basic mode keeps direct download; nothing changes for basic mode callers.

2. **PNG image export** — the "Export image ▾" dropdown on the Plot page
   gains a "PNG image" option in advanced mode only. SVG is available in
   both modes and already ships. PNG uses a JSROOT canvas raster snapshot
   at 2× CSS canvas resolution.

3. **Calculator PDF — advanced mode** — the "Export PDF" button on the
   Calculator page currently generates a basic-mode PDF (header + 5-column
   table). In advanced mode it must append an "Advanced Mode Details"
   metadata block (PARTICLE, MATERIAL, PROGRAMS, SETTINGS, SYSTEM, BUILD)
   after the table per `export.md` §6.3.

No WASM work is required for this stage. All three additions are pure
TypeScript / Svelte, and the existing WASM service interface is unchanged.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 runes, build commands, AI logging rules.
2. `.opencode/lessons-learned.md` — **MUST READ before writing any reactive
   code.** Pay special attention to entries 1 (reactive dep snapshot) and 3
   (cross-page parity).
3. `docs/04-feature-specs/export.md` (Final v6) — the normative spec.
   Read the **entire file**. Key sections for this stage:
   - §1.1 Advanced-Mode CSV Export Configuration Modal
   - §4.1 Image Export (PNG / SVG) — advanced dropdown rules
   - §6.1 Calculator PDF button
   - §6.3 Content — Advanced Mode (metadata block + page layout)
   - §8 Accessibility (aria labels for modal, dropdown)
   - §9 Acceptance Checklist (CSV modal, PNG, Calculator advanced PDF rows)
4. `docs/04-feature-specs/stage-6-11-export-advanced.md` — the focused
   companion spec with acceptance scenarios, reactive triggers matrix,
   cross-page parity checklist, test plan, and data-testid reference.
   Read **every section** before touching any code.
5. `docs/06-wasm-api-contract.md` — read once to confirm that no service
   interface changes are required (this stage is non-WASM).

Key source files (read before writing code):

- `src/lib/export/csv.ts` — `generateCalculatorCsv`, `makeCsvCell`,
  `downloadCsv`. You will extend the string builder to accept `CsvOptions`.
- `src/lib/export/plot-csv.ts` — `generatePlotCsv`. Extend similarly.
- `src/lib/export/pdf.ts` — `generateCalculatorPdf` (basic mode, lines 1–411).
  You will add an advanced-mode variant / extended context type.
- `src/lib/state/export.svelte.ts` — `exportCsv`, `exportPdf`, `canExport`.
  You will add `showCsvModal`, `exportCsvWithOptions`, `exportAdvancedPdf`.
- `src/lib/state/advanced-mode.svelte.ts` — `isAdvancedMode` singleton.
  All advanced UI gating reads this.
- `src/routes/calculator/+page.svelte` — Calculator page. "Export CSV ↓"
  button handler currently calls `exportCsv()` directly; in advanced mode
  it must instead open the modal.
- `src/routes/plot/+page.svelte` — Plot page. `downloadSvg()` lives here
  (lines ~444–460). "Export image ▾" dropdown shows SVG only (lines 632–661).
  You will add the `downloadPng()` function and the PNG menu item.
- `src/lib/state/advanced-options.svelte.ts` — `advancedOptions` singleton;
  needed for the SETTINGS block in advanced PDF.
- `src/lib/state/entity-selection.svelte.ts` — `entityState`; needed for
  PARTICLE + MATERIAL metadata in advanced PDF.
- `src/lib/wasm/libdedx.ts` — confirm `getBuildInfo()` or similar exists;
  otherwise read `static/deploy.json` directly (BUILD section).

Test files (read before writing tests):

- `src/tests/unit/export.test.ts` (if exists) or `src/tests/unit/csv.test.ts`
  — existing unit test patterns.
- `tests/e2e/export.spec.ts` — existing basic-mode E2E patterns; follow the
  same `expect.poll` + `page.waitForEvent("download")` idiom.
- `tests/e2e/calculator-advanced.spec.ts` — advanced-mode navigation pattern.

Run tests:

```sh
pnpm lint && pnpm format       # must be clean before committing
pnpm test                      # Vitest unit + component tests (no WASM)
pnpm exec playwright test      # E2E (needs WASM in static/wasm/)
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` § "AI Session Logging").
Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

---

## Task 1 — CSV string builder extension + CsvExportModal component

> **Depends on nothing.** Pure TypeScript + Svelte, no WASM, no page wiring.

**Spec:** `export.md` §1.1 (modal layout, fields, defaults, localStorage).
`stage-6-11-export-advanced.md` Scenario 1 (smoke), Scenario 3 (basic no-modal),
test plan §Unit tests and §Component tests.

### Acceptance criteria

- `CsvOptions` type exported from `src/lib/export/csv.ts`:
  ```typescript
  export interface CsvOptions {
    separator: "comma" | "semicolon" | "tab";
    lineEndings: "crlf" | "lf";
  }
  ```
- `generateCalculatorCsv(rows, stpUnit, meta, options?: CsvOptions)` accepts
  the new option bag. When `options` is omitted, defaults are `comma` + `crlf`
  (existing behavior is preserved).
- The join separator and line-ending string are derived from `options`:
  - `"comma"` → `,`; `"semicolon"` → `;`; `"tab"` → `\t`
  - `"crlf"` → `\r\n`; `"lf"` → `\n`
- Same extension for `generateMultiProgramCsv` in `src/lib/export/csv.ts`
  (or wherever the multi-program wide CSV is generated) and
  `generatePlotCsv` in `src/lib/export/plot-csv.ts`.
- `src/lib/components/CsvExportModal.svelte` — modal dialog:
  - Container: `data-testid="csv-export-modal"` on the outermost wrapper
  - Separator radio group (three options):
    - `data-testid="csv-separator-comma"`, label "Comma (,)" — default checked
    - `data-testid="csv-separator-semicolon"`, label "Semicolon (;)"
    - `data-testid="csv-separator-tab"`, label "Tab"
  - Line endings radio group (two options):
    - `data-testid="csv-line-endings-crlf"`, label "CRLF" — default checked
    - `data-testid="csv-line-endings-lf"`, label "LF"
  - Filename text input: `data-testid="csv-filename-input"`, pre-filled via
    a required `defaultFilename: string` prop
    - Appends `.csv` extension if the user omits it
  - Buttons:
    - `data-testid="csv-export-confirm"`, label "Download CSV" — triggers
      `onConfirm(options: CsvOptions, filename: string)` callback; disabled
      until all fields are valid
    - `data-testid="csv-export-cancel"`, label "Cancel" — triggers
      `onCancel()` callback
    - Close icon (`✕`) — equivalent to Cancel
  - `Escape` key closes the modal (equivalent to Cancel)
  - `role="dialog"`, `aria-modal="true"`,
    `aria-labelledby` pointing to the "Export CSV" heading
  - On open: focus trapped within modal; focus returns to trigger on close
  - `localStorage` persistence:
    - On confirm: write `csvExportSeparator` and `csvExportLineEndings` keys
    - On mount: read those keys and pre-select the saved values if valid;
      ignore invalid values (fall back to defaults)
  - Props:
    ```typescript
    interface Props {
      open: boolean;
      defaultFilename: string;
      onConfirm: (options: CsvOptions, filename: string) => void;
      onCancel: () => void;
    }
    ```
  - Use a Bits UI Dialog primitive (already a dependency; see
    `vendor/bits-ui/` for source). The existing `CompoundEditorModal.svelte`
    (Stage 6.10) is a good model to follow.
- `pnpm test` and `pnpm build` exit 0.

### Step 1a — tests first

**`src/tests/unit/csv-export-options.test.ts`:**

```typescript
import { generateCalculatorCsv } from "$lib/export/csv";

const MOCK_ROW = { /* minimal valid CalculatedRow */ };
const META = { particle: { name: "Proton" }, material: { name: "Water" }, program: { name: "ICRU 90" } };

test("default options: comma separator, CRLF line endings", () => {
  const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META);
  expect(content.split("\r\n").length).toBeGreaterThan(1); // CRLF present
  expect(content).not.toContain("\n\r");                  // no bare LF
});

test("semicolon separator produces semicolon-delimited header", () => {
  const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
    separator: "semicolon", lineEndings: "crlf",
  });
  const header = content.split("\r\n")[0] ?? "";
  expect(header).toContain(";");
  expect(header).not.toContain(",");
});

test("tab separator produces tab-delimited header", () => {
  const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
    separator: "tab", lineEndings: "lf",
  });
  const header = content.split("\n")[0] ?? "";
  expect(header).toContain("\t");
});

test("lf line endings produce LF only (no CR)", () => {
  const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
    separator: "comma", lineEndings: "lf",
  });
  expect(content).not.toContain("\r");
});
```

**`src/tests/components/CsvExportModal.test.ts`:**

```typescript
import { render } from "@testing-library/svelte";
import CsvExportModal from "$lib/components/CsvExportModal.svelte";

test("modal renders when open=true", () => {
  const { getByTestId } = render(CsvExportModal, {
    props: { open: true, defaultFilename: "test.csv", onConfirm: () => {}, onCancel: () => {} },
  });
  expect(getByTestId("csv-export-modal")).toBeInTheDocument();
});

test("comma radio is checked by default", () => {
  const { getByTestId } = render(CsvExportModal, {
    props: { open: true, defaultFilename: "test.csv", onConfirm: () => {}, onCancel: () => {} },
  });
  expect(getByTestId("csv-separator-comma")).toBeChecked();
  expect(getByTestId("csv-separator-semicolon")).not.toBeChecked();
});

test("filename input is pre-filled with defaultFilename", () => {
  const { getByTestId } = render(CsvExportModal, {
    props: { open: true, defaultFilename: "my_data.csv", onConfirm: () => {}, onCancel: () => {} },
  });
  expect((getByTestId("csv-filename-input") as HTMLInputElement).value).toBe("my_data.csv");
});
```

### Step 1b — implement

- In `csv.ts`: add `CsvOptions` type; add optional `options?: CsvOptions`
  parameter to `generateCalculatorCsv`. Derive separator string and line
  ending string at the top of the function. Propagate to `plot-csv.ts` similarly.
- `CsvExportModal.svelte`: use Bits UI `Dialog.Root`, `Dialog.Content`.
  Read `localStorage` in a `$effect(() => { ... })` that runs once on mount
  (guard with `typeof localStorage !== "undefined"` for SSR). Write
  `localStorage` inside the confirm handler.
- Keep the modal visually minimal: white card, 400px max-width, standard
  Tailwind spacing. Follow `CompoundEditorModal.svelte` layout.

### Done when

`pnpm test` green; then commit:

```
feat(export): add CsvOptions to CSV builders and CsvExportModal component
```

---

## Task 2 — Calculator PDF advanced mode metadata block

> **Depends on nothing** (extends `pdf.ts` only; no WASM, no Svelte).

**Spec:** `export.md` §6.3 (advanced mode content and layout), §6.4 (filename),
§5.3.1 (page-number footer — already implemented for basic mode),
`stage-6-11-export-advanced.md` Scenario 5 (download triggers + filename check),
test plan §Unit tests for advanced PDF.

### Acceptance criteria

- New exported type in `src/lib/export/pdf.ts`:
  ```typescript
  export interface AdvancedPdfMetadata {
    particle: { name: string; atomicNumber: number; massNumber: number } | null;
    material: { name: string; phase: "gas" | "condensed"; densityGcm3: number } | null;
    programs: Array<{ name: string; source: "builtin" | "external"; sourceUrl?: string }>;
    settings: {
      interpolationScale?: string;    // e.g. "Log-log"
      interpolationMethod?: string;   // e.g. "Spline"
      aggregateState?: string;        // e.g. "Condensed" (only if non-default)
      densityOverride?: number;       // g/cm³ (only if set)
      iValueOverride?: number;        // eV (only if set)
    };
    system: string;                   // navigator.userAgent (caller passes this)
    build?: {
      commit: string;
      date: string;
      branch: string;
    } | null;                         // null when deploy.json absent
  }
  ```
- New exported function `generateAdvancedCalculatorPdf(ctx: AdvancedPdfExportContext): Promise<void>` where:
  ```typescript
  export interface AdvancedPdfExportContext extends PdfExportContext {
    advanced: AdvancedPdfMetadata;
  }
  ```
- The function generates the same header and results table as basic mode
  (`generateCalculatorPdf`), then appends the "Advanced Mode Details" block
  per `export.md` §6.3 wireframe:
  - Horizontal rule + "Advanced Mode Details" heading (bold)
  - **PARTICLE** — `{name}  Z={atomicNumber}  A={massNumber}`
  - **MATERIAL** — `{name} ({phase})  ρ = {densityGcm3} g/cm³`
  - **PROGRAMS** — one line per program: `{name}  (built-in)` or
    `{name}  (external) {sourceUrl}`
  - **SETTINGS** — one line per non-default setting (omit if all default):
    `Interpolation: {scale} / {method}`,
    `Aggregate state: {aggregateState}`,
    `Density override: {value} g/cm³`,
    `I-value override: {value} eV`
  - **SYSTEM** — `{system}` (one line, truncated to 80 chars if longer)
  - **BUILD** — `Commit: {commit} · {date} · {branch}`
    (silently omitted when `advanced.build` is `null`)
  - The Advanced Mode Details section starts on a new page if it would not
    fit on the current page (rule: less than 40 mm remaining). Otherwise it
    continues on the same page.
- The function uses the same filename as the existing basic-mode PDF:
  `buildPdfFilename(particle, material, program)`. For multi-program advanced
  mode, the caller passes the first program (or a synthetic entry); the
  multi-program wide filename pattern (`_Nprograms.pdf`) is handled in
  Stage 6.12.
- All existing `generateCalculatorPdf` callers are unchanged.
- `pnpm test` and `pnpm build` exit 0.

### Step 2a — tests first

**`src/tests/unit/calculator-pdf-advanced.test.ts`:**

PDF binary output is hard to parse. Instead, test the metadata-rendering
helpers directly by extracting them into testable pure functions.

```typescript
// Helper that formats the PARTICLE line
import { formatParticleMetadataLine } from "$lib/export/pdf";

test("formatParticleMetadataLine renders Z and A", () => {
  expect(formatParticleMetadataLine({ name: "Proton", atomicNumber: 1, massNumber: 1 }))
    .toBe("Proton  Z=1  A=1");
});

// Helper that formats a PROGRAMS entry
import { formatProgramMetadataLine } from "$lib/export/pdf";

test("builtin program shows (built-in)", () => {
  expect(formatProgramMetadataLine({ name: "ICRU 90", source: "builtin" }))
    .toBe("ICRU 90  (built-in)");
});

test("external program shows source URL", () => {
  expect(formatProgramMetadataLine({ name: "NIST", source: "external", sourceUrl: "https://x.com/nist" }))
    .toBe("NIST  (external) https://x.com/nist");
});

// Settings block: only non-default values appear
import { formatSettingsLines } from "$lib/export/pdf";

test("empty settings returns empty array", () => {
  expect(formatSettingsLines({})).toEqual([]);
});

test("density override is included when set", () => {
  const lines = formatSettingsLines({ densityOverride: 2.5 });
  expect(lines).toContain("Density override: 2.5 g/cm³");
});

test("interpolation is included when set", () => {
  const lines = formatSettingsLines({ interpolationScale: "Log-log", interpolationMethod: "Spline" });
  expect(lines).toContain("Interpolation: Log-log / Spline");
});

test("BUILD block is omitted when build is null", () => {
  // Just a documentation test — verified by absence of "Commit:" in SETTINGS
  expect(formatSettingsLines({ densityOverride: undefined })).not.toContain(
    expect.stringContaining("Commit:"),
  );
});
```

Export the helper functions from `pdf.ts` so tests can import them directly.
Mark them `export` (not just module-private). This is test-driven design —
extracting the helpers first means the PDF generator is naturally testable.

### Step 2b — implement

In `src/lib/export/pdf.ts`:

1. Export `formatParticleMetadataLine`, `formatProgramMetadataLine`,
   `formatSettingsLines` as thin pure functions.
2. Add `AdvancedPdfMetadata` and `AdvancedPdfExportContext` types.
3. Add `generateAdvancedCalculatorPdf`:
   - Call the same header + table logic as `generateCalculatorPdf` (extract
     into a shared `renderCalculatorTableSection(doc, ...)` helper to avoid
     duplication).
   - After the table, check remaining vertical space; add page if < 40 mm.
   - Render the "Advanced Mode Details" block using jsPDF text primitives
     (no jspdf-autotable needed for this text-only section).
   - Page-number footer is already handled by `addPageFooter` in the existing
     code; call it the same way.
4. jsPDF is already a dependency (`jspdf ^4.2.1`). No new packages needed
   for Task 2.

### Done when

`pnpm test` green; then commit:

```
feat(export): add Calculator advanced PDF with metadata block
```

---

## Task 3 — Wire Calculator + Plot pages + PNG export + E2E tests

> **Depends on Tasks 1 and 2.**

**Spec:** `stage-6-11-export-advanced.md` Scenarios 1–5 (all five E2E tests),
Reactive Triggers Matrix, Cross-Page Parity Checklist.
`export.md` §4.1 PNG export details (2× resolution, filename `dedx_plot.png`).

### Acceptance criteria

**Calculator page (`src/routes/calculator/+page.svelte`):**

- "Export CSV ↓" click handler:
  - When `isAdvancedMode.value === true`: set `showCsvModal = true` (open
    `CsvExportModal`) instead of calling `exportCsv()` directly.
  - When `isAdvancedMode.value === false`: call `exportCsv()` as before
    (no modal). No behavioural change in basic mode.
- `CsvExportModal` is conditionally rendered: `{#if showCsvModal}`. Default
  `showCsvModal = $state(false)`.
  - `defaultFilename` prop: derive the canonical filename from the current
    entity state (particle/material/program) using `buildCsvFilename`.
  - `onConfirm(options, filename)`: call `exportCsvWithOptions(options, filename)`;
    set `showCsvModal = false`.
  - `onCancel()`: set `showCsvModal = false`.
- "Export PDF" click handler:
  - When `isAdvancedMode.value === true`: build `AdvancedPdfMetadata` from
    current state (entity selection, advanced options, `deploy.json`, user
    agent) and call `generateAdvancedCalculatorPdf`.
  - When `isAdvancedMode.value === false`: call `generateCalculatorPdf` as
    before. No behavioural change in basic mode.
- `deploy.json` fetch for BUILD block: lazy-fetch `${base}/deploy.json` once;
  pass the result (or `null` on 404/error) to `generateAdvancedCalculatorPdf`.
  Follow the same pattern as `BuildInfoBadge.svelte` (Stage 6.7).
- `navigator.userAgent` is passed as the SYSTEM string (guard with
  `typeof navigator !== "undefined"` for SSR).

**Plot page (`src/routes/plot/+page.svelte`):**

- "Export CSV ↓" click handler:
  - Same pattern: open `CsvExportModal` in advanced mode; direct download in
    basic mode. The `onConfirm` handler calls `exportPlotCsvWithOptions`.
- "Export image ▾" dropdown:
  - Add "PNG image" `<button>` above "SVG vector" inside the menu div,
    conditional on `isAdvancedMode.value`:
    ```svelte
    {#if isAdvancedMode.value}
      <button
        role="menuitem"
        data-testid="export-image-png"
        onclick={downloadPng}
        class="..."
      >
        PNG image
      </button>
    {/if}
    <button
      role="menuitem"
      data-testid="export-image-svg"
      onclick={downloadSvg}
      class="..."
    >
      SVG vector
    </button>
    ```
  - Add `data-testid="export-image-btn"` to the existing dropdown trigger
    button (currently has `aria-label="Export plot as image"` but no testid).
- `downloadPng()` function:
  ```typescript
  async function downloadPng() {
    if (!getSvg) return;
    const svgString = await getSvg();
    if (!svgString) return;

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx2d = canvas.getContext("2d")!;
      ctx2d.scale(scale, scale);
      ctx2d.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = "dedx_plot.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    };

    img.src = svgUrl;
    showExportMenu = false;
  }
  ```
  - Rationale: JSROOT's `makeSVG()` output (already wired to `getSvg`) is
    rasterized at 2× via an intermediate Canvas. This is simpler than calling
    JSROOT's internal PNG API and avoids adding new JSROOT dependencies.

**Export state additions (`src/lib/state/export.svelte.ts`):**

- `exportCsvWithOptions(options: CsvOptions, filename: string): void` —
  calls `generateCalculatorCsv(rows, stpUnit, meta, options)` and
  `downloadCsv(content, filename)`.
- `exportPlotCsvWithOptions(options: CsvOptions, filename: string): void` —
  calls `generatePlotCsv(series, stpUnit, options)` and
  `downloadCsv(content, filename)`.
- Keep existing `exportCsv()` and `exportPdf()` unchanged (basic mode callers
  still work).

**Cross-page parity checklist** (from companion spec, verify before declaring done):

```
[ ] CSV modal: opens in advanced mode on both Calculator and Plot pages
[ ] CSV modal: NOT opened in basic mode on either page
[ ] PNG option: visible in advanced mode; absent (not hidden) in basic mode
[ ] PDF advanced: metadata block present in advanced-mode Calculator PDF
[ ] localStorage: separator/lineEndings persisted; restored on next modal open
```

### Step 3a — tests first (`tests/e2e/export-advanced.spec.ts`)

Create a new E2E file. Use `page.waitForEvent("download")` for all download
assertions. Use `expect.poll` for async STP/series results. Never use
`waitForTimeout`. Tag tests per `playwright.config.ts` conventions.

```typescript
import { test, expect } from "@playwright/test";

const wasmPresent = (): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("fs").accessSync("static/wasm/libdedx.wasm");
    return true;
  } catch {
    return false;
  }
};

test.describe("Export — advanced mode additions", () => {

  test("CSV modal opens in advanced mode (Calculator); semicolon separator persists @smoke",
    async ({ page }) => {
      test.skip(!wasmPresent(), "WASM binary absent");
      await page.goto("/calculator?mode=advanced&particle=1&material=276");
      await expect.poll(
        async () => parseFloat((await page.locator('[data-testid="stp-cell-0"]').textContent()) ?? ""),
        { timeout: 8000 },
      ).toBeGreaterThan(0);

      await page.click('[data-testid="export-csv-btn"]');
      await expect(page.locator('[data-testid="csv-export-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="csv-separator-comma"]')).toBeChecked();

      await page.click('[data-testid="csv-separator-semicolon"]');
      const download = await Promise.all([
        page.waitForEvent("download"),
        page.click('[data-testid="csv-export-confirm"]'),
      ]).then(([d]) => d);
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
      await expect(page.locator('[data-testid="csv-export-modal"]')).not.toBeVisible();

      // Re-open: semicolon persists
      await page.click('[data-testid="export-csv-btn"]');
      await expect(page.locator('[data-testid="csv-separator-semicolon"]')).toBeChecked();
    },
  );

  test("CSV modal also opens on Plot page in advanced mode @regression", async ({ page }) => {
    test.skip(!wasmPresent(), "WASM binary absent");
    await page.goto("/plot?mode=advanced&particle=1&material=276&program=3");
    // Add a series: the plot page needs at least one committed series for
    // the export button to be enabled. In the URL-init path, a series
    // should auto-commit from the URL params — check canExport becomes true.
    await expect
      .poll(
        async () => (await page.locator('[data-testid="export-csv-btn"]').getAttribute("disabled")),
        { timeout: 8000 },
      )
      .toBeNull();

    await page.click('[data-testid="export-csv-btn"]');
    await expect(page.locator('[data-testid="csv-export-modal"]')).toBeVisible();
  });

  test("basic mode: CSV downloads immediately, no modal @regression", async ({ page }) => {
    test.skip(!wasmPresent(), "WASM binary absent");
    await page.goto("/calculator?particle=1&material=276");
    await expect.poll(
      async () => parseFloat((await page.locator('[data-testid="stp-cell-0"]').textContent()) ?? ""),
      { timeout: 8000 },
    ).toBeGreaterThan(0);

    // In basic mode the button should trigger download directly
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('[data-testid="export-csv-btn"]'),
    ]);
    await expect(page.locator('[data-testid="csv-export-modal"]')).not.toBeVisible({ timeout: 500 });
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test("PNG export available in advanced mode; SVG in both modes @smoke", async ({ page }) => {
    test.skip(!wasmPresent(), "WASM binary absent");
    await page.goto("/plot?particle=1&material=276&program=3");

    // Basic mode: PNG absent, SVG present
    await page.click('[data-testid="export-image-btn"]');
    await expect(page.locator('[data-testid="export-image-png"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="export-image-svg"]')).toBeVisible();
    await page.keyboard.press("Escape");

    // Switch to advanced mode
    await page.click('[data-testid="advanced-mode-toggle"]');
    await page.click('[data-testid="export-image-btn"]');
    await expect(page.locator('[data-testid="export-image-png"]')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('[data-testid="export-image-png"]'),
    ]);
    expect(download.suggestedFilename()).toBe("dedx_plot.png");
  });

  test("Calculator PDF downloads in advanced mode with dedx_calculator_*.pdf filename @regression",
    async ({ page }) => {
      test.skip(!wasmPresent(), "WASM binary absent");
      await page.goto("/calculator?mode=advanced&particle=1&material=276");
      await expect.poll(
        async () => parseFloat((await page.locator('[data-testid="stp-cell-0"]').textContent()) ?? ""),
        { timeout: 8000 },
      ).toBeGreaterThan(0);

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /export pdf/i }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^dedx_calculator_.+\.pdf$/);
    },
  );

});
```

### Step 3b — implement

**Order of changes:**

1. Add `exportCsvWithOptions` / `exportPlotCsvWithOptions` to
   `src/lib/state/export.svelte.ts`. These are thin wrappers — derive the
   `CsvOptions`-aware content and call `downloadCsv`.
2. In `src/routes/calculator/+page.svelte`:
   - Import `CsvExportModal`, `isAdvancedMode`, `generateAdvancedCalculatorPdf`.
   - Add `let showCsvModal = $state(false)`.
   - Change the existing `onclick={exportCsv}` on the "Export CSV ↓" button
     to `onclick={() => isAdvancedMode.value ? (showCsvModal = true) : exportCsv()}`.
   - Add `{#if showCsvModal}` block with `CsvExportModal`.
   - Change the "Export PDF" button handler similarly for advanced vs basic.
3. In `src/routes/plot/+page.svelte`:
   - Same CSV modal wiring.
   - Add `downloadPng` function after `downloadSvg`.
   - Add `data-testid="export-image-btn"` to the existing trigger button.
   - Add `{#if isAdvancedMode.value}` PNG menu item above SVG.

**Reactive dep rule (lessons-learned Entry 1):**
The CSV modal and PDF export are **one-shot actions** (not `$effect` computations),
so there are no reactive dep snapshot concerns. Just read `isAdvancedMode.value`
at click time.

### Done when

`pnpm lint && pnpm test` green; E2E tests in `export-advanced.spec.ts` all
pass (or `test.skip`-ed with WASM absent note); cross-page parity checklist
verified. Then commit:

```
feat(export): wire advanced CSV modal, PNG export, and Calculator advanced PDF
```

---

## Cross-task notes

- Task 1 must be committed before Task 3 (pages import `CsvExportModal`).
- Task 2 must be committed before Task 3 (pages import `generateAdvancedCalculatorPdf`).
- Task 1 and Task 2 are independent and can start in parallel.
- After all tasks: write `CHANGELOG-AI.md` entry and
  `docs/ai-logs/YYYY-MM-DD-stage6-11-export-advanced.md` per AI Logging rules.
- Run `pnpm guard:staged` before every commit (guards against generated
  artifacts, vendor gitlink changes, and WASM binaries).
- **Do not push** the branch unless explicitly requested. Output the manual
  push command in your `TASK DONE` message.

---

## Out of scope / deferred

- Multi-program CSV/PDF layout (drag-reordered columns, wide table split
  for multi-program PDFs) — covered in Stage 6.12.
- Plot PDF advanced mode metadata block — already implemented in Stage 6.6.
- External data in Plot CSV — deferred to Stage 7.
- Full WCAG accessibility audit of the CSV modal — Stage 7.
