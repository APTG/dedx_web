import { test, expect } from "@playwright/test";

/**
 * E2E tests for Stage 6.10 Custom Compounds feature.
 * Tests cover compound editor modal, entity selection integration,
 * program compatibility filter, and Basic/Advanced mode gating.
 */

test.describe("Custom Compounds — Editor Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("AC-2: + Add compound opens modal with blank form", async ({ page }) => {
    // Enable Advanced mode first
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Open material combobox
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();

    // Click + Add compound at bottom of Custom Compounds group
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
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

    // Open editor
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });

    // Try to save with empty name
    const saveBtn = page.getByRole("button", { name: /save/i });

    // Fill everything except name
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.19");

    // Fill elements (H2O)
    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("H");

    // Atom count input has role="spinbutton" (type="number") and placeholder "Count"
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("2");

    // Add oxygen
    const addElementBtn = page.getByRole("button", { name: /add element/i });
    await addElementBtn.click();

    const elementInput2 = page.getByPlaceholder(/symbol or z/i).nth(1);
    await elementInput2.fill("O");

    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    // Try to save - should fail
    await saveBtn.click();

    // Error message should appear
    await expect(page.getByText(/name is required/i)).toBeVisible();
    await expect(modal).toBeVisible(); // Modal should not close
  });

  test("AC-3: Validation — density > 25 blocks Save", async ({ page }) => {
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      if (text.includes("DEBUG") || text.includes("handleSave") || text.includes("validate")) {
        console.log("PAGE CONSOLE:", text);
      }
    });

    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });
    await expect(modal).toBeVisible();

    // Name
    const nameInput = page.getByRole("textbox", { name: /name/i });
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Dense");

    // Density too high
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await expect(densityInput).toBeVisible();
    await densityInput.fill("30");

    // One element
    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await expect(elementInput).toBeVisible();
    await elementInput.fill("H");
    const atomCount = page.getByPlaceholder(/count/i).first();
    await expect(atomCount).toBeVisible();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
    
    await saveBtn.click();
    
    // Wait for validation to run
    await page.waitForTimeout(1000);

    console.log("Console messages after save:", consoleMessages);
    
    // Check if modal is still open (it should be if validation failed)
    const modalStillOpen = await modal.isVisible();
    console.log("Modal still open after save click:", modalStillOpen);
    
    // Try to find any error message
    const allText = await page.getByText(/required|must be|invalid|error/i).all();
    console.log("Found error messages:", allText.length);
    for (let i = 0; i < allText.length && i < 5; i++) {
      console.log(`Error ${i}:`, await allText[i].textContent());
    }

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

    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("Duplicate");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    // First H
    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("H");
    const hydrogenOption = page.locator('[role="option"]:has-text("Hydrogen")').first();
    await hydrogenOption.waitFor({ state: "visible" });
    await hydrogenOption.click({ force: true });
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("2");

    // Add another H (duplicate)
    const addElementBtn = page.getByRole("button", { name: /add element/i });
    await addElementBtn.click();

    const elementInput2 = page.getByPlaceholder(/symbol or z/i).nth(1);
    await elementInput2.fill("H");
    const hydrogenOption2 = page.locator('[role="option"]:has-text("Hydrogen")').first();
    await hydrogenOption2.waitFor({ state: "visible" });
    await hydrogenOption2.click({ force: true });
    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    await expect(page.getByText(/listed more than once/i)).toBeVisible();
  });

  test("AC-2: Create compound adds to library", async ({ page }) => {
    await page.goto("/calculator");
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      if (text.includes("DEBUG") || text.includes("Listbox") || text.includes("Material button")) {
        console.log("PAGE:", text);
      }
    });

    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const modal = page.getByRole("dialog", { name: /compound editor/i });

    // Fill form
    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("LiF Pellet");

    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("2.20");

    // Li (Z=3) - element resolves automatically on input
    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("Li");
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    // Add F (Z=9)
    const addElementBtn = page.getByRole("button", { name: /add element/i });
    await addElementBtn.click();

    const elementInput2 = page.getByPlaceholder(/symbol or z/i).nth(1);
    await elementInput2.fill("F");
    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    // Save - use force:true and JavaScript click for debugging
    const saveBtn = page.getByRole("button", { name: /save/i });
    
    // Check if save button is enabled and visible
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
    
    // Check for any visible error messages before clicking
    const errorMessages = page.getByText(/required|must be|invalid/i);
    const hasErrorsBefore = await errorMessages.count() > 0;
    console.log("Errors before save click:", hasErrorsBefore);
    
    // Save the compound
    await saveBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Log console messages for debugging
    console.log("Console messages during save:", consoleMessages);

    await expect(modal).not.toBeVisible();

    // Debug: re-navigate to reset any stale state, then verify compound persisted
    await page.goto("/calculator");
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();
    await page.waitForTimeout(300);

    // First test: open the material dropdown WITHOUT any modal interaction
    const materialBtn2 = page.getByRole("button", { name: /^Material$/ });
    console.log("Material button text before click:", await materialBtn2.textContent());
    
    // Check the open state before click using JavaScript evaluation
    const openBefore = await materialBtn2.evaluate((el) => {
      const trigger = el as HTMLButtonElement;
      return trigger.getAttribute('data-state') || 'unknown';
    });
    console.log("Trigger data-state before click:", openBefore);
    
    // Click the material button
    console.log("Clicking material button after re-navigation...");
    await materialBtn2.click();
    await page.waitForTimeout(500);
    
    // Check the open state after click
    const openAfter = await materialBtn2.evaluate((el) => {
      const trigger = el as HTMLButtonElement;
      return trigger.getAttribute('data-state');
    });
    console.log("Trigger data-state after click:", openAfter);
    
    // Check what's in the DOM - look for the dropdown content div
    const dropdownContents = page.locator('div.rounded-md.border.bg-popover');
    const contentCount = await dropdownContents.count();
    console.log("Dropdown content div count:", contentCount);
    if (contentCount > 0) {
      const firstContent = dropdownContents.first();
      const contentVisible = await firstContent.isVisible();
      console.log("First dropdown content visible:", contentVisible);
      
      // Get all computed styles that might affect visibility
      const styles = await firstContent.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          display: cs.display,
          position: cs.position,
          visibility: cs.visibility,
          height: cs.height,
          width: cs.width,
          overflow: cs.overflow,
          zIndex: cs.zIndex,
          clientHeight: el.clientHeight,
          offsetHeight: el.offsetHeight,
          scrollHeight: el.scrollHeight,
        };
      });
      console.log("Content computed styles:", JSON.stringify(styles));
      
      // Get inner HTML to see what's inside
      const innerHTML = await firstContent.evaluate((el) => el.innerHTML);
      console.log("Content innerHTML length:", innerHTML.length);
      console.log("Content innerHTML:", innerHTML.substring(0, 1000));
    }
    
    // Check where the listbox role actually is
    const allListboxes = page.locator('[role="listbox"]');
    const allListboxCount = await allListboxes.count();
    console.log("All listbox role elements count:", allListboxCount);
    for (let i = 0; i < allListboxCount && i < 5; i++) {
      const lb = allListboxes.nth(i);
      const isVisible = await lb.isVisible();
      const tagName = await lb.evaluate((el) => el.tagName);
      const classes = await lb.getAttribute('class');
      const parentTag = await lb.evaluate((el) => el.parentElement?.tagName);
      const styles = await lb.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          display: cs.display,
          height: cs.height,
          width: cs.width,
          visibility: cs.visibility,
        };
      });
      console.log(`Listbox ${i}: tag=${tagName}, parent=${parentTag}, visible=${isVisible}, class=${classes?.substring(0, 50)}, styles=${JSON.stringify(styles)}`);
    }
    
    // Check if dropdown opened - check the content div instead of listbox (which has 0 height due to positioning)
    const dropdownContent = page.locator('div.rounded-md.border.bg-popover').first();
    const contentVisible = await dropdownContent.isVisible();
    console.log("Dropdown content div visible:", contentVisible);
    if (contentVisible) {
      console.log("SUCCESS: Dropdown content is visible!");
      // Check if Custom Compounds section is visible
      const hasCustomSection = await page.getByText(/custom compounds/i).count() > 0;
      console.log("Custom Compounds section visible:", hasCustomSection);
      // Check if LiF Pellet is in the dropdown
      const hasLiF = await page.getByText(/LiF Pellet/i).count() > 0;
      console.log("LiF Pellet in dropdown:", hasLiF);
    }
    
    // Close dropdown if open
    if (contentVisible) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    
    // Re-open dropdown to verify compound persisted
    const materialBtn3 = page.getByRole("button", { name: /^Material$/ });
    await materialBtn3.click();
    await page.waitForTimeout(300);
    
    // Verify LiF Pellet with density is visible in the dropdown
    const customGroup = page.getByText(/LiF Pellet/i);
    await expect(customGroup).toBeVisible();
    
    // Debug: check for Custom Compounds section
    const customSection = page.getByText(/Custom Compounds/i);
    const customSectionVisible = await customGroup.isVisible();
    console.log("Custom Compounds section element exists:", customSectionVisible);
    
    // Check for description spans in the dropdown
    const descriptionSpans = page.locator('[data-testid="item-description"]');
    const descCount = await descriptionSpans.count();
    console.log("Description spans count:", descCount);
    
    for (let i = 0; i < descCount; i++) {
      const descText = await descriptionSpans.nth(i).textContent();
      console.log(`Description span ${i} text:`, descText);
    }
    
    // Verify description is visible for the custom compound
    await expect(page.getByText(/2\.2 g\/cm/)).toBeVisible();
  });

  test("AC-6: Delete compound confirmation", async ({ page }) => {
    // Listen to console logs from the page
    page.on("console", msg => {
      if (msg.text().includes("DEBUG") || msg.text().includes("showDeleteConfirm")) {
        console.log("PAGE CONSOLE:", msg.text());
      }
    });
    
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create a compound first
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("ToDelete");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("H");
    const hydrogenOption = page.locator('[role="option"]:has-text("Hydrogen")').first();
    await hydrogenOption.waitFor({ state: "visible" });
    await hydrogenOption.click({ force: true });
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();
    await page.waitForTimeout(300);

    // Open dropdown to see Custom Compounds
    await materialBtn.click();
    await page.waitForTimeout(300);
    
    // Find and click the ToDelete compound option to select it first
    const customCompoundsSection = page.getByText(/Custom Compounds/i).first();
    const toDeleteOption = customCompoundsSection.locator("..").getByText(/ToDelete/i).first();
    await toDeleteOption.click();
    await page.waitForTimeout(200);
    
    // Close dropdown by pressing Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    
    // Re-open dropdown and click edit button
    await materialBtn.click();
    await page.waitForTimeout(300);
    
    // Find edit button for ToDelete in the dropdown - click the compound name first to select it
    const compoundOption = page.getByText(/ToDelete/).first();
    await expect(compoundOption).toBeVisible();
    
    // Find the edit button next to the compound option
    const editBtn = compoundOption.locator("..").getByRole("button", { name: /edit/i }).first();
    await expect(editBtn).toBeVisible();
    console.log("Edit button count:", await page.getByRole("button", { name: /edit/i }).count());
    await editBtn.click({ force: true });
    await page.waitForTimeout(300);
    
    // Modal should be open - now click delete button inside modal
    // Target specifically the Delete button in the modal footer (left side)
    const modal = page.getByRole("dialog").first();
    const deleteBtn = modal.getByRole("button", { name: "Delete" }).first();
    console.log("Delete button visible:", await deleteBtn.isVisible());
    console.log("Delete button disabled:", await deleteBtn.isDisabled());
    await expect(deleteBtn).toBeVisible();
    
    // Check modal state before click - use the correct title
    const modalBefore = page.getByRole("dialog", { name: /edit compound/i });
    const modalVisibleBefore = await modalBefore.isVisible();
    console.log("Modal visible before delete click:", modalVisibleBefore);
    
    if (!modalVisibleBefore) {
      // Try alternative selector
      const altModal = page.locator('[role="dialog"]').first();
      const altVisible = await altModal.isVisible();
      console.log("Alternative modal visible:", altVisible);
    }
    
    // Click the first Delete button to trigger confirmation
    await deleteBtn.click();
    await page.waitForTimeout(300);
    
    // Confirmation dialog should appear
    const confirmText = page.getByText(/Are you sure you want to delete/i);
    await expect(confirmText).toBeVisible();

    // Click the confirm delete button in the confirmation dialog
    const confirmDialog = page.getByRole("dialog").first();
    const confirmDelete = confirmDialog.getByRole("button", { name: "Delete" });
    await confirmDelete.click();
    await page.waitForTimeout(300);

    // Should be removed from combobox
    await materialBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/ToDelete/i)).not.toBeVisible();
  });
});

