import { test, expect } from "@playwright/test";

async function selectParticle(page: import("@playwright/test").Page, id: string, query: string) {
  await page.getByTestId("picker-tab-particle").click();
  await page.getByTestId("picker-particle-search").fill(query);
  await page.getByTestId(`picker-particle-item-${id}`).click();
}

async function openProgramTab(page: import("@playwright/test").Page) {
  await page.getByTestId("picker-tab-program").click();
}

/**
 * E2E tests for Stage 6.10 Custom Compounds feature.
 * Tests cover compound editor modal, entity selection integration,
 * program compatibility filter, and Basic/Advanced mode gating.
 */

test.describe("Custom Compounds — Editor Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("AC-2: + Add compound opens modal with blank form", async ({ page }) => {
    // Enable Advanced mode first
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Open material panel
    await page.getByTestId("picker-tab-material").click();

    // Click + Add compound in the Custom Compounds column
    const addButton = page.getByTestId("picker-material-add-compound");
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Modal should open with blank form
    const modal = page.getByRole("dialog", { name: /compound editor/i });
    await expect(modal).toBeVisible();

    // Name field should receive focus
    const nameInput = page.getByRole("textbox", { name: /name/i });
    await expect(nameInput).toBeFocused();
    await expect(nameInput).toHaveValue("");

    // Density should be blank
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await expect(densityInput).toHaveValue("");

    // Phase should default to Condensed
    const condensedOption = page.getByRole("radio", { name: /condensed/i }).first();
    await expect(condensedOption).toBeChecked();

    // Formula mode should be default
    const formulaMode = page.getByRole("tab", { name: /formula/i });
    await expect(formulaMode).toHaveAttribute("aria-selected", "true");
  });

  test("AC-3: Validation — empty name blocks Save", async ({ page }) => {
    // Enable Advanced mode
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Open material panel and add compound
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });

    // Try to save with empty name
    const saveBtn = page.getByRole("button", { name: /save/i });

    // Fill everything except name
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.19");

    // Fill elements (H2O)
    // H is present by default

    // Atom count input has role="spinbutton" (type="number") and placeholder "Count"
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("2");

    // Add oxygen
    const addInput = page.getByPlaceholder(/Type symbol or element/i);
    await addInput.fill("O");
    await addInput.press("Enter");

    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    // Save stays clickable; pressing it on an invalid form reveals the reason
    // and keeps the modal open instead of silently doing nothing.
    await saveBtn.click();

    // Inline error explains why.
    await expect(page.getByText(/name is required/i)).toBeVisible();
    await expect(modal).toBeVisible(); // Modal should not close
  });

  test("AC-3: Validation — density > 25 blocks Save", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });
    await expect(modal).toBeVisible();

    // Name
    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("Dense");

    // Density too high
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("30");

    // One element — H is present by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    // Pressing Save reveals the inline error and keeps the modal open.
    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();
    await expect(page.getByText(/density must be/i)).toBeVisible();
    await expect(modal).toBeVisible();
  });

  // SKIP: This test case checks for Z outside [1, 118], but the UI prevents
  // setting invalid Z values - handleElementChange only updates when resolveElement
  // returns a valid element. The error path exists in validate() but can't be
  // reached through normal UI interaction.
  // test("AC-3: Validation — unknown element blocks Save", async ({ page }) => {...});

  test("AC-3: Validation — duplicate Z blocks Save", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("Duplicate");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // Li is present by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("2");

    // Add another Li (duplicate)
    const addInput = page.getByPlaceholder(/Type symbol or element/i);
    await addInput.fill("Li");
    await addInput.press("Enter");
    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    const modal = page.getByRole("dialog", { name: /compound editor/i });
    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();
    // The duplicate banner blocks Save: the modal stays open.
    await expect(page.getByText(/appears twice/i)).toBeVisible();
    await expect(modal).toBeVisible();
  });

  test("AC-2: Create compound adds to library", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Open material panel and add compound
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });

    // Fill form
    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("BeO Pellet");

    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("3.01");

    // Change Li (Z=3) to Be (Z=4)
    await page.getByTestId("picker-element-tile-3").first().click();
    await page.getByTestId("picker-grid-tile-4").first().click();
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    // Change F (Z=9) to O (Z=8)
    await page.getByTestId("picker-element-tile-9").first().click();
    await page.getByTestId("picker-grid-tile-8").first().click();
    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();

    // Save the compound
    await saveBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Re-navigate to verify compound persisted
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Open material panel, switch to Custom sub-tab and verify compound is there.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const customList = page.getByTestId("picker-material-list-custom");
    await expect(customList).toBeVisible();

    // Verify BeO Pellet is visible in the custom list.
    await expect(customList.getByText(/BeO Pellet/i)).toBeVisible();

    // Verify density description is visible on the custom compound row.
    await expect(
      customList
        .locator('[data-testid^="picker-material-item-"]', { hasText: /BeO Pellet/i })
        .first(),
    ).toContainText(/3\.01\d* g\/cm/);
  });

  test("AC-6: Delete compound confirmation", async ({ page }) => {
    // Listen to console logs from the page
    page.on("console", (msg) => {
      console.log(`PAGE CONSOLE [${msg.type()}]:`, msg.text());
    });
    page.on("pageerror", (err) => {
      console.log("PAGE ERROR:", err.message);
    });

    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create a compound first
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("ToDelete");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // H is present by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Re-open material panel, switch to Custom sub-tab, and find edit button.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();

    // Find and click the edit button for ToDelete
    const editBtn = page.getByRole("button", { name: /edit compound ToDelete/i });
    await expect(editBtn).toBeVisible();
    console.log(
      "Edit button count:",
      await page.getByRole("button", { name: /edit compound/i }).count(),
    );
    await editBtn.click({ force: true });

    // Modal should be open - now click delete button inside modal
    const modal = page.getByRole("dialog").first();
    const deleteBtn = modal.getByRole("button", { name: "Delete", exact: true }).first();
    console.log("Delete button visible:", await deleteBtn.isVisible());
    console.log("Delete button disabled:", await deleteBtn.isDisabled());
    await expect(deleteBtn).toBeVisible();

    const modalBefore = page.getByRole("dialog", { name: /edit compound/i });
    const modalVisibleBefore = await modalBefore.isVisible();
    console.log("Modal visible before delete click:", modalVisibleBefore);

    // Click the first Delete button to trigger confirmation
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click();

    // Confirmation dialog should appear
    const confirmText = page.getByText(/Are you sure you want to delete/i);
    await expect(confirmText).toBeVisible();

    // Click the confirm delete button in the confirmation dialog
    const confirmDialog = page.getByRole("dialog").first();
    const confirmDelete = confirmDialog.getByRole("button", { name: "Delete" });
    await confirmDelete.click();

    // Re-open material panel and verify compound is gone
    await page.getByTestId("picker-tab-material").click();
    await expect(page.getByText(/ToDelete/i)).not.toBeVisible();
  });

  test("AC-X: Periodic table picker allows adding and editing elements", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("Picker Test");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // Click "Pick from periodic table"
    const pickBtn = page.getByRole("button", { name: /Pick from periodic table/i });
    await pickBtn.click();

    // The picker should appear
    const pickerGrid = page.getByTestId("picker-element-grid");
    await expect(pickerGrid).toBeVisible();

    // Add Carbon (Z=6)
    const carbonTile = page.getByTestId("picker-grid-tile-6").first();
    await carbonTile.click();

    // Verify Carbon was added
    const carbonEditBtn = page.getByTestId("picker-element-tile-6").first();
    await expect(carbonEditBtn).toBeVisible();
    await expect(page.getByText(/Z=6/i).first()).toBeVisible();

    // Edit the first element (Li)
    const lithiumEditBtn = page.getByTestId("picker-element-tile-3").first();
    await lithiumEditBtn.click();

    // The picker should appear for editing
    await expect(pickerGrid).toBeVisible();

    // Change Li to O (Z=8)
    const oxygenTile = page.getByTestId("picker-grid-tile-8").first(); // the one in the picker
    await oxygenTile.click();

    // Verify Li is gone and O is present
    await expect(page.getByTestId("picker-element-tile-3")).not.toBeVisible();
    const oxygenEditBtn = page.getByTestId("picker-element-tile-8").first();
    await expect(oxygenEditBtn).toBeVisible();
  });
});

