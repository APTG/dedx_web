import { test, expect, type Page, type Download } from "@playwright/test";

const WASM_TIMEOUT = 35000;

// CI downloads the WASM artifact before running E2E; skip locally when absent.
async function checkWasmAvailable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get("/wasm/libdedx.wasm");
    return response.ok();
  } catch {
    return false;
  }
}

async function readDownload(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * E2E coverage for the export legend (#797): the off-screen export pad carries
 * an in-canvas TLegend listing every *visible* series; hidden series are
 * excluded; the on-screen plot keeps the HTML strip as its only legend.
 */
test.describe("Plot — legend in exports (#797)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("exported SVG lists visible series and excludes hidden ones", async ({ page }) => {
    const wasmAvailable = await checkWasmAvailable(page);
    test.skip(
      !wasmAvailable,
      "Skipped when WASM binary absent. CI downloads artifact before running E2E.",
    );

    test.setTimeout(60000);
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: WASM_TIMEOUT });

    // Add proton (default), then alpha, so the two labels differ by particle.
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();

    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-item-2").click();
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 15000 });
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-1")).toBeVisible();

    // Capture both labels from the strip before hiding one.
    const visibleLabel = (
      (await page
        .getByTestId("plot-series-row-0")
        .getByRole("button", { name: /edit series/i })
        .textContent()) ?? ""
    ).trim();
    const hiddenLabel = (
      (await page
        .getByTestId("plot-series-row-1")
        .getByRole("button", { name: /edit series/i })
        .textContent()) ?? ""
    ).trim();
    expect(visibleLabel).not.toBe("");
    expect(hiddenLabel).not.toBe("");

    // Hide the second series.
    await page
      .getByTestId("plot-series-row-1")
      .getByRole("button", { name: /hide series/i })
      .click();

    // Let JSROOT finish before exporting.
    const exportCsv = page.getByRole("button", { name: /export csv/i });
    await expect(exportCsv).toBeEnabled({ timeout: 8000 });

    const imageExport = page.getByRole("button", { name: /export.*image/i });
    await expect(imageExport).toBeEnabled({ timeout: 8000 });
    await imageExport.click();

    const svgOption = page.getByRole("menuitem", { name: /svg vector/i });
    await expect(svgOption).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), svgOption.click()]);
    expect(download.suggestedFilename()).toMatch(/\.svg$/);

    const svg = await readDownload(download);
    // The export carries a legend: the visible series name appears as text,
    // the hidden one does not (it is excluded from both legend and curves).
    expect(svg).toContain(visibleLabel);
    expect(svg).not.toContain(hiddenLabel);

    // The on-screen plot must NOT gain an in-canvas legend — its only legend is
    // the HTML strip (the rendered plot SVG has no <text> matching the labels).
    const onScreenSvg = (await page.locator('[role="img"] svg').first().innerHTML()) ?? "";
    expect(onScreenSvg).not.toContain(visibleLabel);
  });
});
