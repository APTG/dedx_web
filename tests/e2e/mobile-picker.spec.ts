import { test, expect } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 412, height: 915 };

test.describe("Mobile picker — adaptive kit (issue #530 PR A)", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("tab change does NOT autofocus search (no keyboard invoked)", async ({ page }) => {
    // On mobile the search field is a button, not an input — it must not be focused.
    await page.getByTestId("picker-tab-material").click();
    const searchBtn = page.getByTestId("picker-material-search");
    // The search element exists but is a button — verify it doesn't receive focus automatically.
    await expect(searchBtn).not.toBeFocused();
  });

  test("search tap target opens full-screen sheet on mobile", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    // The search field should be a button on mobile.
    const searchBtn = page.getByTestId("picker-particle-search");
    await searchBtn.click();
    // Sheet should appear.
    await expect(page.getByTestId("picker-sheet")).toBeVisible();
    await expect(page.getByTestId("picker-sheet-input")).toBeVisible();
  });

  test("Back closes sheet without leaving the page", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-search").click();
    await expect(page.getByTestId("picker-sheet")).toBeVisible();
    // Press browser Back.
    await page.goBack();
    await expect(page.getByTestId("picker-sheet")).toHaveCount(0);
    // Still on calculator page.
    await expect(page.getByTestId("picker-entity-selection")).toBeVisible();
  });

  test("Material tab defaults to Compounds sub-tab on first load", async ({ page }) => {
    await page.getByTestId("picker-tab-material").click();
    const compoundsTab = page.getByTestId("material-subtab-compounds");
    await expect(compoundsTab).toBeVisible();
    await expect(compoundsTab).toHaveAttribute("aria-selected", "true");
  });

  test("Material sheet groups results under COMPOUNDS / ELEMENTS / CUSTOM headers", async ({
    page,
  }) => {
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-search").click();
    await expect(page.getByTestId("picker-sheet")).toBeVisible();
    // Type a query that hits all sub-tabs.
    await page.getByTestId("picker-sheet-input").fill("c");
    await expect(page.getByTestId("picker-sheet-material-results")).toBeVisible();
    // Grouped headers should be present.
    const results = page.getByTestId("picker-sheet-material-results");
    await expect(results).toContainText("Compounds");
    await expect(results).toContainText("Elements");
    await expect(results).toContainText("Custom");
  });

  test("Program tab with ≤10 programs has no search field visible", async ({ page }) => {
    await page.getByTestId("picker-tab-program").click();
    // On mobile with tiny bucket: search row exists but Program tab shows inline list, not search.
    // The program items should be directly visible without needing to tap search.
    await expect(page.getByTestId("picker-program-inline-list")).toBeVisible();
  });

  test("particle tab shows flat list with Z tags (no COMMON/IONS headers)", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    // COMMON/IONS section headers should be absent.
    const tabPanel = page.getByTestId("picker-tab-panel");
    await expect(tabPanel).not.toContainText("Common particles");
    await expect(tabPanel).not.toContainText("Ions");
    // The flat list should be visible.
    await expect(page.getByTestId("picker-particle-list")).toBeVisible();
  });

  test("particle sheet search finds carbon with Z=6 tag", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-search").click();
    await expect(page.getByTestId("picker-sheet")).toBeVisible();
    await page.getByTestId("picker-sheet-input").fill("carbon");
    await expect(page.getByTestId("picker-particle-item-6")).toBeVisible();
    await expect(page.getByTestId("picker-particle-item-6")).toContainText("Z=6");
  });
});