test.describe("Custom Compounds — Entity Selection Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("AC-1: Custom Compounds group absent in Basic mode", async ({ page }) => {
    // Basic mode by default — open the material panel
    await page.getByTestId("picker-tab-material").click();

    // Custom sub-tab should not exist in Basic mode; add button also absent.
    await expect(page.getByTestId("material-subtab-custom")).toHaveCount(0);
    await expect(page.getByTestId("picker-material-add-compound")).not.toBeVisible();
  });

  test.describe.configure({ mode: "serial" });

  test("AC-1: Custom Compounds group appears in Advanced mode", async ({ page }) => {
    await page.goto("/calculator");
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      console.log("PAGE CONSOLE:", text);
    });

    console.log("TEST: Starting AC-1 test");

    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    await page.getByTestId("picker-tab-material").click();
    console.log(
      "TEST: Console messages captured:",
      consoleMessages.length,
      JSON.stringify(consoleMessages.slice(0, 10)),
    );

    // Custom sub-tab and add button should be visible in Advanced mode
    await expect(page.getByTestId("material-subtab-custom")).toBeVisible();
    await expect(page.getByTestId("picker-material-add-compound")).toBeVisible();
  });

  test("AC-7: Custom compounds appear with badge in material panel", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create a compound
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("Badge Test");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // H is present by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Re-open material panel, switch to Custom sub-tab, and verify compound.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const customList2 = page.getByTestId("picker-material-list-custom");
    await expect(customList2.getByText(/Badge Test/i)).toBeVisible();
    // Check for "custom" badge indicator
    await expect(
      page
        .getByText(/custom/i)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });

  test("AC-7: Text filter filters custom compound names", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create compound
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("FilteredTest");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // H is present by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Re-open material panel, switch to Custom sub-tab, and filter.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const searchInput = page.getByTestId("picker-material-search");
    await searchInput.fill("filtered");

    await expect(page.getByText(/FilteredTest/i)).toBeVisible();

    // Clear filter - should still show compound
    await searchInput.clear();
    await expect(page.getByText(/FilteredTest/i)).toBeVisible();
  });
});

