import { test, expect } from "@playwright/test";

test("debug: modal opens on add button click", async ({ page }) => {
  await page.goto("/calculator");
  await page.waitForSelector('[aria-label="Particle"]', { timeout: 15000 });

  // Enable Advanced mode
  await page.getByRole("button", { name: "Switch to Advanced mode" }).click();
  await page.waitForTimeout(500);

  // Open material combobox - use exact role as the original test
  const materialBtn = page.getByRole("button", { name: /^Material$/, exact: true });
  await expect(materialBtn).toBeVisible();
  await materialBtn.click();

  // Wait for dropdown content to be visible
  await page.waitForSelector('[data-testid="dropdown-scroll-container"]', { timeout: 5000, state: "visible" });

  // Find and click + Add compound button using testid
  const addButton = page.getByTestId("add-compound-button");
  await expect(addButton).toBeVisible();
  await addButton.click();

  // Wait for modal overlay to appear
  await page.waitForSelector('[data-state="open"]', { timeout: 3000 });

  // Take screenshot for debugging
  await page.screenshot({ path: "test-results/modal-after-click.png", fullPage: true });

  // Check for dialog role
  const dialogs = await page.getByRole("dialog").all();
  console.log("Number of dialogs found:", dialogs.length);

  // Check for "Compound Editor" text
  const editorText = page.getByText(/compound editor/i);
  const editorVisible = await editorText.isVisible().catch(() => false);
  console.log("Compound Editor text visible:", editorVisible);

  // Check all inputs (not just textboxes)
  const allInputs = await page.locator("input").all();
  console.log("Number of inputs found:", allInputs.length);
  for (let i = 0; i < allInputs.length; i++) {
    const label = await allInputs[i].getAttribute("aria-label");
    const id = await allInputs[i].getAttribute("id");
    const type = await allInputs[i].getAttribute("type");
    const placeholder = await allInputs[i].getAttribute("placeholder");
    console.log(`Input ${i}: id=${id}, type=${type}, aria-label=${label}, placeholder=${placeholder}`);
  }

  // Check all labels
  const allLabels = await page.locator("label").all();
  console.log("Number of labels found:", allLabels.length);
  for (let i = 0; i < allLabels.length; i++) {
    const text = await allLabels[i].textContent();
    const htmlFor = await allLabels[i].getAttribute("for");
    console.log(`Label ${i}: for=${htmlFor}, text=${text}`);
  }

  // Try to find density input by id using locator
  const densityById = page.locator("#compound-density");
  const densityByIdCount = await densityById.count();
  console.log("Density input by id count:", densityByIdCount);
  if (densityByIdCount > 0) {
    const type = await densityById.first().getAttribute("type");
    console.log("Density input type:", type);
  }

  // Check for tabs
  const tabs = await page.getByRole("tab").all();
  console.log("Number of tabs found:", tabs.length);
  for (let i = 0; i < tabs.length; i++) {
    const text = await tabs[i].textContent();
    const selected = await tabs[i].getAttribute("aria-selected");
    console.log(`Tab ${i}: text=${text}, aria-selected=${selected}`);
  }

  // Check for formula tab specifically
  const formulaTab = page.getByRole("tab", { name: "Formula" });
  const formulaTabVisible = await formulaTab.isVisible().catch(() => false);
  console.log("Formula tab visible:", formulaTabVisible);
  if (formulaTabVisible) {
    const selected = await formulaTab.getAttribute("aria-selected");
    console.log("Formula tab aria-selected:", selected);
  }

  // Check all buttons in dialog
  const dialog = page.getByRole("dialog");
  const buttons = await dialog.getByRole("button").all();
  console.log("Buttons in dialog:", buttons.length);
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    const role = await buttons[i].getAttribute("role");
    console.log(`Button ${i}: role=${role}, text=${text}`);
  }

  // Try to find Formula text directly
  const formulaText = page.getByText("Formula", { exact: true });
  const formulaTextVisible = await formulaText.isVisible().catch(() => false);
  console.log("Formula text visible:", formulaTextVisible);
});
