import { test, expect } from '@playwright/test';

test('homepage redirects to calculator', async ({ page }) => {
  await page.goto('/');
  // Calculator writes canonical URL params (urlv/particle/material/...) on
  // mount, so allow an optional query string after `/calculator`.
  await expect(page).toHaveURL(/\/calculator(\?|$)/);
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
