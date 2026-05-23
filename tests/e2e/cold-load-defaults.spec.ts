import { test, expect } from "@playwright/test";

test.describe("Cold-load defaults — issue #555", () => {
  test("row 1 pre-populated with 100 MeV on cold load @smoke", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await expect(energyInput).toHaveValue("100");
  });

  test("STP and CSDA cells populated without user interaction @smoke", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    // Results must appear automatically — no typing required.
    // The real-world budget is 500 ms on a Pixel-class device; CI machines are
    // slower so we poll up to 5 s, consistent with the rest of the E2E suite.
    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 5000 })
      .toBeGreaterThan(0);

    const rangeCell = page.locator('[data-testid="range-cell-0"]');
    await expect
      .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 5000 })
      .toBeGreaterThan(0);
  });

  // Tagged @responsive so this also runs on the mobile-chrome and tablet
  // Playwright projects — verifying the keyboard does not auto-appear.
  test("no element is auto-focused on cold load @responsive", async ({ page }) => {
    await page.goto("/calculator");
    // Wait for WASM results so all reactive mount effects have settled.
    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 10000 })
      .toBeGreaterThan(0);

    const activeTag = await page.evaluate(
      () => (document.activeElement?.tagName ?? "BODY").toUpperCase(),
    );
    expect(activeTag).toBe("BODY");
  });

  test("energies= URL param overrides the 100 default @regression", async ({ page }) => {
    await page.goto("/calculator?energies=250");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await expect(energyInput).toHaveValue("250");
  });
});
