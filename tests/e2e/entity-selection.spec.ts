import { test, expect } from "@playwright/test";

test.describe("Calculator page — compact mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
  });

  test("three comboboxes are present: Particle, Material, Program", async ({ page }) => {
    await expect(page.getByRole("combobox", { name: /particle/i })).toBeVisible();
    await expect(page.getByRole("combobox", { name: /material/i })).toBeVisible();
    await expect(page.getByRole("combobox", { name: /program/i })).toBeVisible();
  });

  test("default values show Proton, Water, Auto-select", async ({ page }) => {
    await expect(page.getByRole("combobox", { name: /particle/i })).toHaveValue(/proton/i);
    await expect(page.getByRole("combobox", { name: /material/i })).toHaveValue(/water/i);
    await expect(page.getByRole("combobox", { name: /program/i })).toHaveValue(/auto-select/i);
  });

  test("typing carbon in the Particle combobox filters the list and shows Carbon", async ({ page }) => {
    const particleCombobox = page.getByRole("combobox", { name: /particle/i });
    await particleCombobox.click();
    await particleCombobox.fill("carbon");

    await expect(page.getByRole("option", { name: /carbon/i })).toBeVisible();
  });

  test("selecting Carbon updates the Program combobox (PSTAR becomes unavailable/greyed)", async ({ page }) => {
    const particleCombobox = page.getByRole("combobox", { name: /particle/i });
    await particleCombobox.click();
    await page.getByRole("option", { name: /carbon/i }).click();

    // PSTAR should be greyed out or unavailable
    const programCombobox = page.getByRole("combobox", { name: /program/i });
    await programCombobox.click();

    // PSTAR option should be disabled or have aria-disabled
    const pstarOption = page.getByRole("option", { name: /pstar/i });
    await expect(pstarOption).toHaveAttribute("aria-disabled", "true");
  });

  test("Reset all link restores defaults", async ({ page }) => {
    // Change particle to carbon
    const particleCombobox = page.getByRole("combobox", { name: /particle/i });
    await particleCombobox.click();
    await page.getByRole("option", { name: /carbon/i }).click();

    // Click reset all
    await page.getByRole("link", { name: /reset all/i }).click();

    // Verify defaults restored
    await expect(page.getByRole("combobox", { name: /particle/i })).toHaveValue(/proton/i);
    await expect(page.getByRole("combobox", { name: /material/i })).toHaveValue(/water/i);
    await expect(page.getByRole("combobox", { name: /program/i })).toHaveValue(/auto-select/i);
  });

  test("Electron entry is visible in the particle list but is not selectable (aria-disabled)", async ({ page }) => {
    const particleCombobox = page.getByRole("combobox", { name: /particle/i });
    await particleCombobox.click();

    const electronOption = page.getByRole("option", { name: /electron/i });
    await expect(electronOption).toBeVisible();
    await expect(electronOption).toHaveAttribute("aria-disabled", "true");
  });

  test("DEDX_ICRU does not appear in the Program combobox", async ({ page }) => {
    const programCombobox = page.getByRole("combobox", { name: /program/i });
    await programCombobox.click();

    // ICRU (ID 9) should not be visible as a selectable option
    const icruOption = page.getByRole("option", { name: /icru/i });
    await expect(icruOption).not.toBeVisible();
  });
});

test.describe("Plot page — full panel mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plot");
  });

  test("three scrollable list panels are visible in the sidebar", async ({ page }) => {
    await expect(page.getByRole("group", { name: /particle/i })).toBeVisible();
    await expect(page.getByRole("group", { name: /material/i })).toBeVisible();
    await expect(page.getByRole("group", { name: /program/i })).toBeVisible();
  });

  test("Particle panel has a text filter input", async ({ page }) => {
    const particlePanel = page.getByRole("group", { name: /particle/i });
    await expect(particlePanel.getByRole("searchbox")).toBeVisible();
  });

  test("Material panel has two sub-lists: Elements and Compounds", async ({ page }) => {
    const materialPanel = page.getByRole("group", { name: /material/i });

    await expect(materialPanel.getByText(/elements/i)).toBeVisible();
    await expect(materialPanel.getByText(/compounds/i)).toBeVisible();
  });

  test("Program panel shows Auto-select at the top", async ({ page }) => {
    const programPanel = page.getByRole("group", { name: /program/i });
    await expect(programPanel.getByText(/auto-select/i)).toBeVisible();
  });

  test("selecting a particle greys out incompatible materials (reduced opacity)", async ({ page }) => {
    const particlePanel = page.getByRole("group", { name: /particle/i });

    // Click on Carbon (or another particle that doesn't support all materials)
    const carbonItem = particlePanel.getByRole("option", { name: /carbon/i });
    await carbonItem.click();

    // Some materials should be greyed out (have reduced opacity)
    const materialPanel = page.getByRole("group", { name: /material/i });
    const incompatibleMaterial = materialPanel.getByRole("option").first();

    // The incompatible material should have reduced opacity style
    const opacity = await incompatibleMaterial.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue("opacity")
    );
    expect(parseFloat(opacity)).toBeLessThan(1);
  });

  test("Add Series button is present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add series/i })).toBeVisible();
  });
});