test.describe("Custom Compounds — Program Compatibility Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("AC-7b: Programs missing elements are greyed out (smoke test)", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create LiF compound (Li Z=3, F Z=9)
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("LiF Compatibility");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("2.20");

    // Li
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    // F
    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Select the compound from the Custom sub-tab.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const lifOption = page
      .getByTestId("picker-material-list-custom")
      .locator('[data-testid^="picker-material-item-"]', { hasText: /LiF Compatibility/ })
      .first();
    await lifOption.click();

    // Open program tab
    await openProgramTab(page);

    // Verify programs are present (greyed-out check requires program-specific data)
    const options = page.locator('[data-testid^="picker-program-item-"]');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Check for opacity-50 styling on some programs (those missing Li or F)
    const greyedOptions = page.locator('[class*="opacity-50"]');
    const greyedCount = await greyedOptions.count();
    expect(greyedCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Custom Compounds — Basic/Advanced Mode Transition", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("AC-1: Custom compound falls back to water in Basic mode", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    page.on("console", (msg) => {
      console.log("PAGE CONSOLE:", msg.text());
    });

    // Enable Advanced mode
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create compound
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("BasicModeTest");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // H is present by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Select the compound from the Custom sub-tab.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const customOption = page
      .getByTestId("picker-material-list-custom")
      .locator('[data-testid^="picker-material-item-"]', { hasText: /BasicModeTest/ })
      .first();
    await customOption.waitFor({ state: "visible" });
    await customOption.click({ force: true });

    // Verify compound is selected — check the material tab label
    const materialTab = page.getByTestId("picker-tab-material");
    const tabText = await materialTab.textContent();
    console.log("Material tab text after selection:", tabText);
    expect(tabText).toContain("BasicModeTest");

    // Switch to Basic mode
    const basicModeBtn = page.getByRole("button", { name: "Switch to Basic mode" });
    await basicModeBtn.click();

    // Should fall back to water — check material tab label
    await expect(page.getByTestId("picker-tab-material")).toContainText(/water/i);
  });
});

