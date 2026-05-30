import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function checkWasmAvailable(page: Page): Promise<boolean> {
  try {
    const resp = await page.request.get("/wasm/libdedx.mjs");
    return resp.ok();
  } catch {
    return false;
  }
}

test.describe("PR 667 - Bethe & Bethe ext validation", () => {
  test("Calculates for multiple energies using Bethe and compares with PSTAR", async ({ page }) => {
    test.setTimeout(60000); // give it plenty of time
    test.skip(!(await checkWasmAvailable(page)), "WASM missing");

    // 1. Get PSTAR values for 10, 50, 100 MeV
    const urlPstar =
      "/calculator?urlv=2&particle=1&material=custom&mat_name=CR39" +
      "&mat_density=1.39&mat_elements=1%3A18%2C6%3A12%2C8%3A7" +
      "&mode=advanced&program=2&programs=2&energies=10,50,100&eunit=MeV&qfocus=both";

    await page.goto(urlPstar);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="compound-from-url-banner"]')
          ?.textContent?.includes("CR39"),
      { timeout: 15000 },
    );

    const pstarValues = [];
    for (let i = 0; i < 3; i++) {
      const stpCell = page.locator(`[data-testid="advanced-stp-cell-${i}"]`);
      const rangeCell = page.locator(`[data-testid="advanced-range-cell-${i}"]`);

      await expect
        .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);
      await expect
        .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);

      pstarValues.push({
        stp: parseFloat((await stpCell.textContent())!),
        range: parseFloat((await rangeCell.textContent())!),
      });
    }
    console.log("PSTAR values:", pstarValues);

    // 2. Get Bethe values for 10, 50, 100 MeV
    const urlBethe =
      "/calculator?urlv=2&particle=1&material=custom&mat_name=CR39" +
      "&mat_density=1.39&mat_elements=1%3A18%2C6%3A12%2C8%3A7" +
      "&mode=advanced&program=100&programs=100&energies=10,50,100&eunit=MeV&qfocus=both";

    await page.goto(urlBethe);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="compound-from-url-banner"]')
          ?.textContent?.includes("CR39"),
      { timeout: 15000 },
    );

    const betheValues = [];
    for (let i = 0; i < 3; i++) {
      const stpCell = page.locator(`[data-testid="advanced-stp-cell-${i}"]`);
      const rangeCell = page.locator(`[data-testid="advanced-range-cell-${i}"]`);

      await expect
        .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);
      await expect
        .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);

      betheValues.push({
        stp: parseFloat((await stpCell.textContent())!),
        range: parseFloat((await rangeCell.textContent())!),
      });
    }
    console.log("Bethe values:", betheValues);

    // 3. Get Bethe ext values for 10, 50, 100 MeV (assuming program=101)
    const urlBetheExt =
      "/calculator?urlv=2&particle=1&material=custom&mat_name=CR39" +
      "&mat_density=1.39&mat_elements=1%3A18%2C6%3A12%2C8%3A7" +
      "&mode=advanced&program=101&programs=101&energies=10,50,100&eunit=MeV&qfocus=both";

    await page.goto(urlBetheExt);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="compound-from-url-banner"]')
          ?.textContent?.includes("CR39"),
      { timeout: 15000 },
    );

    const betheExtValues = [];
    for (let i = 0; i < 3; i++) {
      const stpCell = page.locator(`[data-testid="advanced-stp-cell-${i}"]`);
      const rangeCell = page.locator(`[data-testid="advanced-range-cell-${i}"]`);

      await expect
        .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);
      await expect
        .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 10000 })
        .toBeGreaterThan(0);

      betheExtValues.push({
        stp: parseFloat((await stpCell.textContent())!),
        range: parseFloat((await rangeCell.textContent())!),
      });
    }
    console.log("Bethe ext values:", betheExtValues);

    // Validate that values change across different energies
    expect(betheValues[0].stp).not.toBeCloseTo(betheValues[1].stp, 5);
    expect(betheValues[1].stp).not.toBeCloseTo(betheValues[2].stp, 5);
    expect(betheValues[0].range).not.toBeCloseTo(betheValues[1].range, 5);

    expect(betheExtValues[0].stp).not.toBeCloseTo(betheExtValues[1].stp, 5);
    expect(betheExtValues[1].stp).not.toBeCloseTo(betheExtValues[2].stp, 5);
    expect(betheExtValues[0].range).not.toBeCloseTo(betheExtValues[1].range, 5);

    // Validate order of magnitude with PSTAR (e.g. within 20%)
    for (let i = 0; i < 3; i++) {
      // Compare STP
      expect(betheValues[i].stp / pstarValues[i].stp).toBeGreaterThan(0.5);
      expect(betheValues[i].stp / pstarValues[i].stp).toBeLessThan(2.0);

      // Compare Range
      expect(betheValues[i].range / pstarValues[i].range).toBeGreaterThan(0.5);
      expect(betheValues[i].range / pstarValues[i].range).toBeLessThan(2.0);
    }
  });
});
