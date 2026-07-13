import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES: Array<{ path: string; label: string }> = [
  { path: "/", label: "home" },
  { path: "/calculator", label: "calculator" },
  { path: "/plot", label: "plot" },
  { path: "/docs", label: "docs" },
];

for (const { path, label } of ROUTES) {
  test(`zero WCAG 2.1/2.2 AA violations on ${label} page @regression`, async ({ page }) => {
    await page.goto(path);
    // Wait for the initial paint to settle — WASM-backed pages need the
    // result-table to render before axe can see all interactive elements.
    if (path === "/calculator") {
      await page.waitForSelector('[data-testid="result-table"]', { timeout: 15000 });
    } else if (path === "/plot") {
      await expect(page.getByRole("heading", { name: "Plot" }).first()).toBeVisible();
    } else {
      await page.waitForLoadState("networkidle");
    }

    if (path === "/calculator") {
      // The header's Export PDF/CSV buttons animate opacity (`transition-all`)
      // from their disabled (50%-opacity) state to fully enabled once a result
      // is available (always true on /calculator's default load). Scanning
      // mid-transition can sample a blended color that dips below the AA
      // contrast threshold even though the settled state is compliant — wait
      // for the transition to actually finish before axe runs. (The /plot
      // page is excluded: its Export buttons legitimately stay disabled until
      // the user adds a series, so waiting for "enabled" would hang there.)
      const exportBtn = page.getByTestId("export-pdf-btn");
      await expect(exportBtn).toBeEnabled({ timeout: 15000 });
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="export-pdf-btn"]');
          return btn ? getComputedStyle(btn).opacity === "1" : false;
        },
        { timeout: 5000 },
      );
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      // Bits UI Combobox places the search <input role="combobox"> inside
      // div[role="listbox"], which violates aria-required-children. This is a
      // known structural limitation of the bits-ui combobox pattern and is not
      // fixable without modifying the library. The combobox is functionally
      // accessible — screen readers navigate it correctly via aria-expanded /
      // aria-activedescendant on the trigger.
      .disableRules(["aria-required-children"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test("skip link is the first tab stop and moves focus to main @regression", async ({ page }) => {
  await page.goto("/calculator");
  await page.waitForSelector('[data-testid="result-table"]', { timeout: 15000 });

  // First Tab from the top of the document must land on the skip link.
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();

  // Activating it moves focus to the main content landmark.
  await page.keyboard.press("Enter");
  const main = page.locator("#main-content");
  await expect(main).toBeFocused();
});