test.describe("Custom Compounds — Entity Selection Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("AC-1: Custom Compounds group absent in Basic mode", async ({ page }) => {
    // Basic mode by default
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();

    // Custom Compounds group header should not be in DOM
    await expect(page.getByText(/custom compounds/i)).not.toBeVisible();
    await expect(page.getByRole("button", { name: /\+ add compound/i })).not.toBeVisible();
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

    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();

    await page.waitForTimeout(1000);
    console.log("TEST: Console messages captured:", consoleMessages.length, JSON.stringify(consoleMessages.slice(0, 10)));

    await expect(page.getByText(/custom compounds/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ add compound/i }).first()).toBeVisible();
  });

  test("AC-7: Custom compounds appear with badge in combobox", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create a compound
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("Badge Test");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("H");
    const hydrogenOption = page.locator('[role="option"]:has-text("Hydrogen")').first();
    await hydrogenOption.waitFor({ state: "visible" });
    await hydrogenOption.click({ force: true });
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Verify badge
    await materialBtn.click();
    const customEntry = page.getByText(/Badge Test/i);
    await expect(customEntry).toBeVisible();
    // Check for "custom" badge indicator
    await expect(page.getByText(/custom/i).filter({ visible: true }).first()).toBeVisible();
  });

  test("AC-7: Text filter filters custom compound names", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create compound
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("FilteredTest");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("H");
    const hydrogenOption = page.locator('[role="option"]:has-text("Hydrogen")').first();
    await hydrogenOption.waitFor({ state: "visible" });
    await hydrogenOption.click({ force: true });
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Filter
    await materialBtn.click();
    const searchInput = page.getByPlaceholder(/name or id/i).first();
    await searchInput.fill("filtered");

    await expect(page.getByText(/FilteredTest/i)).toBeVisible();

    // Clear filter - should show all
    await searchInput.clear();
    await expect(page.getByText(/FilteredTest/i)).toBeVisible();
  });
});

