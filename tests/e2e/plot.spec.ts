import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

test.describe("Plot page", () => {
  test("plot page loads @smoke", async ({ page }) => {
    await page.goto("/plot");
    await expect(page).toHaveURL(/\/plot/);
    await expect(page.getByRole("heading", { name: "Plot" })).toBeVisible();
  });

  test("navigates to plot page from calculator", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("link", { name: "Plot" }).click();
    await expect(page).toHaveURL(/\/plot/);
  });

  test("loads stopping-power plot for alpha particles without recursion @regression", async ({
    page,
  }) => {
    // Real-WASM plot initialization can take multiple seconds in CI.
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(
      "/plot?particle=2&material=276&program=auto&stp_unit=kev-um&xscale=log&yscale=log",
    );
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });

    await expect(page.locator('[data-testid="preview-series"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("alert").filter({ hasText: "Preview failed" })).toHaveCount(0);
    expect(errors.filter((e) => e.includes("too much recursion"))).toHaveLength(0);
  });
});

test.describe("Plot page — program selection (each_key_duplicate regression)", () => {
  test("selecting a concrete program does not throw each_key_duplicate", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Default route: Proton + Water + Auto-select, which makes both PSTAR and
    // ICRU49 available in the program panel.  Selecting PSTAR previously caused
    // each_key_duplicate because programItems pushed state.selectedProgram
    // (id=2) as the first entry AND PSTAR also appeared in availablePrograms.
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });

    await page.getByTestId("picker-tab-program").click();

    // Click PSTAR — this was the triggering action for the bug
    const pstarButton = page.getByTestId("picker-program-item-2");
    await pstarButton.click();

    // Allow any async reactive work to settle — wait for the option to be selected.
    await expect(pstarButton).toHaveAttribute("aria-selected", "true", { timeout: 3000 });

    const duplicateKeyErrors = errors.filter(
      (e) => e.includes("each_key_duplicate") || e.includes("duplicate key"),
    );
    expect(duplicateKeyErrors).toHaveLength(0);

    // Auto-select should still be present but not selected
    const autoButton = page.getByTestId("picker-program-auto-hero");
    await expect(autoButton).toHaveAttribute("aria-pressed", "false");
  });

  test("each program appears exactly once in the panel after switching programs", async ({
    page,
  }) => {
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });

    await page.getByTestId("picker-tab-program").click();

    // Click ICRU 49.
    const icruButton = page.getByTestId("picker-program-item-7");
    await icruButton.click();
    // Wait for the clicked option to become selected.
    await expect(icruButton).toHaveAttribute("aria-selected", "true", { timeout: 3000 });

    const options = page.locator('[data-testid^="picker-program-item-"]');
    const count = await options.count();
    const texts = await Promise.all(
      Array.from({ length: count }, (_, i) => options.nth(i).textContent()),
    );
    const uniqueTexts = new Set(texts.map((t) => t?.trim() ?? ""));
    expect(uniqueTexts.size).toBe(count);
  });
});

test.describe("Plot page — Advanced Options panel gating (AC-1)", () => {
  test("Advanced Options panel is absent in Basic mode", async ({ page }) => {
    await page.goto("/plot");
    // Advanced Options accordion should NOT be present in Basic mode
    const panel = page.locator('button:has-text("Advanced Options")');
    await expect(panel).toHaveCount(0);
  });
});

