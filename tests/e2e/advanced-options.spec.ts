import { test, expect } from "@playwright/test";

/**
 * E2E tests for Advanced Options panel.
 *
 * These tests verify the Advanced Options accordion functionality including:
 * - Density override with URL sync
 * - Density override actually affecting CSDA range and stopping power values
 * - Interpolation method changes
 * - I-value override with URL sync
 * - URL round-trip persistence
 * - Input validation
 * - Advanced Options panel only visible in Advanced mode
 */

/** Wait until a locator's text content parses to a positive float. */
async function waitForPositiveValue(
  locator: import("@playwright/test").Locator,
  timeout = 8000,
): Promise<number> {
  let value = 0;
  await expect
    .poll(
      async () => {
        value = parseFloat((await locator.textContent()) ?? "");
        return value;
      },
      { timeout },
    )
    .toBeGreaterThan(0);
  return value;
}

test.describe("Advanced Options Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Wait for the UI to load
    await page.waitForSelector('[data-testid="v8-entity-selection"]', { timeout: 15000 });
  });

  test.describe("Density Override", () => {
    test("enters density 1.20 and asserts URL contains density=1.20", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      // Wait for the Advanced Options accordion trigger to appear
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });

      // Expand and enter density
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#density-override", { timeout: 3000 });
      const densityInput = page.locator("#density-override");
      await densityInput.fill("1.20");
      await densityInput.blur();

      // Wait for URL sync
      await page.waitForFunction(() => window.location.search.includes("density=1.2"), {
        timeout: 5000,
      });

      expect(page.url()).toContain("density=1.2");
    });

    test("density override changes CSDA range (AC-6: 2× density → ~½ range) @smoke", async ({
      page,
    }) => {
      test.setTimeout(50000);
      // Wait for result table to appear with a valid calculation in Basic mode
      await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

      const basicRangeCell = page.locator('[data-testid="range-cell-0"]');
      // Wait until range cell has a numeric value (proton/water default)
      const basicBaseline = await waitForPositiveValue(basicRangeCell, 15000);

      // Switch to Advanced mode and open Advanced Options
      await page.locator('button[aria-label="Switch to Advanced mode"]').click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#density-override", { timeout: 5000 });

      // In Advanced mode, CSDA is shown in multi-program columns (data-program-id attribute).
      // Wait for the default-program CSDA cell to appear and have a positive value.
      const advRangeCell = page.locator('td[data-program-id][data-testid^="range-cell-"]').first();
      await waitForPositiveValue(advRangeCell, 15000);

      // Set density to 2× (water default ~1.0 g/cm³ → 2.0)
      const densityInput = page.locator("#density-override");
      await densityInput.fill("2");
      await densityInput.blur();

      // Range should now be roughly half the basic-mode baseline (2× density → ½ range).
      // Threshold is 60% of baseline (slightly permissive to account for
      // display unit rounding and auto-scale, while still catching the bug
      // where density had zero effect).
      await expect
        .poll(async () => parseFloat((await advRangeCell.textContent()) ?? ""), { timeout: 15000 })
        .toBeLessThan(basicBaseline * 0.6);
    });

    test("switching back to Basic mode after density override reverts to default density", async ({
      page,
    }) => {
      test.setTimeout(50000);
      // Get baseline in Basic mode
      await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });
      const basicRangeCell = page.locator('[data-testid="range-cell-0"]');
      const basicBaseline = await waitForPositiveValue(basicRangeCell, 15000);

      // Switch to Advanced mode and set density to 2
      await page.locator('button[aria-label="Switch to Advanced mode"]').click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#density-override", { timeout: 5000 });
      await page.locator("#density-override").fill("2");
      await page.locator("#density-override").blur();

      // Wait for Advanced mode CSDA cell to reflect density=2 (roughly half baseline)
      const advRangeCell = page.locator('td[data-program-id][data-testid^="range-cell-"]').first();
      await expect
        .poll(async () => parseFloat((await advRangeCell.textContent()) ?? ""), { timeout: 15000 })
        .toBeLessThan(basicBaseline * 0.6);

      // Switch back to Basic mode
      await page.locator('button[aria-label="Switch to Basic mode"]').click();

      // Basic mode should restore the original density — range must be close to original
      // (within 20% to allow for unit auto-scale differences on the same row).
      await expect
        .poll(async () => parseFloat((await basicRangeCell.textContent()) ?? ""), {
          timeout: 15000,
        })
        .toBeGreaterThan(basicBaseline * 0.8);
    });

    test("density override changes stopping power (AC-6: 2× density → ~2× keV/µm)", async ({
      page,
    }) => {
      test.setTimeout(50000);
      // Wait for result table with a numeric STP value in Basic mode
      await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

      const basicStpCell = page.locator('[data-testid="stp-cell-0"]');
      const basicBaselineStp = await waitForPositiveValue(basicStpCell, 15000);

      // Switch to Advanced mode and open panel
      await page.locator('button[aria-label="Switch to Advanced mode"]').click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#density-override", { timeout: 5000 });

      // The unit shown for water (condensed) should be keV/µm.
      // Only proceed if the material is condensed (aggregate state selector absent
      // or shows condensed). For gas materials this test is not applicable.
      const aggSelect = page.locator("#agg-state");
      const isGas = (await aggSelect.count()) > 0 && (await aggSelect.inputValue()) === "gas";
      if (!isGas) {
        // In Advanced mode, STP is shown in multi-program columns (data-program-id attribute).
        const advStpCell = page.locator('td[data-program-id][data-testid^="stp-cell-"]').first();
        await waitForPositiveValue(advStpCell, 15000);

        await page.locator("#density-override").fill("2");
        await page.locator("#density-override").blur();

        // STP (keV/µm) should be roughly doubled when density doubles.
        // Threshold 1.8× (slightly conservative to allow for display rounding).
        await expect
          .poll(async () => parseFloat((await advStpCell.textContent()) ?? ""), { timeout: 15000 })
          .toBeGreaterThan(basicBaselineStp * 1.8);
      }
    });

    test("enters invalid density (negative) → validation error displayed", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });

      // Expand and enter invalid density
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#density-override", { timeout: 3000 });
      const densityInput = page.locator("#density-override");
      await densityInput.fill("-5");
      await densityInput.blur();

      // Error should be displayed
      const errorElement = page.locator("#density-error");
      await expect(errorElement).toBeVisible();
      await expect(errorElement).toContainText("greater than 0");
    });
  });

  test.describe("Advanced Options panel visibility", () => {
    test("Advanced Options panel is absent in Basic mode", async ({ page }) => {
      // Default is Basic mode — Advanced Options accordion should not exist
      const panel = page.locator('button:has-text("Advanced Options")');
      await expect(panel).toHaveCount(0);
    });

    test("Advanced Options panel appears after switching to Advanced mode", async ({ page }) => {
      await page.locator('button[aria-label="Switch to Advanced mode"]').click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });
      await expect(page.locator('button:has-text("Advanced Options")')).toBeVisible();
    });

    test("Advanced Options panel disappears when switching back to Basic mode", async ({
      page,
    }) => {
      // Go to Advanced mode
      await page.locator('button[aria-label="Switch to Advanced mode"]').click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });
      await expect(page.locator('button:has-text("Advanced Options")')).toBeVisible();

      // Back to Basic mode
      await page.locator('button[aria-label="Switch to Basic mode"]').click();
      await expect(page.locator('button:has-text("Advanced Options")')).toHaveCount(0);
    });
  });

  test.describe("Interpolation Method", () => {
    test("switches interpolation method to Spline", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });

      // Expand Advanced Options
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#interp-method", { timeout: 3000 });

      // Use native select to change method to spline
      await page.selectOption("#interp-method", "spline");

      // URL should contain interp_method=spline
      await page.waitForFunction(() => window.location.search.includes("interp_method=spline"), {
        timeout: 5000,
      });
      expect(page.url()).toContain("interp_method=spline");
    });
  });

  test.describe("I-Value Override", () => {
    test("enters I-value override and asserts URL contains ival parameter", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });

      // Expand Advanced Options
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#ival-override", { timeout: 3000 });

      // Enter I-value
      const ivalInput = page.locator("#ival-override");
      await ivalInput.fill("85.5");
      await ivalInput.blur();

      // Wait for URL sync
      await page.waitForFunction(() => window.location.search.includes("ival=85.5"), {
        timeout: 5000,
      });

      expect(page.url()).toContain("ival=85.5");
    });
  });

  test.describe("URL Round-trip", () => {
    test("full advanced options URL round-trip encodes and decodes correctly", async ({ page }) => {
      // Navigate directly with all advanced options params
      const fullUrl = "/calculator?mode=advanced&density=1.20&ival=85&interp_method=spline";
      await page.goto(fullUrl);
      await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 10000 });

      // Expand Advanced Options
      await page.click('button:has-text("Advanced Options")');
      await page.waitForSelector("#density-override", { timeout: 3000 });

      // Verify density
      const densityInput = page.locator("#density-override");
      await expect(densityInput).toHaveValue("1.2");

      // Verify I-value
      const ivalInput = page.locator("#ival-override");
      await expect(ivalInput).toHaveValue("85");
    });
  });
});
