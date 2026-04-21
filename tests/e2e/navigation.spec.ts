import { test, expect } from '@playwright/test';

test.describe('Home redirect', () => {
  test('/ redirects to /calculator', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/calculator$/);
  });
});

test.describe('Nav link clicks', () => {
  test('clicking Plot nav link navigates to /plot', async ({ page }) => {
    await page.goto('/calculator');
    await page.getByRole('link', { name: 'Plot' }).click();
    await expect(page).toHaveURL(/\/plot$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Plot' })).toBeVisible();
  });

  test('clicking Docs nav link navigates to /docs', async ({ page }) => {
    await page.goto('/calculator');
    await page.getByRole('link', { name: 'Docs' }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
  });

  test('clicking Calculator nav link navigates to /calculator', async ({ page }) => {
    await page.goto('/plot');
    await page.getByRole('link', { name: 'Calculator' }).click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Calculator' })).toBeVisible();
  });

  test('clicking webdedx brand logo navigates to /', async ({ page }) => {
    await page.goto('/plot');
    await page.getByRole('link', { name: /webdedx/i }).click();
    // Brand links to "/" which then redirects to /calculator
    await expect(page).toHaveURL(/\/(calculator)?$/);
  });
});

test.describe('Direct URL navigation', () => {
  test('navigating directly to /calculator works', async ({ page }) => {
    await page.goto('/calculator');
    await expect(page.getByRole('heading', { level: 1, name: 'Calculator' })).toBeVisible();
  });

  test('navigating directly to /plot works', async ({ page }) => {
    await page.goto('/plot');
    await expect(page.getByRole('heading', { level: 1, name: 'Plot' })).toBeVisible();
  });

  test('navigating directly to /docs works', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('Docs sub-routes', () => {
  test('/docs/user-guide loads without error', async ({ page }) => {
    await page.goto('/docs/user-guide');
    // Should render a page (not a blank screen)
    await expect(page.locator('main')).toBeVisible();
  });

  test('/docs/technical loads without error', async ({ page }) => {
    await page.goto('/docs/technical');
    await expect(page.locator('main')).toBeVisible();
  });
});
