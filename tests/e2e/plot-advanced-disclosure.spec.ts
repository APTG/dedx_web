import { test, expect, type Page } from "@playwright/test";

// #798 · Advanced-options disclosure above the plot. Visible only in Advanced
// mode (AC-1), collapsed by default, mounted directly above the plot canvas,
// keyboard-accessible, and persists its open/closed state across reloads.

const WASM_TIMEOUT = 20000;

async function waitForPlotReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });
  await expect(page.locator('[data-testid="preview-series"]')).toBeVisible({ timeout: 15000 });
}

test.describe("Plot advanced-options disclosure (#798)", () => {
  test("renders collapsed above the plot in Advanced mode", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot?mode=advanced");
    await waitForPlotReady(page);

    const toggle = page.getByTestId("plot-advanced-toggle");
    await expect(toggle).toBeVisible();
    // Collapsed by default (aria-expanded reflects open/closed state).
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // The disclosure sits above the plot canvas in document order.
    const toggleBox = await toggle.boundingBox();
    const plotBox = await page.locator('[role="img"][aria-label*="plot"]').boundingBox();
    expect(toggleBox!.y).toBeLessThan(plotBox!.y);
  });

  test("keyboard toggles the disclosure and exposes the controls", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot?mode=advanced");
    await waitForPlotReady(page);

    const toggle = page.getByTestId("plot-advanced-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Expanded → the density control inside the panel is visible.
    await expect(page.locator("#density-override")).toBeVisible();
  });

  test("persists the open state across reload", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot?mode=advanced");
    await waitForPlotReady(page);

    await page.getByTestId("plot-advanced-toggle").click();
    await expect(page.getByTestId("plot-advanced-toggle")).toHaveAttribute("aria-expanded", "true");

    await page.reload();
    await waitForPlotReady(page);

    await expect(page.getByTestId("plot-advanced-toggle")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#density-override")).toBeVisible();
  });
});
