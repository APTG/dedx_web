import { test, expect, type Page } from "@playwright/test";

/**
 * Mobile compound editor — 2-step sheet, picker overlay, row action sheet
 * (issue #647). These assertions only make sense on a phone-class viewport
 * (≤ 640px AND coarse pointer), so each test self-skips otherwise; under the
 * `mobile-chrome` Playwright project (Pixel 5) they run for real.
 */

async function isPhoneViewport(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia("(max-width: 640px) and (pointer: coarse)").matches);
}

async function openMobileEditor(page: Page) {
  await page.goto("/calculator");
  await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

  // Custom compounds live behind Advanced mode.
  const advancedBtn = page.getByRole("button", { name: "Switch to Advanced mode" });
  if (await advancedBtn.isVisible().catch(() => false)) {
    await advancedBtn.click();
  }

  // On mobile the picker panel starts collapsed behind a disclosure toggle.
  const toggle = page.getByTestId("picker-toggle");
  if (await toggle.isVisible().catch(() => false)) {
    if ((await toggle.getAttribute("aria-expanded")) === "false") {
      await toggle.click();
    }
  }

  await page.getByTestId("picker-tab-material").click();
  await page.getByTestId("picker-material-add-compound").click();

  await expect(page.getByTestId("compound-editor-mobile-sheet")).toBeVisible();
}

test.describe("Compound editor — mobile 2-step sheet @responsive", () => {
  test("renders the 2-step sheet and Next/Back preserve inputs @smoke", async ({ page }) => {
    test.skip(!(await isPhoneViewport(page)), "phone-only layout");
    await openMobileEditor(page);

    const stepHook = page.getByTestId("compound-editor-mobile-step");
    await expect(stepHook).toHaveAttribute("data-step", "1");

    // Fill Step 1 basics.
    await page.getByTestId("mobile-field-name").fill("Test Mix");
    await page.getByTestId("mobile-field-density").fill("2.5");

    // Advance to Step 2.
    await page.getByTestId("mobile-step1-next").click();
    await expect(stepHook).toHaveAttribute("data-step", "2");

    // Back is non-destructive.
    await page.getByTestId("mobile-step2-back").click();
    await expect(stepHook).toHaveAttribute("data-step", "1");
    await expect(page.getByTestId("mobile-field-name")).toHaveValue("Test Mix");
    await expect(page.getByTestId("mobile-field-density")).toHaveValue("2.5");
  });

  test("Add element opens the picker overlay and commits a selection", async ({ page }) => {
    test.skip(!(await isPhoneViewport(page)), "phone-only layout");
    await openMobileEditor(page);

    await page.getByTestId("mobile-step1-next").click();
    const stepHook = page.getByTestId("compound-editor-mobile-step");
    await expect(stepHook).toHaveAttribute("data-step", "2");

    await page.getByTestId("mobile-add-element").click();
    await expect(stepHook).toHaveAttribute("data-step", "picker");

    // Type to resolve, then commit.
    await page.getByTestId("mobile-picker-search").fill("Si");
    await expect(page.getByTestId("mobile-picker-helper")).toContainText("Silicon");
    await page.getByTestId("mobile-picker-commit").click();

    await expect(stepHook).toHaveAttribute("data-step", "2");
    // Silicon (Z=14) tile should now be present in the composition.
    await expect(page.getByTestId("picker-element-tile-14")).toBeVisible();
  });

  test("editing a row's element tile opens the picker in EDIT mode", async ({ page }) => {
    test.skip(!(await isPhoneViewport(page)), "phone-only layout");
    await openMobileEditor(page);

    await page.getByTestId("mobile-step1-next").click();

    // Default LiF — tap the Li tile, switch it to Si (Z=14).
    await page.getByTestId("picker-element-tile-3").click();
    const stepHook = page.getByTestId("compound-editor-mobile-step");
    await expect(stepHook).toHaveAttribute("data-step", "picker");
    await page.getByTestId("picker-grid-tile-14").click();
    await page.getByTestId("mobile-picker-commit").click();

    await expect(stepHook).toHaveAttribute("data-step", "2");
    await expect(page.getByTestId("picker-element-tile-14")).toBeVisible();
    await expect(page.getByTestId("picker-element-tile-3")).toHaveCount(0);
  });

  test("long-press a row opens the action sheet and removes it", async ({ page }) => {
    test.skip(!(await isPhoneViewport(page)), "phone-only layout");
    await openMobileEditor(page);

    await page.getByTestId("mobile-step1-next").click();

    const rows = page.getByTestId("mobile-row-actions");
    await expect(rows).toHaveCount(2);

    // Long-press the second row (Fluorine). The 400ms timer fires while held.
    const fluorineRow = page.getByTestId("picker-element-tile-9");
    await fluorineRow.dispatchEvent("pointerdown");
    await expect(page.getByTestId("compound-editor-row-action-sheet")).toBeVisible({
      timeout: 2000,
    });
    await fluorineRow.dispatchEvent("pointerup");


    await page.getByTestId("row-action-remove").click();
    await expect(page.getByTestId("mobile-row-actions")).toHaveCount(1);
  });
});
