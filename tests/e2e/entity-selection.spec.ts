import { test, expect } from "@playwright/test";

test.describe("Calculator page — compact mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Wait for WASM to load and combobox triggers to appear
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("three comboboxes are present: Particle, Material, Program", async ({ page }) => {
    await expect(page.getByRole("button", { name: /particle/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /material/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /program/i })).toBeVisible();
  });

  test("default values show Proton (Z=1), Water, Auto-select", async ({ page }) => {
    await expect(page.getByRole("button", { name: /particle/i })).toContainText(/Z=1/i);
    await expect(page.getByRole("button", { name: /material/i })).toContainText(/water/i);
    await expect(page.getByRole("button", { name: /program/i })).toContainText(/auto-select/i);
  });

  test("typing carbon in the Particle search filters the list and shows Carbon", async ({
    page,
  }) => {
    const particleBtn = page.getByRole("button", { name: /particle/i });
    await particleBtn.click();

    // Type in the search input inside the open dropdown (filter to visible only)
    await page.locator('input[placeholder="Search..."]').filter({ visible: true }).fill("carbon");

    await expect(page.getByRole("option", { name: /carbon/i }).first()).toBeVisible();
  });

  test("selecting Carbon removes incompatible programs (PSTAR proton-only disappears)", async ({
    page,
  }) => {
    // Open particle dropdown and select Carbon (Z=6)
    const particleBtn = page.getByRole("button", { name: /particle/i });
    await particleBtn.click();
    await page.getByRole("option", { name: /Z=6/i }).first().click();

    // Open program dropdown
    const programBtn = page.getByRole("button", { name: /program/i });
    await programBtn.click();

    // PSTAR (proton-only in libdedx) should not appear for carbon
    await expect(page.getByRole("option", { name: /pstar/i })).toHaveCount(0);
  });

  test("Reset all link restores defaults", async ({ page }) => {
    // Change particle to Carbon (Z=6)
    const particleBtn = page.getByRole("button", { name: /particle/i });
    await particleBtn.click();
    await page.getByRole("option", { name: /Z=6/i }).first().click();

    // Click reset all
    await page.getByRole("link", { name: /reset all/i }).click();

    // Verify defaults restored
    await expect(page.getByRole("button", { name: /particle/i })).toContainText(/Z=1/i);
    await expect(page.getByRole("button", { name: /material/i })).toContainText(/water/i);
    await expect(page.getByRole("button", { name: /program/i })).toContainText(/auto-select/i);
  });

  test("Electron (ESTAR) is disabled — ESTAR not implemented in libdedx v1.4.0", async ({
    page,
  }) => {
    const particleBtn = page.getByRole("button", { name: /particle/i });
    await particleBtn.click();

    const electronOption = page.getByRole("option", { name: /electron/i });
    await expect(electronOption).toHaveCount(1);
    await expect(electronOption).toHaveAttribute("data-disabled", "");
  });

  test("DEDX_ICRU internal selector (ID 9) does not appear in the Program combobox", async ({
    page,
  }) => {
    // ICRU (ID 9) is excluded from the UI via EXCLUDED_FROM_UI set.
    // Its label would be "ICRU — 1.0". No such option should be in the DOM at all.
    // Note: ICRU49 (a different program) is valid and may appear; we only exclude the internal ICRU.
    const icruInternal = page.locator('[role="option"]', { hasText: "ICRU — 1.0" });
    await expect(icruInternal).toHaveCount(0);
  });
});

test.describe("Plot page — placeholder (Stage 6)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plot");
    await page.waitForSelector("main", { timeout: 10000 });
  });

  test("Plot page loads and shows coming-soon placeholder", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /plot/i })).toBeVisible();
    await expect(page.getByText(/coming soon/i)).toBeVisible();
  });
});
