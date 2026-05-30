import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for issue #670 — stopping-power OUTPUT unit selector in the
 * Advanced calculator (STP column header dropdown), the shared `sunit=` URL
 * param, cross-page sharing with the Plot page, and the mobile bottom sheet.
 *
 * Computation-dependent assertions skip automatically when the WASM binary is
 * absent (it is not built in the unit-test CI job).
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
  // particle=1 (proton), material=276 (water, ρ=1), program=2 (PSTAR).
  await page.goto("/calculator?particle=1&material=276&program=2&mode=advanced");
  await page.waitForFunction(
    () => new URLSearchParams(window.location.search).get("mode") === "advanced",
    { timeout: 15000 },
  );
  await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 15000 });
}

test.describe("STP output units — Advanced single-entity (Energy → mode)", () => {
  test("header dropdown converts cells, writes sunit, and persists across reload", async ({
    page,
  }) => {
    const hasWasm = await checkWasmPresent(page);
    if (!hasWasm) {
      test.skip(true, "WASM binary absent — skipping computation test");
      return;
    }

    await gotoAdvancedSingleEntity(page);

    const input = page.getByTestId("advanced-energy-input-0");
    await input.fill("100 MeV");
    await input.blur();

    const stpCell = page.getByTestId("advanced-stp-cell-0");
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 8000 })
      .toBeGreaterThan(0);
    const kevUmValue = parseFloat((await stpCell.textContent()) ?? "");

    // Default header reads keV/µm.
    const trigger = page.getByTestId("advanced-stp-unit-trigger");
    await expect(trigger).toContainText("keV/µm");

    // Open the menu and pick MeV/cm.
    await trigger.click();
    await page.getByTestId("advanced-stp-unit-option-MeV/cm").click();

    // Header now reads MeV/cm; for water (ρ=1) MeV/cm = 10 × keV/µm.
    await expect(trigger).toContainText("MeV/cm");
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? "") / kevUmValue, {
        timeout: 5000,
      })
      .toBeCloseTo(10, 1);

    // URL carries the shared param.
    await expect
      .poll(() => new URLSearchParams(new URL(page.url()).search).get("sunit"))
      .toBe("mev-cm");

    // Reload — the unit survives via the URL (no localStorage).
    await page.reload();
    await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("advanced-stp-unit-trigger")).toContainText("MeV/cm");
  });

  test("unknown sunit token falls back to keV/µm without error", async ({ page }) => {
    await page.goto("/calculator?particle=1&material=276&program=2&mode=advanced&sunit=bogus");
    await expect(page.getByTestId("advanced-combined-table")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("advanced-stp-unit-trigger")).toContainText("keV/µm");
  });
});

test.describe("STP output units — shared with the Plot page", () => {
  test("plot honours the shared sunit param", async ({ page }) => {
    await page.goto("/plot?sunit=mev-cm2-g");
    // The stopping-power radio group reflects the shared unit once the page is past
    // its loading skeleton. Only the unit param is needed — no series to restore.
    const radio = page.locator('input[name="stp-unit"][value="MeV·cm²/g"]');
    await expect(radio).toBeChecked({ timeout: 20000 });
  });

  test("legacy stp_unit param still selects the unit on the plot", async ({ page }) => {
    await page.goto("/plot?stp_unit=mev-cm");
    const radio = page.locator('input[name="stp-unit"][value="MeV/cm"]');
    await expect(radio).toBeChecked({ timeout: 20000 });
  });
});

test.describe("STP output units — multi-entity (compare across programs)", () => {
  test("one unit governs every program column", async ({ page }) => {
    const hasWasm = await checkWasmPresent(page);
    if (!hasWasm) {
      test.skip(true, "WASM binary absent — skipping computation test");
      return;
    }

    await page.goto(
      "/calculator?particle=1&material=276&mode=advanced&programs=7%2C9&energies=100",
    );
    await expect(page.getByTestId("result-table")).toBeVisible({ timeout: 15000 });

    // The group header hosts the single unit control.
    const trigger = page.getByTestId("multi-stp-unit-trigger");
    await expect(trigger).toContainText("keV/µm");

    // Grab a value from each program column before switching.
    const cell7 = page.getByTestId("stp-cell-7-0");
    const cell9 = page.getByTestId("stp-cell-9-0");
    await expect
      .poll(async () => parseFloat((await cell7.textContent()) ?? ""), { timeout: 8000 })
      .toBeGreaterThan(0);
    const before7 = parseFloat((await cell7.textContent()) ?? "");
    const before9 = parseFloat((await cell9.textContent()) ?? "");

    await trigger.click();
    await page.getByTestId("multi-stp-unit-option-MeV·cm²/g").click();
    await expect(trigger).toContainText("MeV·cm²/g");

    // Both columns re-render in the new unit (water ρ=1: MeV·cm²/g = 10 × keV/µm).
    await expect
      .poll(async () => parseFloat((await cell7.textContent()) ?? "") / before7, { timeout: 5000 })
      .toBeCloseTo(10, 1);
    await expect
      .poll(async () => parseFloat((await cell9.textContent()) ?? "") / before9, { timeout: 5000 })
      .toBeCloseTo(10, 1);
  });
});

test.describe("STP output units — mobile bottom sheet", () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test("tapping the header opens a bottom sheet that updates the column", async ({ page }) => {
    const hasWasm = await checkWasmPresent(page);
    if (!hasWasm) {
      test.skip(true, "WASM binary absent — skipping computation test");
      return;
    }

    await gotoAdvancedSingleEntity(page);
    const input = page.getByTestId("advanced-energy-input-0");
    await input.fill("100 MeV");
    await input.blur();

    const stpCell = page.getByTestId("advanced-stp-cell-0");
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 8000 })
      .toBeGreaterThan(0);

    await page.getByTestId("advanced-stp-unit-trigger").click();

    // Bottom sheet (not the desktop popover) is shown on a phone viewport.
    const sheet = page.getByTestId("advanced-stp-unit-sheet");
    await expect(sheet).toBeVisible();

    // Rows are large enough to tap comfortably (≥44 px).
    const option = page.getByTestId("advanced-stp-unit-option-MeV·cm²/g");
    const box = await option.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await option.click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId("advanced-stp-unit-trigger")).toContainText("MeV·cm²/g");
  });
});
