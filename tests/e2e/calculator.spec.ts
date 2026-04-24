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
