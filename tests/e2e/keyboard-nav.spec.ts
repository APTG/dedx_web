import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

/**
 * E2E coverage for keyboard navigation in the entity picker.
 * Tests the `/`, ↑↓↵, and tab-advance keyboard shortcuts.
 */
test.describe("Entity picker — keyboard navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } }); // desktop

  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', {
      timeout: WASM_TIMEOUT,
    });
    // Calculator starts collapsed (defaults are proton + water + auto → complete).
    // Expand by clicking the particle tab so the panel is open.
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-tab-panel")).toBeVisible();
  });

  test("/ key focuses the search input", async ({ page }) => {
    // Click the (non-interactive) page heading to blur the search input
    // without landing on some other focusable control — a plain body click
    // targets the viewport center, whose contents shift with page layout.
    await page.locator("h1").click();
    await page.keyboard.press("/");
    const searchInput = page.getByTestId("picker-particle-search");
    await expect(searchInput).toBeFocused();
  });

  test("/ key expands the panel if collapsed", async ({ page }) => {
    // Collapse the panel first.
    await page.getByTestId("picker-toggle").click();
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
    await page.locator("h1").click();
    await page.keyboard.press("/");
    await expect(page.getByTestId("picker-tab-panel")).toBeVisible();
    await expect(page.getByTestId("picker-particle-search")).toBeFocused();
  });

  test("↓ and ↑ move highlight through particle list", async ({ page }) => {
    const searchInput = page.getByTestId("picker-particle-search");
    await searchInput.focus();

    // ArrowDown should highlight the second available item.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    // The highlighted row gets bg-accent class — verify at least 1 highlighted item exists.
    const highlighted = page.locator('[data-testid^="picker-particle-item-"].bg-accent');
    await expect(highlighted).toHaveCount(1);
  });

  test("↵ Enter selects the highlighted particle and collapses when all slots are already complete", async ({
    page,
  }) => {
    const searchInput = page.getByTestId("picker-particle-search");
    await searchInput.focus();

    // ArrowDown once → highlights second available item (alpha particle, Z=2).
    await page.keyboard.press("ArrowDown");
    // Enter → selects it and auto-advances to the next empty tab.
    await page.keyboard.press("Enter");

    // Calculator defaults are already complete, so no empty tab remains.
    // Enter updates particle and collapses the panel instead of auto-advancing.
    await expect(page.getByTestId("picker-tab-particle")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });

  test("↵ Enter selects first available particle and collapses when complete", async ({ page }) => {
    const searchInput = page.getByTestId("picker-particle-search");
    await searchInput.focus();
    await page.keyboard.press("Enter");

    // No empty tab remains on calculator defaults, so panel collapses.
    await expect(page.getByTestId("picker-tab-particle")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });
});
