import { test, expect, type Page } from "@playwright/test";

// #795 · Axis title margins — the X/Y axis titles must never overlap their
// tick labels, in any X log/lin × Y log/lin combination. The fix sets
// fTitleOffset on the histogram axes and is re-applied on every redraw, so we
// re-check after toggling each scale.

const WASM_TIMEOUT = 20000;

async function waitForPlotReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });
  await expect(page.locator('[data-testid="preview-series"]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Loading plot engine")).toHaveCount(0, { timeout: 20000 });
  // The series path is the last thing JSROOT draws; wait for at least one.
  await page.waitForFunction(
    () => !!document.querySelector('[role="img"][aria-label*="plot"] svg path'),
    { timeout: 15000 },
  );
}

/**
 * Returns true when the given axis title text and the nearest numeric tick
 * label overlap. `titleMatch` identifies the axis-title <text> by its content
 * ("Energy" for X, "Stopping Power" for Y); every other numeric <text> on the
 * plot is treated as a candidate tick label.
 */
async function titleOverlapsTicks(page: Page, titleMatch: string): Promise<boolean> {
  return page.evaluate((needle) => {
    const svg = document.querySelector('[role="img"][aria-label*="plot"] svg');
    if (!svg) return true;
    const texts = Array.from(svg.querySelectorAll("text")) as SVGTextElement[];
    const title = texts.find((t) => (t.textContent ?? "").includes(needle));
    if (!title) return true;
    const titleRect = title.getBoundingClientRect();
    const overlaps = (a: DOMRect, b: DOMRect): boolean =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return texts.some((t) => {
      if (t === title) return false;
      const txt = (t.textContent ?? "").trim();
      // Only numeric tick labels (allow scientific/decimal forms).
      if (!/^[-+]?\d/.test(txt)) return false;
      return overlaps(titleRect, t.getBoundingClientRect());
    });
  }, titleMatch);
}

/**
 * Returns true when the given axis title text is clipped by the SVG edge — i.e.
 * any part of the title's bounding box falls outside the SVG's own box. The
 * larger title offsets pushed the titles to the canvas edge (#801), so the pad
 * margins must keep them fully inside. A 1px tolerance absorbs sub-pixel
 * rounding.
 */
async function titleClippedBySvg(page: Page, titleMatch: string): Promise<boolean> {
  return page.evaluate((needle) => {
    const svg = document.querySelector('[role="img"][aria-label*="plot"] svg');
    if (!svg) return true;
    const texts = Array.from(svg.querySelectorAll("text")) as SVGTextElement[];
    const title = texts.find((t) => (t.textContent ?? "").includes(needle));
    if (!title) return true;
    const svgRect = svg.getBoundingClientRect();
    const r = title.getBoundingClientRect();
    const tol = 1;
    return (
      r.left < svgRect.left - tol ||
      r.right > svgRect.right + tol ||
      r.top < svgRect.top - tol ||
      r.bottom > svgRect.bottom + tol
    );
  }, titleMatch);
}

async function toggleScale(page: Page, axis: "X" | "Y", label: "Log" | "Lin"): Promise<void> {
  const group = page.getByRole("radiogroup", { name: `${axis} axis scale` });
  await group.getByText(`${axis}: ${label}`, { exact: true }).click();
}

test.describe("Plot axis title margins (#795)", () => {
  test("titles never overlap tick labels across all scale combinations @regression", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    // Default is X log / Y log. Walk through all four combinations, re-checking
    // both axis titles after each redraw.
    const combos: Array<{ x: "Log" | "Lin"; y: "Log" | "Lin" }> = [
      { x: "Log", y: "Log" },
      { x: "Log", y: "Lin" },
      { x: "Lin", y: "Lin" },
      { x: "Lin", y: "Log" },
    ];

    for (const combo of combos) {
      await toggleScale(page, "X", combo.x);
      await toggleScale(page, "Y", combo.y);

      // expect.poll retries the SVG measurement until JSROOT has redrawn and
      // re-applied the offsets — no fixed sleep needed.
      await expect.poll(() => titleOverlapsTicks(page, "Energy"), { timeout: 10000 }).toBe(false);
      await expect
        .poll(() => titleOverlapsTicks(page, "Stopping Power"), { timeout: 10000 })
        .toBe(false);
    }
  });

  test("titles stay fully inside the SVG (not clipped at the edge) @regression", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    // Linear-Y is where the clipping was most visible (#801): the Y title sat at
    // the left edge and the X title at the bottom edge. Check both axes there.
    await toggleScale(page, "X", "Log");
    await toggleScale(page, "Y", "Lin");

    await expect
      .poll(() => titleClippedBySvg(page, "Stopping Power"), { timeout: 10000 })
      .toBe(false);
    await expect.poll(() => titleClippedBySvg(page, "Energy"), { timeout: 10000 }).toBe(false);
  });
});
