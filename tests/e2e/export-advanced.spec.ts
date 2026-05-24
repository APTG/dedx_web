import { test, expect } from "@playwright/test";

async function waitForAdvancedCalculatorResult(
  page: import("@playwright/test").Page,
): Promise<void> {
  const energyInput = page.getByTestId("advanced-energy-input-0");
  await energyInput.fill("100 MeV");
  await energyInput.blur();

  await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 10000 });
  await expect
    .poll(
      async () => {
        const text = (await page.getByTestId("advanced-stp-cell-0").textContent())?.trim() ?? "";
        return text && text !== "—" ? parseFloat(text) : 0;
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
}

test.describe("Export Advanced Mode", () => {
  test("CSV modal: opens in advanced mode, semicolon separator persists @smoke", async ({
    page,
  }) => {
    // Navigate directly to advanced mode calculator
    await page.goto("/calculator?mode=advanced");

    // Wait for advanced mode to be initialized (toggle shows "Advanced" selected)
    // Use getByRole with aria-pressed attribute for the Advanced mode toggle button
    await page.waitForSelector(
      'button[aria-label="Switch to Advanced mode"][aria-pressed="true"]',
      { timeout: 10000 },
    );

    await waitForAdvancedCalculatorResult(page);

    // Wait for export button to be enabled (use test ID like PDF test uses role)
    const exportCsvBtn = page.getByTestId("export-csv-btn");
    await expect(exportCsvBtn).toBeEnabled({ timeout: 5000 });

    // Scroll to top first - header may have scrolled out of view
    await page.evaluate(() => window.scrollTo(0, 0));

    // Click the button
    await exportCsvBtn.click();

    // Wait for modal to appear
    const modal = page.getByTestId("csv-export-modal");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("csv-separator-comma")).toBeChecked();

    await page.click('[data-testid="csv-separator-semicolon"]');

    const downloadPromise = page.waitForEvent("download");
    await page.click('[data-testid="csv-export-confirm"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);

    await expect(modal).not.toBeVisible();

    // Re-open: separator persists
    await page.getByTestId("export-csv-btn").click();
    await expect(page.getByTestId("csv-separator-semicolon")).toBeChecked();
  });

  test("Plot CSV export in advanced mode opens shared CSV modal @regression", async ({ page }) => {
    test.setTimeout(90000);
    await page.goto("/plot?mode=advanced");
    // Wait for WASM to compute the default preview (more reliable than waiting for JSROOT render)
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 35000 });

    // Add a series using the default selection
    const addSeriesButton = page.getByRole("button", { name: /add series/i });
    await expect(addSeriesButton).toBeEnabled();
    await addSeriesButton.click();

    // Wait for export CSV button to be enabled (series rendered)
    const exportCsvBtn = page.getByTestId("export-csv-btn");
    await expect(exportCsvBtn).toBeEnabled({ timeout: 8000 });

    // Open the shared CSV modal (Scenario 2 — same modal as Calculator)
    await exportCsvBtn.click();
    const modal = page.getByTestId("csv-export-modal");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // The modal exposes the separator and line-endings options
    await expect(page.getByTestId("csv-separator-comma")).toBeVisible();
    await expect(page.getByTestId("csv-separator-semicolon")).toBeVisible();
    await expect(page.getByTestId("csv-separator-tab")).toBeVisible();
    await expect(page.getByTestId("csv-line-endings-crlf")).toBeVisible();
    await expect(page.getByTestId("csv-line-endings-lf")).toBeVisible();

    // Confirm with defaults to trigger the download
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("csv-export-confirm").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    await expect(modal).not.toBeVisible();
  });

  test("CSV modal does NOT open in basic mode — download is immediate @regression", async ({
    page,
  }) => {
    await page.goto("/calculator");

    // Fill energy first (triggers auto-select and calculation)
    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    // Wait for result table AND STP data
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });
    const stpCell = page.locator('[data-testid^="stp-cell-"]').first();
    await expect
      .poll(
        async () => {
          const text = await stpCell.textContent();
          return text && text.trim() !== "—" ? parseFloat(text.trim()) : 0;
        },
        { timeout: 15000 },
      )
      .toBeGreaterThan(0);

    // Wait for export button to be enabled
    const exportCsvBtn = page.getByRole("button", { name: /export csv/i });
    await expect(exportCsvBtn).toBeEnabled({ timeout: 5000 });

    const downloadPromise = page.waitForEvent("download");
    await exportCsvBtn.click();

    // Modal should never appear
    await expect(page.locator('[data-testid="csv-export-modal"]')).not.toBeVisible({
      timeout: 500,
    });

    // Download should have triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test("PNG export only in advanced mode @smoke", async ({ page }) => {
    test.setTimeout(90000);
    // Basic mode: navigate directly
    await page.goto("/plot");
    // Wait for WASM to compute the default preview — this is the reliable signal that
    // the page is ready to interact with (JSROOT draw timing is too variable for a 20s limit).
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 35000 });

    // Add a series first
    const addSeriesButton = page.getByRole("button", { name: /add series/i });
    await expect(addSeriesButton).toBeEnabled({ timeout: 8000 });
    await addSeriesButton.click();

    const exportCsvBtnBasic = page.getByRole("button", { name: /export csv/i });
    await expect(exportCsvBtnBasic).toBeEnabled({ timeout: 8000 });

    // Wait for the image export button to appear
    const imageExportBtn = page.getByRole("button", { name: /export.*image/i });
    await expect(imageExportBtn).toBeVisible({ timeout: 8000 });
    await expect(imageExportBtn).toBeEnabled({ timeout: 8000 });
    await imageExportBtn.click();

    // Wait for menu to open and check SVG option exists
    await page.waitForSelector('[role="menu"]', { timeout: 3000 });
    const svgOption = page.getByRole("menuitem", { name: /svg vector/i });
    await expect(svgOption).toBeVisible();
    // PNG option should NOT exist in basic mode
    const pngOptionBasic = page.getByRole("menuitem", { name: /png image/i });
    await expect(pngOptionBasic).not.toBeVisible();
    await page.keyboard.press("Escape");

    // Advanced mode: navigate directly
    await page.goto("/plot?mode=advanced");
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 35000 });

    // Add a series in advanced mode
    const addSeriesButtonAdvanced = page.getByRole("button", { name: /add series/i });
    await expect(addSeriesButtonAdvanced).toBeEnabled({ timeout: 8000 });
    await addSeriesButtonAdvanced.click();

    const exportCsvBtnAdvanced = page.getByRole("button", { name: /export csv/i });
    await expect(exportCsvBtnAdvanced).toBeEnabled({ timeout: 8000 });

    // Wait for image export button to be visible again
    const imageExportBtnAdvanced = page.getByRole("button", { name: /export.*image/i });
    await expect(imageExportBtnAdvanced).toBeVisible({ timeout: 8000 });
    await expect(imageExportBtnAdvanced).toBeEnabled({ timeout: 8000 });
    await imageExportBtnAdvanced.click();

    await page.waitForSelector('[role="menu"]', { timeout: 3000 });

    // PNG option should now be visible
    const pngOption = page.getByRole("menuitem", { name: /png image/i });
    await expect(pngOption).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await pngOption.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("dedx_plot.png");
  });

  test("Calculator PDF triggers download in advanced mode @regression", async ({ page }) => {
    // Navigate directly to advanced mode calculator
    await page.goto("/calculator?mode=advanced");

    // Wait for advanced mode to be initialized
    await page.waitForSelector(
      'button[aria-label="Switch to Advanced mode"][aria-pressed="true"]',
      { timeout: 10000 },
    );

    await waitForAdvancedCalculatorResult(page);

    // Wait for export button to be enabled
    const exportPdfBtn = page.getByRole("button", { name: /export pdf/i });
    await expect(exportPdfBtn).toBeEnabled({ timeout: 5000 });

    const downloadPromise = page.waitForEvent("download");
    await exportPdfBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/dedx_calculator_.*\.pdf$/);
  });
});
