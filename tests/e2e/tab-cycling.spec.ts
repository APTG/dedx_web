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

// ── Global ArrowLeft/ArrowRight handler (entity-selection.svelte) ─────────────
//
// The global handler fires when the picker panel is open AND focus is on
// document.body (cold-load path) or anywhere inside the picker that is not a
// text input or a tab button.  Tab buttons own the key via their own onkeydown
// handler, and text inputs must NOT trigger a tab switch.

test.describe("Entity picker — global ArrowLeft/ArrowRight tab switching", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', {
      timeout: WASM_TIMEOUT,
    });
    // Open the panel so the global handler is active.
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-tab-panel")).toBeVisible();
  });

  test("ArrowRight cycles to Material tab when document.body has focus", async ({ page }) => {
    // Click outside the picker so focus falls to body.
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("picker-tab-material")).toHaveAttribute("aria-selected", "true");
  });

  test("ArrowLeft cycles to Program tab (wrap-around) when document.body has focus", async ({
    page,
  }) => {
    // Particle is currently active. ArrowLeft should wrap to Program.
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("ArrowLeft");

    await expect(page.getByTestId("picker-tab-program")).toHaveAttribute("aria-selected", "true");
  });

  test("ArrowRight is ignored when focus is inside the search input", async ({ page }) => {
    // Focus the particle search input (it is an HTMLInputElement — should be skipped).
    const search = page.getByTestId("picker-particle-search");
    await search.focus();

    // ArrowRight should NOT switch tabs while typing in the search box.
    await page.keyboard.press("ArrowRight");

    // Particle tab must still be active.
    await expect(page.getByTestId("picker-tab-particle")).toHaveAttribute("aria-selected", "true");
  });

  test("ArrowRight is ignored when focus is on a tab button (no double-firing)", async ({
    page,
  }) => {
    // The tab-bar onkeydown already handles this; the global handler must not
    // fire a second time.  Focusing the particle tab button and pressing
    // ArrowRight should move focus to the Material tab exactly once.
    await page.getByTestId("picker-tab-particle").focus();
    await page.keyboard.press("ArrowRight");

    // The Material tab should be active and focused exactly once, not looped.
    await expect(page.getByTestId("picker-tab-material")).toHaveAttribute("aria-selected", "true");
    // Only one tab may have aria-selected=true.
    await expect(page.locator('[data-testid^="picker-tab-"][aria-selected="true"]')).toHaveCount(1);
  });
});
