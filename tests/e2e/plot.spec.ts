import { test, expect } from "@playwright/test";

test.describe("Plot page", () => {
  test("plot page loads", async ({ page }) => {
    await page.goto("/plot");
    await expect(page).toHaveURL(/\/plot/);
    await expect(page.getByRole("heading", { name: "Plot" })).toBeVisible();
  });

  test("navigates to plot page from calculator", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("link", { name: "Plot" }).click();
    await expect(page).toHaveURL(/\/plot/);
  });
});
