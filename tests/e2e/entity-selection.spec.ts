import { test, expect } from "@playwright/test";

test.describe("Calculator page — compact mode", () => {
  const particleTrigger = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: /^Particle$/ });
  const materialTrigger = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: /^Material$/ });
  const programTrigger = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: /^Program$/ });

  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Wait for WASM to load and combobox triggers to appear
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("three comboboxes are present: Particle, Material, Program", async ({ page }) => {
    await expect(particleTrigger(page)).toBeVisible();
    await expect(materialTrigger(page)).toBeVisible();
    await expect(programTrigger(page)).toBeVisible();
  });

  test("default values show proton, Water, Auto-select", async ({ page }) => {
    await expect(particleTrigger(page)).toContainText(/proton/i);
    await expect(materialTrigger(page)).toContainText(/water/i);
    await expect(programTrigger(page)).toContainText(/auto-select/i);
  });

  test("typing carbon in the Particle search filters the list and shows Carbon", async ({
    page,
  }) => {
    const particleBtn = particleTrigger(page);
    await particleBtn.click();

    // Type in the search input inside the open Particle dropdown.
    // Particle combobox uses placeholder "Name, symbol, Z..." (not generic "Search...").
    // Use .first() — after opening, exactly one such input is in the DOM.
    await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill("carbon");

    await expect(page.getByRole("option", { name: /carbon/i }).first()).toBeVisible();
  });

  test("selecting Carbon removes incompatible programs (PSTAR proton-only disappears)", async ({
    page,
  }) => {
    // Open particle dropdown and select Carbon (C)
    const particleBtn = particleTrigger(page);
    await particleBtn.click();
    await page.getByRole("option", { name: /^Carbon \(C\)/i }).first().click();

    // Open program dropdown
    const programBtn = programTrigger(page);
    await programBtn.click();

    // PSTAR (proton-only in libdedx) should not appear for carbon
    await expect(page.getByRole("option", { name: /pstar/i })).toHaveCount(0);
  });

  test("Reset all link restores defaults", async ({ page }) => {
    // Change particle to Carbon (C)
    const particleBtn = particleTrigger(page);
    await particleBtn.click();
    await page.getByRole("option", { name: /^Carbon \(C\)/i }).first().click();

    // Click restore defaults
    await page.getByRole("button", { name: /restore defaults/i }).click();

    // Verify defaults restored
    await expect(particleTrigger(page)).toContainText(/proton/i);
    await expect(materialTrigger(page)).toContainText(/water/i);
    await expect(programTrigger(page)).toContainText(/auto-select/i);
  });

  test("Electron (ESTAR) is disabled — ESTAR not implemented in libdedx v1.4.0", async ({
    page,
  }) => {
    const particleBtn = particleTrigger(page);
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
    // Note: ICRU 49 (a different program) is valid and may appear; we only exclude the internal ICRU.
    const icruInternal = page.locator('[role="option"]', { hasText: "ICRU — 1.0" });
    await expect(icruInternal).toHaveCount(0);
  });
});
