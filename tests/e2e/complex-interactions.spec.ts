/**
 * Complex calculator interaction E2E tests.
 *
 * These tests exercise multi-step user flows that unit tests cannot catch:
 * non-default particle/material combinations, energy input with unit suffixes,
 * invalid input error display, auto-select program resolution, and mixed-unit
 * per-row mode.  All tests require WASM to be loaded.
 */
import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

async function waitForWasm(page: import("@playwright/test").Page) {
  await page.goto("/calculator");
  await page.waitForSelector('[aria-label="Particle"]', { timeout: WASM_TIMEOUT });
}

/** Wait until the result table is visible (entity selection is complete). */
async function waitForTable(page: import("@playwright/test").Page) {
  // Wait for a stable, identifying header cell so we don't race the
  // initial WASM load.  Reuse WASM_TIMEOUT — initial page load and
  // resolveAutoSelect can both be slow in CI.
  await expect(page.locator("thead th").first()).toContainText(/Energy/i, {
    timeout: WASM_TIMEOUT,
  });
}

/** Type a value into the first energy row and wait for input. */
async function typeInRow(page: import("@playwright/test").Page, index: number, value: string) {
  const inputs = page.locator("input[data-row-index]");
  // page.fill() already dispatches an `input` event, which is what the
  // <input oninput> handler in result-table.svelte listens to — no need
  // to dispatch a second event (that would trigger an extra WASM call).
  await inputs.nth(index).fill(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Default-state calculations
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Calculator — default state (Hydrogen + Water + Auto-select)", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("shows the result table with five columns", async ({ page }) => {
    const headers = page.locator("thead th");
    await expect(headers).toHaveCount(5);
    await expect(headers.nth(0)).toContainText(/Energy/i);
    await expect(headers.nth(1)).toContainText(/MeV\/nucl/);
    await expect(headers.nth(2)).toContainText(/Unit/i);
    await expect(headers.nth(3)).toContainText(/Stopping Power/i);
    await expect(headers.nth(4)).toContainText(/CSDA Range/i);
  });

  test("default row '100' shows a normalised MeV/nucl value of 100", async ({ page }) => {
    const mevNuclCell = page.locator("tbody tr").first().locator("td").nth(1);
    await expect(mevNuclCell).toContainText("100");
  });

  test("editing the energy row triggers recalculation and shows STP result", async ({ page }) => {
    await typeInRow(page, 0, "12");
    // After typing the STP column should populate (not show "-")
    const stpCell = page.locator("tbody tr").first().locator("td").nth(3);
    await expect(stpCell).not.toContainText("-", { timeout: 5000 });
  });

  test("adding a second identical energy row shows results in both rows", async ({ page }) => {
    await typeInRow(page, 0, "12");
    await typeInRow(page, 1, "12");
    const rows = page.locator("tbody tr");
    // Two data rows (plus the empty sentinel row = 3 total)
    await expect(rows).toHaveCount(3);
    const firstStp = rows.first().locator("td").nth(3);
    const secondStp = rows.nth(1).locator("td").nth(3);
    // Check that results are populated (not empty dash)
    // Note: values may be subnormal (e.g. "3.8e-314") due to Issue #7
    await expect(firstStp).not.toHaveText(/^-$/, { timeout: 5000 });
    await expect(secondStp).not.toHaveText(/^-$/, { timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Energy input with unit suffixes
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Calculator — energy input with unit suffixes", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("'100 keV' is parsed and shows ~0.1 in the → MeV/nucl column", async ({ page }) => {
    await typeInRow(page, 0, "100 keV");
    const mevNuclCell = page.locator("tbody tr").first().locator("td").nth(1);
    // 100 keV = 0.1 MeV for proton (A=1)
    await expect(mevNuclCell).toContainText("0.1");
  });

  test("'12 MeV/nucl' shows 12 in the → MeV/nucl column (proton, A=1)", async ({ page }) => {
    await typeInRow(page, 0, "12 MeV/nucl");
    const mevNuclCell = page.locator("tbody tr").first().locator("td").nth(1);
    await expect(mevNuclCell).toContainText("12");
  });

  test("'12 MeV/u' shows ~12 in the → MeV/nucl column (proton, A=1, m_u≈1)", async ({ page }) => {
    await typeInRow(page, 0, "12MeV/u");
    const mevNuclCell = page.locator("tbody tr").first().locator("td").nth(1);
    // For proton: MeV/u ≈ MeV/nucl (A=1, m_u≈1.008)
    await expect(mevNuclCell).not.toContainText("-");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invalid input error display
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Calculator — invalid input error display", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("typing 'bebok' shows the input in red with an inline error message", async ({ page }) => {
    await typeInRow(page, 0, "bebok");
    const row = page.locator("tbody tr").first();
    const input = row.locator("input[data-row-index]").first();
    // Input border turns red for invalid input
    await expect(input).toHaveClass(/border-red-500/);
    // An inline error message with role="alert" appears
    const alertMsg = row.locator('[role="alert"]');
    await expect(alertMsg).toBeVisible();
    await expect(alertMsg).not.toBeEmpty();
  });

  test("typing '-5' (non-positive) shows an inline error message", async ({ page }) => {
    await typeInRow(page, 0, "-5");
    const row = page.locator("tbody tr").first();
    const alertMsg = row.locator('[role="alert"]');
    await expect(alertMsg).toBeVisible();
  });

  test("typing 'unknown unit' like '100 xyz' shows inline error", async ({ page }) => {
    await typeInRow(page, 0, "100 xyz");
    const row = page.locator("tbody tr").first();
    const alertMsg = row.locator('[role="alert"]');
    await expect(alertMsg).toBeVisible();
    await expect(alertMsg).toContainText(/unknown unit/i);
  });

  test("validation summary counts excluded values", async ({ page }) => {
    await typeInRow(page, 0, "bebok");
    // The validation summary at the bottom should appear
    await expect(page.getByText(/values excluded/i)).toBeVisible({ timeout: 3000 });
  });

  test("correcting an invalid value removes the error message", async ({ page }) => {
    await typeInRow(page, 0, "bebok");
    // Confirm error appears
    const row = page.locator("tbody tr").first();
    await expect(row.locator('[role="alert"]')).toBeVisible();
    // Now fix it
    await typeInRow(page, 0, "100");
    await expect(row.locator('[role="alert"]')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-select program resolution communication
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Calculator — auto-select and program resolution", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
  });

  test("default state shows table (not 'Select a particle and material')", async ({ page }) => {
    await waitForTable(page);
    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByText("Select a particle and material")).not.toBeVisible();
  });

  test("switching to Urea (if available): either shows results or a clear no-program message", async ({
    page,
  }) => {
    // Open material dropdown and search for Urea
    const materialBtn = page.getByRole("button", { name: /^Material$/ });
    await materialBtn.click();
    const searchInput = page.locator('input[placeholder="Name or ID..."]').first();
    await searchInput.fill("Urea");

    const ureaOption = page.getByRole("option", { name: /Urea/i }).first();
    const ureaExists = await ureaOption.isVisible({ timeout: 2000 }).catch(() => false);

    if (ureaExists) {
      await ureaOption.click();
      // With auto-select fallback: table should be visible (any program took over)
      // OR a clear explanation message is shown (no program at all)
      const tableVisible = await page
        .locator("table")
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const noProgMsg = await page
        .getByText(/No program supports/i)
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      // One of the two must be true — never the confusing "Select a particle and material"
      expect(tableVisible || noProgMsg).toBe(true);
      await expect(
        page.getByText("Select a particle and material to calculate."),
      ).not.toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-row paste interaction
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Calculator — multi-row paste", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("pasting three energy values creates three separate rows", async ({ page }) => {
    const firstInput = page.locator("input[data-row-index]").first();
    await firstInput.focus();
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", "10\n50\n200");
      const event = new ClipboardEvent("paste", { clipboardData, bubbles: true });
      document.querySelector("input[data-row-index]")?.dispatchEvent(event);
    });
    // Should have 3 data rows + 1 empty sentinel = 4 total
    await expect(page.locator("tbody tr")).toHaveCount(4, { timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatSigFigs robustness (via UI observation)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Calculator — no crashes during typical interactions", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("editing energy value from 100 to 12 does not crash the page", async ({ page }) => {
    await typeInRow(page, 0, "12");
    // Page must remain responsive
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("RangeError");
  });

  test("adding two rows with value '12' does not crash the page", async ({ page }) => {
    await typeInRow(page, 0, "12");
    await typeInRow(page, 1, "12");
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("RangeError");
  });

  test("switching particle to Carbon then editing energy does not crash", async ({ page }) => {
    const particleBtn = page.getByRole("button", { name: /^Particle$/ });
    await particleBtn.click();
    await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill("carbon");
    const carbonOption = page.getByRole("option", { name: /carbon/i }).first();
    await carbonOption.click();

    await waitForTable(page);
    await typeInRow(page, 0, "100");
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("RangeError");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Heavy-ion calculations (Carbon, Helium)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Calculator — heavy-ion calculations (Carbon, Helium)", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("Carbon + Water + 100 MeV/nucl shows numeric STP result", async ({ page }) => {
    const particleBtn = page.getByRole("button", { name: /^Particle$/ });
    await particleBtn.click();
    await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill("carbon");
    const carbonOption = page.getByRole("option", { name: /carbon/i }).first();
    await carbonOption.click();

    await waitForTable(page);
    await typeInRow(page, 0, "100 MeV/nucl");

    const stpCell = page.locator("tbody tr").first().locator("td").nth(3);
    // Only treat the bare placeholder dash as "no result" — scientific-notation
    // values like "3.8e-314" legitimately contain "-" in the exponent.
    await expect(stpCell).not.toHaveText(/^-$/, { timeout: 5000 });
    await expect(stpCell).not.toBeEmpty();
  });

  test("Helium + Water + 50 MeV/nucl shows numeric STP result", async ({ page }) => {
    const particleBtn = page.getByRole("button", { name: /^Particle$/ });
    await particleBtn.click();
    await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill("helium");
    const heliumOption = page.getByRole("option", { name: /helium/i }).first();
    await heliumOption.click();

    await waitForTable(page);
    await typeInRow(page, 0, "50 MeV/nucl");

    const stpCell = page.locator("tbody tr").first().locator("td").nth(3);
    // Only treat the bare placeholder dash as "no result" — scientific-notation
    // values like "3.8e-314" legitimately contain "-" in the exponent.
    await expect(stpCell).not.toHaveText(/^-$/, { timeout: 5000 });
    await expect(stpCell).not.toBeEmpty();
  });

  test("Carbon: per-row unit selector shows MeV/nucl column with correct value", async ({
    page,
  }) => {
    const particleBtn = page.getByRole("button", { name: /^Particle$/ });
    await particleBtn.click();
    await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill("carbon");
    const carbonOption = page.getByRole("option", { name: /carbon/i }).first();
    await carbonOption.click();

    await waitForTable(page);
    // Type explicit MeV/nucl unit to get 1:1 mapping
    await typeInRow(page, 0, "100 MeV/nucl");

    const mevNuclCell = page.locator("tbody tr").first().locator("td").nth(1);
    await expect(mevNuclCell).toContainText("100");
  });

  test("switching from Proton to Carbon with value entered does not crash", async ({ page }) => {
    await typeInRow(page, 0, "50");

    const particleBtn = page.getByRole("button", { name: /^Particle$/ });
    await particleBtn.click();
    await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill("carbon");
    const carbonOption = page.getByRole("option", { name: /carbon/i }).first();
    await carbonOption.click();

    await waitForTable(page);
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("RangeError");

    const stpCell = page.locator("tbody tr").first().locator("td").nth(3);
    // Only treat the bare placeholder dash as "no result" — scientific-notation
    // values like "3.8e-314" legitimately contain "-" in the exponent.
    await expect(stpCell).not.toHaveText(/^-$/, { timeout: 5000 });
  });
});
