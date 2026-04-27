import { test, expect } from "@playwright/test";

test.describe("Nav link clicks", () => {
  test("clicking Plot nav link navigates to /plot", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("link", { name: "Plot" }).click();
    // Plot page writes canonical URL params (stp_unit/xscale/yscale) on mount,
    // so allow an optional query string after `/plot`.
    await expect(page).toHaveURL(/\/plot(\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: "Plot" })).toBeVisible();
  });

  test("clicking Docs nav link navigates to /docs", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("link", { name: "Docs" }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole("heading", { level: 1, name: "Documentation" })).toBeVisible();
  });

  test("clicking Calculator nav link navigates to /calculator", async ({ page }) => {
    await page.goto("/plot");
    await page.getByRole("link", { name: "Calculator" }).click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.getByRole("heading", { level: 1, name: "Calculator" })).toBeVisible();
  });

  test("clicking webdedx brand logo redirects to /calculator", async ({ page }) => {
    await page.goto("/plot");
    await page.getByRole("link", { name: /webdedx/i }).click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.getByRole("heading", { level: 1, name: "Calculator" })).toBeVisible();
  });
});

test.describe("Docs sub-routes", () => {
  test("/docs/user-guide loads without error", async ({ page }) => {
    const response = await page.goto("/docs/user-guide");
    expect(response).not.toBeNull();
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "User Guide" })).toBeVisible();
  });

  test("/docs/technical loads without error", async ({ page }) => {
    const response = await page.goto("/docs/technical");
    expect(response).not.toBeNull();
    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { level: 1, name: "Technical Reference" }),
    ).toBeVisible();
  });
});
