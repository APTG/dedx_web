# Feature: Export — Advanced Mode Additions (Stage 6.11)

> **Status:** Draft v1 (2026-05-06)
>
> **Behavioral detail:** [`export.md`](export.md) §§1.1, 4.1, 6.1 (Final v6)
>
> **Related specs:**
>
> - Full export spec: [`export.md`](export.md)
> - Advanced mode: [`advanced-options.md`](advanced-options.md)
> - WASM API contract: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)

---

<!--
  Stage 6.11 implements three focused additions to the already-shipped
  basic-mode export (6.6). Each addition is advanced-mode-only or extends
  an existing button with new behaviour.

  Scope of this spec:
    §1.1  Advanced-mode CSV Export Configuration Modal (Calculator + Plot)
    §4.1  PNG image export via "Export image ▾" dropdown (Plot, advanced only)
    §6.1  Calculator PDF button (jsPDF + jspdf-autotable v5.0.5+ wiring)

  Out of scope: multi-program CSV/PDF layout (6.12), SVG export (already
  shipped in 6.6), basic-mode PDF (already shipped in 6.6).
-->

---

## Goal & User Story

**As a** researcher in advanced mode who needs to share stopping-power tables
with colleagues who use different spreadsheet applications,
**I want to** choose the CSV separator (comma, semicolon, or tab) and line
ending convention before downloading,
**so that** the exported file opens correctly in Excel (Windows), LibreOffice,
and locale-sensitive regional software without manual reformatting.

**As a** researcher assembling a publication figure from the Plot page,
**I want to** download a high-resolution PNG snapshot of the JSROOT canvas,
**so that** I can embed it directly in a manuscript or presentation without
needing an SVG editor.

**As a** researcher on the Calculator page in advanced mode,
**I want to** export a PDF that includes not just the results table but also
the full Advanced Options metadata block (particle, material, programs,
settings, system, build),
**so that** the PDF is a self-contained record of the exact calculation context.

---

## Acceptance Scenarios

### Scenario 1: CSV modal opens in advanced mode and downloads with custom separator @smoke

**Given** the user is on `/calculator` in **advanced mode** with at least one
energy row calculated

**When** the user clicks **"Export CSV ↓"** in the app toolbar

**Then**

- DOM: `[data-testid="csv-export-modal"]` is visible
- DOM: `[data-testid="csv-separator-comma"]` radio is selected by default
- DOM: `[data-testid="csv-filename-input"]` value starts with `"dedx_"`

**When** the user selects `[data-testid="csv-separator-semicolon"]` and clicks
`[data-testid="csv-export-confirm"]`

**Then**

- DOM: `[data-testid="csv-export-modal"]` is no longer visible
- A file download is triggered (Playwright: intercept via `page.waitForEvent("download")`)
- The downloaded file's first line is a semicolon-delimited header row

**When** the user opens the modal again on the same page

**Then**

- DOM: `[data-testid="csv-separator-semicolon"]` is still selected (localStorage
  persistence)

```typescript
test("CSV modal: opens in advanced mode, semicolon separator persists @smoke", async ({ page }) => {
  await page.goto("/calculator?advanced=1&particle=1&material=276");
  // Wait for at least one result
  await expect
    .poll(
      async () =>
        parseFloat((await page.locator('[data-testid="stp-cell-0"]').textContent()) ?? ""),
      { timeout: 8000 },
    )
    .toBeGreaterThan(0);

  await page.click('[data-testid="export-csv-btn"]');
  await expect(page.locator('[data-testid="csv-export-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="csv-separator-comma"]')).toBeChecked();

  await page.click('[data-testid="csv-separator-semicolon"]');

  const downloadPromise = page.waitForEvent("download");
  await page.click('[data-testid="csv-export-confirm"]');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);

  await expect(page.locator('[data-testid="csv-export-modal"]')).not.toBeVisible();

  // Re-open: separator persists
  await page.click('[data-testid="export-csv-btn"]');
  await expect(page.locator('[data-testid="csv-separator-semicolon"]')).toBeChecked();
});
```

---

### Scenario 2: CSV modal also opens on Plot page in advanced mode @regression

**Given** the user is on `/plot` in **advanced mode** with at least one series
plotted

**When** the user clicks **"Export CSV ↓"** in the app toolbar

**Then**

- DOM: `[data-testid="csv-export-modal"]` is visible (same modal as Calculator)
- The modal shows the separator and line-endings options

---

### Scenario 3: CSV modal does NOT open in basic mode — download is immediate @regression

