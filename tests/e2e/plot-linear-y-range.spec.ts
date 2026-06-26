import { test, expect, type Page } from "@playwright/test";

// #796 · Linear-Y "nice ceiling" auto-range. In linear-Y mode the axis max is
// niceCeil(dataMax) instead of JSROOT's ~10000 default, so the curve fills the
// plot height instead of being squashed into the bottom quarter.

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

/**
 * The fraction (0 = top, 1 = bottom) of the SVG height at which the data curve
 * reaches its highest point. The data path spans most of the frame width, so we
 * pick the widest stroked <path> as the series curve.
 */
async function curvePeakFraction(page: Page): Promise<number> {
  return page.evaluate(() => {
    const svg = document.querySelector('[role="img"][aria-label*="plot"] svg');
    if (!svg) return 1;
    const svgRect = svg.getBoundingClientRect();
    const paths = Array.from(svg.querySelectorAll("path")) as SVGPathElement[];
    // The series curve is the widest path; grid/frame elements are narrower or
    // are <line>/<rect>. Ignore degenerate zero-width paths.
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

test.describe("Plot linear-Y nice-ceiling auto-range (#796)", () => {
  test("curve fills the plot height in linear-Y instead of the bottom quarter @regression", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    // Switch Y to linear — default is log.
    const yGroup = page.getByRole("radiogroup", { name: "Y axis scale" });
    await yGroup.getByText("Y: Lin", { exact: true }).click();

    // With niceCeil the peak sits in the upper part of the plot. Worst case the
    // nice ceiling is ~2× the data max (peak at ~50%); the old ~10000 default
    // pushed the peak to ~75% down. Anything above 0.6 fails the fix. expect.poll
    // retries until JSROOT has redrawn with the new linear range.
    await expect
      .poll(() => curvePeakFraction(page), {
        timeout: 10000,
        message: "linear-Y curve peak should reach the upper portion of the plot",
      })
      .toBeLessThan(0.6);
  });
});
