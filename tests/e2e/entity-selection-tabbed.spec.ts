import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the picker entity-selection redesign (now the default render path).
 * The old v7 comboboxes/panels are no longer rendered.
 *
 * See `docs/04-feature-specs/entity-selection.md`.
 */
test.describe("Calculator page — tabbed picker", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("tab bar renders proton/Water/Auto inline; recipe bar removed", async ({ page }) => {
    // Recipe bar removed in the entity-selector rework.
    await expect(page.getByTestId("picker-recipe-bar")).toHaveCount(0);
    await expect(page.getByTestId("picker-tab-particle")).toContainText("proton");
    await expect(page.getByTestId("picker-tab-material")).toContainText("Water");
    await expect(page.getByTestId("picker-tab-program")).toContainText(/Auto/);
  });

  test("renders three tabs and starts collapsed (defaults complete)", async ({ page }) => {
    await expect(page.getByTestId("picker-tab-particle")).toBeVisible();
    await expect(page.getByTestId("picker-tab-material")).toBeVisible();
    await expect(page.getByTestId("picker-tab-program")).toBeVisible();
    // Panel should be collapsed since defaults are already complete
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });

  test("clicking a tab expands the panel", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-particle-tab")).toBeVisible();
  });

  test("clicking a tab activates the matching tab and opens panel", async ({ page }) => {
    await page.getByTestId("picker-tab-program").click();
    await expect(page.getByTestId("picker-tab-program")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-program-tab")).toBeVisible();
  });

  test("electron row is omitted from the particle list (spec § Particle)", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-particle-item-1001")).toHaveCount(0);
  });

  test("particle list shows Z inline in name (no separate Z column)", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-particle-item-1")).toContainText("proton (Z=1)");
  });

  test("particle search filters the list and a click selects + stays on tab", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    const search = page.getByTestId("picker-particle-search");
    await search.fill("alpha");
    const alpha = page.getByTestId("picker-particle-item-2");
    await expect(alpha).toBeVisible();
    await alpha.click();

    // Tab bar updates inline.
    await expect(page.getByTestId("picker-tab-particle")).toContainText("alpha particle");
    // Water is already set + Program auto-resolves → all tabs non-empty → panel collapses on Calculator.
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });

  test("material tab shows split columns and program tab legend is visible", async ({ page }) => {
    await page.getByTestId("picker-tab-material").click();
    await expect(page.getByTestId("picker-material-col-elements")).toBeVisible();
    await expect(page.getByTestId("picker-material-col-compounds")).toBeVisible();

    await page.getByTestId("picker-tab-program").click();
    await expect(page.getByTestId("picker-program-auto-hero")).toBeVisible();
    await expect(page.getByTestId("picker-program-legend")).toBeVisible();
  });

  test("reset (advanced toolbar) restores defaults and collapses the panel", async ({ page }) => {
    // Reset is in the Advanced toolbar — switch on Advanced via URL.
    await page.goto("/calculator?mode=advanced");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    // Open panel first by clicking a tab.
    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-search").fill("alpha");
    await page.getByTestId("picker-particle-item-2").click();

    await page.getByTestId("picker-reset").click();

    await expect(page.getByTestId("picker-tab-particle")).toContainText("proton");
    await expect(page.getByTestId("picker-tab-material")).toContainText("Water");
    // After reset defaults are complete → panel should be closed
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });

  test("compatibility overlay link is hidden in Basic mode (advanced toolbar gated)", async ({
    page,
  }) => {
    await expect(page.getByTestId("picker-advanced-toolbar")).toHaveCount(0);
    await expect(page.getByTestId("picker-explore-compat")).toHaveCount(0);
  });
});

test.describe("Plot page — tabbed picker", () => {
  test("renders tabbed picker above the series-list area (always expanded)", async ({ page }) => {
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
    await expect(page.getByTestId("picker-tab-bar")).toBeVisible();
    // Plot page is NOT collapsible — panel should always be visible
    await expect(page.getByTestId("picker-tab-panel")).toBeVisible();
  });
});
