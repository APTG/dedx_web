import { test, expect } from "@playwright/test";

/**
 * E2E tests for Inverse Lookups feature (Range and Inverse STP tabs).
 *
 * All computation tests use real WASM (no mock injection).
 * Tests that require WASM skip automatically when the binary is absent.
 */

async function checkWasmPresent(page: import("@playwright/test").Page): Promise<boolean> {
  try {
    const response = await page.request.head("/wasm/libdedx.mjs");
    return response.status() === 200;
  } catch {
    return false;
  }
}

/** Parse an auto-scaled energy label ("5.033 keV", "100 MeV", "2.5 GeV") to MeV. */
function parseEnergyMeV(text: string): number {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(keV|MeV|GeV)?$/);
  if (!m) return NaN;
  const v = parseFloat(m[1]!);
  const u = m[2] ?? "MeV";
  if (u === "keV") return v / 1000;
  if (u === "GeV") return v * 1000;
  return v;
}

function inverseUnitGroup(page: import("@playwright/test").Page, testId: string) {
  return page.getByTestId(testId);
}

async function selectInverseUnit(
  page: import("@playwright/test").Page,
  testId: string,
  label: string,
): Promise<void> {
  await inverseUnitGroup(page, testId).getByRole("radio", { name: label }).click();
}

async function expectInverseUnitSelected(
  page: import("@playwright/test").Page,
  testId: string,
  label: string,
): Promise<void> {
  await expect(inverseUnitGroup(page, testId).getByRole("radio", { name: label })).toHaveAttribute(
    "aria-checked",
    "true",
  );
}

