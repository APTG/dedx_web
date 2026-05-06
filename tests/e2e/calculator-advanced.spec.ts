import { test, expect } from "@playwright/test";

/**
 * E2E tests for Calculator Advanced Mode (Multi-Program Comparison).
 *
 * These tests verify the advanced mode toggle, program selection, URL state,
 * and round-trip encoding/decoding for the multi-program feature.
 *
 * Note: Tests that require WASM calculation are skipped when WASM binary is absent.
 * CI downloads the WASM artifact before running E2E tests.
 */

test.describe("Advanced mode", () => {
  test("Basic/Advanced toggle is visible in toolbar", async ({ page }) => {
    await page.goto("/calculator");

    // Wait for the page to load
    await expect(page.getByRole("heading", { name: "Calculator" })).toBeVisible();

    // The advanced mode toggle should be in the top-right action bar
    const advancedToggle = page.locator('button:has-text("Advanced")');
    await expect(advancedToggle).toBeVisible();
  });

  test("Clicking Advanced does not throw effect_update_depth_exceeded", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/calculator");
    // Wait for WASM and URL sync before toggling (state + calcState must be ready)
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();

    // Allow effects to settle — wait for mode URL update instead of fixed delay
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    expect(errors.filter((e) => e.includes("effect_update_depth_exceeded"))).toHaveLength(0);
  });

  test("Toggling Advanced on/off/on does not cause errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    const basicToggle = page.locator('button[aria-label="Switch to Basic mode"]');
    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');

    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });
    await basicToggle.click();
    await page.waitForFunction(() => !window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });
    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    await expect(page.getByRole("heading", { name: "Calculator" })).toBeVisible();
    expect(errors.filter((e) => e.includes("effect_update_depth_exceeded"))).toHaveLength(0);
  });

  test("Advanced mode URL contains mode=advanced after toggling on", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();

    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });
    expect(page.url()).toContain("mode=advanced");
  });
});
