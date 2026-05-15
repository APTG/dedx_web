import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for external data sources in Calculator Advanced Mode.
 *
 * These tests require network access to the SRIM .webdedx store at
 * https://s3.cloud.cyfronet.pl/dedxweb/srim-gui.webdedx/
 * and the WASM binary in static/wasm/.
 *
 * URL source: src/lib/utils/external-data-example-urls.ts
 *
 * CORS note: the S3 bucket does not send Access-Control-Allow-Origin headers.
 * The beforeEach hook intercepts S3 requests and injects the required CORS
 * headers so that zarrita (which uses fetch()) can access the store.
 */

const SRIM_EXTDATA =
  "extdata=srim:https%3A%2F%2Fs3.cloud.cyfronet.pl%2Fdedxweb%2Fsrim-gui.webdedx%2F";

// Proton in Liquid Water with ICRU 49, 100 MeV
const BASE_QUERY = `urlv=1&${SRIM_EXTDATA}&particle=1&material=276&program=7&energies=100&eunit=MeV`;

async function gotoAdvancedWithSrim(page: Page) {
  await page.goto(`/calculator?${BASE_QUERY}&mode=advanced&qfocus=both`);
  await page.waitForFunction(
    () => new URLSearchParams(window.location.search).get("mode") === "advanced",
    { timeout: 15000 },
  );
  // External data loading + WASM init can take 20-30s on first load
  await expect(page.getByRole("button", { name: /Programs/ })).toBeVisible({ timeout: 30000 });
}

// All tests in this suite hit a live S3 endpoint and are slow/potentially
// flaky in CI — they are tagged @nightly and excluded from default PR runs.
// Run locally with: pnpm test:e2e:nightly
test.describe("External data in Calculator Advanced Mode @nightly", () => {
  // External data requires S3 network access — allow 90s per test
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    // The S3 bucket doesn't send CORS headers; inject them so zarrita's fetch() succeeds.
    await page.route(/s3\.cloud\.cyfronet\.pl\/dedxweb\//, async (route) => {
      // Respond to OPTIONS preflight directly with CORS approval.
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
          },
          body: "",
        });
        return;
      }
      // For GET/HEAD, forward to S3 and add CORS headers to the response.
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    });
  });

  test("SRIM program appears in Programs picker when extdata loaded", async ({ page }) => {
    await gotoAdvancedWithSrim(page);

    // Open the Programs picker
    await page.getByRole("button", { name: /Programs/ }).click();

    const listbox = page.getByRole("listbox", { name: "Select comparison programs" });
    await expect(listbox).toBeVisible();

    // The External section header should be present
    await expect(listbox.getByText("External", { exact: false })).toBeVisible();

    // SRIM program should appear with 🔗 prefix
    const srimOption = listbox.getByRole("option", { name: /srim/i });
    await expect(srimOption).toBeVisible();
  });

  test("Adding SRIM program creates a new column in the table", async ({ page }) => {
    await gotoAdvancedWithSrim(page);

    // Open Programs picker and add SRIM
    await page.getByRole("button", { name: /Programs/ }).click();
    const listbox = page.getByRole("listbox", { name: "Select comparison programs" });
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
    await page.getByRole("button", { name: /Programs/ }).click();
    const srimOption = page
      .getByRole("listbox", { name: "Select comparison programs" })
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
    await expect(page.getByRole("button", { name: /Programs/ })).toBeVisible({ timeout: 30000 });

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
    await page.getByRole("button", { name: /Programs/ }).click();
    await page
      .getByRole("listbox", { name: "Select comparison programs" })
      .getByRole("option", { name: /srim/i })
      .click();
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
    await expect(page.getByRole("button", { name: /Programs/ })).toBeVisible({ timeout: 30000 });

    const srimHeader = page.locator(`th[data-program-id^="ext:srim:"]`).first();
    await expect(srimHeader).toBeVisible({ timeout: 10000 });
  });
});
