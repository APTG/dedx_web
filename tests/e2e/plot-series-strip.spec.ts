import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

/**
 * E2E coverage for the reworked series strip (#793): real icon-button actions,
 * a single (sidebar) add entry point, hidden-state styling, and reorder.
 */
test.describe("Plot — series strip rework (#793)", () => {
  test.use({ viewport: { width: 1280, height: 800 } }); // desktop

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', {
      timeout: WASM_TIMEOUT,
    });
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 15000 });
  });

  test("the strip contains no Add-series control (single sidebar entry point)", async ({
    page,
  }) => {
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();

    // No add control of any kind lives inside the strip.
    const strip = page.getByTestId("plot-series-strip");
    await expect(strip.getByRole("button", { name: /add/i })).toHaveCount(0);
    // The count + sidebar hint live in the strip header instead.
    await expect(page.getByTestId("plot-series-count")).toContainText(/1 series/i);
  });

  test("eye toggle hides then re-shows a series with distinct styling", async ({ page }) => {
    await page.getByTestId("plot-add-series").click();
    const row = page.getByTestId("plot-series-row-0");
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /hide series/i }).click();
    await expect(row).toHaveClass(/opacity-40/);
    // The label is struck through and the toggle flips to "show".
    await expect(row.getByRole("button", { name: /edit series/i })).toHaveClass(/line-through/);
    await expect(row.getByRole("button", { name: /show series/i })).toBeVisible();

    await row.getByRole("button", { name: /show series/i }).click();
    await expect(row).not.toHaveClass(/opacity-40/);
    await expect(row.getByRole("button", { name: /hide series/i })).toBeVisible();
  });

  test("hiding every series keeps the framed canvas, not the loading text (#812 follow-up) @regression", async ({
    page,
  }) => {
    // Commit a series so the strip holds both the preview and a committed curve.
    await page.getByTestId("plot-add-series").click();
    const row = page.getByTestId("plot-series-row-0");
    await expect(row).toBeVisible();

    // Wait until JSROOT has actually drawn a curve, so we exercise the
    // drawn → all-hidden transition rather than the initial-load placeholder.
    const canvas = page.locator('[role="img"][aria-label*="plot"]');
    await expect(page.getByText("Loading plot engine")).toHaveCount(0, { timeout: 20000 });
    await page.waitForFunction(
      () => !!document.querySelector('[role="img"][aria-label*="plot"] svg path'),
      { timeout: 15000 },
    );

    // Hide the committed series and the preview → nothing left visible.
    await row.getByRole("button", { name: /hide series/i }).click();
    await page
      .getByTestId("preview-series")
      .getByRole("button", { name: /hide preview/i })
      .click();

    // The empty framed axes stay on screen — no "Loading plot engine…" fallback.
    // The JSROOT canvas SVG is still rendered (not the placeholder), and its
    // axis tick labels draw even with no curves — proof the framed axes remain.
    // Scope to the outer `svg.root_canvas` so the nested `main_layer` <svg>
    // doesn't trip Playwright's strict-mode single-element check.
    await expect(page.getByText("Loading plot engine")).toHaveCount(0);
    await expect(canvas.locator("svg.root_canvas")).toBeVisible();
    await expect
      .poll(() => canvas.locator("svg text").count(), { timeout: 10000 })
      .toBeGreaterThan(0);
  });

  test("trash button removes a series", async ({ page }) => {
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();
    await page
      .getByTestId("plot-series-row-0")
      .getByRole("button", { name: /remove series/i })
      .click();
    await expect(page.getByTestId("plot-series-row-0")).toHaveCount(0);
  });

  test("action buttons expose accessible names", async ({ page }) => {
    await page.getByTestId("plot-add-series").click();
    const row = page.getByTestId("plot-series-row-0");
    await expect(row.getByRole("button", { name: /hide series/i })).toBeVisible();
    await expect(row.getByRole("button", { name: /remove series/i })).toBeVisible();
    await expect(row.getByRole("button", { name: /reorder series/i })).toBeVisible();
  });

  test("keyboard reorder on the drag handle changes the plotted order", async ({ page }) => {
    // Add proton series
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-0")).toBeVisible();

    // Switch to alpha and add a second series
    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-item-2").click();
    await page.waitForSelector('[data-testid="preview-series"]', { timeout: 15000 });
    await page.getByTestId("plot-add-series").click();
    await expect(page.getByTestId("plot-series-row-1")).toBeVisible();

    const firstLabelBefore = await page
      .getByTestId("plot-series-row-0")
      .getByRole("button", { name: /edit series/i })
      .textContent();

    // Move the first row down one position via its drag handle.
    const handle = page.getByTestId("plot-series-drag-0");
    await handle.focus();
    await handle.press("ArrowDown");

    const secondLabelAfter = await page
      .getByTestId("plot-series-row-1")
      .getByRole("button", { name: /edit series/i })
      .textContent();
    expect((secondLabelAfter ?? "").trim()).toBe((firstLabelBefore ?? "").trim());
  });
});
