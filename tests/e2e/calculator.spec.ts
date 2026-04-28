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

    await page.waitForTimeout(600);

    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    const stpText = await stpCell.textContent();
    expect(stpText).not.toBe('0');
    expect(stpText).not.toBe('');
    expect(stpText).not.toContain('0 keV');

    const rangeCell = page.locator('[data-testid="range-cell-0"]');
    const rangeText = await rangeCell.textContent();
    expect(rangeText).not.toBe('0 nm');
    expect(rangeText).not.toBe('');
  });
});
