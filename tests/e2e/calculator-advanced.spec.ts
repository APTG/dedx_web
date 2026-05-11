import { test, expect } from "@playwright/test";

/**
 * E2E tests for Calculator Advanced Mode (Multi-Program Comparison).
 *
 * These tests verify the advanced mode toggle, program selection, URL state,
 * and round-trip encoding/decoding for the multi-program feature.
 *
 * Note: Tests that require WASM calculation are skipped when WASM binary is absent.
 * CI downloads the WASM artifact before running E2E tests.
 */

test.describe("Advanced mode", () => {
  test("Basic/Advanced toggle is visible in toolbar", async ({ page }) => {
    await page.goto("/calculator");

    // Wait for the page to load
    await expect(page.getByRole("heading", { name: "Calculator" })).toBeVisible();

    // The advanced mode toggle should be in the top-right action bar
    const advancedToggle = page.locator('button:has-text("Advanced")');
    await expect(advancedToggle).toBeVisible();
  });

  test("Clicking Advanced does not throw effect_update_depth_exceeded", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/calculator");
    // Wait for WASM and URL sync before toggling (state + calcState must be ready)
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();

    // Allow effects to settle — wait for mode URL update instead of fixed delay
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    expect(errors.filter((e) => e.includes("effect_update_depth_exceeded"))).toHaveLength(0);
  });

  test("Toggling Advanced on/off/on does not cause errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    const basicToggle = page.locator('button[aria-label="Switch to Basic mode"]');
    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');

    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });
    await basicToggle.click();
    await page.waitForFunction(() => !window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });
    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    await expect(page.getByRole("heading", { name: "Calculator" })).toBeVisible();
    expect(errors.filter((e) => e.includes("effect_update_depth_exceeded"))).toHaveLength(0);
  });

  test("Advanced mode URL contains mode=advanced after toggling on", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();

    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });
    expect(page.url()).toContain("mode=advanced");
  });

  test("Column drag-and-drop reordering", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    // Enable advanced mode
    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    // Add a second program (MSTAR)
    const programCombobox = page.getByLabel("Program");
    await programCombobox.click();
    await page.getByRole("option", { name: "MSTAR" }).click();
    // Wait for MSTAR column to appear
    await page.waitForSelector('th[data-program-id="101"]:has-text("MSTAR")', { timeout: 5000 });

    // Check initial column order (PSTAR should be first)
    const stpGroup = page.getByRole("columnheader", { name: "Stopping Power" });
    await expect(stpGroup).toBeVisible();

    // Find PSTAR and MSTAR subheaders in STP group
    const pstarHeader = page.locator('th[data-program-id="9"]:has-text("PSTAR")').first();
    const mstarHeader = page.locator('th[data-program-id="101"]:has-text("MSTAR")').first();

    // PSTAR should be first (default), MSTAR second
    await expect(pstarHeader).toBeVisible();
    await expect(mstarHeader).toBeVisible();

    // Drag MSTAR to position before PSTAR (should not work - PSTAR is fixed as default)
    await mstarHeader.dragTo(pstarHeader, { sourcePosition: { x: 50, y: 10 }, targetPosition: { x: 10, y: 10 } });
    // Wait for drag operation to complete
    await page.waitForFunction(() => !document.querySelector('[data-dragging]'), { timeout: 2000 });

    // PSTAR should still be first (default program cannot be moved)
    const firstHeaderAfterDrag = page.locator('tr:nth-child(2) th:nth-child(2)').first();
    await expect(firstHeaderAfterDrag).toContainText("PSTAR");
  });

  test("Keyboard column reordering with Alt+Arrow", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    // Enable advanced mode
    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    // Add a second program (MSTAR)
    const programCombobox = page.getByLabel("Program");
    await programCombobox.click();
    await page.getByRole("option", { name: "MSTAR" }).click();
    // Wait for MSTAR column to appear
    await page.waitForSelector('th[data-program-id="101"]:has-text("MSTAR")', { timeout: 5000 });

    // Focus on MSTAR column header and try Alt+Arrow
    const mstarHeader = page.locator('th[data-program-id="101"]:has-text("MSTAR")').first();
    await mstarHeader.focus();

    // Alt+Right should move MSTAR right (if possible)
    await page.keyboard.press("Alt+ArrowRight");
    // Wait for announcement to appear
    await page.waitForSelector('[aria-live="polite"]:not(:empty)', { timeout: 2000 });

    // Check that an announcement was made
    const announcement = page.getByRole("status").or(page.locator('[aria-live="polite"]'));
    await expect(announcement).toBeVisible();
  });

  test("Default program column cannot be dragged", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    // Enable advanced mode with multiple programs
    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    const programCombobox = page.getByLabel("Program");
    await programCombobox.click();
    await page.getByRole("option", { name: "MSTAR" }).click();
    // Wait for MSTAR column to appear
    await page.waitForSelector('th[data-program-id="101"]:has-text("MSTAR")', { timeout: 5000 });

    // PSTAR (default) should have draggable="false" and aria-disabled="true"
    const pstarHeader = page.locator('th[data-program-id="9"]:has-text("PSTAR")').first();
    await expect(pstarHeader).toHaveAttribute("draggable", "false");
    await expect(pstarHeader).toHaveAttribute("aria-disabled", "true");

    // MSTAR (non-default) should be draggable
    const mstarHeader = page.locator('th[data-program-id="101"]:has-text("MSTAR")').first();
    await expect(mstarHeader).toHaveAttribute("draggable", "true");
  });

  test("Column visibility toggle - hide/show program", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });

    // Enable advanced mode with multiple programs
    const advancedToggle = page.locator('button[aria-label="Switch to Advanced mode"]');
    await advancedToggle.click();
    await page.waitForFunction(() => window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    const programCombobox = page.getByLabel("Program");
    await programCombobox.click();
    await page.getByRole("option", { name: "MSTAR" }).click();
    // Wait for MSTAR column to appear
    await page.waitForSelector('th[data-program-id="101"]:has-text("MSTAR")', { timeout: 5000 });

    // Find and click the "Columns..." button
    const columnsButton = page.getByRole("button", { name: /Columns/ });
    await expect(columnsButton).toBeVisible();
    await columnsButton.click();

    // MSTAR checkbox should be visible in the dropdown
    const mstarCheckbox = page.getByRole("checkbox", { name: /MSTAR/ });
    await expect(mstarCheckbox).toBeChecked();

    // Uncheck MSTAR to hide it
    await mstarCheckbox.click();
    // Wait for MSTAR column to disappear
    await page.waitForSelector('th[data-program-id="101"]', { state: "hidden", timeout: 2000 });

    // MSTAR column should be hidden
    const mstarHeaders = page.locator('th[data-program-id="101"]');
    await expect(mstarHeaders).toHaveCount(0);

    // URL should contain hidden_programs parameter
    await expect(page).toHaveURL(/hidden_programs=/);
  });
});
