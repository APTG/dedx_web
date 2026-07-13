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
    // Basic mode is always exactly one row (issue #840) — the second energy
    // in the link is silently dropped rather than creating a second row.
    await expect(page.getByTestId("energy-input-0")).toHaveValue("100");
    await expect(page.getByTestId("energy-input-1")).toHaveCount(0);
  });

  test("loading a multi-energy URL in Advanced mode restores all rows", async ({ page }) => {
    await page.goto("/calculator?mode=advanced&particle=6&material=276&energies=100,200&eunit=MeV");
    await page.waitForSelector('[data-testid="advanced-combined-table"]', { timeout: 10000 });
    await expect(page.getByTestId("advanced-energy-input-0")).toHaveValue("100");
    await expect(page.getByTestId("advanced-energy-input-1")).toHaveValue("200");
  });

  test("invalid URL params fall back to defaults without error", async ({ page }) => {
    await page.goto("/calculator?particle=NOPE&energies=notanumber&eunit=bebok");
    await expect(page.getByRole("heading", { name: /calculator/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test("mixed-unit rows encoded with :unit suffix", async ({ page }) => {
    // Add Row is Advanced-only since issue #840 — mixed-unit rows require a
    // second row, which Basic mode (always exactly one row) cannot produce.
    await page.goto("/calculator?mode=advanced");
    await page.waitForSelector('[data-testid="advanced-combined-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="advanced-energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    const addRowBtn = page.getByRole("button", { name: /add row/i });
    await addRowBtn.click();

    const energyInput2 = page.locator('[data-testid="advanced-energy-input-1"]');
    await energyInput2.fill("500 keV");
    await energyInput2.blur();

    await page.waitForFunction(() => window.location.search.includes("500:keV"), { timeout: 5000 });
    expect(page.url()).toContain("500:keV");
  });

  test("Basic mode: a shared calc=range (as-shipped imode=csda) link stays on the Range tab and round-trips without mode=advanced", async ({
    page,
  }) => {
    // Issue #840: calc=/lookups=/runit= (as-shipped: imode=/lookups=/iunit=)
    // are no longer advanced-mode-only.
    await page.goto("/calculator?particle=1&material=276&imode=csda&ivalues=7.718:cm");
    await page.waitForSelector('[data-testid="basic-range-card"]', { timeout: 10000 });

    await expect(page.locator('[data-testid="inverse-tab-range"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator('[data-testid="basic-range-input"]')).toHaveValue("7.718 cm");

    await waitForUrl(page, "imode=csda");
    expect(page.url()).not.toContain("mode=advanced");
  });
});

/**
 * Multi-particle URL round-trip (issue #599).
 *
 * Spec: docs/04-feature-specs/shareable-urls.md §3.1
 * Canonical example: particles=1~2~6&across=particles&mode=advanced
 */
test.describe("Multi-particle URL encoding (across=particles)", () => {
  test("selecting multiple particles in advanced mode encodes particles= and across=particles in URL", async ({
    page,
  }) => {
    // Start in advanced mode, across=particles
    await page.goto("/calculator?mode=advanced&particle=1&material=276&across=particles");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    // Open particle tab and select a second particle (Carbon, Z=6)
    await page.getByTestId("picker-tab-particle").click();
    const carbonItem = page.getByTestId("picker-particle-item-6");
    // Carbon should be visible as a list item in multi-mode; click to add it.
    await expect(carbonItem).toBeVisible({ timeout: 5000 });
    await carbonItem.click();

    // URL must now contain across=particles and particles= with at least two IDs.
    await waitForUrl(page, "across=particles");
    await waitForUrl(page, "particles=");
    const url = new URL(page.url());
    const particlesParam = url.searchParams.get("particles");
    expect(particlesParam).not.toBeNull();
    // Canonical list separator is `~` from v3 (issue #672); never a bare comma.
    expect(particlesParam).not.toContain(",");
    const ids = particlesParam!.split(/[,~]/).map(Number);
    expect(ids).toContain(1); // proton (default anchor)
    expect(ids).toContain(6); // carbon
  });

  test("sharing a URL with particles=1,2,6&across=particles restores multi-select state", async ({
    page,
  }) => {
    await page.goto(
      "/calculator?urlv=2&mode=advanced&particle=1&particles=1,2,6&material=276&program=9&energies=100&eunit=MeV&across=particles",
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
      "/calculator?particle=6&particles=1,2,6&material=276&program=9&energies=100&eunit=MeV&across=particles",
    );
    await page.waitForFunction(() => window.location.search.includes("particle="), {
      timeout: 10000,
    });
    await expect(page.getByTestId("picker-tab-particle")).toContainText(/Carbon/, {
      timeout: 8000,
    });
    await expect(page.getByTestId("compare-across-strip")).toHaveCount(0);
  });

  test("URL in advanced mode without particles= has no across=particles in encoded URL", async ({
    page,
  }) => {
    await page.goto("/calculator?mode=advanced&particle=1&material=276");
    await waitForUrl(page, "mode=advanced");
    // By default across should be "single" — no across= param emitted.
    await page.waitForFunction(
      () =>
        window.location.search.includes("particle=") &&
        !window.location.search.includes("across=particles"),
      { timeout: 8000 },
    );
    expect(page.url()).not.toContain("across=particles");
    expect(page.url()).not.toContain("particles=");
  });
});

/**
 * Linkifier-safe list separator (issue #672).
 *
 * Multi-item shared links used commas, which messenger/email auto-linkifiers
 * truncate at the first comma. The canonical separator is now `~`, and legacy
 * comma links must still hydrate and upgrade to the `~` form on load.
 */
test.describe("Linkifier-safe URLs (issue #672)", () => {
  // Multiple energy rows are Advanced-only since issue #840 (Basic mode is
  // always exactly one row), so these list-separator regressions now exercise
  // Advanced mode — the `,` → `~` behavior itself is mode-independent.
  test("multi-row energies are encoded with ~ and never a bare comma", async ({ page }) => {
    await page.goto(
      "/calculator?mode=advanced&particle=1&material=276&energies=100,200,500&eunit=MeV",
    );
    // Decoder accepts the legacy comma form, then replaceState rewrites the URL
    // bar to the canonical ~ form.
    await page.waitForFunction(() => window.location.search.includes("energies=100~200~500"), {
      timeout: 8000,
    });
    const search = new URL(page.url()).search;
    expect(search).toContain("energies=100~200~500");
    expect(search).not.toContain(",");
    expect(search).not.toContain("%2C");
    // The whole search string survives a comma-terminating linkifier intact.
    expect(search.split(",")).toHaveLength(1);
  });

  test("a urlv=2 comma link still hydrates and upgrades to the urlv=3 ~ form", async ({ page }) => {
    await page.goto(
      "/calculator?urlv=2&mode=advanced&particle=6&material=276&energies=100,200&eunit=MeV",
    );
    // No unsupported-version banner: v2 is within the supported range.
    await expect(page.locator('[data-testid="url-version-warning"]')).not.toBeVisible({
      timeout: 3000,
    });
    // Both rows restored (Advanced mode).
    await page.waitForSelector('[data-testid="advanced-combined-table"]', { timeout: 10000 });
    await expect(page.getByTestId("advanced-energy-input-0")).toHaveValue("100", { timeout: 8000 });
    await expect(page.getByTestId("advanced-energy-input-1")).toHaveValue("200");
    // Canonical form rewritten to urlv=3 with the ~ separator.
    await page.waitForFunction(
      () =>
        window.location.search.includes("urlv=3") &&
        window.location.search.includes("energies=100~200"),
      { timeout: 8000 },
    );
    expect(new URL(page.url()).search).not.toContain(",");
  });
});