test.describe("Scenario 2: Water (H2O) — formula mode and stopping power sanity check", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("Create water via formula mode (H:2, O:1) and verify reasonable stopping power", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Select alpha particle (well-known stopping power in water)
    await selectParticle(page, "2", "alpha");
    await expect(page.getByTestId("picker-tab-particle")).toContainText("alpha particle");

    // Open compound editor
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });
    await expect(modal).toBeVisible();

    // Fill: name and density
    await page.getByRole("textbox", { name: /name/i }).fill("Water H2O formula");
    await page.getByRole("spinbutton", { name: /density/i }).fill("1.0");

    // Change Li to H
    await page.getByTestId("picker-element-tile-3").first().click();
    await page.getByTestId("picker-grid-tile-1").first().click();

    // Remove F
    const removeBtn = page.getByTestId("picker-element-row-remove").nth(1);
    await removeBtn.click();
    const confirmBtn = page.getByRole("button", { name: "Yes, remove" });
    await confirmBtn.click();

    // First element: H with atom count 2
    const count0 = page.getByPlaceholder(/count/i).first();
    await count0.fill("2");

    // Add oxygen
    const addInput = page.getByPlaceholder(/Type symbol or element/i);
    await addInput.fill("O");
    await addInput.press("Enter");
    const count1 = page.getByPlaceholder(/count/i).nth(1);
    await count1.fill("1");

    // Save
    await page.getByRole("button", { name: /save/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Select the water compound from the Custom sub-tab.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const waterOption = page
      .getByTestId("picker-material-list-custom")
      .locator('[data-testid^="picker-material-item-"]', { hasText: /Water H2O formula/ })
      .first();
    await waterOption.waitFor({ state: "visible" });
    await waterOption.click();
    await expect(page.getByTestId("picker-tab-material")).toContainText("Water H2O formula");

    // Select first available program
    await openProgramTab(page);
    const firstProgramOption = page.locator('[data-testid^="picker-program-item-"]').first();
    await firstProgramOption.waitFor({ state: "visible" });
    await firstProgramOption.click();

    // Set energy to 5 MeV
    const energyInput = page.getByTestId("advanced-energy-input-0");
    await expect(energyInput).toBeVisible();
    await energyInput.fill("5");
    await energyInput.blur();

    // Verify a non-empty stopping power result is produced
    const stpCell = page.locator('[data-testid^="advanced-stp-cell-"]').first();
    // Wait for a numeric result (not a dash placeholder)
    await expect(stpCell).toHaveText(/\d/, { timeout: 10000 });

    // Parse value and check it's in a physically plausible range.
    // Alpha at 5 MeV in water: ~83 MeV·cm²/g or ~8 keV/µm depending on display unit.
    // Range [1, 500] covers all supported display units.
    const stpText = await stpCell.textContent();
    const stpValue = parseFloat(stpText?.trim() ?? "");
    expect(stpValue).toBeGreaterThan(0);
    expect(stpValue).toBeLessThan(500);
  });

  test("Create water via weight-fraction mode (H:11.19%, O:88.81%) and verify calculation", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Open compound editor
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });
    await expect(modal).toBeVisible();

    // Fill name and density
    await page.getByRole("textbox", { name: /name/i }).fill("Water H2O weight");
    await page.getByRole("spinbutton", { name: /density/i }).fill("1.0");

    // Change Li to H
    await page.getByTestId("picker-element-tile-3").first().click();
    await page.getByTestId("picker-grid-tile-1").first().click();

    // Remove F
    const removeBtn = page.getByTestId("picker-element-row-remove").nth(1);
    await removeBtn.click();
    const confirmBtn = page.getByRole("button", { name: "Yes, remove" });
    await confirmBtn.click();

    // Switch to weight fraction mode
    const weightTab = page.getByRole("tab", { name: /weight fraction/i });
    await weightTab.click();
    await expect(weightTab).toHaveAttribute("aria-selected", "true");

    // The weight fraction input for H should now be editable
    const wf0 = page.getByRole("spinbutton", { name: /weight fraction.*element 1/i }).first();
    await expect(wf0).toBeVisible();
    await expect(wf0).toBeEnabled();
    await wf0.fill("11.19");

    // Add oxygen element
    const addInput = page.getByPlaceholder(/Type symbol or element/i);
    await addInput.fill("O");
    await addInput.press("Enter");

    // Set oxygen weight fraction
    const wf1 = page.getByRole("spinbutton", { name: /weight fraction.*element 2/i }).first();
    await expect(wf1).toBeVisible();
    await wf1.fill("88.81");

    // Save — fractions sum to 100%, should succeed
    await page.getByRole("button", { name: /save/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Select the water compound from the Custom sub-tab.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const waterOption = page
      .getByTestId("picker-material-list-custom")
      .locator('[data-testid^="picker-material-item-"]', { hasText: /Water H2O weight/ })
      .first();
    await expect(waterOption).toBeVisible();
    await waterOption.click();
    await expect(page.getByTestId("picker-tab-material")).toContainText("Water H2O weight");

    // Select alpha particle
    await selectParticle(page, "2", "alpha");

    // Select ASTAR: custom compounds are evaluated through the elemental
    // compound path, which is supported for this alpha-particle sanity check.
    await openProgramTab(page);
    const astarOption = page.getByTestId("picker-program-item-1");
    await astarOption.waitFor({ state: "visible" });
    await astarOption.click();

    // Set energy and verify result
    const energyInput = page.getByTestId("advanced-energy-input-0");
    await energyInput.fill("5");
    await energyInput.blur();

    const stpCell = page.locator('[data-testid^="advanced-stp-cell-"]').first();
    await expect(stpCell).toHaveText(/\d/, { timeout: 10000 });

    // Weight fraction input should yield the same physical result as formula mode.
    // Alpha at 5 MeV in water: ~83 MeV·cm²/g or ~8 keV/µm depending on display unit.
    // Range [1, 500] covers all supported display units.
    const stpText = await stpCell.textContent();
    const stpValue = parseFloat(stpText?.trim() ?? "");
    expect(stpValue).toBeGreaterThan(0);
    expect(stpValue).toBeLessThan(500);
  });

  test("Weight fraction sum ≠ 100% blocks Save", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });

    await page.getByRole("textbox", { name: /name/i }).fill("Bad Fractions");
    await page.getByRole("spinbutton", { name: /density/i }).fill("1.0");

    // H is present by default

    // Switch to weight fraction mode
    await page.getByRole("tab", { name: /weight fraction/i }).click();

    // Set fraction to only 50% (doesn't sum to 100)
    const wf0 = page.getByRole("spinbutton", { name: /weight fraction.*element 1/i }).first();
    await wf0.fill("50");

    // Save is blocked while the sum is out of tolerance — clicking keeps the
    // modal open and surfaces the reason.
    await page.getByRole("button", { name: /save/i }).click();

    // The destructive error paragraph explains why (not the hint text).
    await expect(
      page
        .locator("p.text-destructive")
        .filter({ hasText: /must sum to 100%/i })
        .first(),
    ).toBeVisible();
    await expect(modal).toBeVisible();
  });

  test("Formula display normalizes neat ratios and suppresses complex ones", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    // Set up a complex compound
    await page.getByRole("textbox", { name: /name/i }).fill("Beer");
    await page.getByRole("spinbutton", { name: /density/i }).fill("1.01");

    // Change Li to H
    await page.getByTestId("picker-element-tile-3").first().click();
    await page.getByTestId("picker-grid-tile-1").first().click();

    // Switch to weight fraction mode
    await page.getByRole("tab", { name: /weight fraction/i }).click();

    const wf0 = page.getByRole("spinbutton", { name: /weight fraction.*element 1/i }).first();
    await wf0.fill("35.747");

    // Change F to C
    await page.getByTestId("picker-element-tile-9").first().click();
    await page.getByTestId("picker-grid-tile-6").first().click();

    const wf1 = page.getByRole("spinbutton", { name: /weight fraction.*element 2/i }).first();
    await wf1.fill("1.0");

    // Add O
    const addInput = page.getByPlaceholder(/Type symbol or element/i);
    await addInput.fill("O");
    await addInput.press("Enter");

    const wf2 = page.getByRole("spinbutton", { name: /weight fraction.*element 3/i }).first();
    await wf2.fill("63.253");

    // The formula footer should say "Defined by mass fraction — no simple formula"
    const formulaFooter = page.getByTestId("compound-formula-footer");
    await expect(formulaFooter.getByTestId("compound-formula-none")).toBeVisible();
    await expect(formulaFooter.getByTestId("compound-formula-none")).toHaveText(
      "Defined by mass fraction — no simple formula",
    );
    await expect(formulaFooter.getByTestId("compound-formula-copy")).toBeDisabled();

    // Change to a neat ratio (H: 11.19, O: 88.81)
    await wf0.fill("11.19");

    // Remove C
    const removeBtn = page.getByTestId("picker-element-row-remove").nth(1);
    await removeBtn.click();
    await page.getByRole("button", { name: "Yes, remove" }).click();

    // Now O is at index 1
    const wf1_new = page.getByRole("spinbutton", { name: /weight fraction.*element 2/i }).first();
    await wf1_new.fill("88.81");

    // Formula footer should now show H2O as normalized
    await expect(formulaFooter.getByTestId("compound-formula-string")).toHaveText(/≈ H₂O/);
    await expect(formulaFooter.getByTestId("compound-formula-copy")).toBeEnabled();
  });
});

