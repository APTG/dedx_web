import { test, expect } from "@playwright/test";

/**
 * E2E test for issue #869 — Basic-mode calculator URLs silently discarded an
 * explicit `program=` param with no user-facing feedback. Reproduces the exact
 * link aidedx generated (see APTG/aidedx#116): a Basic-mode link (no
 * `mode=advanced`) with `program=6` (ICRU 73), which the app always resets to
 * Auto-select in Basic mode (#816) — now with a toast explaining why.
 */

test.describe("Issue #869 — Basic-mode program-discard toast", () => {
  test("shows a toast when a Basic-mode URL's explicit program= is discarded @smoke", async ({
    page,
  }) => {
    await page.goto(
      "/calculator?urlv=3&particle=5&material=14&program=6&energies=220.5:keV&eunit=MeV",
    );

    const toast = page.getByTestId("calculator-notice-toast");
    await expect(toast).toBeVisible({ timeout: 20000 });
    await expect(toast).toContainText("Basic mode ignores the link's program");
  });

  test("does not show the toast when the URL has no program= param", async ({ page }) => {
    await page.goto("/calculator?urlv=3&particle=5&material=14&energies=220.5:keV&eunit=MeV");

    // Wait for Basic mode's hydration/calculation to actually settle before
    // asserting the toast's absence, rather than a fixed sleep (banned, #12 in
    // .opencode/lessons-learned.md — flaky in CI).
    await page.waitForSelector('[data-testid="basic-single-row-card"]', { timeout: 20000 });
    await expect(page.getByTestId("calculator-notice-toast")).toHaveCount(0);
  });

  test("does not show the toast when the URL requests Advanced mode", async ({ page }) => {
    await page.goto(
      "/calculator?urlv=3&mode=advanced&particle=5&material=14&program=6&energies=220.5:keV&eunit=MeV",
    );

    await page.waitForSelector('[data-testid="advanced-combined-table"]', { timeout: 20000 });
    await expect(page.getByTestId("calculator-notice-toast")).toHaveCount(0);
  });
});
