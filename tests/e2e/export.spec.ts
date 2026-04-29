import { test, expect } from "@playwright/test";

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

  test("Export CSV downloads a file with the correct filename and headers", async ({ page }) => {
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
    const header = noBom.split("\r\n")[0]!;
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
