import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

/**
 * Keyboard cycling between Particle / Material / Program tabs using
 * ArrowLeft / ArrowRight when a tab button is focused.
 *
 * Tagged @firefox so the firefox Playwright project picks these up in addition
 * to the default chromium run.
 *
 * See: entity-selection/tab-bar.svelte — handleKeyDown
 */
test.describe("Tab bar — ArrowLeft / ArrowRight cycling @firefox", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', {
      timeout: WASM_TIMEOUT,
    });
  });

  // ── forward (→) ───────────────────────────────────────────────────────────

  test("ArrowRight on Particle tab activates Material tab and opens its panel", async ({
    page,
  }) => {
    await page.getByTestId("picker-tab-particle").focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("picker-tab-material")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-material-tab")).toBeVisible();
  });

  test("ArrowRight on Material tab activates Program tab and opens its panel", async ({ page }) => {
    await page.getByTestId("picker-tab-material").focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("picker-tab-program")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-program-tab")).toBeVisible();
  });

  test("ArrowRight on Program tab wraps to Particle tab", async ({ page }) => {
    await page.getByTestId("picker-tab-program").focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("picker-tab-particle")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-particle-tab")).toBeVisible();
  });

  // ── backward (←) ──────────────────────────────────────────────────────────

  test("ArrowLeft on Material tab activates Particle tab", async ({ page }) => {
    await page.getByTestId("picker-tab-material").focus();
    await page.keyboard.press("ArrowLeft");

    await expect(page.getByTestId("picker-tab-particle")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-particle-tab")).toBeVisible();
  });

  test("ArrowLeft on Particle tab wraps to Program tab", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").focus();
    await page.keyboard.press("ArrowLeft");

    await expect(page.getByTestId("picker-tab-program")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-program-tab")).toBeVisible();
  });

  // ── real-world flow ────────────────────────────────────────────────────────

  test("after selecting a particle, ArrowRight from Particle tab opens Material panel", async ({
    page,
  }) => {
    // Select alpha particle — all defaults then complete, panel collapses.
    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-search").fill("alpha");
    await page.getByTestId("picker-particle-item-2").click();
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);

    // Navigate to Material via keyboard from the collapsed state.
    await page.getByTestId("picker-tab-particle").focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("picker-tab-material")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-material-tab")).toBeVisible();
  });

  test("full forward cycle returns to the starting tab", async ({ page }) => {
    // After each ArrowRight the search input gets auto-focused (activateTab opens the panel
    // and the entity-selection effect moves focus there). Re-focus the next tab button
    // each step, mirroring real keyboard usage where the user tabs back to the bar.
    await page.getByTestId("picker-tab-particle").focus();
    await page.keyboard.press("ArrowRight"); // Particle → Material

    await page.getByTestId("picker-tab-material").focus();
    await page.keyboard.press("ArrowRight"); // Material → Program

    await page.getByTestId("picker-tab-program").focus();
    await page.keyboard.press("ArrowRight"); // Program → Particle (wrap)

    await expect(page.getByTestId("picker-tab-particle")).toHaveAttribute("aria-selected", "true");
  });
});