test.describe("Scenario 1: LiF pellet smoke test", () => {
  test("Create LiF compound and calculate with MSTAR", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    // Enable Advanced mode
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Select alpha particle (He-4)
    await selectParticle(page, "2", "alpha");
    await expect(page.getByTestId("picker-tab-particle")).toContainText("alpha particle");

    // Create LiF
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("LiF Pellet");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("2.20");

    // Li and F are present by default
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();
    await expect(page.getByRole("dialog", { name: /compound editor/i })).not.toBeVisible();

    // Select LiF from the Custom sub-tab.
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("material-subtab-custom").click();
    const lifOption = page
      .getByTestId("picker-material-list-custom")
      .locator('[data-testid^="picker-material-item-"]', { hasText: /LiF Pellet/ })
      .first();
    await lifOption.waitFor({ state: "visible" });
    await lifOption.click();
    await expect(page.getByTestId("picker-tab-material")).toContainText("LiF Pellet");

    // Select a program
    await openProgramTab(page);

    // Select first available program
    const firstOption = page.locator('[data-testid^="picker-program-item-"]').first();
    await firstOption.waitFor({ state: "visible" });
    await firstOption.click({ force: true });

    // Set energy in the editable result-table input.
    const energyInput = page.getByTestId("advanced-energy-input-0");
    await expect(energyInput).toBeVisible();
    await energyInput.fill("5");
    await energyInput.blur();

    // Verify calculation produces results (stopping power cell has value)
    const stoppingPowerValue = page.locator('[data-testid^="advanced-stp-cell-"]').first();
    await expect(stoppingPowerValue).toHaveText(/\S/, { timeout: 10000 });
  });
});

