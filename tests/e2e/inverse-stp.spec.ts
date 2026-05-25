import { test, expect } from "@playwright/test";

/**
 * E2E tests for issue #560: Inverse-STP column reveal behaviour.
 *
 * - Single high-E column by default
 * - Low-E column revealed when any row returns two solutions
 * - Column collapses when all rows return to single solution
 * - `?istpbranch=both` reveals column on load
 * - "Plot" button on 2-solution row navigates to plot and creates 2 series
 *
 * All computation tests require real WASM and skip when absent.
 */

async function checkWasmPresent(page: import("@playwright/test").Page): Promise<boolean> {
  try {
    const response = await page.request.head("/wasm/libdedx.mjs");
    return response.status() === 200;
  } catch {
    return false;
  }
}

async function navigateToStpTab(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/calculator?particle=1&material=276&program=2&mode=advanced&qfocus=both");
  await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="inverse-tab-stp"]', { timeout: 15000 });
  await page.click('[data-testid="inverse-tab-stp"]');
  await page.waitForSelector('[data-testid="inverse-stp-table"]', { timeout: 5000 });
}

test.describe("Inverse-STP table — column reveal behaviour", () => {
  test("single high-E column by default @smoke", async ({ page }) => {
    await page.goto(
      "/calculator?particle=1&material=276&program=2&mode=advanced&qfocus=both&imode=stp",
    );
    await page.waitForSelector('[data-testid="inverse-stp-table"]', { timeout: 15000 });

    // High-E column header must exist
    await expect(page.locator('[data-testid="col-hi-e"]')).toBeVisible();

    // Low-E column header must NOT exist yet (no 2-solution input)
    await expect(page.locator('[data-testid="col-lo-e"]')).toHaveCount(0);
  });

  test("2-solution input reveals low-E column @smoke", async ({ page }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Proton (1) in Water (276) via PSTAR (2): 30 keV/µm → 2 solutions exist
    await page.goto(
      "/calculator?particle=1&material=276&program=2&mode=advanced&qfocus=both&imode=stp&lookups=30&iunit=kev-um",
    );
    await page.waitForSelector('[data-testid="inverse-stp-table"]', { timeout: 15000 });

    // Wait for high-E result to populate
    await expect(page.locator('[data-testid="inverse-stp-result-high-0"] span')).toHaveText(
      /^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/,
      { timeout: 15000 },
    );

    // Low-E column header must now be visible
    await expect(page.locator('[data-testid="col-lo-e"]')).toBeVisible({ timeout: 5000 });

    // Low-E result cell must show a numeric energy too
    await expect(page.locator('[data-testid="inverse-stp-result-low-0"] span')).toHaveText(
      /^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/,
      { timeout: 5000 },
    );
  });

  test("single-solution input keeps only high-E column; single solution shows — in low-E @smoke", async ({
    page,
  }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Load with a two-solution value, then a single-solution placeholder
    await page.goto(
      "/calculator?particle=1&material=276&program=2&mode=advanced&qfocus=both&imode=stp&lookups=30&iunit=kev-um",
    );
    await page.waitForSelector('[data-testid="inverse-stp-table"]', { timeout: 15000 });

    // Wait for both columns
    await expect(page.locator('[data-testid="col-lo-e"]')).toBeVisible({ timeout: 15000 });

    // Add a second row with a value above the Bragg peak (only single solution expected — no low-E)
    await page.click("text=+ Add row");
    await page.waitForSelector('[data-testid="inverse-stp-input-1"]', { timeout: 3000 });

    // The second row is empty so it shows — in both columns
    await expect(page.locator('[data-testid="inverse-stp-result-low-1"]')).toContainText("—");
  });

  test("auto-collapse: all rows single-solution → low-E column disappears @regression", async ({
    page,
  }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Navigate with a 2-solution value
    await page.goto(
      "/calculator?particle=1&material=276&program=2&mode=advanced&qfocus=both&imode=stp&lookups=30&iunit=kev-um",
    );
    await page.waitForSelector('[data-testid="inverse-stp-table"]', { timeout: 15000 });

    // Wait for low-E column to appear
    await expect(page.locator('[data-testid="col-lo-e"]')).toBeVisible({ timeout: 15000 });

    // Clear the input to make the row empty (no solutions)
    await page.fill('[data-testid="inverse-stp-input-0"]', "");

    // Low-E column must disappear once no rows have 2 solutions
    await expect
      .poll(async () => (await page.locator('[data-testid="col-lo-e"]').count()) === 0, {
        timeout: 10000,
      })
      .toBe(true);
  });

  test("?istpbranch=both reveals column on load even without 2-solution data @regression", async ({
    page,
  }) => {
    // Load with istpbranch=both but no lookup values
    await page.goto(
      "/calculator?particle=1&material=276&program=2&mode=advanced&qfocus=both&imode=stp&istpbranch=both",
    );
    await page.waitForSelector('[data-testid="inverse-stp-table"]', { timeout: 15000 });

    // Low-E column must be visible from URL state alone
    await expect(page.locator('[data-testid="col-lo-e"]')).toBeVisible({ timeout: 5000 });

    // All result cells show — (no input)
    await expect(page.locator('[data-testid="inverse-stp-result-high-0"]')).toContainText("—");
  });

  test("URL encodes istpbranch=both after low-E column reveals @regression", async ({ page }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    await navigateToStpTab(page);

    // Type a 2-solution value
    await page.fill('[data-testid="inverse-stp-input-0"]', "30");

    // Wait for low-E column
    await expect(page.locator('[data-testid="col-lo-e"]')).toBeVisible({ timeout: 15000 });

    // URL must update to include istpbranch=both
    await page.waitForFunction(() => window.location.search.includes("istpbranch=both"), {
      timeout: 5000,
    });
    expect(page.url()).toContain("istpbranch=both");
  });

  test("Plot button appears on 2-solution row and navigates to plot @regression", async ({
    page,
  }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    await page.goto(
      "/calculator?particle=1&material=276&program=2&mode=advanced&qfocus=both&imode=stp&lookups=30&iunit=kev-um",
    );
    await page.waitForSelector('[data-testid="inverse-stp-table"]', { timeout: 15000 });

    // Wait for both results
    await expect(page.locator('[data-testid="inverse-stp-result-high-0"] span')).toHaveText(
      /^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/,
      { timeout: 15000 },
    );
    await expect(page.locator('[data-testid="inverse-stp-result-low-0"] span')).toHaveText(
      /^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/,
      { timeout: 5000 },
    );

    // Plot button must be visible
    await expect(page.locator('[data-testid="inverse-stp-plot-0"]')).toBeVisible({ timeout: 3000 });

    // Click Plot — should navigate to /plot
    await page.click('[data-testid="inverse-stp-plot-0"]');
    await page.waitForURL(/\/plot/, { timeout: 10000 });
    expect(page.url()).toContain("/plot");
    expect(page.url()).toContain("inv_stp_branch=both");
  });

  test("Plot page creates 2 legend entries from inv_stp_branch=both @regression", async ({
    page,
  }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Navigate directly to plot page with inv_stp_branch=both
    await page.goto("/plot?particle=1&material=276&program=2&inv_stp_branch=both");
    await page.waitForSelector('[data-testid="plot-series-strip"]', { timeout: 20000 });

    // Wait for 2 series to appear in the legend / series strip
    await expect
      .poll(
        async () => {
          const items = await page
            .locator('[data-testid="plot-series-strip"] [data-testid^="plot-series-row-"]')
            .count();
          return items;
        },
        { timeout: 15000 },
      )
      .toBe(2);

    // Both series labels must contain the branch suffix
    const labels = await page
      .locator('[data-testid="plot-series-strip"] [data-testid^="plot-series-row-"]')
      .allTextContents();
    const hasHighE = labels.some((l) => l.includes("high-E"));
    const hasLowE = labels.some((l) => l.includes("low-E"));
    expect(hasHighE).toBe(true);
    expect(hasLowE).toBe(true);
  });
});
