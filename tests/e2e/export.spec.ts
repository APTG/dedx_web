import { test, expect, type Page } from "@playwright/test";

test.describe("Calculator export — toolbar buttons", () => {
  test("Export PDF and Export CSV become enabled after a result is computed", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    // Wait for the STP value to actually arrive
    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 5000 })
      .toBeGreaterThan(0);

    const exportPdf = page.getByRole("button", { name: /export pdf/i });
    const exportCsv = page.getByRole("button", { name: /export csv/i });
    await expect(exportPdf).toBeEnabled();
    await expect(exportCsv).toBeEnabled();
  });

  test("Export CSV downloads a file with the correct filename and headers @smoke", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 5000 })
      .toBeGreaterThan(0);

    const exportCsv = page.getByRole("button", { name: /export csv/i });
    await expect(exportCsv).toBeEnabled();

    const [download] = await Promise.all([page.waitForEvent("download"), exportCsv.click()]);

    // Filename: dedx_calculator_{particle}_{material}_{program}.csv
    expect(download.suggestedFilename()).toMatch(/^dedx_calculator_.+\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");
    // Strip BOM, then split.
    const noBom = content.replace(/^\uFEFF/, "");
    const header = noBom.split("\r\n")[0] ?? "";
    expect(header).toContain("Normalized Energy (MeV/nucl)");
    expect(header).toContain("Typed Value");
    expect(header).toContain("Unit");
    expect(header).toContain("CSDA Range");
    expect(header).toContain("Stopping Power");
  });

  test("Export PDF downloads a PDF file with the correct filename", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 5000 })
      .toBeGreaterThan(0);

    const exportPdf = page.getByRole("button", { name: /export pdf/i });
    await expect(exportPdf).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      exportPdf.click(),
    ]);

    // Filename: dedx_calculator_{particle}_{material}_{program}.pdf
    expect(download.suggestedFilename()).toMatch(/^dedx_calculator_.+\.pdf$/);

    // Validate it's actually a PDF by reading the magic bytes
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const buf = Buffer.concat(chunks);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });
});

test.describe("Plot export", () => {
  // Helper to check WASM availability - skips tests if WASM binary is absent
  // CI downloads artifact before running E2E.
  async function checkWasmAvailable(page: Page) {
    try {
      const response = await page.request.get("/wasm/libdedx.wasm");
      return response.ok();
    } catch {
      return false;
    }
  }

  test("Export buttons disabled on plot page with no series", async ({ page }) => {
    // Skip if WASM binaries are missing
    // Skipped when WASM binary absent. CI downloads artifact before running E2E.
    const wasmAvailable = await checkWasmAvailable(page);
    test.skip(
      !wasmAvailable,
      "Skipped when WASM binary absent. CI downloads artifact before running E2E.",
    );

    await page.goto("/plot");
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 35000 });

    const exportPdf = page.getByRole("button", { name: /export pdf/i });
    const exportCsv = page.getByRole("button", { name: /export csv/i });

    // Without any series, export buttons should be disabled
    await expect(exportPdf).toBeDisabled();
    await expect(exportCsv).toBeDisabled();
  });

  test("Export CSV enabled after adding a series", async ({ page }) => {
    // Check WASM availability before running
    // Skipped when WASM binary absent. CI downloads artifact before running E2E.
    const wasmAvailable = await checkWasmAvailable(page);
    test.skip(
      !wasmAvailable,
      "Skipped when WASM binary absent. CI downloads artifact before running E2E.",
    );

    await page.goto("/plot");
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 35000 });

    // Add a series using the default selection (Proton in Water)
    const addSeriesButton = page.getByRole("button", { name: /add series/i });
    await expect(addSeriesButton).toBeEnabled();
    await addSeriesButton.click();

    // Wait for JSROOT to render the series (export buttons become enabled when ready)
    const exportCsv = page.getByRole("button", { name: /export csv/i });
    const exportPdf = page.getByRole("button", { name: /export pdf/i });
    await expect(exportCsv).toBeEnabled({ timeout: 8000 });
    await expect(exportPdf).toBeEnabled({ timeout: 8000 });
  });

  test("SVG vector download from image dropdown", async ({ page }) => {
    // Check WASM availability before running
    // Skipped when WASM binary absent. CI downloads artifact before running E2E.
    const wasmAvailable = await checkWasmAvailable(page);
    test.skip(
      !wasmAvailable,
      "Skipped when WASM binary absent. CI downloads artifact before running E2E.",
    );

    await page.goto("/plot");
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 35000 });

    // Add a series first
    const addSeriesButton2 = page.getByRole("button", { name: /add series/i });
    await expect(addSeriesButton2).toBeEnabled({ timeout: 8000 });
    await addSeriesButton2.click();

    // Wait for series calculation/rendering to finish before opening image export
    const exportCsvButton = page.getByRole("button", { name: /export csv/i });
    await expect(exportCsvButton).toBeEnabled({ timeout: 8000 });

    // Wait for the image export button to appear (series rendered in JSROOT)
    const imageExportButton = page.getByRole("button", { name: /export.*image/i });
    await expect(imageExportButton).toBeVisible({ timeout: 8000 });
    await expect(imageExportButton).toBeEnabled({ timeout: 8000 });
    await imageExportButton.click();

    // Select SVG vector
    const svgOption = page.getByRole("menuitem", { name: /svg vector/i });
    await expect(svgOption).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), svgOption.click()]);

    // Check the downloaded file has .svg extension
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("Export CSV download has correct filename", async ({ page }) => {
    // Check WASM availability before running
    // Skipped when WASM binary absent. CI downloads artifact before running E2E.
    const wasmAvailable = await checkWasmAvailable(page);
    test.skip(
      !wasmAvailable,
      "Skipped when WASM binary absent. CI downloads artifact before running E2E.",
    );

    await page.goto("/plot");
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 35000 });

    // Add a series first
    const addSeriesButton3 = page.getByRole("button", { name: /add series/i });
    await addSeriesButton3.click();

    const exportCsv = page.getByRole("button", { name: /export csv/i });
    await expect(exportCsv).toBeEnabled({ timeout: 8000 });

    const [download] = await Promise.all([page.waitForEvent("download"), exportCsv.click()]);

    // Check the downloaded file has the correct filename
    expect(download.suggestedFilename()).toBe("dedx_plot_data.csv");
  });
});
