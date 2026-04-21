import { test, expect } from '@playwright/test';

test('homepage redirects to calculator', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const currentUrl = page.url();
  expect(currentUrl).toContain('calculator');
});

test('calculator page loads', async ({ page }) => {
  await page.goto('/calculator');
  await expect(page.getByRole('heading', { name: 'Calculator' })).toBeVisible();
});

test('plot page loads', async ({ page }) => {
  await page.goto('/plot');
  await expect(page.getByRole('heading', { name: 'Plot' })).toBeVisible();
});

test('docs page loads', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByRole('heading', { name: 'Documentation' })).toBeVisible();
});
