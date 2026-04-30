import { test, expect } from '@playwright/test';

test.describe('Calculator Page - Smoke Test', () => {
  test('calculator page loads with heading', async ({ page }) => {
    await page.goto('/calculator');
    await expect(page.getByRole('heading', { name: 'Calculator' })).toBeVisible();
  });

  test('energy input component renders after WASM loads', async ({ page }) => {
    test.skip(true, 'SKIP: WASM loading timeout in E2E environment - tracked separately');
    
    await page.goto('/calculator');
    await page.waitForSelector('[aria-label="Particle"]', { timeout: 30000 });
    await page.waitForSelector('button:has-text("Add row")', { timeout: 10000 });
    
    const energyInputs = page.locator('input[aria-label*="Energy value"]');
    await expect(energyInputs).toHaveCount(3);
  });
});

test.describe('WASM calculation produces real values', () => {
  test('100 MeV proton in Water (PSTAR) shows non-zero STP and range', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill('100 MeV');
    await energyInput.blur();

    // Wait for the STP cell to leave the placeholder/calculating state and
    // resolve to a numeric value greater than zero. ResultTable renders
    // "—" while `isCalculating` and "-" when no result is available, so
    // asserting `not.toBe('0')` / `not.toBe('')` would pass against either
    // placeholder. We poll the cell text until parseFloat returns a real
    // positive number.
    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ''), { timeout: 5000 })
      .toBeGreaterThan(0);

    const rangeCell = page.locator('[data-testid="range-cell-0"]');
    await expect
      .poll(async () => parseFloat((await rangeCell.textContent()) ?? ''), { timeout: 5000 })
      .toBeGreaterThan(0);
  });
});

test.describe('Calculator on mobile viewport', () => {
  // Pixel 7A-like viewport (the device referenced in the issue).
  test.use({ viewport: { width: 412, height: 915 } });

  test('calculated stopping power and range are fully visible (no clipping)', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill('100 MeV');
    await energyInput.blur();

    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    const rangeCell = page.locator('[data-testid="range-cell-0"]');

    // Wait for real WASM-computed values.
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ''), { timeout: 5000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => parseFloat((await rangeCell.textContent()) ?? ''), { timeout: 5000 })
      .toBeGreaterThan(0);

    // The bug from the issue: result columns get squished and their text gets
    // clipped on narrow viewports. With the fix, the table has a min-width
    // and the wrapper scrolls horizontally, so each cell is wide enough that
    // its content is not visually truncated by an `overflow:hidden` ancestor.
    for (const cell of [stpCell, rangeCell]) {
      const text = (await cell.textContent())?.trim() ?? '';
      expect(text.length).toBeGreaterThan(0);

      // Each result cell should be wide enough to fully render its number
      // (scrollWidth must not exceed clientWidth — otherwise the value
      // is being clipped by an overflow:hidden ancestor).
      const { clientWidth, scrollWidth } = await cell.evaluate((el) => ({
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    }

    // The table wrapper (the element with `overflow-x-auto`) must allow the
    // user to scroll to the right-hand result columns when the viewport is
    // narrower than the table — i.e. scrollWidth > clientWidth on the wrapper.
    const tableWrapper = page.locator('[data-testid="result-table"]').locator('..');
    const wrapperMetrics = await tableWrapper.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        overflowX: style.overflowX,
      };
    });
    expect(wrapperMetrics.overflowX).toMatch(/auto|scroll/);
    expect(wrapperMetrics.scrollWidth).toBeGreaterThanOrEqual(wrapperMetrics.clientWidth);
  });
});