test.describe("Inverse Lookups — Range Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("heading", { name: "Calculator" })).toBeVisible({ timeout: 10000 });
    try {
      await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 60000 });
    } catch (e) {
      await page.screenshot({ path: "test-results/particle-selector-timeout.png" });
      throw e;
    }
  });

  test("Range tab: energy from CSDA range @smoke", async ({ page }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Proton (1) in Water (276) via PSTAR (2): 7.718 g/cm² ≈ 100.5 MeV
    await page.goto(
      "/calculator?particle=1&material=276&program=2&imode=csda&ivalues=7.718:cm&advanced=1",
    );
    await page.waitForSelector('[data-testid="inverse-range-result-0"]', { timeout: 15000 });

    const energyResult = page.locator('[data-testid="inverse-range-result-0"]');
    await expect(energyResult).toHaveText(/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/, { timeout: 15000 });

    const energy = parseEnergyMeV((await energyResult.textContent())!.trim());
    // PSTAR: 7.718 g/cm² → ~100.5 MeV; allow ±15% for unit-display rounding
    expect(energy).toBeGreaterThan(85);
    expect(energy).toBeLessThan(120);

    // Changing the range input must produce a different result
    const result = page.locator('[data-testid="inverse-range-result-0"]');
    await page.fill('[data-testid="inverse-range-input-0"]', "15.4");
    const before = await result.textContent();
    await page.locator('[data-testid="inverse-range-input-0"]').blur();
    await expect
      .poll(async () => (await result.textContent())?.trim(), { timeout: 15000 })
      .not.toBe(before?.trim());
  });

  test("Range tab: URL round-trip @regression", async ({ page }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    await page.goto("/calculator?particle=1&material=276&advanced=1");
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });

    await page.click('[data-testid="inverse-tab-range"]');
    await selectInverseUnit(page, "inverse-range-unit", "mm");
    await page.fill('[data-testid="inverse-range-input-0"]', "3.5");
    await page.locator('[data-testid="inverse-range-input-0"]').blur();

    await page.waitForFunction(
      () =>
        window.location.search.includes("imode=csda") &&
        window.location.search.includes("iunit=mm"),
      { timeout: 5000 },
    );

    const url = page.url();
    expect(url).toContain("imode=csda");
    expect(url).toContain("iunit=mm");

    await page.reload();
    await page.waitForFunction(() => window.location.search.includes("iunit=mm"), {
      timeout: 10000,
    });

    await expect(page.locator('[data-testid="inverse-tab-range"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expectInverseUnitSelected(page, "inverse-range-unit", "mm");
    await expect(page.locator('[data-testid="inverse-range-input-0"]')).toHaveValue("");
  });

  test("Range tab: 'm' suffix accepted, 'km' rejected @regression", async ({ page }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    await page.goto("/calculator?particle=1&material=276&advanced=1");
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });
    await page.click('[data-testid="inverse-tab-range"]');

    // '30 m' — valid metre suffix; must produce a positive numeric result
    await page.fill('[data-testid="inverse-range-input-0"]', "30 m");
    const energyResult = page.locator('[data-testid="inverse-range-result-0"]');
    await expect(energyResult).toHaveText(/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/, { timeout: 15000 });
    expect(parseEnergyMeV((await energyResult.textContent())!.trim())).toBeGreaterThan(0);

    // Per-row mode active → master unit selector disabled
    await expect(
      inverseUnitGroup(page, "inverse-range-unit").getByRole("radio", { name: "cm" }),
    ).toBeDisabled();

    // '0.03 km' — unrecognised suffix → result cell shows validation error
    await page.fill('[data-testid="inverse-range-input-0"]', "0.03 km");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-range-result-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/unrecognized unit/i);
  });

  test("Range tab: rejects negative and non-numeric input @regression", async ({ page }) => {
    await page.goto("/calculator?particle=1&material=276&advanced=1");
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });
    await page.click('[data-testid="inverse-tab-range"]');

    await page.fill('[data-testid="inverse-range-input-0"]', "-5");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-range-result-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/positive/i);

    await page.fill('[data-testid="inverse-range-input-0"]', "abc");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-range-result-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/numeric/i);
  });

  test("Inverse STP tab: rejects zero and non-numeric input @regression", async ({ page }) => {
    await page.goto("/calculator?particle=1&material=276&advanced=1");
    await page.waitForSelector('[data-testid="inverse-tab-stp"]', { timeout: 5000 });
    await page.click('[data-testid="inverse-tab-stp"]');

    await page.fill('[data-testid="inverse-stp-input-0"]', "0");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-stp-row-error-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/positive/i);

    await page.fill('[data-testid="inverse-stp-input-0"]', "xyz");
    await expect
      .poll(
        async () =>
          (await page.locator('[data-testid="inverse-stp-row-error-0"]').textContent())?.trim(),
        { timeout: 10000 },
      )
      .toMatch(/numeric/i);
  });

  test("Inverse STP tab: shows E_low and E_high for 30 keV/µm proton/water @smoke", async ({
    page,
  }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Proton (1) in Water (276) via PSTAR (2): 30 keV/µm is below Bragg peak → both branches exist
    await page.goto(
      "/calculator?particle=1&material=276&program=2&imode=stp&ivalues=30&iunit=kev-um&advanced=1",
    );
    await page.waitForSelector('[data-testid="inverse-stp-input-0"]', { timeout: 15000 });

    const lowSpan = page.locator('[data-testid="inverse-stp-result-low-0"] span');
    const highSpan = page.locator('[data-testid="inverse-stp-result-high-0"] span');

    await expect(lowSpan).toHaveText(/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/, { timeout: 15000 });
    await expect(highSpan).toHaveText(/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/, { timeout: 15000 });

    const lowEnergyMeV = parseEnergyMeV((await lowSpan.textContent())!);
    const highEnergyMeV = parseEnergyMeV((await highSpan.textContent())!);
    expect(lowEnergyMeV).toBeGreaterThan(0);
    expect(highEnergyMeV).toBeGreaterThan(0);
    // E_high (above Bragg peak, descending branch) > E_low (below Bragg peak, ascending branch)
    expect(highEnergyMeV).toBeGreaterThan(lowEnergyMeV);
  });

  test("Inverse STP tab: monotone branch — 1 keV/µm proton/water ICRU49 @smoke", async ({
    page,
  }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Proton (1) in Water (276) via ICRU49 (7): monotone STP over the tabulated range.
    // 1 keV/µm = 10 MeV·cm²/g (water density 1 g/cm³).  The old bisection returned -1
    // here because find_min() returned -1 for the monotone curve (no Bragg peak in range).
    await page.goto(
      "/calculator?particle=1&material=276&program=7&imode=stp&ivalues=1&iunit=kev-um&advanced=1",
    );
    await page.waitForSelector('[data-testid="inverse-stp-input-0"]', { timeout: 15000 });

    const highSpan = page.locator('[data-testid="inverse-stp-result-high-0"] span');
    await expect(highSpan).toHaveText(/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/, { timeout: 15000 });
    const energyMeV = parseEnergyMeV((await highSpan.textContent())!);
    // 10 MeV·cm²/g corresponds to ~65–70 MeV in ICRU49 for proton in water
    expect(energyMeV).toBeGreaterThan(40);
    expect(energyMeV).toBeLessThan(120);
  });

  test("Range tab: unit change triggers recalculation @regression", async ({ page }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Load with 10 cm range for proton in water; read the initial energy
    await page.goto(
      "/calculator?particle=1&material=276&program=2&imode=csda&ivalues=10&iunit=cm&advanced=1",
    );
    await page.waitForSelector('[data-testid="inverse-range-result-0"]', { timeout: 15000 });

    const energyResult = page.locator('[data-testid="inverse-range-result-0"]');
    await expect(energyResult).toHaveText(/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/, { timeout: 15000 });
    const energyAtCm = parseEnergyMeV((await energyResult.textContent())!.trim());
    expect(energyAtCm).toBeGreaterThan(0);

    // Change master unit to mm; same numeric value (10) now means 10 mm = 1 cm → different energy
    await selectInverseUnit(page, "inverse-range-unit", "mm");

    await expect
      .poll(
        async () => {
          const text = (await energyResult.textContent())?.trim();
          if (!text || !/^\d/.test(text)) return null;
          return parseEnergyMeV(text);
        },
        { timeout: 15000 },
      )
      .not.toBe(energyAtCm);

    const energyAtMm = parseEnergyMeV((await energyResult.textContent())!.trim());
    expect(energyAtMm).toBeGreaterThan(0);
    // 10 mm < 10 cm, so energy for 10 mm range must be less than for 10 cm
    expect(energyAtMm).toBeLessThan(energyAtCm);
  });

  test("STP tab: unit change triggers recalculation @regression", async ({ page }) => {
    const wasmPresent = await checkWasmPresent(page);
    test.skip(!wasmPresent, "WASM binary absent");

    // Load with 30 keV/µm; note initial E_low
    await page.goto(
      "/calculator?particle=1&material=276&program=2&imode=stp&ivalues=30&iunit=kev-um&advanced=1",
    );
    await page.waitForSelector('[data-testid="inverse-stp-result-low-0"]', { timeout: 15000 });

    const lowSpan = page.locator('[data-testid="inverse-stp-result-low-0"] span');
    await expect(lowSpan).toHaveText(/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/, { timeout: 15000 });
    const energyAtKevUm = parseFloat((await lowSpan.textContent())!.trim());

    // Change unit to MeV/cm; same numeric value (30) now means 30 MeV/cm → different conversion
    await selectInverseUnit(page, "inverse-stp-unit", "MeV/cm");

    await expect
      .poll(
        async () => {
          const text = (await lowSpan.textContent())?.trim();
          if (!text || !/^\d/.test(text)) return null;
          return parseFloat(text);
        },
        { timeout: 15000 },
      )
      .not.toBe(energyAtKevUm);
  });
});

