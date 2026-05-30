import { test, expect } from "@playwright/test";

test.describe("PR 661: Custom compounds in compare-across", () => {
  test("displays custom compound name correctly and omits cc_ ID from URL", async ({ page }) => {
    // Navigate to advanced mode
    await page.goto("/calculator?mode=advanced&particle=1&material=276&energies=100");
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );

    // Switch across to material
    await page.getByTestId("across-material").click();
    await expect(page.getByTestId("across-material")).toHaveAttribute("aria-checked", "true");

    // Open material picker
    await page.getByTestId("picker-tab-material").click();

    // Create a new custom compound
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("My Cool Material");

    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // Atom count is present for H by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    // Save
    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();
    await expect(page.getByRole("dialog", { name: /compound editor/i })).not.toBeVisible({
      timeout: 5000,
    });

    // Select the newly created material to compare
    // Wait for the custom subtab to be visible if not already
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    
    // Select "My Cool Material"
    const customOption = page
      .getByTestId("picker-material-list-custom")
      .locator('[data-testid^="picker-material-item-"]', { hasText: /My Cool Material/ })
      .first();
    await customOption.waitFor({ state: "visible" });
    await customOption.click();

    // Close the picker
    await page.keyboard.press("Escape");

    // Check that the multi-entity table shows the correct name, NOT cc_...
    // Wait for the multi-table to render
    const table = page.getByTestId("table-multi");
    await expect(table).toBeVisible({ timeout: 10000 });

    // The table headers should contain "My Cool Material"
    await expect(table).toContainText("My Cool Material");
    await expect(table).not.toContainText("cc_");

    // Now check the URL.
    // The custom material "My Cool Material" is only stored locally, so its ID (cc_...) is invalid
    // for a shareable URL across browser sessions unless it is the *single* primary `material=custom`.
    // In compare-across, it should be stripped from the `materials=` parameter.
    const searchParams = await page.evaluate(() => window.location.search);
    const urlParams = new URLSearchParams(searchParams);
    
    // `materials` parameter shouldn't contain `cc_`
    const materialsParam = urlParams.get("materials");
    expect(materialsParam).not.toContain("cc_");

    // Add a built-in material to the comparison
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-elements").click();
    
    const aluminumOption = page.locator('[data-testid="picker-material-item-13"]');
    await aluminumOption.click();
    await page.keyboard.press("Escape");

    // Check the URL again. Now it should contain valid materials
    const searchParams2 = await page.evaluate(() => window.location.search);
    const urlParams2 = new URLSearchParams(searchParams2);
    
    expect(urlParams2.get("across")).toBe("materials");
    expect(urlParams2.get("materials")).toContain("13"); // Aluminum
    expect(urlParams2.get("materials")).toContain("276"); // Water
    expect(urlParams2.get("materials")).not.toContain("cc_");
  });
});