**Given** the user is on `/calculator` in **basic mode**

**When** the user clicks **"Export CSV ↓"**

**Then**

- DOM: `[data-testid="csv-export-modal"]` is **not** shown at any point
- A file download triggers immediately

---

### Scenario 4: PNG export available in Plot advanced mode; SVG in both modes @smoke

**Given** the user is on `/plot` in **basic mode** with at least one series

**When** the user clicks **"Export image ▾"** in the controls bar

**Then**

- DOM: `[data-testid="export-image-svg"]` option is visible in the dropdown
- DOM: `[data-testid="export-image-png"]` option is **not** present

**Given** the user switches to **advanced mode**

**When** the user clicks **"Export image ▾"**

**Then**

- DOM: `[data-testid="export-image-png"]` is visible
- DOM: `[data-testid="export-image-svg"]` is visible

**When** the user clicks `[data-testid="export-image-png"]`

**Then**

- A file download triggers with `suggestedFilename()` === `"dedx_plot.png"`

```typescript
test("PNG export only in advanced mode @smoke", async ({ page }) => {
  await page.goto("/plot?particle=1&material=276&program=3");
  // Basic mode — no PNG option
  await page.click('[data-testid="export-image-btn"]');
  await expect(page.locator('[data-testid="export-image-png"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="export-image-svg"]')).toBeVisible();
  await page.keyboard.press("Escape");

  // Switch to advanced mode
  await page.click('[data-testid="advanced-mode-toggle"]');
  await page.click('[data-testid="export-image-btn"]');
  await expect(page.locator('[data-testid="export-image-png"]')).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.click('[data-testid="export-image-png"]');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("dedx_plot.png");
});
```

---

### Scenario 5: Calculator PDF button wired and produces download @regression

**Given** the user is on `/calculator` in advanced mode with results

**When** the user clicks **"Export PDF"** in the app toolbar

**Then**

- A PDF file download triggers (filename matches `dedx_calculator_*.pdf`)
- The generated PDF contains the string `"Advanced Mode Details"` in its
  content (confirming the metadata block is appended after the results table)

> **Note:** Content verification of a binary PDF is hard in E2E tests. At
> minimum, verify that a download event fires and the filename is `.pdf`. The
> metadata block content is covered by unit tests on the PDF-generation module.

---

## Reactive Triggers Matrix

Export is a **one-shot action** — it captures the current state at the moment
the user clicks Download. It is not reactive (no `$effect` needed for export
itself). The modal's localStorage persistence is not a reactive computation.

| Feature      |  Calculator (Basic)  |   Calculator (Advanced)    |     Plot (Basic)     |  Plot (Advanced)  |
| ------------ | :------------------: | :------------------------: | :------------------: | :---------------: |
| CSV modal    | ❌ (direct download) |       ✅ modal opens       | ❌ (direct download) |  ✅ modal opens   |
| PNG export   |         N/A          |            N/A             |   ❌ option absent   | ✅ option present |
| Advanced PDF |         N/A          | ✅ metadata block appended |         N/A          |        N/A        |

Legend: ✅ = behaviour active; ❌ = must not activate / option must be absent;
N/A = not applicable.

---

## URL Round-Trip Table

Export features add no URL parameters. The CSV modal settings are stored in
`localStorage`, not the URL.

| `localStorage` key     | Type                              | Values    | Default   |
| ---------------------- | --------------------------------- | --------- | --------- |
| `csvExportSeparator`   | `"comma" \| "semicolon" \| "tab"` | as listed | `"comma"` |
| `csvExportLineEndings` | `"crlf" \| "lf"`                  | as listed | `"crlf"`  |

---

## Cross-Page Parity Checklist

> Export additions are triggered from specific pages; the table below lists
> which additions apply to which page.

### Pages affected

- [src/routes/calculator/+page.svelte](../../src/routes/calculator/+page.svelte) —
  "Export CSV ↓" opens modal in advanced mode; "Export PDF" button wired with
  jsPDF + jspdf-autotable v5.0.5+; advanced PDF appends metadata block.
- [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte) —
  "Export CSV ↓" opens modal in advanced mode; "Export image ▾" shows PNG
  option in advanced mode.

### Required pillars

| Pillar                                                                           | Calculator  | Plot        |
| -------------------------------------------------------------------------------- | ----------- | ----------- |
| CSV modal only in advanced mode (`isAdvancedMode.value` guard)                   | ✅ required | ✅ required |
| PNG option only in advanced mode (`isAdvancedMode.value` guard on dropdown item) | N/A         | ✅ required |
| Advanced PDF metadata block only in advanced mode                                | ✅ required | N/A         |
| `localStorage` persistence of separator + line-endings restored on modal open    | ✅ required | ✅ required |