test.describe("Advanced Mode Gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("Advanced-mode gate: inverse tabs absent in Basic mode @regression", async ({ page }) => {
    await expect(page.locator('[data-testid="inverse-tab-range"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="inverse-tab-stp"]')).toHaveCount(0);

    await page.locator('button[aria-label="Switch to Advanced mode"]').click();
    await page.waitForSelector('button:has-text("Advanced Options")', { timeout: 5000 });
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });

    await expect(page.locator('[data-testid="inverse-tab-range"]')).toBeVisible();
    await expect(page.locator('[data-testid="inverse-tab-stp"]')).toBeVisible();
  });

  test("Advanced-mode gate: switching to Basic while on Range tab shows Forward content @regression", async ({
    page,
  }) => {
    // Enable advanced mode and switch to Range tab
    await page.locator('button[aria-label="Switch to Advanced mode"]').click();
    await page.waitForSelector('[data-testid="inverse-tab-range"]', { timeout: 5000 });
    await page.click('[data-testid="inverse-tab-range"]');
    await expect(page.locator('[data-testid="inverse-tab-range"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Switch back to basic mode
    await page.locator('button[aria-label="Switch to Basic mode"]').click();
    await page.waitForFunction(() => !window.location.search.includes("mode=advanced"), {
      timeout: 5000,
    });

    // Tab switcher must be gone
    await expect(page.locator('[data-testid="inverse-tab-range"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="inverse-tab-stp"]')).toHaveCount(0);

    // Forward tab content must be visible — the result table heading or energy input
    await expect(page.locator('[data-testid="inverse-tab-forward"]')).toHaveCount(0);
    // The forward result table should be in the DOM (it renders when activeTab === "forward")
    await expect(page.locator('[data-testid="result-table"]')).toBeVisible({ timeout: 5000 });
  });
});
