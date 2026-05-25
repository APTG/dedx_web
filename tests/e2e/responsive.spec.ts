import { test, expect, type Page } from "@playwright/test";

// Stage 7.3 — Mobile responsive polish
// These tests run on all projects but the assertions are most relevant for
// the mobile-chrome (Pixel 5) and tablet (iPad Air) Playwright projects.

async function expectNoHorizontalOverflow(page: Page, message: string) {
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      {
        message,
        timeout: 10000,
      },
    )
    .toBe(false);
}

test.describe("Responsive layout — Calculator @smoke", () => {
  test("no horizontal overflow on calculator page @responsive", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 30000 });

    await expectNoHorizontalOverflow(page, "page body must not overflow horizontally");
  });

  test("entity tabs are visible without horizontal overflow on narrow viewport @responsive", async ({
    page,
  }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 30000 });

    const particleTab = page.locator('[data-testid="picker-tab-particle"]');
    const materialTab = page.locator('[data-testid="picker-tab-material"]');
    await expect(particleTab).toBeVisible();
    await expect(materialTab).toBeVisible();

    await expectNoHorizontalOverflow(page, "picker entity tabs must not overflow horizontally");
  });
});

test.describe("Responsive layout — Plot @smoke", () => {
  test("no horizontal overflow on plot page @responsive", async ({ page }) => {
    await page.goto("/plot");
    await expect(page.getByRole("heading", { name: "Plot" })).toBeVisible();

    await expectNoHorizontalOverflow(page, "plot page must not overflow horizontally");
  });

  test("entity panels collapsed by default on mobile viewport @responsive", async ({ page }) => {
    test.setTimeout(30000);
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 25000 }).catch(() => {});

    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 600) {
      // Not a mobile viewport — skip this assertion
      test.skip();
      return;
    }

    // Mobile: picker toggle is visible and panel starts collapsed.
    const disclosureBtn = page.getByTestId("picker-toggle");
    await expect(disclosureBtn).toBeVisible();
    await expect(disclosureBtn).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);

    // Expand panels
    await disclosureBtn.click();
    await expect(disclosureBtn).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("picker-tab-panel")).toBeVisible();
  });

  test("entity panels always visible on desktop viewport @responsive", async ({ page }) => {
    test.setTimeout(30000);
    await page.goto("/plot");

    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 600) {
      test.skip();
      return;
    }

    // Desktop: picker is expanded and the old "Select Entities" disclosure is absent.
    await expect(page.getByTestId("picker-tab-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: /Select Entities/i })).toHaveCount(0);
  });
});

test.describe("Responsive layout — touch targets @responsive", () => {
  test("interactive controls meet minimum touch target size on mobile", async ({ page }) => {
    test.setTimeout(30000);
    await page.goto("/plot");
    await expect(page.getByRole("heading", { name: "Plot" })).toBeVisible();

    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 900) {
      test.skip();
      return;
    }

    // All radio-pill labels (stp unit, axis scale) must be ≥ 44px tall
    const radioLabels = page.locator('[role="radiogroup"] label');
    const count = await radioLabels.count();
    for (let i = 0; i < count; i++) {
      const box = await radioLabels.nth(i).boundingBox();
      if (box) {
        expect(box.height, `radio label ${i} height`).toBeGreaterThanOrEqual(43); // 1px tolerance
      }
    }
  });
});
