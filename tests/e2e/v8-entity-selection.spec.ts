import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the v8 entity-selection redesign (behind ?v8=1).
 * v7 remains the default render path, so the v7-targeted specs
 * (entity-selection.spec.ts, calculator.spec.ts, plot.spec.ts, etc.)
 * keep running unchanged and exercise the production path.
 *
 * See `docs/04-feature-specs/entity-selection.md § v8 (draft)`.
 */
test.describe("Calculator page — v8 picker (?v8=1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator?v8=1");
    await page.waitForSelector('[data-testid="v8-entity-selection"]', { timeout: 15000 });
  });

  test("renders the recipe bar with current selection", async ({ page }) => {
    const recipe = page.getByTestId("v8-recipe-bar");
    await expect(recipe).toBeVisible();
    await expect(recipe).toContainText("proton");
    await expect(recipe).toContainText("Water");
    await expect(recipe).toContainText(/Auto/);
  });

  test("renders three tabs and starts on the Particle tab", async ({ page }) => {
    await expect(page.getByTestId("v8-tab-particle")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("v8-tab-material")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("v8-tab-program")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("v8-particle-tab")).toBeVisible();
  });

  test("clicking a recipe-bar segment activates the matching tab", async ({ page }) => {
    await page.getByTestId("v8-recipe-program").click();
    await expect(page.getByTestId("v8-tab-program")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("v8-program-tab")).toBeVisible();
  });

  test("electron row is omitted from the particle list (spec §v8 Particle)", async ({ page }) => {
    await expect(page.getByTestId("v8-particle-item-1001")).toHaveCount(0);
  });

  test("particle search filters the list and a click selects + auto-advances", async ({ page }) => {
    const search = page.getByTestId("v8-particle-search");
    await search.fill("alpha");
    const alpha = page.getByTestId("v8-particle-item-2");
    await expect(alpha).toBeVisible();
    await alpha.click();

    // Recipe bar updates.
    await expect(page.getByTestId("v8-recipe-bar")).toContainText("alpha particle");
    // Water is already set → auto-advance lands on Program.
    await expect(page.getByTestId("v8-tab-program")).toHaveAttribute("aria-selected", "true");
  });

  test("program tab shows the Auto-select hero card and a TAB/FN/EXT legend", async ({ page }) => {
    await page.getByTestId("v8-tab-program").click();
    await expect(page.getByTestId("v8-program-auto-hero")).toBeVisible();
    await expect(page.getByTestId("v8-program-legend")).toBeVisible();
  });

  test("recipe-bar reset restores defaults and activates the Particle tab", async ({ page }) => {
    // First mutate the selection.
    await page.getByTestId("v8-particle-search").fill("alpha");
    await page.getByTestId("v8-particle-item-2").click();
    await expect(page.getByTestId("v8-recipe-bar")).toContainText("alpha particle");

    await page.getByTestId("v8-recipe-reset").click();

    await expect(page.getByTestId("v8-recipe-bar")).toContainText("proton");
    await expect(page.getByTestId("v8-recipe-bar")).toContainText("Water");
    await expect(page.getByTestId("v8-tab-particle")).toHaveAttribute("aria-selected", "true");
  });

  test("compatibility overlay link is hidden in Basic mode (PR #2 wiring deferred)", async ({
    page,
  }) => {
    await expect(page.getByTestId("v8-recipe-compat")).toHaveCount(0);
  });
});

test.describe("Plot page — v8 picker (?v8=1)", () => {
  test("renders v8 picker above the series-list area", async ({ page }) => {
    await page.goto("/plot?v8=1");
    await page.waitForSelector('[data-testid="v8-entity-selection"]', { timeout: 15000 });
    await expect(page.getByTestId("v8-recipe-bar")).toBeVisible();
  });
});

test.describe("v7 stays the default render path (no flag)", () => {
  test("/calculator without ?v8=1 still renders the v7 comboboxes", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
    await expect(page.getByTestId("v8-entity-selection")).toHaveCount(0);
  });
});
