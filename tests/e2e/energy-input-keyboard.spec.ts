import { test, expect, type Page } from "@playwright/test";

const WASM_TIMEOUT = 20000;

/**
 * E2E coverage for keyboard navigation in the basic energy input hero card
 * (table-basic.svelte) and advanced combined table (table-advanced.svelte).
 *
 * Since issue #840, Add Row is Advanced-only: Basic mode is always exactly
 * one row, so the row-navigation/reorder/delete keyboard contract below only
 * applies to the Advanced table. Basic mode's keyboard contract is now just
 * Escape/Enter blurring the single input.
 *
 * Covers (Advanced only): Escape, Shift+Enter, Enter (add row),
 * ArrowUp/Down navigation, Ctrl/Cmd+Arrow row reordering, and Backspace
 * delete-empty-row.
 */

// ── Basic table (non-advanced mode) ─────────────────────────────────────────

test.describe("Basic energy table — keyboard contract", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', {
      timeout: WASM_TIMEOUT,
    });
  });

  test("Escape blurs the energy input", async ({ page }) => {
    const input = page.getByTestId("energy-input-0");
    await input.focus();
    await expect(input).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(input).not.toBeFocused();
  });

  test("Enter blurs the input without creating a second row (issue #840)", async ({ page }) => {
    const input0 = page.getByTestId("energy-input-0");
    await input0.fill("100");
    await input0.press("Enter");

    await expect(input0).not.toBeFocused();
    await expect(page.getByTestId("energy-input-1")).toHaveCount(0);
  });

  test("no '+ Add row' button and no multi-row table in Basic mode", async ({ page }) => {
    await expect(page.getByRole("button", { name: /\+\s*Add row/i })).toHaveCount(0);
    await expect(page.locator('[data-testid="basic-multi-row-table"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="basic-single-row-card"]')).toBeVisible();
  });
});

// ── Advanced table (single-entity advanced mode) ─────────────────────────────

test.describe("Advanced energy table — keyboard contract", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function gotoAdvanced(page: Page) {
    await page.goto("/calculator?particle=1&material=276&program=2&mode=advanced");
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );
    await expect(page.getByTestId("advanced-combined-table")).toBeVisible({
      timeout: WASM_TIMEOUT,
    });
  }

  test("Escape blurs the advanced energy input", async ({ page }) => {
    await gotoAdvanced(page);
    const input = page.getByTestId("advanced-energy-input-0");
    await input.focus();
    await expect(input).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(input).not.toBeFocused();
  });

  test("Enter on last advanced row adds a new row and focuses it", async ({ page }) => {
    await gotoAdvanced(page);
    const input0 = page.getByTestId("advanced-energy-input-0");
    await input0.fill("100");
    await input0.press("Enter");

    const input1 = page.getByTestId("advanced-energy-input-1");
    await expect(input1).toBeVisible({ timeout: 3000 });
    await expect(input1).toBeFocused();
  });

  test("Shift+Enter does not advance focus in advanced table", async ({ page }) => {
    await gotoAdvanced(page);
    const input0 = page.getByTestId("advanced-energy-input-0");
    await input0.fill("100");
    await input0.press("Enter"); // moves to row 1

    const input1 = page.getByTestId("advanced-energy-input-1");
    await expect(input1).toBeFocused({ timeout: 3000 });
    // Fill row 1 so handleBlur (called by Shift+Enter) does not remove it as an empty row.
    await input1.fill("200");

    await input1.press("Shift+Enter");
    await expect(input1).toBeFocused();
  });

  test("ArrowDown moves focus to next advanced row", async ({ page }) => {
    await gotoAdvanced(page);
    const input0 = page.getByTestId("advanced-energy-input-0");
    await input0.fill("100");
    await input0.press("Enter");
    const input1 = page.getByTestId("advanced-energy-input-1");
    await expect(input1).toBeVisible({ timeout: 3000 });
    // Fill row 1 so the blur event fired when input0 is re-focused does not
    // remove it via handleBlur (the advanced table has an onblur handler).
    await input1.fill("200");

    await input0.focus();
    await page.keyboard.press("ArrowDown");
    await expect(input1).toBeFocused();
  });

  test("ArrowUp moves focus to previous advanced row", async ({ page }) => {
    await gotoAdvanced(page);
    const input0 = page.getByTestId("advanced-energy-input-0");
    await input0.fill("100");
    await input0.press("Enter");
    const input1 = page.getByTestId("advanced-energy-input-1");
    await expect(input1).toBeVisible({ timeout: 3000 });

    await input1.focus();
    await page.keyboard.press("ArrowUp");
    await expect(input0).toBeFocused();
  });

  test("Ctrl+ArrowDown reorders advanced row 0 to position 1 and follows focus", async ({
    page,
  }) => {
    await gotoAdvanced(page);
    const input0 = page.getByTestId("advanced-energy-input-0");
    await input0.fill("100");
    await input0.press("Enter");
    const input1 = page.getByTestId("advanced-energy-input-1");
    await expect(input1).toBeVisible({ timeout: 3000 });
    await input1.fill("200");

    await input0.focus();
    await page.keyboard.press("Control+ArrowDown");

    const newInput1 = page.getByTestId("advanced-energy-input-1");
    await expect(newInput1).toBeFocused({ timeout: 2000 });
    await expect(newInput1).toHaveValue("100");
    await expect(page.getByTestId("advanced-energy-input-0")).toHaveValue("200");
  });

  test("Ctrl+ArrowUp reorders advanced row 1 to position 0 and follows focus", async ({ page }) => {
    await gotoAdvanced(page);
    const input0 = page.getByTestId("advanced-energy-input-0");
    await input0.fill("100");
    await input0.press("Enter");
    const input1 = page.getByTestId("advanced-energy-input-1");
    await expect(input1).toBeVisible({ timeout: 3000 });
    await input1.fill("200");

    await input1.focus();
    await page.keyboard.press("Control+ArrowUp");

    await expect(page.getByTestId("advanced-energy-input-0")).toBeFocused({ timeout: 2000 });
    await expect(page.getByTestId("advanced-energy-input-0")).toHaveValue("200");
  });

  test("Backspace on empty advanced input deletes row and moves focus to previous", async ({
    page,
  }) => {
    await gotoAdvanced(page);
    const input0 = page.getByTestId("advanced-energy-input-0");
    await input0.fill("100");
    await input0.press("Enter");
    const input1 = page.getByTestId("advanced-energy-input-1");
    await expect(input1).toBeVisible({ timeout: 3000 });

    await input1.focus();
    await page.keyboard.press("Backspace");

    await expect(page.getByTestId("advanced-energy-input-1")).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId("advanced-energy-input-0")).toBeFocused({ timeout: 2000 });
  });
});