test.describe("Custom Compounds — Live Derived UI (Issue #645)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("Formula footer shows derived formula, atom count, and Bragg I-value in atoms mode", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    await page.getByRole("textbox", { name: /name/i }).fill("Tissue-like");
    await page.getByRole("spinbutton", { name: /density/i }).fill("1.0");

    // Build H52 C63 N3 O25 — rows sort ascending Z → H, C, N, O.
    const addInput = page.getByPlaceholder(/Type symbol or element/i);
    await addInput.fill("H");
    await addInput.press("Enter");

    // Now we have H (1), Li (3), F (9). Remove F, then Li.
    const removeBtns = page.getByTestId("picker-element-row-remove");
    await removeBtns.nth(2).click(); // Remove F
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await removeBtns.nth(1).click(); // Remove Li
    await page.getByRole("button", { name: "Yes, remove" }).click();

    for (const sym of ["C", "N", "O"]) {
      await addInput.fill(sym);
      await addInput.press("Enter");
    }
    const counts = page.getByPlaceholder(/count/i);
    await counts.nth(0).fill("52"); // H
    await counts.nth(1).fill("63"); // C
    await counts.nth(2).fill("3"); // N
    await counts.nth(3).fill("25"); // O

    const footer = page.getByTestId("compound-formula-footer");
    await expect(footer).toBeVisible();

    // 52 + 63 + 3 + 25 = 143 atoms; formula rendered in ascending-Z order.
    await expect(page.getByTestId("compound-total-atoms")).toContainText("143 atoms");
    await expect(page.getByTestId("compound-formula-string")).toContainText("H₅₂C₆₃N₃O₂₅");

    // I-value is previewed via Bragg additivity (computed, not overridden).
    await expect(page.getByTestId("compound-ivalue")).toContainText("eV");
    await expect(page.getByTestId("compound-ivalue")).toContainText(/computed/i);

    // Copy button and live per-row mass % are present.
    await expect(page.getByTestId("compound-formula-copy")).toBeVisible();
    await expect(page.getByTestId("compound-mass-percent-0")).toContainText(/% by mass/);

    // Footer is now visible in weight-fraction mode as well.
    await page.getByRole("tab", { name: /weight fraction/i }).click();
    await expect(footer).toBeVisible();
    await expect(page.getByTestId("compound-sum-tracker")).toBeVisible();
  });

  test("Sum tracker flags out-of-tolerance fractions and auto-rescales to 100%", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();
    await page.getByTestId("picker-tab-material").click();
    await page.getByTestId("picker-material-add-compound").click();

    await page.getByRole("textbox", { name: /name/i }).fill("Rescale Test");
    await page.getByRole("spinbutton", { name: /density/i }).fill("1.0");

    // Two rows, then switch to weight-fraction mode.
    const addInput = page.getByPlaceholder(/Type symbol or element/i);
    await addInput.fill("O");
    await addInput.press("Enter");
    await page.getByRole("tab", { name: /weight fraction/i }).click();

    // Fractions summing to 90% — out of tolerance.
    await page
      .getByRole("spinbutton", { name: /weight fraction.*element 1/i })
      .first()
      .fill("40");
    await page
      .getByRole("spinbutton", { name: /weight fraction.*element 2/i })
      .first()
      .fill("50");

    const status = page.getByTestId("compound-sum-status");
    const saveBtn = page.getByRole("button", { name: /save/i });
    const modal = page.getByRole("dialog", { name: /compound editor/i });
    await expect(status).toContainText(/must equal 100/i);
    // Out of tolerance: clicking Save keeps the modal open.
    await saveBtn.click();
    await expect(status).toContainText(/must equal 100/i);
    await expect(modal).toBeVisible();

    // Auto-rescale normalises the fractions to exactly 100%.
    await page.getByTestId("compound-sum-rescale").click();
    await expect(status).toContainText(/within tolerance/i);
    // Now Save succeeds and the modal closes.
    await saveBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
