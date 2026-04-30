import { test, expect } from "@playwright/test";

test.describe("Calculator URL sync", () => {
  test("calculator state is encoded in URL after loading", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), { timeout: 10000 });
    expect(page.url()).toContain("particle=1");
    expect(page.url()).toContain("material=276");
  });

  test("loading URL with particle=6 restores carbon selection", async ({ page }) => {
    await page.goto("/calculator?particle=6&material=276&energies=100,200&eunit=MeV");
    await expect(page.getByText(/Carbon \(C\)/)).toBeVisible({ timeout: 8000 });
    const energyInputs = page.getByRole("textbox");
    await expect(energyInputs.nth(0)).toHaveValue("100");
    await expect(energyInputs.nth(1)).toHaveValue("200");
  });

  test("invalid URL params fall back to defaults without error", async ({ page }) => {
    await page.goto("/calculator?particle=NOPE&energies=notanumber&eunit=bebok");
    await expect(page.getByRole("heading", { name: /calculator/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test("mixed-unit rows encoded with :unit suffix", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    const addRowBtn = page.getByRole("button", { name: /add row/i });
    await addRowBtn.click();

    const energyInput2 = page.locator('[data-testid="energy-input-1"]');
    await energyInput2.fill("500 keV");
    await energyInput2.blur();

    await page.waitForFunction(() => window.location.search.includes("500:keV"), { timeout: 5000 });
    expect(page.url()).toContain("500:keV");
  });
});
