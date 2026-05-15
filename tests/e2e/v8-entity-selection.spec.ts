import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the v8 entity-selection redesign (now the default render path).
 * The old v7 comboboxes/panels are no longer rendered.
 *
 * See `docs/04-feature-specs/entity-selection.md § v8`.
 */
test.describe("Calculator page — v8 picker", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="v8-entity-selection"]', { timeout: 15000 });
  });

  test("renders the recipe bar with current selection", async ({ page }) => {
    const recipe = page.getByTestId("v8-recipe-bar");
    await expect(recipe).toBeVisible();
    await expect(recipe).toContainText("proton");
    await expect(recipe).toContainText("Water");
    await expect(recipe).toContainText(/Auto/);
  });

  test("renders three tabs and starts collapsed (defaults complete)", async ({ page }) => {
    await expect(page.getByTestId("v8-tab-particle")).toBeVisible();
    await expect(page.getByTestId("v8-tab-material")).toBeVisible();
    await expect(page.getByTestId("v8-tab-program")).toBeVisible();
    // Panel should be collapsed since defaults are already complete
    await expect(page.getByTestId("v8-tab-panel")).toHaveCount(0);
  });

  test("clicking a tab expands the panel", async ({ page }) => {
    await page.getByTestId("v8-tab-particle").click();
    await expect(page.getByTestId("v8-particle-tab")).toBeVisible();
  });

  test("clicking a recipe-bar segment activates the matching tab and opens panel", async ({
    page,
  }) => {
    await page.getByTestId("v8-recipe-program").click();
    await expect(page.getByTestId("v8-tab-program")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("v8-program-tab")).toBeVisible();
  });

  test("electron row is omitted from the particle list (spec §v8 Particle)", async ({ page }) => {
    await page.getByTestId("v8-tab-particle").click();
    await expect(page.getByTestId("v8-particle-item-1001")).toHaveCount(0);
  });

  test("particle list shows Z inline in name (no separate Z column)", async ({ page }) => {
    await page.getByTestId("v8-tab-particle").click();
    await expect(page.getByTestId("v8-particle-item-1")).toContainText("proton (Z=1)");
  });

  test("particle search filters the list and a click selects + auto-advances", async ({ page }) => {
    await page.getByTestId("v8-tab-particle").click();
    const search = page.getByTestId("v8-particle-search");
    await search.fill("alpha");
    const alpha = page.getByTestId("v8-particle-item-2");
    await expect(alpha).toBeVisible();
    await alpha.click();

    // Recipe bar updates.
    await expect(page.getByTestId("v8-recipe-bar")).toContainText("alpha particle");
    // Water is already set → auto-advance lands on Program → still complete → panel collapses
    await expect(page.getByTestId("v8-tab-panel")).toHaveCount(0);
  });

  test("material tab shows split columns and program tab legend is visible", async ({ page }) => {
    await page.getByTestId("v8-tab-material").click();
    await expect(page.getByTestId("v8-material-col-elements")).toBeVisible();
    await expect(page.getByTestId("v8-material-col-compounds")).toBeVisible();

    await page.getByTestId("v8-tab-program").click();
    await expect(page.getByTestId("v8-program-auto-hero")).toBeVisible();
    await expect(page.getByTestId("v8-program-legend")).toBeVisible();
  });

  test("recipe-bar reset restores defaults and collapses the panel", async ({ page }) => {
    // Open panel first by clicking a tab.
    await page.getByTestId("v8-tab-particle").click();
    await page.getByTestId("v8-particle-search").fill("alpha");
    await page.getByTestId("v8-particle-item-2").click();

    await page.getByTestId("v8-recipe-reset").click();

    await expect(page.getByTestId("v8-recipe-bar")).toContainText("proton");
    await expect(page.getByTestId("v8-recipe-bar")).toContainText("Water");
    // After reset defaults are complete → panel should be closed
    await expect(page.getByTestId("v8-tab-panel")).toHaveCount(0);
  });

  test("compatibility overlay link is hidden in Basic mode (PR #2 wiring deferred)", async ({
    page,
  }) => {
    await expect(page.getByTestId("v8-recipe-compat")).toHaveCount(0);
  });
});

test.describe("Plot page — v8 picker", () => {
  test("renders v8 picker above the series-list area (always expanded)", async ({ page }) => {
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="v8-entity-selection"]', { timeout: 15000 });
    await expect(page.getByTestId("v8-recipe-bar")).toBeVisible();
    // Plot page is NOT collapsible — panel should always be visible
    await expect(page.getByTestId("v8-tab-panel")).toBeVisible();
  });
});