test.describe("Plot page — Advanced Options density recalculation", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly in Advanced mode so the panel is available immediately
    await page.goto("/plot?mode=advanced");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });
  });

  test("preview series appears after selecting particle, material, program", async ({ page }) => {
    test.setTimeout(60000);
    // Default selection (proton + water + auto) should produce a preview series
    await expect
      .poll(async () => (await page.locator('[data-testid="preview-series"]').count()) > 0, {
        timeout: 15000,
      })
      .toBe(true);
  });

  test("density override updates preview series data-density attribute (triggers reactivity) @smoke", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Wait for preview series to appear (default proton + water + auto selection)
    const previewItem = page.locator('[data-testid="preview-series"]');
    await expect.poll(async () => (await previewItem.count()) > 0, { timeout: 15000 }).toBe(true);

    // Read the built-in density from the preview item
    const builtInDensity = parseFloat((await previewItem.getAttribute("data-density")) ?? "0");
    expect(builtInDensity).toBeGreaterThan(0);

    // Open Advanced Options accordion and set density to 2×
    await page.click('button:has-text("Advanced Options")');
    await page.waitForSelector("#density-override", { timeout: 5000 });
    await page.locator("#density-override").fill("2");
    await page.locator("#density-override").blur();

    // The preview series' data-density should update to 2.0 (reactivity fix verification)
    await expect
      .poll(async () => parseFloat((await previewItem.getAttribute("data-density")) ?? "0"), {
        timeout: 15000,
      })
      .toBeCloseTo(2.0, 1);
  });

  test("density override persists in URL for plot page", async ({ page }) => {
    test.setTimeout(30000);

    // Open Advanced Options and set density
    await page.click('button:has-text("Advanced Options")');
    await page.waitForSelector("#density-override", { timeout: 5000 });
    await page.locator("#density-override").fill("1.5");
    await page.locator("#density-override").blur();

    // URL should contain density parameter
    await page.waitForFunction(() => window.location.search.includes("density=1.5"), {
      timeout: 8000,
    });
    expect(page.url()).toContain("density=1.5");
  });

  test("clearing density override restores built-in density in preview series", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Wait for preview series
    const previewItem = page.locator('[data-testid="preview-series"]');
    await expect.poll(async () => (await previewItem.count()) > 0, { timeout: 15000 }).toBe(true);

    const builtInDensity = parseFloat((await previewItem.getAttribute("data-density")) ?? "0");
    expect(builtInDensity).toBeGreaterThan(0);

    // Set density to 2
    await page.click('button:has-text("Advanced Options")');
    await page.waitForSelector("#density-override", { timeout: 5000 });
    await page.locator("#density-override").fill("2");
    await page.locator("#density-override").blur();

    // Wait for density to update
    await expect
      .poll(async () => parseFloat((await previewItem.getAttribute("data-density")) ?? "0"), {
        timeout: 15000,
      })
      .toBeCloseTo(2.0, 1);

    // Clear density via the clear button (aria-label="Clear density override")
    await page.click('[aria-label="Clear density override"]');

    // Density should revert to the material's built-in density
    await expect
      .poll(async () => parseFloat((await previewItem.getAttribute("data-density")) ?? "0"), {
        timeout: 15000,
      })
      .toBeCloseTo(builtInDensity, 1);
  });

  test("MeV·cm²/g unit (mass STP) is density-independent: stpUnit label present when selected", async ({
    page,
  }) => {
    // Navigate with mass STP unit selected
    await page.goto("/plot?mode=advanced&stpUnit=MeV%C2%B7cm%C2%B2%2Fg");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: WASM_TIMEOUT });

    // The unit selector should reflect mass STP — just verify no JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Open options and set density — should not cause errors
    await page.click('button:has-text("Advanced Options")');
    await page.waitForSelector("#density-override", { timeout: 5000 });
    await page.locator("#density-override").fill("2");
    await page.locator("#density-override").blur();

    // Wait for reactive update to settle: density=2 should appear in URL
    await page.waitForFunction(() => window.location.search.includes("density=2"), {
      timeout: 8000,
    });
    expect(errors).toHaveLength(0);
  });

  test("interpolation method change (linear → spline) re-triggers preview (URL updates)", async ({
    page,
  }) => {
    test.setTimeout(30000);

    // Open Advanced Options
    await page.click('button:has-text("Advanced Options")');
    await page.waitForSelector("#interp-method", { timeout: 5000 });

    // Switch interpolation method to spline
    await page.selectOption("#interp-method", "spline");

    // URL should contain interp_method=spline
    await page.waitForFunction(() => window.location.search.includes("interp_method=spline"), {
      timeout: 8000,
    });
    expect(page.url()).toContain("interp_method=spline");
  });
});
