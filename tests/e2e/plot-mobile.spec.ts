import { test, expect, type Page } from "@playwright/test";

// #799 · Mobile adaptations — re-verify the landed plot fixes (#793 toolbar /
// series strip, #794 toolbar + zoom, #798 advanced disclosure) at phone width.
// Target 375×667, smoke at 360×640.

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

/** Signature of the plot's numeric axis tick labels — a range-zoom proxy. */
async function axisTickSignature(page: Page): Promise<string> {
  return page.evaluate(() => {
    const svg = document.querySelector('[role="img"][aria-label*="plot"] svg');
    if (!svg) return "";
    return Array.from(svg.querySelectorAll("text"))
      .map((t) => (t.textContent ?? "").trim())
      .filter((s) => /^[-+]?\d/.test(s))
      .join("|");
  });
}

async function expectNoHorizontalOverflow(page: Page, message: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const root = document.documentElement;
          return Math.ceil(root.scrollWidth - root.clientWidth);
        }),
      { message, timeout: 10000 },
    )
    .toBeLessThanOrEqual(1);
}

// Drive the tests at a real phone viewport regardless of the Playwright project.
for (const vp of [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
]) {
  test.describe(`Plot mobile adaptations @${vp.width}px (#799)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`toolbar stays on one row, Reset keeps its label @responsive @smoke`, async ({ page }) => {
      test.setTimeout(60000);
      await page.goto("/plot");
      await waitForPlotReady(page);

      const toolbar = page.getByTestId("plot-toolbar");
      await expect(toolbar).toBeVisible();

      // One row: the toolbar is no taller than a single ~36px control row.
      // (A wrap to a second row would roughly double this height.) Width is
      // covered by expectNoHorizontalOverflow below, which is robust to the
      // sub-pixel/font-rendering differences a strict width assertion is not.
      const toolbarBox = await toolbar.boundingBox();
      expect(toolbarBox).not.toBeNull();
      expect(toolbarBox!.height, "toolbar must not wrap to a second row").toBeLessThan(60);

      // Reset zoom keeps its visible label (the discoverability anchor).
      await expect(page.getByTestId("plot-reset-zoom")).toHaveText(/Reset zoom/);

      // Export is icon-only below xs (420px): the icon shows, the text label is
      // display:none (so it is hidden, even though it stays in the DOM).
      const exportBtn = page.getByTestId("export-image-btn");
      await expect(exportBtn).toBeVisible();
      await expect(exportBtn.locator("svg")).toBeVisible();
      await expect(exportBtn.getByText("Export image", { exact: false })).toBeHidden();

      await expectNoHorizontalOverflow(page, "plot toolbar must not overflow horizontally");
    });

    test(`series rows have ≥44px eye/trash targets and ellipsis labels @responsive`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/plot");
      await waitForPlotReady(page);

      // Commit the default preview into a real series row.
      await page.getByTestId("plot-add-series").click();
      const row = page.getByTestId("plot-series-row-0");
      await expect(row).toBeVisible();

      for (const name of [/hide series/i, /remove series/i]) {
        const box = await row.getByRole("button", { name }).boundingBox();
        expect(box, `${name} target box`).not.toBeNull();
        expect(box!.height, `${name} target height`).toBeGreaterThanOrEqual(43); // 1px tolerance
        expect(box!.width, `${name} target width`).toBeGreaterThanOrEqual(43);
      }

      // The label truncates with an ellipsis rather than forcing a wider row.
      const labelClass = await row
        .getByRole("button", { name: /edit series/i })
        .getAttribute("class");
      expect(labelClass).toContain("truncate");

      await expectNoHorizontalOverflow(page, "series rows must not overflow horizontally");
    });

    test(`plot canvas keeps a legible min-height @responsive`, async ({ page }) => {
      test.setTimeout(60000);
      await page.goto("/plot");
      await waitForPlotReady(page);

      const canvas = page.locator('[role="img"][aria-label*="plot"]');
      const box = await canvas.boundingBox();
      expect(box, "plot canvas box").not.toBeNull();
      expect(
        box!.height,
        "plot canvas must stay tall enough for the Bragg peak",
      ).toBeGreaterThanOrEqual(170);
      // The Bragg peak is legible: the canvas top is within the viewport.
      expect(box!.y).toBeLessThan(vp.height);
    });

    test(`Reset zoom is reachable after a zoom and restores full range @responsive`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/plot");
      await waitForPlotReady(page);

      const full = await axisTickSignature(page);
      expect(full).not.toBe("");

      // On touch, axis pinch-zoom stays disabled, so the toolbar − / + are the
      // only way to zoom the axes and the persistent Reset button is the
      // finger-sized escape hatch back to full range.
      await page.getByTestId("plot-zoom-in").click();
      await expect.poll(() => axisTickSignature(page), { timeout: 10000 }).not.toBe(full);

      const reset = page.getByTestId("plot-reset-zoom");
      await expect(reset).toBeInViewport();
      await reset.click();
      await expect.poll(() => axisTickSignature(page), { timeout: 10000 }).toBe(full);
    });

    test(`Advanced disclosure opens without pushing the plot fully off-screen @responsive`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/plot?mode=advanced");
      await waitForPlotReady(page);

      const toggle = page.getByTestId("plot-advanced-toggle");
      // Align the toggle to the top of the viewport — the worst case for the
      // plot below it getting pushed off-screen as the panel expands.
      await toggle.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#density-override")).toBeVisible();

      // Without any further scrolling the plot canvas must remain at least
      // partially within the viewport — opening the panel may push it down but
      // must not shove it entirely off the bottom of a short viewport.
      const canvas = page.locator('[role="img"][aria-label*="plot"]');
      const box = await canvas.boundingBox();
      expect(box, "plot canvas box").not.toBeNull();
      expect(box!.y, "plot top must stay above the viewport bottom").toBeLessThan(vp.height);
      expect(box!.y + box!.height, "plot bottom must stay below the viewport top").toBeGreaterThan(
        0,
      );
    });
  });
}
