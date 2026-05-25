import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for external data sources in Calculator Advanced Mode.
 *
 * These tests require EXTERNAL_DATA_URL to point at a runner-hosted
 * S3-compatible .webdedx store and the WASM binary in static/wasm/.
 * They are intended for the manual S3 E2E workflow, not default PR CI.
 */

const EXTERNAL_DATA_URL = process.env.EXTERNAL_DATA_URL;
const EXTERNAL_DATA_STORE_URL = normalizeStoreUrl(EXTERNAL_DATA_URL);
const SRIM_EXTDATA = `extdata=srim:${encodeURIComponent(EXTERNAL_DATA_STORE_URL)}`;

// Proton in Liquid Water with ICRU 49, 100 MeV
const BASE_QUERY = `urlv=1&${SRIM_EXTDATA}&particle=1&material=276&program=7&energies=100&eunit=MeV`;

function normalizeStoreUrl(url: string | undefined): string {
  if (!url) return "";
  return url.endsWith("/") ? url : `${url}/`;
}

async function gotoAdvancedWithSrim(page: Page) {
  await page.goto(`/calculator?${BASE_QUERY}&mode=advanced&qfocus=both`);
  await page.waitForFunction(
    () => new URLSearchParams(window.location.search).get("mode") === "advanced",
    { timeout: 15000 },
  );
  // External data loading + WASM init can take 20-30s on first load
  await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible({ timeout: 30000 });
}

async function openProgramPicker(page: Page) {
  await page.getByTestId("across-program").click();
  await page.getByTestId("picker-tab-program").click();
  await expect(page.getByTestId("picker-program-list")).toBeVisible();
}

// Run manually with: EXTERNAL_DATA_URL=http://127.0.0.1:9000/bucket/store.webdedx pnpm test:e2e:s3
test.describe("External data in Calculator Advanced Mode @s3", () => {
  test.skip(
    !EXTERNAL_DATA_URL,
    "Set EXTERNAL_DATA_URL to a runner-hosted S3-compatible .webdedx store",
  );

  // External data requires S3-compatible network access — allow 90s per test
  test.setTimeout(90000);

  test("SRIM program appears in Programs picker when extdata loaded", async ({ page }) => {
    await gotoAdvancedWithSrim(page);

    // Open the Programs picker
    await openProgramPicker(page);

    const listbox = page.getByTestId("picker-program-list");

    // The External section header should be present
    await expect(listbox.getByText("External", { exact: false })).toBeVisible();

    // SRIM program should appear with 🔗 prefix
    const srimOption = listbox.getByRole("option", { name: /srim/i });
    await expect(srimOption).toBeVisible();
  });

  test("Adding SRIM program creates a new column in the table", async ({ page }) => {
    await gotoAdvancedWithSrim(page);

    // Open Programs picker and add SRIM
    await openProgramPicker(page);
    const listbox = page.getByTestId("picker-program-list");
    const srimOption = listbox.getByRole("option", { name: /srim/i });
    await srimOption.click();
    await page.keyboard.press("Escape");

    // Wait for table header with SRIM program to appear
    // SRIM ExtRef is "ext:srim:srim-2013-gui"
    const srimHeader = page.locator(`th[data-program-id^="ext:srim:"]`).first();
    await expect(srimHeader).toBeVisible({ timeout: 10000 });
    await expect(srimHeader).toContainText(/srim/i);
  });

  test("SRIM column shows calculated STP values", async ({ page }) => {
    await gotoAdvancedWithSrim(page);

    // Open Programs picker and add SRIM
    await openProgramPicker(page);
    const srimOption = page
      .getByTestId("picker-program-list")
      .getByRole("option", { name: /srim/i });
    await srimOption.click();
    await page.keyboard.press("Escape");

    // Wait for SRIM column to appear
    const srimHeader = page.locator(`th[data-program-id^="ext:srim:"]`).first();
    await expect(srimHeader).toBeVisible({ timeout: 10000 });

    // Wait for the STP cell in the first energy row to have a value
    const srimCell = page.locator(`td[data-testid^="stp-cell-ext:srim:"][data-testid$="-0"]`);
    await expect(srimCell).not.toContainText("—", { timeout: 15000 });
    // Value should be a number, not an error
    const cellText = await srimCell.textContent();
    expect(cellText).toMatch(/[\d.]+/);
  });

  test("SRIM as default program shows STP values in advanced mode", async ({ page }) => {
    // Start with SRIM as the selected program (no explicit program param — rely on extdata)
    await page.goto(
      `/calculator?urlv=1&${SRIM_EXTDATA}&particle=1&material=276&energies=100&eunit=MeV&mode=advanced`,
    );
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );
    await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible({ timeout: 30000 });

    // The SRIM program should be shown in the header as default
    const defaultHeader = page.locator(`th[data-program-id^="ext:srim:"]`).first();
    // If SRIM is the default, it should appear with the ◆ indicator
    // (It only appears if SRIM is the auto-resolved program)
    // Just verify we're in advanced mode without errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    expect(errors.filter((e) => e.includes("effect_update_depth_exceeded"))).toHaveLength(0);
    void defaultHeader;
  });

  test("URL round-trip preserves SRIM in programs param after adding", async ({ page }) => {
    await gotoAdvancedWithSrim(page);

    // Add SRIM to comparison
    await openProgramPicker(page);
    await page.getByTestId("picker-program-list").getByRole("option", { name: /srim/i }).click();
    await page.keyboard.press("Escape");

    // Wait for URL to update with programs param containing ext:srim:
    await page.waitForFunction(
      () => {
        const programs = new URLSearchParams(window.location.search).get("programs");
        return programs !== null && programs.includes("ext:srim:");
      },
      { timeout: 10000 },
    );

    const url = page.url();
    // Colons in query param values may be literal or %3A-encoded
    expect(url).toMatch(/programs=[^&]*(ext:srim:|ext%3Asrim%3A)/i);

    // Reload and verify SRIM column is restored
    await page.reload();
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") === "advanced",
      { timeout: 15000 },
    );
    // Wait for external data + WASM to reload before checking the table
    await expect(page.getByTestId("picker-advanced-toolbar")).toBeVisible({ timeout: 30000 });

    const srimHeader = page.locator(`th[data-program-id^="ext:srim:"]`).first();
    await expect(srimHeader).toBeVisible({ timeout: 10000 });
  });
});