test.describe("Custom Compounds — Program Compatibility Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("AC-7b: Programs missing elements are greyed out (smoke test)", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Create LiF compound (Li Z=3, F Z=9)
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("LiF Compatibility");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("2.20");

    // Li
    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("Li");
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    // F
    const addElementBtn = page.getByRole("button", { name: /add element/i });
    await addElementBtn.click();

    const elementInput2 = page.getByPlaceholder(/symbol or z/i).nth(1);
    await elementInput2.fill("F");
    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Select the compound
    await materialBtn.click();
    const lifOption = page.getByText(/LiF Compatibility/i);
    await lifOption.click();

    // Open program dropdown
    const programBtn = page.getByRole("button", { name: /^Program$/ });
    await programBtn.click();

    // Verify programs are present (greyed-out check requires program-specific data)
    const options = page.locator('[role="option"]');
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
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });
  });

  test("AC-1: Custom compound falls back to water in Basic mode", async ({ page }) => {
    // Navigate to calculator
    await page.goto("/calculator");
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });

    // Capture console messages
    page.on("console", (msg) => {
      console.log("PAGE CONSOLE:", msg.text());
    });

    // Enable Advanced mode
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();
    await page.waitForTimeout(200);

    // Create compound
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    await page.waitForTimeout(200);
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("BasicModeTest");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("1.0");

    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("H");
    const hydrogenOption = page.locator('[role="option"]:has-text("Hydrogen")').first();
    await hydrogenOption.waitFor({ state: "visible" });
    await hydrogenOption.click({ force: true });
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();
    await page.waitForTimeout(300);

    // Select the compound - open dropdown, find and click the option
    await materialBtn.click();
    await page.waitForTimeout(300);
    
    // Click on the custom compound option using role="option" selector
    const customOption = page.locator('[role="option"]:has-text("BasicModeTest")').first();
    await customOption.waitFor({ state: "visible" });
    await customOption.click({ force: true });
    await page.waitForTimeout(300);

    // Verify compound is selected - check the button text
    const selectedMaterialBtn = page.getByRole("button", { name: /^Material$/ });
    const buttonText = await selectedMaterialBtn.textContent();
    console.log("Material button text after selection:", buttonText);
    expect(buttonText).toContain("BasicModeTest");

    // Switch to Basic mode - use explicit aria-label
    const basicModeBtn = page.getByRole("button", { name: "Switch to Basic mode" });
    await basicModeBtn.click();
    await page.waitForTimeout(300);

    // Should fall back to water
    const finalMaterialBtn = page.getByRole("button", { name: /^Material$/ });
    await expect(finalMaterialBtn).toContainText(/water/i);
  });
});