**Implementer contract:** Verify that opening the CSV modal in basic mode
**never** shows the modal (test Scenario 3 above). Verify that switching from
advanced to basic mode removes the PNG option from the "Export image ▾" dropdown
without a page reload.

---

## Test Plan

### Unit tests (Vitest)

- `src/tests/unit/csv-export-modal.test.ts`
  - [ ] `buildCsvString(rows, { separator: "semicolon" })` produces semicolon-delimited output
  - [ ] `buildCsvString(rows, { lineEndings: "lf" })` produces LF-only line endings
  - [ ] filename with no `.csv` extension has `.csv` appended
  - [ ] `localStorage` round-trip: separator written → modal re-opened → separator restored

- `src/tests/unit/calculator-pdf.test.ts` (extend existing PDF tests)
  - [ ] Advanced mode PDF output includes `"PARTICLE"`, `"MATERIAL"`, `"PROGRAMS"`,
        `"SETTINGS"`, `"SYSTEM"`, `"BUILD"` metadata fields in that order
  - [ ] Advanced mode PDF metadata block appears **after** the results table

### Component tests (`@testing-library/svelte`)

- `src/tests/components/CsvExportModal.test.ts`
  - [ ] Modal renders when `isAdvancedMode.value === true`
  - [ ] Modal does not render when `isAdvancedMode.value === false`
  - [ ] Clicking "Cancel" fires close without emitting download
  - [ ] Selecting semicolon separator and clicking confirm emits correct separator
  - ⚠ If `CsvExportModal` reads `isAdvancedMode` as a module-level singleton,
    set it in `beforeEach` and reset in `afterEach`

### E2E tests (Playwright)

- `tests/e2e/export-advanced.spec.ts`
  - `@smoke` — CSV modal opens in advanced mode, semicolon separator persists
    (Scenario 1)
  - `@smoke` — PNG export available in Plot advanced mode; absent in basic
    (Scenario 4)
  - `@regression` — CSV modal on Plot page (Scenario 2)
  - `@regression` — basic mode downloads immediately, no modal (Scenario 3)
  - `@regression` — Calculator PDF triggers download in advanced mode (Scenario 5)

---

## Out of Scope / Deferred

- **Multi-program CSV/PDF layout** (drag-reordered columns, delta/% tooltip
  inclusion in CSV) — covered in `stage-6-12-multi-program-polish.md`.
- **Advanced PDF for Plot page** — the export spec §5.3 covers this; it is
  already implemented as part of 6.6. This spec adds the Calculator PDF
  button and advanced-mode metadata block (§6.1 of `export.md`).
- **External data in Plot CSV** (`export.md` §4.3) — deferred to Stage 7
  alongside `external-data.md` implementation.
- **Accessibility audit of the CSV modal** — covered by the general WCAG
  accessibility pass in Stage 7. The modal must use `role="dialog"`,
  `aria-modal="true"`, and focus trap per `export.md` §8.

---

## Open Questions

None. All behavioral detail is in `export.md` Final v6.

---

## Appendix: data-testid Reference

| `data-testid` value       | Element                              | Notes                               |
| ------------------------- | ------------------------------------ | ----------------------------------- |
| `export-csv-btn`          | "Export CSV ↓" button in app toolbar | Present on both Calculator and Plot |
| `csv-export-modal`        | CSV configuration modal container    | Shown only in advanced mode         |
| `csv-separator-comma`     | Comma radio button                   | Default selection                   |
| `csv-separator-semicolon` | Semicolon radio button               | —                                   |
| `csv-separator-tab`       | Tab radio button                     | —                                   |
| `csv-line-endings-crlf`   | CRLF radio button                    | Default selection                   |
| `csv-line-endings-lf`     | LF radio button                      | —                                   |
| `csv-filename-input`      | Filename text input                  | Pre-filled with canonical default   |
| `csv-export-confirm`      | "Download CSV" button                | Triggers download + closes modal    |
| `csv-export-cancel`       | "Cancel" button                      | Closes without download             |
| `export-image-btn`        | "Export image ▾" dropdown button     | Plot controls bar only              |
| `export-image-png`        | PNG dropdown option                  | Visible only in advanced mode       |
| `export-image-svg`        | SVG dropdown option                  | Visible in both modes               |
