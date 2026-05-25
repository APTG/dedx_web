import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * E2E tests for Stage 6.13 — Formal URL Parser.
 *
 * Tests cover all 6 acceptance scenarios from the spec:
 * - Scenario 1a: urlv mismatch shows banner (no WASM needed)
 * - Scenario 1b: load-defaults restores calculation (WASM needed)
 * - Scenario 2: urlv=2 (current) — no warning
 * - Scenario 3: missing urlv — treated as legacy, no warning
 * - Scenario 4: custom compound round-trip (WASM needed)
 * - Scenario 5: duplicate params use last value
 * - Scenario 6: unknown params dropped
 */

async function checkWasmAvailable(page: Page): Promise<boolean> {
  try {
    const resp = await page.request.get("/wasm/libdedx.mjs");
    return resp.ok();
  } catch {
    return false;
  }
}

test.describe("Stage 6.13 — URL parser", () => {
  // ── Scenario 1a: urlv mismatch shows banner (no WASM needed) @smoke ───────
  test("urlv=999: version-mismatch banner visible with correct version @smoke", async ({
    page,
  }) => {
    await page.goto("/calculator?urlv=999&particle=1&material=276&energies=100");
    const banner = page.locator('[data-testid="url-version-warning"]');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText("999");
    await expect(page.locator('[data-testid="url-version-warning-load-defaults"]')).toBeVisible();
    await page.waitForFunction(
      () => {
        const cell = document.querySelector('[data-testid="stp-cell-0"]');
        return !cell || Number.isNaN(parseFloat(cell.textContent ?? ""));
      },
      { timeout: 2000 },
    );
  });

  // ── Scenario 1b: load-defaults restores calculation (WASM needed) @smoke ──
  test("urlv=999: load-defaults dismisses banner and restores calculation @smoke", async ({
    page,
  }) => {
    const wasmOk = await checkWasmAvailable(page);
    test.skip(!wasmOk, "WASM binary absent — skip calculation assertion");

    await page.goto("/calculator?urlv=999&particle=1&material=276&energies=100");
    const banner = page.locator('[data-testid="url-version-warning"]');
    await expect(banner).toBeVisible({ timeout: 5000 });

    await page.click('[data-testid="url-version-warning-load-defaults"]');
    await expect(banner).not.toBeVisible({ timeout: 3000 });

    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
  });

  // ── Scenario 2: urlv=2 (current) — no warning @regression ────────────────
  test("malformed urlv: version-mismatch banner visible @regression", async ({ page }) => {
    await page.goto("/calculator?urlv=1abc&particle=1&material=276&energies=100");
    const banner = page.locator('[data-testid="url-version-warning"]');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText("1abc");
  });

  test("urlv=2: no warning banner shown @regression", async ({ page }) => {
    await page.goto("/calculator?urlv=2&particle=1&material=276&energies=100&eunit=MeV");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator('[data-testid="url-version-warning"]')).not.toBeVisible({
      timeout: 3000,
    });
  });

  // ── Scenario 3: missing urlv — treated as legacy, no warning @regression ───
  test("missing urlv: no warning banner (legacy-compatible) @regression", async ({ page }) => {
    await page.goto("/calculator?particle=1&material=276&energies=100");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator('[data-testid="url-version-warning"]')).not.toBeVisible({
      timeout: 3000,
    });
  });

  // ── Scenario 4: custom compound round-trip (WASM needed) @smoke ──────────
  test("custom compound URL round-trip: mat_* params restore compound @smoke", async ({ page }) => {
    const wasmOk = await checkWasmAvailable(page);
    test.skip(!wasmOk, "WASM binary absent — skip custom compound round-trip");

    const url =
      "/calculator?urlv=2&particle=2&material=custom&mat_name=Water-url-test" +
      "&mat_density=1&mat_elements=1%3A2%2C8%3A1&mode=advanced&program=1&programs=1&energies=5";

    await page.goto(url);
    // Wait for the banner text to appear (more reliable than waiting for testid alone)
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="compound-from-url-banner"]')
          ?.textContent?.includes("Water-url-test"),
      { timeout: 10000 },
    );
    await expect(page.locator('[data-testid="compound-from-url-banner"]')).toBeVisible({
      timeout: 5000,
    });
    const stpCell = page
      .locator('[data-testid="advanced-stp-cell-0"], [data-testid^="stp-cell-"]')
      .first();
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), {
        timeout: 10000,
      })
      .toBeGreaterThan(0);
  });

  test("advanced URL can switch back to Basic mode @regression", async ({ page }) => {
    const wasmOk = await checkWasmAvailable(page);
    test.skip(!wasmOk, "WASM binary absent — skip advanced mode URL restore");

    await page.goto(
      "/calculator?urlv=2&particle=1&material=276&program=7&energies=12&eunit=MeV&mode=advanced&programs=7&qfocus=both",
    );
    // Wait for WASM to load and produce a result — this also confirms urlInitialized=true
    // (the URL update effect guards on urlInitialized, so we must not click before it's set).
    const stpCell = page
      .locator('[data-testid="advanced-stp-cell-0"], [data-testid^="stp-cell-"]')
      .first();
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), {
        timeout: 20000,
      })
      .toBeGreaterThan(0);

    await page.locator('button[aria-label="Switch to Basic mode"]').click();
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("mode") !== "advanced",
      { timeout: 10000 },
    );

    await expect(page.locator('button[aria-label="Switch to Basic mode"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // ── Scenario 5: duplicate params use last value @regression ───────────────
  test("duplicate particle param: last value (2) used @regression", async ({ page }) => {
    const wasmOk = await checkWasmAvailable(page);
    test.skip(!wasmOk, "WASM binary absent — skip canonical URL sync assertion");

    await page.goto("/calculator?particle=1&particle=2&material=276&energies=100");
    // Wait for the duplicate particle=1 to be removed (URL sync completes)
    await page.waitForFunction(() => !window.location.search.includes("particle=1"), {
      timeout: 5000,
    });
    const searchParams = new URL(page.url()).searchParams;
    expect(searchParams.getAll("particle")).toHaveLength(1);
    expect(searchParams.get("particle")).toBe("2");
  });

  // ── Scenario 6: unknown params dropped from canonical URL @regression ─────
  test("unknown params dropped from canonical URL @regression", async ({ page }) => {
    const wasmOk = await checkWasmAvailable(page);
    test.skip(!wasmOk, "WASM binary absent — skip canonical URL sync assertion");

    await page.goto("/calculator?urlv=2&particle=1&material=276&energies=100&foo=bar&unknown=xyz");
    await page.waitForFunction(() => !window.location.search.includes("foo="), {
      timeout: 5000,
    });
    expect(page.url()).not.toContain("foo=");
    expect(page.url()).not.toContain("unknown=");
    expect(page.url()).toContain("particle=1");
  });
});
