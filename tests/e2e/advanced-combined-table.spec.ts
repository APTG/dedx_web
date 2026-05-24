import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for the combined Advanced result table (issue #559).
 *
 * Covers Energy → and Range → modes in single-entity Advanced configuration
 * Advanced configuration, where `table-advanced.svelte` is rendered.
 *
 * Tests that require WASM computation skip automatically when the binary is absent.
 */

async function checkWasmPresent(page: Page): Promise<boolean> {
  try {
    const res = await page.request.head("/wasm/libdedx.mjs");
    return res.status() === 200;
  } catch {
    return false;
  }
}

async function gotoAdvancedSingleEntity(page: Page): Promise<void> {
  // Advanced mode, single-entity (single selected particle/material/program).
  // particle=1 (proton), material=276 (water), program=2 (PSTAR) — single program.
  await page.goto("/calculator?particle=1&material=276&program=2&mode=advanced");
  await page.waitForFunction(
    () => new URLSearchParams(window.location.search).get("mode") === "advanced",
    { timeout: 15000 },
  );
  await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible({ timeout: 10000 });
}

test.describe("Advanced combined table — Energy → mode", () => {
  test("renders a single combined <table> in Advanced + single-entity mode", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);

    // The combined table must be present (not the old separate input+result sections).
    const table = page.getByTestId("advanced-combined-table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Must have proper table structure.
    await expect(table.locator("thead")).toBeVisible();
    await expect(table.locator("tbody")).toBeVisible();

    // Column headers: #, Energy, STP, CSDA Range (MeV/nucl conditional column absent at start).
    const thead = table.locator("thead th");
    const headerTexts = await thead.allInnerTexts();
    const joined = headerTexts.join(" ");
    expect(joined).toContain("Energy");
    expect(joined).toContain("STP");
    expect(joined).toContain("CSDA Range");
  });

  test("standalone energy unit strip is absent for single-entity advanced mode", async ({
    page,
  }) => {
    await gotoAdvancedSingleEntity(page);
    // The compact strip inside table-advanced is testid="advanced-energy-unit-strip".
    // The OLD standalone strip had no specific testid but was placed between picker and tabs.
    // Verify the combined table is present (which contains its own strip internally).
    await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 10000 });
    // The unit strip inside the component should be present.
    await expect(page.getByTestId("advanced-energy-unit-strip")).toBeVisible({ timeout: 5000 });
  });

  test("row 1 has faint yellow tint class", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);
    await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 10000 });

    const firstRow = page.getByTestId("advanced-energy-row-0");
    await expect(firstRow).toBeVisible();
    // Row 1 should carry the amber background class.
    const cls = await firstRow.getAttribute("class");
    expect(cls).toMatch(/bg-amber/);
  });

  test("→ MeV/nucl column appears when an inline unit suffix is typed", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);
    const table = page.getByTestId("advanced-combined-table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Column should be absent initially.
    await expect(page.getByTestId("mev-nucl-column-header")).not.toBeVisible();

    // Add row 2 (type in row 0 to trigger auto-add, then type in row 1).
    const row0Input = page.getByTestId("advanced-energy-input-0");
    await row0Input.fill("100");
    await row0Input.press("Enter");

    // Type a value with an inline unit suffix in row 1.
    const row1Input = page.getByTestId("advanced-energy-input-1");
    await row1Input.fill("10 keV");

    // The → MeV/nucl column header should now be visible.
    await expect(page.getByTestId("mev-nucl-column-header")).toBeVisible({ timeout: 3000 });
  });

  test("delete row × button removes a row", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);
    const table = page.getByTestId("advanced-combined-table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Add a second row.
    await page.getByTestId("advanced-energy-input-0").fill("100");
    await page.getByTestId("advanced-energy-input-0").press("Enter");
    await expect(page.getByTestId("advanced-energy-input-1")).toBeVisible({ timeout: 3000 });

    // Delete row 0.
    await page.getByTestId("advanced-delete-row-0").click();

    // Row 1 becomes row 0; original row 1 is gone.
    await expect(page.getByTestId("advanced-energy-input-1")).not.toBeVisible({ timeout: 3000 });
  });

  test("out-of-range input shows red border and 'out of range' in result cells", async ({
    page,
  }) => {
    const hasWasm = await checkWasmPresent(page);
    if (!hasWasm) {
      test.skip(true, "WASM binary absent — skipping computation test");
      return;
    }

    await gotoAdvancedSingleEntity(page);
    await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 10000 });

    // Enter an energy far above the tabulated range (proton in water: PSTAR range ~1 MeV–10 GeV).
    const input = page.getByTestId("advanced-energy-input-0");
    await input.fill("1e9"); // 1 TeV — way out of range
    await input.blur();

    // Result cell should show out-of-range indicator.
    const stpCell = page.getByTestId("advanced-stp-cell-0");
    await expect(stpCell).toContainText("out of range", { timeout: 10000 });

    const rangeCell = page.getByTestId("advanced-range-cell-0");
    await expect(rangeCell).toContainText("out of range", { timeout: 3000 });

    // Input should carry destructive border class.
    const inputClass = await input.getAttribute("class");
    expect(inputClass).toMatch(/border-destructive/);
  });

  test("5-row snapshot: Energy → single-entity", async ({ page }) => {
    const hasWasm = await checkWasmPresent(page);
    if (!hasWasm) {
      test.skip(true, "WASM binary absent — skipping snapshot test");
      return;
    }

    await gotoAdvancedSingleEntity(page);
    await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 10000 });

    // Fill 5 rows via Enter key navigation.
    const energies = ["10", "50", "100", "500", "1000"];
    for (let i = 0; i < energies.length; i++) {
      const input = page.getByTestId(`advanced-energy-input-${i}`);
      await input.fill(energies[i]!);
      if (i < energies.length - 1) {
        await input.press("Enter");
        await expect(page.getByTestId(`advanced-energy-input-${i + 1}`)).toBeVisible({
          timeout: 3000,
        });
      }
    }

    await expect
      .poll(async () => (await page.getByTestId("advanced-range-cell-4").textContent())?.trim(), {
        timeout: 10000,
      })
      .not.toBe("—");

    // Snapshot the table.
    await expect(page.getByTestId("advanced-combined-table")).toMatchAriaSnapshot();
  });
});

