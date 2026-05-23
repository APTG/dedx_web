import { test, expect, type Page } from "@playwright/test";

const ICRU49_ID = 7;
const ICRU73_OLD_ID = 5;
const ASTAR_ID = 1;
const PSTAR_ID = 2;
const MSTAR_ID = 4;

async function gotoAdvanced(page: Page, query = "particle=1&material=276") {
  await page.goto(`/calculator?${query}&mode=advanced&qfocus=both`);
  await page.waitForFunction(
    () => new URLSearchParams(window.location.search).get("mode") === "advanced",
    {
      timeout: 15000,
    },
  );
  expect(page.url()).toContain("mode=advanced");
  // The advanced toolbar is rendered by EntitySelection when isAdvancedMode.value is true,
  // which happens synchronously after initAdvancedModeFromUrl() processes the URL param.
  // Waiting for it ensures the entity picker has fully hydrated advanced-mode state before
  // we interact with program multi-select.
  await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible();
}

async function selectComparisonProgram(page: Page, programName: RegExp, programId: number) {
  // Programs are now selected via the program tab in the entity picker (multi-select mode).
  await page.getByTestId("picker-tab-program").click();
  await page.getByTestId("picker-program-list").getByRole("option", { name: programName }).click();
  await expect(page.locator(`th[data-program-id="${programId}"]`).first()).toBeVisible();
  // Collapse the picker panel via Escape (the same handler used by keyboard users) so
  // the panel does not obscure subsequent drag-and-drop or column-header interactions.
  await page.keyboard.press("Escape");
}

async function stpHeaderOrder(page: Page): Promise<string[]> {
  return page.locator("thead tr:nth-child(2) th").evaluateAll((headers) => {
    const half = headers.length / 2;
    return headers.slice(0, half).map((header) => header.textContent?.trim() ?? "");
  });
}

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
    await gotoAdvanced(page);
    await selectComparisonProgram(page, /PSTAR/, PSTAR_ID);

    const stpGroup = page.getByRole("columnheader", { name: /Stopping Power/ });
    await expect(stpGroup).toBeVisible();

    const defaultHeader = page
      .locator(`th[data-program-id="${ICRU49_ID}"]:has-text("ICRU 49")`)
      .first();
    const pstarHeader = page.locator(`th[data-program-id="${PSTAR_ID}"]:has-text("PSTAR")`).first();
    await expect(defaultHeader).toBeVisible();
    await expect(pstarHeader).toBeVisible();

    const initialOrder = await stpHeaderOrder(page);
    await pstarHeader.dragTo(defaultHeader, {
      sourcePosition: { x: 50, y: 10 },
      targetPosition: { x: 10, y: 10 },
    });

    await expect.poll(() => stpHeaderOrder(page)).toEqual(initialOrder);
  });

  test("Keyboard column reordering with Alt+Arrow", async ({ page }) => {
    await gotoAdvanced(page, "particle=6&material=276");
    await selectComparisonProgram(page, /ICRU 73 \(old\)/, ICRU73_OLD_ID);
    await selectComparisonProgram(page, /MSTAR/, MSTAR_ID);

    const oldIcruHeader = page
      .locator(`th[data-program-id="${ICRU73_OLD_ID}"]:has-text("ICRU 73 (old)")`)
      .first();
    await oldIcruHeader.focus();

    await page.keyboard.press("Alt+ArrowRight");

    await expect.poll(() => stpHeaderOrder(page)).toEqual(["ICRU 73 ◆", "MSTAR", "ICRU 73 (old)"]);
    await expect(page.locator('[role="status"][aria-atomic="true"]')).toHaveText(
      "ICRU 73 (old) moved to position 3 of 3.",
    );
  });

  test("Default program column cannot be dragged", async ({ page }) => {
    await gotoAdvanced(page);
    await selectComparisonProgram(page, /PSTAR/, PSTAR_ID);

    const defaultHeader = page
      .locator(`th[data-program-id="${ICRU49_ID}"]:has-text("ICRU 49")`)
      .first();
    await expect(defaultHeader).toHaveAttribute("draggable", "false");
    await expect(defaultHeader).toHaveAttribute("aria-disabled", "true");

    const pstarHeader = page.locator(`th[data-program-id="${PSTAR_ID}"]:has-text("PSTAR")`).first();
    await expect(pstarHeader).toHaveAttribute("draggable", "true");
  });

  test("Column visibility toggle - hide/show program", async ({ page }) => {
    await gotoAdvanced(page, "particle=6&material=276");
    await selectComparisonProgram(page, /MSTAR/, MSTAR_ID);

    // Find and click the "Columns..." button
    const columnsButton = page.getByRole("button", { name: /Columns/ });
    await expect(columnsButton).toBeVisible();
    await columnsButton.click();

    // MSTAR checkbox should be visible in the dropdown
    const mstarCheckbox = page.getByRole("checkbox", { name: /MSTAR/ });
    await expect(mstarCheckbox).toBeChecked();

    // Uncheck MSTAR to hide it
    await mstarCheckbox.click();

    const mstarHeaders = page.locator(`th[data-program-id="${MSTAR_ID}"]`);
    await expect(mstarHeaders).toHaveCount(0);

    // URL should contain hidden_programs parameter
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("hidden_programs") === "4",
      { timeout: 5000 },
    );
  });

  test("out-of-range comparison program shows an error without hiding safe program results", async ({
    page,
  }) => {
    await gotoAdvanced(page, "particle=2&material=276&program=4");
    await expect(page.locator(`[data-testid="stp-cell-${MSTAR_ID}-0"]`)).toContainText(/\d/, {
      timeout: 15000,
    });

    await selectComparisonProgram(page, /ASTAR/, ASTAR_ID);
    await expect(page.locator(`[data-testid="stp-cell-${ASTAR_ID}-0"]`)).toContainText(/\d/, {
      timeout: 15000,
    });

    await page.locator('[data-testid="energy-input-0"]').fill("2000");
    await page.locator('[data-testid="energy-input-0"]').blur();

    const safeCell = page.locator(`[data-testid="stp-cell-${MSTAR_ID}-0"]`);
    await expect(safeCell).toContainText(/\d/, { timeout: 15000 });
    await expect(safeCell).not.toContainText("⚠️");

    const outOfRangeCell = page.locator(`[data-testid="stp-cell-${ASTAR_ID}-0"]`);
    await expect(outOfRangeCell).toContainText("⚠️", { timeout: 15000 });
    await expect(outOfRangeCell.locator("span")).toHaveAttribute(
      "title",
      /Energy out of tabulated range/,
    );
  });
});
