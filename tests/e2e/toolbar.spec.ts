import { test, expect } from "@playwright/test";

test.describe("App toolbar", () => {
  test("toolbar has Share URL button on calculator page", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("button", { name: /share url/i })).toBeVisible();
  });

  test("Export PDF and Export CSV buttons are visible on calculator page", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("navigation")).toBeVisible();
    const exportPdf = page.getByRole("button", { name: /export pdf/i });
    const exportCsv = page.getByRole("button", { name: /export csv/i });
    await expect(exportPdf).toBeVisible();
    await expect(exportCsv).toBeVisible();
  });

  test("Export PDF and Export CSV buttons are disabled on plot page (no calculator results)", async ({
    page,
  }) => {
    await page.goto("/plot");
    await expect(page.getByRole("navigation")).toBeVisible();
    const exportPdf = page.getByRole("button", { name: /export pdf/i });
    const exportCsv = page.getByRole("button", { name: /export csv/i });
    await expect(exportPdf).toBeVisible();
    await expect(exportPdf).toBeDisabled();
    await expect(exportCsv).toBeVisible();
    await expect(exportCsv).toBeDisabled();
  });

  test("toolbar hides Export PDF and Export CSV buttons on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/calculator");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("button", { name: /share url/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /export pdf/i })).toBeHidden();
    await expect(page.getByRole("button", { name: /export csv/i })).toBeHidden();
  });

  test("Share URL button shows Copied feedback on click", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/calculator");
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.getByRole("button", { name: /share url/i }).click();
    await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 2000 });
    const copiedText = await page.evaluate(() => navigator.clipboard.readText());
    await expect(copiedText).toBe(page.url());
  });

  test("toolbar is also present on plot page", async ({ page }) => {
    await page.goto("/plot");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("button", { name: /share url/i })).toBeVisible();
  });
});
