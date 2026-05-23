import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

/**
 * E2E coverage for the Plot page add-series flow.
 * Tests the series-strip component: add, remove, toggle visibility, and edit.
 */
test.describe("Plot — add-series flow", () => {
  test.use({ viewport: { width: 1280, height: 800 } }); // desktop

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', {
      timeout: WASM_TIMEOUT,
    });
    // Default state: proton + water → preview should appear
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 15000 });
  });

  test("+ Add button commits preview as series and shows row in strip @regression", async ({
    page,
  }) => {
    await expect(page.getByTestId("plot-series-row-0")).toHaveCount(0);
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();
  });

  test("add 2 series with different particles and assert strip count", async ({ page }) => {
    // Add proton series
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();

    // Switch to alpha particle
    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-item-2").click();
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 15000 });

    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();
    await expect(page.getByTestId("plot-series-row-1")).toBeVisible();
  });

  test("visibility toggle hides a series row visually", async ({ page }) => {
    await page.getByTestId("plot-add-series").click();
    const row = page.getByTestId("plot-series-row-0");
    await expect(row).toBeVisible();

    // Click the eye button to toggle visibility
    await row.getByRole("button", { name: /hide series/i }).click();
    // Row stays in DOM but gets opacity-40 class (visually dimmed)
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/opacity-40/);
  });

  test("remove button removes a series from the strip", async ({ page }) => {
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();

    await page
      .getByTestId("plot-series-row-0")
      .getByRole("button", { name: /remove series/i })
      .click();
    await expect(page.getByTestId("plot-series-row-0")).toHaveCount(0);
  });

  test("clicking series label enters editing mode (ring highlight + editing label)", async ({
    page,
  }) => {
    await page.getByTestId("plot-add-series").click();
    const row = page.getByTestId("plot-series-row-0");
    // Click the series label to start editing
    await row.getByRole("button", { name: /edit series/i }).click();
    await expect(row).toHaveClass(/ring-2/);
    await expect(page.getByTestId("plot-series-done")).toBeVisible();
  });

  test("Done editing button exits edit mode", async ({ page }) => {
    await page.getByTestId("plot-add-series").click();
    await page
      .getByTestId("plot-series-row-0")
      .getByRole("button", { name: /edit series/i })
      .click();
    await expect(page.getByTestId("plot-series-done")).toBeVisible();

    await page.getByTestId("plot-series-done").click();
    await expect(page.getByTestId("plot-series-done")).toHaveCount(0);
    await expect(page.getByTestId("plot-add-series")).toBeVisible();
  });
});
