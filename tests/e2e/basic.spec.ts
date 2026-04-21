import { test, expect } from '@playwright/test';

test('homepage redirects to calculator', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/calculator');
});

test('calculator page loads', async ({ page }) => {
  await page.goto('/calculator');
  await expect(page.getByText('Calculator')).toBeVisible();
});

test('plot page loads', async ({ page }) => {
  await page.goto('/plot');
  await expect(page.getByText('Plot')).toBeVisible();
});

test('docs page loads', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByText('Documentation')).toBeVisible();
});
