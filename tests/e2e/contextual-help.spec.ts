import { test, expect } from "@playwright/test";

// Contextual-help "ⓘ" hints (docs/04-feature-specs/contextual-help.md, #769).
// The hints are static content, so this runs against the real app without any
// WASM mock injection.
test.describe("Contextual help — Program data source", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    // Open the picker on the Program tab.
    await page.getByTestId("picker-tab-program").click();
    await expect(page.getByTestId("picker-program-tab")).toBeVisible();
  });

  test("explains what a program (data source) is and links to the docs @smoke", async ({
    page,
  }) => {
    const hint = page.getByTestId("picker-program-help").getByRole("button");
    await expect(hint).toBeVisible();

    // Open on focus (keyboard / tap path).
    await hint.focus();

    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/data source/i);

    const learnMore = tip.getByRole("link", { name: /Learn more/i });
    await expect(learnMore).toHaveAttribute("href", /\/docs\/user-guide#choosing-a-program/);

    // Dismissable without moving focus (WCAG 1.4.13).
    // Note: the Calculator page's global ESC handler intentionally blurs and
    // collapses the picker (documented behaviour), so we verify tooltip
    // dismissal only — not focus retention — in this context.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("each listed program exposes a help hint", async ({ page }) => {
    // PSTAR (program id 2) is present whenever protons are selectable (default).
    const pstarHint = page.getByTestId("picker-program-help-2");
    await expect(pstarHint).toBeVisible();

    await pstarHint.click();
    await expect(page.getByRole("tooltip")).toContainText(/PSTAR/);

    // Opening the hint must not change the selected program.
    await expect(page.getByTestId("picker-tab-program")).toContainText(/Auto/);
  });

  test("TAB/FN/EXT badge in legend shows accessible tooltip on focus and ESC dismisses", async ({
    page,
  }) => {
    const legend = page.getByTestId("picker-program-legend");
    const tabBadge = legend.getByTestId("picker-program-tag-TAB");
    await expect(tabBadge).toBeVisible();

    // Open on keyboard focus (covers keyboard + touch paths).
    await tabBadge.focus();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/Tabulated data/i);

    // ESC dismisses the tooltip. The Calculator page's global ESC handler also
    // blurs picker focus by design, so we verify tooltip dismissal only.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });
});

// Quantity & unit hints (PR 2, #770). Parity: both stopping power AND CSDA range
// expose a concept hint on the result card. The default proton/water selection
// computes on load, so the Basic single-row card is present.
test.describe("Contextual help — quantities & units", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByTestId("basic-single-row-card")).toBeVisible();
  });

  test("explains the stopping-power quantity and links to the glossary @smoke", async ({
    page,
  }) => {
    const hint = page.getByTestId("basic-stp-help").getByRole("button");
    await hint.focus();

    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/electronic/i);

    const learnMore = tip.getByRole("link", { name: /Learn more/i });
    await expect(learnMore).toHaveAttribute("href", /\/docs\/user-guide#quantities/);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("gives CSDA range equal weight with its own hint", async ({ page }) => {
    const hint = page.getByTestId("basic-range-help").getByRole("button");
    await hint.focus();

    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/Bragg/);
  });
});