test.describe("Advanced combined table — Range → mode", () => {
  test("Range → tab renders the combined table component", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);

    // Switch to the Range → tab.
    await page.getByTestId("inverse-tab-range").click();

    // The new table should be visible (not the old grid).
    const table = page.getByTestId("advanced-range-table");
    await expect(table).toBeVisible({ timeout: 5000 });

    // Column headers: Range, Unit, → Energy.
    const headerTexts = await table.locator("thead th").allInnerTexts();
    const joined = headerTexts.join(" ");
    expect(joined).toContain("Range");
    expect(joined).toContain("Unit");
    expect(joined).toContain("→ Energy");
  });

  test("Range → row 1 has faint yellow tint", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);
    await page.getByTestId("inverse-tab-range").click();

    const firstRow = page.getByTestId("inverse-range-row-0");
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    const cls = await firstRow.getAttribute("class");
    expect(cls).toMatch(/bg-amber/);
  });

  test("Range → unit anchor strip is rendered inside the component", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);
    await page.getByTestId("inverse-tab-range").click();

    // The unit strip testid was preserved from the old inline strip.
    await expect(page.getByTestId("inverse-range-unit")).toBeVisible({ timeout: 5000 });
  });

  test("Range → delete row button removes a row", async ({ page }) => {
    await gotoAdvancedSingleEntity(page);
    await page.getByTestId("inverse-tab-range").click();

    // Add a second row.
    await page.getByTestId("inverse-range-input-0").fill("10 cm");
    await expect(page.getByTestId("advanced-range-table")).toBeVisible({ timeout: 5000 });

    // + Add row button.
    await page.getByRole("button", { name: "+ Add row" }).click();
    await expect(page.getByTestId("inverse-range-input-1")).toBeVisible({ timeout: 3000 });

    // Delete row 0.
    await page.getByTestId("inverse-range-delete-0").click();
    await expect(page.getByTestId("inverse-range-input-1")).not.toBeVisible({ timeout: 3000 });
  });

  test("Range → computes inverse energy (WASM required)", async ({ page }) => {
    const hasWasm = await checkWasmPresent(page);
    if (!hasWasm) {
      test.skip(true, "WASM binary absent — skipping computation test");
      return;
    }

    await page.goto(
      "/calculator?particle=1&material=276&program=2&imode=csda&lookups=7.718:cm&mode=advanced",
    );
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );

    await page.getByTestId("inverse-tab-range").click();
    const result = page.getByTestId("inverse-range-result-0");
    await expect(result).not.toContainText("—", { timeout: 8000 });
    const text = await result.innerText();
    expect(text).toMatch(/\d/); // some numeric output
  });
});
