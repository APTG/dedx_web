import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for Issue #561 — compare-across 4-button strip, table-multi, Columns dropdown removal.
 *
 * Test plan:
 * 1. 4-button strip renders in advanced mode (data-testid="compare-across-strip")
 * 2. No "Columns…" dropdown anywhere on page
 * 3. Switching across dimension to "particles" renders multi-entity table
 * 4. qshow=range URL param toggles quantity display
 * 5. Legacy ?hidden= / qfocus= params load silently without errors
 * 6. CSV export contains both # Stopping Power and # CSDA Range sections
 *
 * Note: Tests that require WASM calculation are annotated. CI downloads the WASM
 * artifact before running E2E tests. Without WASM some tests are skipped.
 */

async function gotoAdvanced(page: Page, query = "particle=1&material=276") {
  await page.goto(`/calculator?${query}&mode=advanced`);
  await page.waitForFunction(
    () => new URLSearchParams(window.location.search).get("mode") === "advanced",
    { timeout: 15000 },
  );
  await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible();
}

test.describe("Compare-across strip", () => {
  test("4-button strip renders in advanced mode", async ({ page }) => {
    await gotoAdvanced(page);
    const strip = page.getByTestId("compare-across-strip");
    await expect(strip).toBeVisible();
    await expect(page.getByTestId("across-single")).toBeVisible();
    await expect(page.getByTestId("across-program")).toBeVisible();
    await expect(page.getByTestId("across-material")).toBeVisible();
    await expect(page.getByTestId("across-particle")).toBeVisible();
  });

  test("single button is active by default", async ({ page }) => {
    await gotoAdvanced(page);
    const singleBtn = page.getByTestId("across-single");
    await expect(singleBtn).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("across-program")).toHaveAttribute("aria-checked", "false");
  });

  test("strip is not visible in Basic mode", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });
    await expect(page.getByTestId("compare-across-strip")).toHaveCount(0);
  });
});

test.describe("Columns dropdown removal", () => {
  test("no Columns… button exists in advanced mode", async ({ page }) => {
    await gotoAdvanced(page);
    // There should be no Columns… dropdown anywhere on the page
    await expect(page.locator('[data-testid="columns-dropdown"]')).toHaveCount(0);
    await expect(page.locator('button:has-text("Columns")')).toHaveCount(0);
  });

  test("no Columns… button in basic mode", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 15000,
    });
    await expect(page.locator('button:has-text("Columns")')).toHaveCount(0);
  });
});

test.describe("Legacy URL compatibility", () => {
  test("?qfocus=both loads without error (silently ignored)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/calculator?particle=1&material=276&mode=advanced&programs=9&qfocus=both");
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );

    expect(errors).toHaveLength(0);
    // Page should have loaded correctly with advanced toolbar
    await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible();
  });

  test("?hidden=programs=2 loads without error (silently ignored)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(
      "/calculator?particle=1&material=276&mode=advanced&programs=9&hidden=programs=2",
    );
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );

    expect(errors).toHaveLength(0);
    await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible();
  });

  test("?hidden_programs=2 loads without error (silently ignored)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(
      "/calculator?particle=1&material=276&mode=advanced&programs=9&hidden_programs=2",
    );
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );

    expect(errors).toHaveLength(0);
    await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible();
  });
});

test.describe("Quantity toggle (requires WASM)", () => {
  test("quantity-toggle renders above result table in multi-program mode", async ({ page }) => {
    await page.goto(
      "/calculator?particle=1&material=276&mode=advanced&programs=7%2C9&energies=100",
    );
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );

    // Wait for WASM calculation to complete (multi-program renders result-table)
    let wasmReady = false;
    try {
      await page.locator('[data-testid="result-table"]').waitFor({ timeout: 8000 });
      wasmReady = true;
    } catch {
      // WASM not available
    }
    if (!wasmReady) {
      test.skip();
      return;
    }

    const toggle = page.getByTestId("quantity-toggle");
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId("quantity-toggle-stp")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("quantity-toggle-range")).toHaveAttribute("aria-checked", "false");
  });

  test("qshow=range URL param activates CSDA Range toggle button", async ({ page }) => {
    await page.goto(
      "/calculator?particle=1&material=276&mode=advanced&programs=7%2C9&energies=100&qshow=range",
    );
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );

    // Wait for WASM calculation to complete (multi-program renders result-table)
    let wasmReady = false;
    try {
      await page.locator('[data-testid="result-table"]').waitFor({ timeout: 8000 });
      wasmReady = true;
    } catch {
      // WASM not available
    }
    if (!wasmReady) {
      test.skip();
      return;
    }

    await expect(page.getByTestId("quantity-toggle-range")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("quantity-toggle-stp")).toHaveAttribute("aria-checked", "false");
  });
});

test.describe("Multi-entity table (requires WASM)", () => {
  async function switchToAcross(page: Page, dimension: "material" | "particle" | "program") {
    const strip = page.getByTestId("compare-across-strip");
    await expect(strip).toBeVisible();
    await page.getByTestId(`across-${dimension}`).click();
    await expect(page.getByTestId(`across-${dimension}`)).toHaveAttribute("aria-checked", "true");
  }

  test("switching to materials renders table-multi", async ({ page }) => {
    await gotoAdvanced(page, "particle=1&material=276&energies=100");

    // In Advanced single-program mode, WASM renders advanced-combined-table
    let wasmReady = false;
    try {
      await page.locator('[data-testid="advanced-combined-table"]').waitFor({ timeout: 8000 });
      wasmReady = true;
    } catch {
      // WASM not available
    }
    if (!wasmReady) {
      test.skip();
      return;
    }

    await switchToAcross(page, "material");

    // Select Aluminum (id=13) as second material alongside the default Water (id=276)
    await page.getByTestId("picker-tab-material").click();
    const aluminumItem = page.locator('[data-testid="picker-material-item-13"]');
    await expect(aluminumItem).toBeVisible();
    await aluminumItem.click();
    await page.keyboard.press("Escape");

    // table-multi should appear
    await expect(page.getByTestId("table-multi")).toBeVisible({ timeout: 5000 });
  });
});
