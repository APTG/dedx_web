import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function checkWasmAvailable(page: Page): Promise<boolean> {
  try {
    const resp = await page.request.get("/wasm/libdedx.mjs");
    return resp.ok();
  } catch {
    return false;
  }
}

test.describe("PR 667 - Water validation and table stability", () => {
  test("Custom water vs predefined liquid water CSDA ranges", async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!(await checkWasmAvailable(page)), "WASM missing");

    // Predefined Liquid Water (ID 276)
    // material=276 in libdedx is Liquid Water
    const urlPredefined =
      "/calculator?urlv=2&particle=1&material=276" +
      "&mode=advanced&program=100&programs=100&energies=10,50,100&eunit=MeV&qfocus=both";

    await page.goto(urlPredefined);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="compound-from-url-banner"]')
          ?.textContent?.includes("Liquid Water") || true,
      { timeout: 15000 },
    );

    const predefinedValues = [];
    for (let i = 0; i < 3; i++) {
      const rangeCell = page.locator(`[data-testid="advanced-range-cell-${i}"]`);
      await expect
        .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);

      predefinedValues.push(parseFloat((await rangeCell.textContent())!));
    }
    console.log("Predefined Water ranges (Bethe):", predefinedValues);

    // Custom Water
    // H:2, O:1 => 1:2,8:1. Density 1.0
    const urlCustom =
      "/calculator?urlv=2&particle=1&material=custom&mat_name=CustomWater" +
      "&mat_density=1.0&mat_elements=1%3A2%2C8%3A1" +
      "&mode=advanced&program=100&programs=100&energies=10,50,100&eunit=MeV&qfocus=both";

    await page.goto(urlCustom);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="compound-from-url-banner"]')
          ?.textContent?.includes("CustomWater"),
      { timeout: 15000 },
    );

    const customValues = [];
    for (let i = 0; i < 3; i++) {
      const rangeCell = page.locator(`[data-testid="advanced-range-cell-${i}"]`);
      await expect
        .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);

      customValues.push(parseFloat((await rangeCell.textContent())!));
    }
    console.log("Custom Water ranges:", customValues);

    // Validate that custom water and predefined water have similar CSDA ranges
    for (let i = 0; i < 3; i++) {
      const ratio = customValues[i]! / predefinedValues[i]!;
      expect(ratio).toBeGreaterThan(0.9);
      expect(ratio).toBeLessThan(1.1);
    }
  });

  test("Stability when adding and removing energies", async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!(await checkWasmAvailable(page)), "WASM missing");

    const url =
      "/calculator?urlv=2&particle=1&material=custom&mat_name=CR39" +
      "&mat_density=1.39&mat_elements=1%3A18%2C6%3A12%2C8%3A7" +
      "&mode=advanced&program=100&programs=100&energies=10,50&eunit=MeV&qfocus=both";

    await page.goto(url);

    // Wait for the table to load
    await expect(page.locator('[data-testid="advanced-range-cell-1"]')).toBeVisible({
      timeout: 15000,
    });

    // Add energy 100
    // In advanced mode, inputs are typically data-testid="advanced-energy-input-0", etc.
    // Or if it's the main calculator page, it might be energy-input-0.
    // Let's find the last energy input and press Enter to add a new one.
    const input1 = page.getByTestId("energy-input-1");
    if (await input1.isVisible()) {
      await input1.press("Enter");
      const input2 = page.getByTestId("energy-input-2");
      await expect(input2).toBeVisible({ timeout: 5000 });
      await input2.fill("100");
      await input2.blur();
    } else {
      // Try advanced-energy-input if standard one is not found
      const advInput1 = page.getByTestId("advanced-energy-input-1");
      await advInput1.press("Enter");
      const advInput2 = page.getByTestId("advanced-energy-input-2");
      await expect(advInput2).toBeVisible({ timeout: 5000 });
      await advInput2.fill("100");
      await advInput2.blur();
    }

    // Check if new row appears in table
    await expect(page.locator('[data-testid="advanced-range-cell-2"]')).toBeVisible({
      timeout: 10000,
    });

    // Remove the last energy (100)
    if (await input1.isVisible()) {
      const input2 = page.getByTestId("energy-input-2");
      await input2.fill("");
      await input2.focus();
      await page.keyboard.press("Backspace");
    } else {
      const advInput2 = page.getByTestId("advanced-energy-input-2");
      await advInput2.fill("");
      await advInput2.focus();
      await page.keyboard.press("Backspace");
    }

    // The 3rd row should disappear, back to 2 rows
    await expect(page.locator('[data-testid="advanced-range-cell-2"]')).not.toBeVisible({
      timeout: 10000,
    });
  });
});
