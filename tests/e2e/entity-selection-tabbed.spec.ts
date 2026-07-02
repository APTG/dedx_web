import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the picker entity-selection redesign (now the default render path).
 * The old v7 comboboxes/panels are no longer rendered.
 *
 * See `docs/04-feature-specs/entity-selection.md`.
 */
test.describe("Calculator page — tabbed picker", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("tab bar renders proton/Water inline; recipe bar removed; no Program tab in Basic", async ({
    page,
  }) => {
    // Recipe bar removed in the entity-selector rework.
    await expect(page.getByTestId("picker-recipe-bar")).toHaveCount(0);
    await expect(page.getByTestId("picker-tab-particle")).toContainText("proton");
    await expect(page.getByTestId("picker-tab-material")).toContainText("Water");
    // Program tab is Advanced-only now — auto-selected behind the scenes (#816).
    await expect(page.getByTestId("picker-tab-program")).toHaveCount(0);
  });

  test("renders Particle + Material tabs and starts collapsed (defaults complete)", async ({
    page,
  }) => {
    await expect(page.getByTestId("picker-tab-particle")).toBeVisible();
    await expect(page.getByTestId("picker-tab-material")).toBeVisible();
    // Program tab is Advanced-only now (#816).
    await expect(page.getByTestId("picker-tab-program")).toHaveCount(0);
    // Panel should be collapsed since defaults are already complete
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });

  test("clicking a tab expands the panel", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-particle-tab")).toBeVisible();
  });

  test("Basic mode shows the 'Calculated with … (auto-selected)' annotation (#816)", async ({
    page,
  }) => {
    // Defaults (proton + Water) are complete, so results — and the annotation
    // that names the auto-selected program — render on load.
    const annotation = page.getByTestId("program-annotation");
    await expect(annotation).toBeVisible();
    await expect(annotation).toContainText(/Calculated with/i);
    await expect(annotation).toContainText(/auto-selected/i);
  });

  test("clicking a tab activates the matching tab and opens panel", async ({ page }) => {
    await page.getByTestId("picker-tab-material").click();
    await expect(page.getByTestId("picker-tab-material")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-material-tab")).toBeVisible();
  });

  test("electron row is omitted from the particle list (spec § Particle)", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    await expect(page.getByTestId("picker-particle-item-1001")).toHaveCount(0);
  });

  test("particle list shows flat list with Z tag and no section headers", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    // proton row shows the name and a Z=1 tag
    await expect(page.getByTestId("picker-particle-item-1")).toContainText("proton");
    await expect(page.getByTestId("picker-particle-item-1")).toContainText("Z=1");
    // Section headers should be gone
    await expect(page.getByTestId("picker-particle-tab")).not.toContainText("Common particles");
    await expect(page.getByTestId("picker-particle-tab")).not.toContainText("Ions");
  });

  test("particle search filters the list and a click selects + stays on tab", async ({ page }) => {
    await page.getByTestId("picker-tab-particle").click();
    const search = page.getByTestId("picker-particle-search");
    await search.fill("alpha");
    const alpha = page.getByTestId("picker-particle-item-2");
    await expect(alpha).toBeVisible();
    await alpha.click();

    // Tab bar updates inline.
    await expect(page.getByTestId("picker-tab-particle")).toContainText("alpha particle");
    // Water is already set + Program auto-resolves → all tabs non-empty → panel collapses on Calculator.
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });

  test("material tab shows sub-tab pills (Compounds default)", async ({ page }) => {
    await page.getByTestId("picker-tab-material").click();
    // Sub-tab pills replace the old column layout.
    await expect(page.getByTestId("material-subtab-compounds")).toBeVisible();
    await expect(page.getByTestId("material-subtab-elements")).toBeVisible();
    // Compounds should be the default active sub-tab.
    await expect(page.getByTestId("material-subtab-compounds")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Old column test-IDs are gone.
    await expect(page.getByTestId("picker-material-col-elements")).toHaveCount(0);
    await expect(page.getByTestId("picker-material-col-compounds")).toHaveCount(0);
  });

  test("reset (advanced toolbar) restores defaults and collapses the panel", async ({ page }) => {
    // Reset is in the Advanced toolbar — switch on Advanced via URL.
    await page.goto("/calculator?mode=advanced");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });

    // Open panel first by clicking a tab.
    await page.getByTestId("picker-tab-particle").click();
    await page.getByTestId("picker-particle-search").fill("alpha");
    await page.getByTestId("picker-particle-item-2").click();

    await page.getByTestId("picker-reset").click();

    await expect(page.getByTestId("picker-tab-particle")).toContainText("proton");
    await expect(page.getByTestId("picker-tab-material")).toContainText("Water");
    // After reset defaults are complete → panel should be closed
    await expect(page.getByTestId("picker-tab-panel")).toHaveCount(0);
  });

  test("advanced toolbar is hidden in Basic mode", async ({ page }) => {
    await expect(page.getByTestId("picker-advanced-toolbar")).toHaveCount(0);
  });
});

test.describe("Calculator page — Program tab (Advanced mode, #816)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator?mode=advanced");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
  });

  test("Program tab is present in Advanced mode and shows Auto inline", async ({ page }) => {
    await expect(page.getByTestId("picker-tab-program")).toBeVisible();
    await expect(page.getByTestId("picker-tab-program")).toContainText(/Auto/);
  });

  test("clicking the Program tab activates it and shows the legend", async ({ page }) => {
    await page.getByTestId("picker-tab-program").click();
    await expect(page.getByTestId("picker-tab-program")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("picker-program-tab")).toBeVisible();
    await expect(page.getByTestId("picker-program-legend")).toBeVisible();
  });

  test("returning to Basic overwrites an Advanced program choice with Auto (#816 round-trip)", async ({
    page,
  }) => {
    // Pin an explicit program (PSTAR, id 2) in Advanced mode.
    await page.getByTestId("picker-tab-program").click();
    const pstar = page.getByTestId("picker-program-item-2");
    await pstar.click();
    // Calculator mode auto-collapses the picker once the selection is complete,
    // so assert via the stable tab summary instead of the soon-to-be-removed row.
    await expect(page.getByTestId("picker-tab-program")).toContainText(/PSTAR/);

    // Basic mode has no program selector and always auto-selects, so the pinned
    // PSTAR must be discarded on a Basic → Advanced round-trip — the user's
    // Advanced choice is not silently retained behind the hidden tab.
    await page.getByRole("button", { name: "Switch to Basic mode" }).click();
    await page.getByRole("button", { name: "Switch to Advanced mode" }).click();

    await page.getByTestId("picker-tab-program").click();
    await expect(page.getByTestId("picker-program-auto-hero")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("picker-program-item-2")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});

test.describe("Plot page — tabbed picker", () => {
  test("renders tabbed picker above the series-list area (always expanded)", async ({ page }) => {
    await page.goto("/plot");
    await page.waitForSelector('[data-testid="picker-entity-selection"]', { timeout: 15000 });
    await expect(page.getByTestId("picker-tab-bar")).toBeVisible();
    // Plot page is NOT collapsible — panel should always be visible
    await expect(page.getByTestId("picker-tab-panel")).toBeVisible();
  });
});
