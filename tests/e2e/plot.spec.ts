import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

test.describe("Plot page", () => {
  test("plot page loads", async ({ page }) => {
    await page.goto("/plot");
    await expect(page).toHaveURL(/\/plot/);
    await expect(page.getByRole("heading", { name: "Plot" })).toBeVisible();
  });

  test("navigates to plot page from calculator", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("link", { name: "Plot" }).click();
    await expect(page).toHaveURL(/\/plot/);
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
    await page.waitForSelector('[aria-label="③ Program"]', { timeout: WASM_TIMEOUT });

    const programPanel = page.getByRole("group", { name: "③ Program" });

    // Click PSTAR — this was the triggering action for the bug
    const pstarButton = programPanel.getByRole("button", { name: /PSTAR/i });
    await pstarButton.click();

    // Allow any async reactive work to settle
    await page.waitForTimeout(300);

    const duplicateKeyErrors = errors.filter(
      (e) => e.includes("each_key_duplicate") || e.includes("duplicate key"),
    );
    expect(duplicateKeyErrors).toHaveLength(0);

    // PSTAR should now be the selected program
    await expect(pstarButton).toHaveAttribute("aria-pressed", "true");

    // Auto-select should still be present but not selected
    const autoButton = programPanel.getByRole("button", { name: /Auto-select/i });
    await expect(autoButton).toHaveAttribute("aria-pressed", "false");
  });

  test("each program appears exactly once in the panel after switching programs", async ({
    page,
  }) => {
    await page.goto("/plot");
    await page.waitForSelector('[aria-label="③ Program"]', { timeout: WASM_TIMEOUT });

    const programPanel = page.getByRole("group", { name: "③ Program" });

    // Click ICRU 49 if present, otherwise click the first non-Auto program
    const icruButton = programPanel.getByRole("button", { name: /ICRU/i }).first();
    await icruButton.click();
    await page.waitForTimeout(200);

    const buttons = programPanel.getByRole("button");
    const count = await buttons.count();
    const texts = await Promise.all(
      Array.from({ length: count }, (_, i) => buttons.nth(i).textContent()),
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
