import { test, expect, type Page } from "@playwright/test";

// #794 · App toolbar + Reset zoom — JSROOT's native on-canvas toolbar and
// right-click context menu are replaced by an app-level toolbar (− / + / Reset
// zoom / Export).

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
 * A signature of the plot's numeric axis tick labels. Zooming changes the
 * visible range and therefore the tick labels, so this is a stable,
 * implementation-agnostic proxy for "is the plot zoomed" across reset.
 */
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

/** Box-zoom a central region of the plot frame via a left-button drag. */
async function boxZoom(page: Page): Promise<void> {
  const canvas = page.locator('[role="img"][aria-label*="plot"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error("plot canvas has no bounding box");
  const x0 = box.x + box.width * 0.4;
  const y0 = box.y + box.height * 0.35;
  const x1 = box.x + box.width * 0.65;
  const y1 = box.y + box.height * 0.6;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  // Several intermediate moves so JSROOT registers the rubber-band selection.
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 });
  await page.mouse.move(x1, y1, { steps: 5 });
  await page.mouse.up();
}

test.describe("Plot toolbar & reset zoom (#794)", () => {
  test("app toolbar renders with − / + / Reset zoom / Export @smoke", async ({ page }) => {
    await page.goto("/plot");
    await waitForPlotReady(page);

    const toolbar = page.getByTestId("plot-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(page.getByTestId("plot-zoom-out")).toBeVisible();
    await expect(page.getByTestId("plot-zoom-in")).toBeVisible();
    await expect(page.getByTestId("plot-reset-zoom")).toBeVisible();
    await expect(page.getByTestId("export-image-btn")).toBeVisible();
  });

  test("JSROOT's native toolbar does not render on the plot @regression", async ({ page }) => {
    await page.goto("/plot");
    await waitForPlotReady(page);

    // With settings.ToolBar = false JSROOT never populates its on-canvas button
    // layer, so the group stays empty (no toggle, no camera/menu buttons).
    await expect(page.locator(".btns_layer > *")).toHaveCount(0);
  });

  test("right-clicking the plot does not open a ROOT context menu @regression", async ({
    page,
  }) => {
    await page.goto("/plot");
    await waitForPlotReady(page);

    const canvas = page.locator('[role="img"][aria-label*="plot"]');
    await canvas.click({ button: "right", position: { x: 120, y: 120 } });

    // JSROOT's context menu mounts as a .jsroot_ctxt_container; it must not appear.
    await expect(page.locator(".jsroot_ctxt_container")).toHaveCount(0);
  });

  test("box-zoom changes the axes; Reset zoom restores full range @regression", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    const full = await axisTickSignature(page);
    expect(full).not.toBe("");

    await boxZoom(page);
    await expect.poll(() => axisTickSignature(page), { timeout: 10000 }).not.toBe(full);

    await page.getByTestId("plot-reset-zoom").click();
    await expect.poll(() => axisTickSignature(page), { timeout: 10000 }).toBe(full);
  });

  test("Reset zoom is disabled until the plot is zoomed (#812) @regression", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    const reset = page.getByTestId("plot-reset-zoom");
    // A freshly drawn plot sits at full range, so there is nothing to reset.
    await expect(reset).toBeDisabled();

    // Zooming in gives Reset something to do → it becomes enabled.
    await boxZoom(page);
    await expect(reset).toBeEnabled();

    // Resetting returns to full range → the button disables itself again.
    await reset.click();
    await expect(reset).toBeDisabled();
  });

  test("Zoom out is disabled until the plot is zoomed (#812) @regression", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    const zoomOut = page.getByTestId("plot-zoom-out");
    // A freshly drawn plot sits at full range, so zooming out further is a no-op.
    await expect(zoomOut).toBeDisabled();

    // Zooming in gives Zoom out something to do → it becomes enabled.
    await boxZoom(page);
    await expect(zoomOut).toBeEnabled();

    // Resetting returns to full range → Zoom out disables itself again, same as Reset.
    await page.getByTestId("plot-reset-zoom").click();
    await expect(zoomOut).toBeDisabled();
  });

  test("clicking Zoom out down to full range disables it and Reset alike (#812) @regression", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    const zoomOut = page.getByTestId("plot-zoom-out");
    const reset = page.getByTestId("plot-reset-zoom");
    const full = await axisTickSignature(page);

    // Zoom in first so there is somewhere to zoom back out from.
    await boxZoom(page);
    await expect(zoomOut).toBeEnabled();

    // Keep stepping out — each step is clamped to the full data range — until
    // Zoom out disables itself, mirroring the max-zoom-out report in #812.
    for (let i = 0; i < 10 && !(await zoomOut.isDisabled()); i++) {
      await zoomOut.click();
    }
    await expect.poll(() => axisTickSignature(page), { timeout: 10000 }).toBe(full);
    await expect(zoomOut).toBeDisabled();
    await expect(reset).toBeDisabled();
  });

  test("− / + buttons step the zoom; Reset restores full range @regression", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/plot");
    await waitForPlotReady(page);

    const full = await axisTickSignature(page);
    expect(full).not.toBe("");

    // Zooming in narrows the visible range → axis tick labels change.
    await page.getByTestId("plot-zoom-in").click();
    await expect.poll(() => axisTickSignature(page), { timeout: 10000 }).not.toBe(full);

    // Reset returns to full range.
    await page.getByTestId("plot-reset-zoom").click();
    await expect.poll(() => axisTickSignature(page), { timeout: 10000 }).toBe(full);
  });
});
