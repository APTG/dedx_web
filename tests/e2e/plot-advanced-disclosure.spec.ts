import { test, expect, type Page } from "@playwright/test";

// #798 · Advanced-options disclosure above the plot. Collapsed by default,
// discoverable on cold load, persists open/closed across reload, and hosts the
// manual Y-range override that wins over the #796 niceCeil auto-range.

const WASM_TIMEOUT = 20000;

async function waitForPlotReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });
  await expect(page.locator('[data-testid="preview-series"]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Loading plot engine")).toHaveCount(0, { timeout: 20000 });
  await page.waitForFunction(
    () => !!document.querySelector('[role="img"][aria-label*="plot"] svg path'),
    { timeout: 15000 },
  );
}

/** Top fraction (0 = top, 1 = bottom) of the SVG at which the curve peaks. */
async function curvePeakFraction(page: Page): Promise<number> {
  return page.evaluate(() => {
    const svg = document.querySelector('[role="img"][aria-label*="plot"] svg');
    if (!svg) return 1;
    const svgRect = svg.getBoundingClientRect();
    const paths = Array.from(svg.querySelectorAll("path")) as SVGPathElement[];
    let widest: SVGPathElement | null = null;
    let widestW = svgRect.width * 0.5;
    for (const p of paths) {
      const r = p.getBoundingClientRect();
      if (r.width > widestW) {
        widestW = r.width;
        widest = p;
      }
    }
    if (!widest) return 1;
    const top = widest.getBoundingClientRect().top;
    return (top - svgRect.top) / svgRect.height;
  });
}

test.describe("Plot advanced-options disclosure (#798)", () => {
  test("renders collapsed above the plot on cold load", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    const toggle = page.getByTestId("plot-advanced-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Collapsed → the override inputs are not rendered yet.
    await expect(page.getByTestId("plot-ymax")).toHaveCount(0);

    // The disclosure sits above the plot canvas in document order.
    const toggleBox = await toggle.boundingBox();
    const plotBox = await page.locator('[role="img"][aria-label*="plot"]').boundingBox();
    expect(toggleBox!.y).toBeLessThan(plotBox!.y);
  });

  test("keyboard toggles the disclosure and exposes the Y-range inputs", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    const toggle = page.getByTestId("plot-advanced-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("plot-ymin")).toBeVisible();
    await expect(page.getByTestId("plot-ymax")).toBeVisible();
  });

  test("manual yMax overrides niceCeil and clearing restores auto-range", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    // Linear-Y so the override visibly re-scales the curve height.
    await page
      .getByRole("radiogroup", { name: "Y axis scale" })
      .getByText("Y: Lin", { exact: true })
      .click();

    await page.getByTestId("plot-advanced-toggle").click();

    // Auto (niceCeil) keeps the peak in the upper portion of the plot.
    await expect.poll(() => curvePeakFraction(page), { timeout: 10000 }).toBeLessThan(0.6);
    const autoFraction = await curvePeakFraction(page);

    // A large manual ceiling pushes the same peak down toward the middle/bottom.
    await page.getByTestId("plot-ymax").fill("6000");
    await expect
      .poll(() => curvePeakFraction(page), {
        timeout: 10000,
        message: "manual yMax should push the curve peak lower than the auto ceiling",
      })
      .toBeGreaterThan(autoFraction + 0.1);

    // Clearing the override restores the niceCeil auto-range.
    await page.getByTestId("plot-ymax").fill("");
    await expect.poll(() => curvePeakFraction(page), { timeout: 10000 }).toBeLessThan(0.6);
  });

  test("persists the open state across reload", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    await page.getByTestId("plot-advanced-toggle").click();
    await expect(page.getByTestId("plot-advanced-toggle")).toHaveAttribute("aria-expanded", "true");

    await page.reload();
    await waitForPlotReady(page);

    await expect(page.getByTestId("plot-advanced-toggle")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("plot-ymax")).toBeVisible();
  });
});
