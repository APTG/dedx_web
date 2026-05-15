import { test, expect } from "@playwright/test";

test.describe("Calculator page — entity selection (v8 picker)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Wait for WASM to load and v8 picker to appear
    await page.waitForSelector('[data-testid="v8-entity-selection"]', { timeout: 15000 });
  });

  test("recipe bar shows proton, Water, Auto by default", async ({ page }) => {
    const recipe = page.getByTestId("v8-recipe-bar");
    await expect(recipe).toContainText(/proton/i);
    await expect(recipe).toContainText(/water/i);
    await expect(recipe).toContainText(/auto/i);
  });

  test("typing carbon in the particle search filters the list and shows Carbon (C, Z=6)", async ({
    page,
  }) => {
    await page.getByTestId("v8-tab-particle").click();
    const search = page.getByTestId("v8-particle-search");
    await search.fill("carbon");

    await expect(page.getByTestId("v8-particle-item-6")).toBeVisible();
    await expect(page.getByTestId("v8-particle-item-6")).toContainText("Carbon (C, Z=6)");
  });

  test("selecting Carbon removes incompatible programs (PSTAR proton-only disappears)", async ({
    page,
  }) => {
    // Open particle tab and select Carbon
    await page.getByTestId("v8-tab-particle").click();
    await page.getByTestId("v8-particle-search").fill("carbon");
    await page.getByTestId("v8-particle-item-6").click();

    // Open program tab
    await page.getByTestId("v8-tab-program").click();

    // PSTAR (proton-only in libdedx) should not appear for carbon
    await expect(page.getByTestId("v8-program-item-2")).toHaveCount(0);
  });

  test("recipe-bar reset restores defaults", async ({ page }) => {
    // Change particle to Carbon
    await page.getByTestId("v8-tab-particle").click();
    await page.getByTestId("v8-particle-search").fill("carbon");
    await page.getByTestId("v8-particle-item-6").click();

    await expect(page.getByTestId("v8-recipe-bar")).toContainText(/carbon/i);

    await page.getByTestId("v8-recipe-reset").click();

    await expect(page.getByTestId("v8-recipe-bar")).toContainText(/proton/i);
    await expect(page.getByTestId("v8-recipe-bar")).toContainText(/water/i);
  });

  test("Electron (ESTAR) is absent from the particle list (not yet implemented)", async ({
    page,
  }) => {
    await page.getByTestId("v8-tab-particle").click();
    await expect(page.getByTestId("v8-particle-item-1001")).toHaveCount(0);
    const search = page.getByTestId("v8-particle-search");
    await search.fill("electron");
    await expect(page.locator('[data-testid^="v8-particle-item-"]')).toHaveCount(0);
  });

  test("DEDX_ICRU internal selector (ID 9) does not appear in the program tab", async ({
    page,
  }) => {
    await page.getByTestId("v8-tab-program").click();
    // ICRU (ID 9) is excluded via EXCLUDED_FROM_UI set.
    await expect(page.getByTestId("v8-program-item-9")).toHaveCount(0);
  });
});
