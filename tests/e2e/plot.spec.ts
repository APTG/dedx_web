import { test, expect } from "@playwright/test";

test.describe("Plot page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plot");
  });

  test("has entity selection panels in sidebar", async ({ page }) => {
    await expect(page.getByRole("list", { name: /particle/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("list", { name: /material/i })).toBeVisible({ timeout: 10000 });
  });

  test("has Add Series button", async ({ page }) => {
    const btn = page.getByRole("button", { name: /add series/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

  test("has stopping power unit controls", async ({ page }) => {
    await expect(page.getByRole("radio", { name: /keV/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("radio", { name: /MeV\/cm/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("radio", { name: /MeV·cm/i })).toBeVisible({ timeout: 10000 });
  });

  test("has axis scale controls (default Log/Log)", async ({ page }) => {
    await expect(page.getByRole("radio", { name: /x.*log/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("radio", { name: /y.*log/i })).toBeVisible({ timeout: 10000 });
  });

  test("shows plot canvas with role=img", async ({ page }) => {
    await expect(page.getByRole("img", { name: /stopping power/i })).toBeVisible({ timeout: 15000 });
  });
});
