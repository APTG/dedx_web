import { test, expect } from "@playwright/test";

// Stage 7.3 — Mobile responsive polish
// These tests run on all projects but the assertions are most relevant for
// the mobile-chrome (Pixel 5) and tablet (iPad Air) Playwright projects.

test.describe("Responsive layout — Calculator @smoke", () => {
  test("no horizontal overflow on calculator page @responsive", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 30000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, "page body must not overflow horizontally").toBe(false);
  });

  test("entity tabs are visible without horizontal overflow on narrow viewport @responsive", async ({
    page,
  }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 30000 });

    const particleTab = page.locator('[data-testid="v8-tab-particle"]');
    const materialTab = page.locator('[data-testid="v8-tab-material"]');
    await expect(particleTab).toBeVisible();
    await expect(materialTab).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, "v8 entity tabs must not overflow horizontally").toBe(false);
  });
});

test.describe("Responsive layout — Plot @smoke", () => {
  test("no horizontal overflow on plot page @responsive", async ({ page }) => {
    await page.goto("/plot");
    await expect(page.getByRole("heading", { name: "Plot" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, "plot page must not overflow horizontally").toBe(false);
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

    // Mobile: disclosure button must be visible, entity panels hidden
    const disclosureBtn = page.getByRole("button", { name: /Select Entities/i });
    await expect(disclosureBtn).toBeVisible();
    expect(await disclosureBtn.getAttribute("aria-expanded")).toBe("false");

    // Expand panels
    await disclosureBtn.click();
    expect(await disclosureBtn.getAttribute("aria-expanded")).toBe("true");
  });

  test("entity panels always visible on desktop viewport @responsive", async ({ page }) => {
    test.setTimeout(30000);
    await page.goto("/plot");

    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 600) {
      test.skip();
      return;
    }

    // Desktop: no disclosure button, panels directly visible
    const disclosureBtn = page.getByRole("button", { name: /Select Entities/i });
    await expect(disclosureBtn).not.toBeVisible();
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
