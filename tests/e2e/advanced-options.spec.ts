import { test, expect } from "@playwright/test";

/**
 * E2E tests for Advanced Options panel.
 *
 * These tests verify the Advanced Options accordion functionality including:
 * - Density override with URL sync
 * - Interpolation method changes
 * - I-value override with URL sync
 * - URL round-trip persistence
 * - Input validation
 */

test.describe("Advanced Options Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Wait for the UI to load
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test.describe("Density Override", () => {
    test("enters density 1.20 and asserts URL contains density=1.20", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      await page.waitForTimeout(1000);

      // Expand and enter density
      await page.click('button:has-text("Advanced Options")');
      await page.waitForTimeout(300);
      const densityInput = page.locator("#density-override");
      await densityInput.fill("1.20");
      await densityInput.blur();

      // Wait for URL sync
      await page.waitForFunction(() => window.location.search.includes("density=1.2"), {
        timeout: 5000,
      });

      expect(page.url()).toContain("density=1.2");
    });

    test("enters invalid density (negative) → validation error displayed", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      await page.waitForTimeout(1000);

      // Expand and enter invalid density
      await page.click('button:has-text("Advanced Options")');
      await page.waitForTimeout(300);
      const densityInput = page.locator("#density-override");
      await densityInput.fill("-5");
      await densityInput.blur();
      await page.waitForTimeout(500);

      // Error should be displayed
      const errorElement = page.locator("#density-error");
      await expect(errorElement).toBeVisible();
      await expect(errorElement).toContainText("greater than 0");
    });
  });

  test.describe("Interpolation Method", () => {
    test("switches interpolation method to Spline", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      await page.waitForTimeout(500);

      // Expand Advanced Options
      await page.click('button:has-text("Advanced Options")');
      await page.waitForTimeout(300);

      // Use native select to change method to spline
      await page.selectOption("#interp-method", "spline");
      await page.waitForTimeout(500);

      // URL should contain interp_method=spline
      expect(page.url()).toContain("interp_method=spline");
    });
  });

  test.describe("I-Value Override", () => {
    test("enters I-value override and asserts URL contains ival parameter", async ({ page }) => {
      // Switch to Advanced mode
      const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
      await advancedToggle.click();
      await page.waitForTimeout(1000);

      // Expand Advanced Options
      await page.click('button:has-text("Advanced Options")');
      await page.waitForTimeout(300);

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
      const fullUrl =
        "/calculator?mode=advanced&density=1.20&ival=85&interp_method=spline";
      await page.goto(fullUrl);
      await page.waitForTimeout(1000);

      // Expand Advanced Options
      await page.click('button:has-text("Advanced Options")');
      await page.waitForTimeout(500);

      // Verify density
      const densityInput = page.locator("#density-override");
      await expect(densityInput).toHaveValue("1.2");

      // Verify I-value
      const ivalInput = page.locator("#ival-override");
      await expect(ivalInput).toHaveValue("85");
    });
  });
});
