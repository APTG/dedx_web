import { test, expect, type Page } from "@playwright/test";

/** Wait until the URL bar contains the given substring. */
async function waitForUrl(page: Page, needle: string, timeout = 8000) {
  await page.waitForFunction((n: string) => window.location.search.includes(n), needle, {
    timeout,
  });
}

test.describe("Calculator URL sync", () => {
  test("calculator state is encoded in URL after loading", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 10000,
    });
    expect(page.url()).toContain("particle=1");
    expect(page.url()).toContain("material=276");
  });

  test("loading URL with particle=6 restores carbon selection", async ({ page }) => {
    await page.goto("/calculator?particle=6&material=276&energies=100,200&eunit=MeV");
    await expect(page.getByTestId("picker-tab-particle")).toContainText(/Carbon \(C/, {
      timeout: 8000,
    });
    const energyInputs = page.getByRole("textbox");
    await expect(energyInputs.nth(0)).toHaveValue("100");
    await expect(energyInputs.nth(1)).toHaveValue("200");
  });

  test("invalid URL params fall back to defaults without error", async ({ page }) => {
    await page.goto("/calculator?particle=NOPE&energies=notanumber&eunit=bebok");
    await expect(page.getByRole("heading", { name: /calculator/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test("mixed-unit rows encoded with :unit suffix", async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    const addRowBtn = page.getByRole("button", { name: /add row/i });
    await addRowBtn.click();

    const energyInput2 = page.locator('[data-testid="energy-input-1"]');
    await energyInput2.fill("500 keV");
    await energyInput2.blur();

    await page.waitForFunction(() => window.location.search.includes("500:keV"), { timeout: 5000 });
    expect(page.url()).toContain("500:keV");
  });
});

/**
 * Multi-particle URL round-trip (issue #599).
 *
 * Spec: docs/04-feature-specs/shareable-urls.md §3.1
 * Canonical example: particles=1,2,6&across=particle&mode=advanced
 */
test.describe("Multi-particle URL encoding (across=particle)", () => {
  test("selecting multiple particles in advanced mode encodes particles= and across=particle in URL", async ({
    page,
  }) => {
    // Start in advanced mode, across=particle
    await page.goto("/calculator?mode=advanced&particle=1&material=276&across=particle");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    // Open particle tab and select a second particle (Carbon, Z=6)
    await page.getByTestId("picker-tab-particle").click();
    const carbonItem = page.getByTestId("picker-particle-item-6");
    // Carbon should be visible as a list item in multi-mode; click to add it.
    await expect(carbonItem).toBeVisible({ timeout: 5000 });
    await carbonItem.click();

    // URL must now contain across=particle and particles= with at least two IDs.
    await waitForUrl(page, "across=particle");
    await waitForUrl(page, "particles=");
    const url = new URL(page.url());
    const particlesParam = url.searchParams.get("particles");
    expect(particlesParam).not.toBeNull();
    const ids = particlesParam!.split(",").map(Number);
    expect(ids).toContain(1); // proton (default anchor)
    expect(ids).toContain(6); // carbon
  });

  test("sharing a URL with particles=1,2,6&across=particle restores multi-select state", async ({
    page,
  }) => {
    await page.goto(
      "/calculator?urlv=2&mode=advanced&particle=1&particles=1,2,6&material=276&program=9&energies=100&eunit=MeV&across=particle",
    );
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    // The across-particle button should be active.
    const acrossParticle = page.getByTestId("across-particle");
    await expect(acrossParticle).toHaveAttribute("aria-checked", "true", { timeout: 8000 });

    // Open particle tab — check that the three IDs are marked as selected.
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-particle-item-1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("picker-particle-item-2")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("picker-particle-item-6")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("particles= in basic mode is silently ignored (no error, defaults loaded)", async ({
    page,
  }) => {
    // Basic mode: particles= and across= are invalid per spec and must be ignored.
    await page.goto(
      "/calculator?particle=6&particles=1,2,6&material=276&program=9&energies=100&eunit=MeV&across=particle",
    );
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 10000,
    });
    await expect(page.getByTestId("picker-tab-particle")).toContainText(/Carbon/, {
      timeout: 8000,
    });
    await expect(page.getByTestId("compare-across-strip")).toHaveCount(0);
  });

  test("URL in advanced mode without particles= has no across=particle in encoded URL", async ({
    page,
  }) => {
    await page.goto("/calculator?mode=advanced&particle=1&material=276");
    await waitForUrl(page, "mode=advanced");
    // By default across should be "single" — no across= param emitted.
    await page.waitForFunction(
      () =>
        window.location.search.includes("particle=") &&
        !window.location.search.includes("across=particle"),
      { timeout: 8000 },
    );
    expect(page.url()).not.toContain("across=particle");
    expect(page.url()).not.toContain("particles=");
  });
});
