import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the periodic-grid scan view in the particle tab.
 *
 * Spec: docs/04-feature-specs/entity-selection.md § Particle
 * Issue: #599
 */
test.describe("Particle tab — periodic-grid scan view", () => {
  test.describe("Basic mode", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/calculator");
      await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
      await page.getByTestId("picker-tab-particle").click();
    });

    test("view toggle is not rendered in Basic mode", async ({ page }) => {
      await expect(page.getByTestId("picker-particle-view-toggle")).toHaveCount(0);
      // List is the only rendering.
      await expect(page.getByTestId("picker-particle-list")).toBeVisible();
      await expect(page.getByTestId("picker-particle-grid")).toHaveCount(0);
    });
  });

  test.describe("Advanced mode (desktop)", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/calculator?mode=advanced");
      await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
      await page.getByTestId("picker-tab-particle").click();
    });

    test("view toggle is rendered with two buttons", async ({ page }) => {
      const toggle = page.getByTestId("picker-particle-view-toggle");
      await expect(toggle).toBeVisible();
      await expect(page.getByTestId("picker-particle-view-list")).toBeVisible();
      await expect(page.getByTestId("picker-particle-view-grid")).toBeVisible();
      // List is the default.
      await expect(page.getByTestId("picker-particle-view-list")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByTestId("picker-particle-view-grid")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(page.getByTestId("picker-particle-list")).toBeVisible();
      await expect(page.getByTestId("picker-particle-grid")).toHaveCount(0);
    });

    test("clicking grid toggle switches to grid view", async ({ page }) => {
      await page.getByTestId("picker-particle-view-grid").click();
      await expect(page.getByTestId("picker-particle-view-grid")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      // Grid replaces list.
      await expect(page.getByTestId("picker-particle-grid")).toBeVisible();
      await expect(page.getByTestId("picker-particle-list")).toHaveCount(0);
      // Container exposes view mode for downstream assertions.
      await expect(page.getByTestId("picker-particle-tab")).toHaveAttribute("data-view", "grid");
    });

    test("grid shows tiles with Symbol (bold) + Z (muted) and omits electron", async ({ page }) => {
      await page.getByTestId("picker-particle-view-grid").click();

      // Proton tile (id 1) shows H + Z=1.
      const proton = page.getByTestId("picker-particle-tile-1");
      await expect(proton).toBeVisible();
      await expect(proton).toContainText("H");
      await expect(proton).toContainText("1");

      // Carbon (Z=6) shows C.
      const carbon = page.getByTestId("picker-particle-tile-6");
      await expect(carbon).toBeVisible();
      await expect(carbon).toContainText("C");

      // Electron (id 1001) is omitted.
      await expect(page.getByTestId("picker-particle-tile-1001")).toHaveCount(0);
    });

    test("clicking an available tile selects the particle and updates the tab label", async ({
      page,
    }) => {
      await page.getByTestId("picker-particle-view-grid").click();
      // Pick alpha (id 2 → He).
      await page.getByTestId("picker-particle-tile-2").click();
      await expect(page.getByTestId("picker-tab-particle")).toContainText("alpha particle");
    });

    test("unavailable tiles are disabled and rendered at reduced opacity", async ({ page }) => {
      // Switch to ICRU 49 (program=7), which restricts compatibility enough
      // to reliably produce unavailable tiles in the particle grid.
      await page.goto("/calculator?mode=advanced&program=7");
      await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
      await page.getByTestId("picker-tab-particle").click();
      await page.getByTestId("picker-particle-view-grid").click();

      const grid = page.getByTestId("picker-particle-grid");
      const unavailable = grid.locator('[data-available="0"]').first();
      const available = grid.locator('[data-available="1"]').first();

      const unavailableCount = await grid.locator('[data-available="0"]').count();
      expect(unavailableCount).toBeGreaterThan(0);
      await expect(available).toBeEnabled();
      await expect(unavailable).toBeDisabled();
      await expect(unavailable).toHaveClass(/opacity-40/);
    });

    test("selected particle tile gets the orange selection ring", async ({ page }) => {
      await page.getByTestId("picker-particle-view-grid").click();
      // Default particle is proton — tile 1 should be aria-selected.
      const proton = page.getByTestId("picker-particle-tile-1");
      await expect(proton).toHaveAttribute("aria-selected", "true");
      // Click alpha → it becomes selected, proton no longer.
      await page.getByTestId("picker-particle-tile-2").click();

      // The calculator page auto-collapses the tab panel when the selection is complete.
      // Re-open it to check the tile.
      await page.getByTestId("picker-tab-particle").click();
      await page.getByTestId("picker-particle-view-grid").click();

      await expect(page.getByTestId("picker-particle-tile-2")).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    test("toggling back to list view restores the list", async ({ page }) => {
      await page.getByTestId("picker-particle-view-grid").click();
      await expect(page.getByTestId("picker-particle-grid")).toBeVisible();
      await page.getByTestId("picker-particle-view-list").click();
      await expect(page.getByTestId("picker-particle-list")).toBeVisible();
      await expect(page.getByTestId("picker-particle-grid")).toHaveCount(0);
    });

    test("search query filters tiles in grid view", async ({ page }) => {
      await page.getByTestId("picker-particle-view-grid").click();
      await page.getByTestId("picker-particle-search").fill("carbon");
      // Carbon tile present; an unrelated tile (proton) hidden by filter.
      await expect(page.getByTestId("picker-particle-tile-6")).toBeVisible();
      await expect(page.getByTestId("picker-particle-tile-1")).toHaveCount(0);
    });
  });

  test.describe("Advanced mode (mobile)", () => {
    test.use({ viewport: { width: 412, height: 915 } });

    test.beforeEach(async ({ page }) => {
      await page.goto("/calculator?mode=advanced");
      await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
      await page.getByTestId("picker-tab-particle").click();
    });

    test("grid keeps mobile tap targets >=44px and avoids horizontal overflow", async ({
      page,
    }) => {
      await page.getByTestId("picker-particle-view-grid").click();
      const grid = page.getByTestId("picker-particle-grid");
      await expect(grid).toBeVisible();

      const protonTile = page.getByTestId("picker-particle-tile-1");
      const box = await protonTile.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);

      await expect
        .poll(async () => {
          return await grid.evaluate((el) => el.scrollWidth - el.clientWidth);
        })
        .toBeLessThanOrEqual(1);
    });

    test("grid is selectable on mobile (tap → selection persists in tab label)", async ({
      page,
    }) => {
      await page.getByTestId("picker-particle-view-grid").click();
      // Tap alpha tile.
      await page.getByTestId("picker-particle-tile-2").click();
      await expect(page.getByTestId("picker-tab-particle")).toContainText("alpha particle");
    });
  });
});
