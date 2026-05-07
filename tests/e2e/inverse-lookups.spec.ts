import { test, expect } from "@playwright/test";

/**
 * E2E tests for Inverse Lookups feature (Range and Inverse STP tabs).
 *
 * These tests verify:
 * - Range tab: energy from CSDA range (primary flow)
 * - Range tab: URL round-trip persistence
 * - Advanced-mode gate: inverse tabs absent in Basic mode
 * - Range tab: inline suffix detection (m accepted, km rejected)
 * - Range tab: invalid input rejection (negative, non-numeric)
 */

/**
 * Check if WASM binary is present. When absent, tests that require
 * actual computation should be skipped.
 */
async function checkWasmpresent(page: import("@playwright/test").Page): Promise<boolean> {
  try {
    const response = await page.request.head("/wasm/libdedx.mjs");
    return response.status() === 200;
  } catch {
    return false;
  }
}

test.describe("Inverse Lookups — Range Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Wait for the UI to load
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("Range tab: energy from CSDA range @smoke", async ({ page }) => {
    const wasmPresent = await checkWasmpresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Capture console messages
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      console.log("CONSOLE:", msg.text());
      consoleMessages.push(msg.text());
    });

    // Use Air (Dry) material (104) with PSTAR (program 2) which has valid inverse CSDA data
    // Note: Water liquid (276) doesn't have inverse CSDA tables in libdedx for PSTAR/ICRU49
    await page.goto("/calculator?particle=1&material=104&program=2&imode=csda&ivalues=100:cm&advanced=1");
    await page.waitForSelector('[data-testid="inverse-range-result-0"]', { timeout: 15000 });

    // Log console messages for debugging
    console.log("Browser console messages:", consoleMessages);
    console.log("Total messages:", consoleMessages.length);

    const result = page.locator('[data-testid="inverse-range-result-0"]');

    // Baseline result must be a positive number (not an error message like "-1")
    const energyText = await expect
      .poll(async () => (await result.textContent())?.trim(), { timeout: 15000 })
      .toMatch(/^\d+(\.\d+)?$/);

    // Parse and verify the energy value is actually > 0
    expect(parseFloat(energyText!)).toBeGreaterThan(0);

    // Change range input; result must update
    await page.fill('[data-testid="inverse-range-input-0"]', "15.4");
    const before = await result.textContent();
    await page.locator('[data-testid="inverse-range-input-0"]').blur();
    await expect
      .poll(async () => (await result.textContent())?.trim(), { timeout: 15000 })
      .not.toBe(before?.trim());
  });

  test("Range tab: URL round-trip @regression", async ({ page }) => {
    const wasmPresent = await checkWasmpresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Navigate with Range tab URL params
    await page.goto("/calculator?particle=1&material=276&advanced=1");
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });

    // Click Range tab
    await page.click('[data-testid="inverse-tab-range"]');

    // Select mm as master unit
    await page.selectOption('[data-testid="inverse-range-unit"]', "mm");

    // Enter value
    await page.fill('[data-testid="inverse-range-input-0"]', "3.5");
    await page.locator('[data-testid="inverse-range-input-0"]').blur();

    // Wait for URL sync (debounce + URL update)
    await page.waitForFunction(() => window.location.search.includes("imode=csda") && window.location.search.includes("iunit=mm"), { timeout: 5000 });

    // Verify URL contains inverse lookup params
    const url = page.url();
    expect(url).toContain("imode=csda");
    expect(url).toContain("ivalues=3.5");
    expect(url).toContain("iunit=mm");

    // Reload page and wait for URL sync
    await page.reload();
    await page.waitForFunction(() => window.location.search.includes("iunit=mm"), { timeout: 10000 });
    await page.waitForSelector('[data-testid="inverse-range-result-0"]', { timeout: 15000 });

    // Verify tab is still active
    const tab = page.locator('[data-testid="inverse-tab-range"]');
    await expect(tab).toHaveAttribute("aria-selected", "true");

    // Verify input is restored
    const input = page.locator('[data-testid="inverse-range-input-0"]');
    await expect(input).toHaveValue("3.5");

    // Verify result is a positive number (not an error value)
    const resultText = await expect
      .poll(async () => (await page.locator('[data-testid="inverse-range-result-0"]').textContent())?.trim(), {
        timeout: 15000,
      })
      .toMatch(/^\d+(\.\d+)?$/);
    expect(parseFloat(resultText!)).toBeGreaterThan(0);
  });

  test("Range tab: 'm' suffix accepted, 'km' rejected @regression", async ({ page }) => {
    const wasmPresent = await checkWasmpresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Use Air (Dry) material — verify ID at runtime if needed
    // PSTAR material ID for Air (Dry) is typically around 104
    const airMaterialId = 104;
    await page.goto(`/calculator?particle=1&material=${airMaterialId}&advanced=1`);
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });

    // Click Range tab
    await page.click('[data-testid="inverse-tab-range"]');

    // '30 m' — valid metre suffix; must produce a positive numeric result
    await page.fill('[data-testid="inverse-range-input-0"]', "30 m");
    const resultText = await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-range-result-0"]').textContent())?.trim(),
        { timeout: 15000 },
      )
      .toMatch(/^\d+(\.\d+)?$/);
    expect(parseFloat(resultText!)).toBeGreaterThan(0);

    // Per-row mode active → master unit selector disabled
    await expect(page.locator('[data-testid="inverse-range-unit"]')).toBeDisabled();

    // '0.03 km' — unrecognised suffix → inline error mentioning 'km'
    await page.fill('[data-testid="inverse-range-input-0"]', "0.03 km");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-range-row-error-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/km/);
  });

  test("Range tab: rejects negative and non-numeric input @regression", async ({ page }) => {
    await page.goto("/calculator?particle=1&material=276&advanced=1");
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });

    // Click Range tab
    await page.click('[data-testid="inverse-tab-range"]');

    // Negative value → error mentioning "positive"
    await page.fill('[data-testid="inverse-range-input-0"]', "-5");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-range-row-error-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/positive/i);

    // Non-numeric text → error mentioning "numeric"
    await page.fill('[data-testid="inverse-range-input-0"]', "abc");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-range-row-error-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/numeric/i);
  });

  test("Inverse STP tab: rejects zero and non-numeric input @regression", async ({ page }) => {
    await page.goto("/calculator?particle=1&material=276&advanced=1");
    await page.waitForSelector('[data-testid="inverse-tab-stp"]', { timeout: 5000 });

    // Click Inverse STP tab
    await page.click('[data-testid="inverse-tab-stp"]');

    // Zero value → error mentioning "positive"
    await page.fill('[data-testid="inverse-stp-input-0"]', "0");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-stp-row-error-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/positive/i);

    // Non-numeric text → error mentioning "numeric"
    await page.fill('[data-testid="inverse-stp-input-0"]', "xyz");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-stp-row-error-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/numeric/i);
  });
});

test.describe("Advanced Mode Gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Wait for the UI to load
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("Advanced-mode gate: inverse tabs absent in Basic mode @regression", async ({ page }) => {
    // In Basic mode, inverse tabs should not exist in DOM
    const rangeTab = page.locator('[data-testid="inverse-tab-range"]');
    const stpTab = page.locator('[data-testid="inverse-tab-stp"]');

    await expect(rangeTab).toHaveCount(0);
    await expect(stpTab).toHaveCount(0);

    // Switch to Advanced mode
    await page.locator('button[aria-label="Switch to Advanced mode"]').click();
    await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });

    // Wait for inverse tabs to appear in DOM
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });

    // Inverse tabs should now be present
    await expect(page.locator('[data-testid="inverse-tab-range"]')).toBeVisible();
    await expect(page.locator('[data-testid="inverse-tab-stp"]')).toBeVisible();
  });
});