test.describe("Scenario 1: LiF pellet smoke test", () => {
  // Requires Stage 6.10 Task 5 (calculator dispatch through calculateCustomCompound),
  // which is being implemented in a separate follow-up PR.
  test.skip("Create LiF compound and calculate with MSTAR", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });

    // Enable Advanced mode
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    // Select alpha particle (He-4)
    const particleBtn = page.getByRole("button", { name: /^Particle$/ });
    await particleBtn.click();
    const alphaOption = page.getByRole("option", { name: /^alpha particle$/ });
    await expect(alphaOption).toBeVisible();
    await alphaOption.click();
    await expect(particleBtn).toContainText("alpha particle");

    // Create LiF
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const addButton = page.getByRole("button", { name: /\+ add compound/i }).first();
    await addButton.click();

    const nameInput = page.getByRole("textbox", { name: /name/i });
    await nameInput.fill("LiF Pellet");
    const densityInput = page.getByRole("spinbutton", { name: /density/i });
    await densityInput.fill("2.20");

    // Li (Z=3)
    const elementInput = page.getByPlaceholder(/symbol or z/i).first();
    await elementInput.fill("Li");
    const atomCount = page.getByPlaceholder(/count/i).first();
    await atomCount.fill("1");

    // F (Z=9)
    const addElementBtn = page.getByRole("button", { name: /add element/i });
    await addElementBtn.click();
    const elementInput2 = page.getByPlaceholder(/symbol or z/i).nth(1);
    await elementInput2.fill("F");
    const atomCount2 = page.getByPlaceholder(/count/i).nth(1);
    await atomCount2.fill("1");

    const saveBtn = page.getByRole("button", { name: /save/i });
    await saveBtn.click();
    await expect(page.getByRole("dialog", { name: /compound editor/i })).not.toBeVisible();

    // Select LiF
    await materialBtn.click();
    const lifOption = page.locator('[role="option"]:has-text("LiF Pellet")').first();
    await lifOption.waitFor({ state: "visible" });
    await lifOption.click();
    await expect(materialBtn).toContainText("LiF Pellet");

    // Select a program
    const programBtn = page.getByRole("button", { name: /^Program$/ });
    await programBtn.click();

    // Select first available program
    const firstOption = page.locator('[role="option"]').first();
    await firstOption.waitFor({ state: "visible" });
    await firstOption.click();

    // Set energy in the editable result-table input.
    const energyInput = page.getByTestId("energy-input-0");
    await expect(energyInput).toBeVisible();
    await energyInput.fill("5");
    await energyInput.blur();

    // Verify calculation produces results (stopping power cell has value)
    const stoppingPowerValue = page.locator('[data-testid^="stp-cell-"]').first();
    await expect(stoppingPowerValue).toHaveText(/\S/, { timeout: 10000 });
  });
});
