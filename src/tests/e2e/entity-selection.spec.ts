import { test, expect, Page } from '@playwright/test';

test.describe('Entity Selection Comboboxes - E2E', () => {
  const gotoPage = async (page: Page) => {
    await page.goto('/');
    await page.waitForSelector('button[aria-label="Particle"]');
  };

  test('renders entity selection comboboxes on page load', async ({ page }) => {
    await gotoPage(page);

    // Should see three comboboxes
    await expect(page.getByLabel('Particle')).toBeVisible();
    await expect(page.getByLabel('Material')).toBeVisible();
    await expect(page.getByLabel('Program')).toBeVisible();

    // Default selections
    await expect(page.getByLabel('Particle')).toContainText('Proton');
    await expect(page.getByLabel('Material')).toContainText('Water (liquid)');
    await expect(page.getByLabel('Program')).toContainText('Auto-select');
  });

  test('selecting a particle updates the selection', async ({ page }) => {
    await gotoPage(page);

    // Click particle combobox to open dropdown
    await page.getByLabel('Particle').click();
    await page.getByLabel('Selectable option').getByText('Carbon (C)').click();

    // Particle combobox should show selected value
    await expect(page.getByLabel('Particle')).toContainText('Carbon (C)');
  });

  test('selecting carbon with water resets program to auto-select', async ({ page }) => {
    await gotoPage(page);

    // First select Carbon
    await page.getByLabel('Particle').click();
    await page.getByLabel('Selectable option').getByText('Carbon (C)').click();

    // Select Water material
    await page.getByLabel('Material').click();
    await page.getByLabel('Selectable option').getByText('Water (liquid)').click();

    // Program should be reset to Auto-select
    await expect(page.getByLabel('Program')).toContainText('Auto-select');
  });

  test('electron cannot be selected (not in auto-select candidates)', async ({ page }) => {
    await gotoPage(page);

    // Click particle combobox
    await page.getByLabel('Particle').click();

    // Electron should NOT be in the list
    await expect(page.getByLabel('Selectable option').getByText('Electron')).not.toBeVisible();
  });

  test('material dropdown shows Elements and Compounds sections', async ({ page }) => {
    await gotoPage(page);

    await page.getByLabel('Material').click();

    // Should see section headers
    await expect(page.getByRole('option', { name: 'Elements' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Compounds' })).toBeVisible();

    // Should see materials in sections
    await expect(page.getByLabel('Selectable option').getByText('Hydrogen')).toBeVisible();
    await expect(page.getByLabel('Selectable option').getByText('Water (liquid)')).toBeVisible();
  });

  test('isComplete reflects valid selection state', async ({ page }) => {
    await gotoPage(page);

    // Initial state with defaults should be complete
    const initialButton = page.getByRole('button', { name: /Submit/i });
    await expect(initialButton).toBeEnabled();

    // Select invalid combination (e.g., particle with incompatible material)
    await page.getByLabel('Particle').click();
    await page.getByLabel('Selectable option').getByText('Carbon (C)').click();

    // Should still be complete since Carbon + Water is valid
    await expect(initialButton).toBeEnabled();
  });

  test('reset restores default selections', async ({ page }) => {
    await gotoPage(page);

    // Change selections
    await page.getByLabel('Particle').click();
    await page.getByLabel('Selectable option').getByText('Carbon (C)').click();

    await page.getByLabel('Program').click();
    await page.getByLabel('Selectable option').getByText('T2200W').click();

    // Click Reset button
    await page.getByRole('button', { name: /Reset all/i }).click();

    // Should be back to defaults
    await expect(page.getByLabel('Particle')).toContainText('Proton');
    await expect(page.getByLabel('Material')).toContainText('Water (liquid)');
    await expect(page.getByLabel('Program')).toContainText('Auto-select');
  });

  test('auto-select resolves program when particle and material are selected', async ({ page }) => {
    await gotoPage(page);

    // Initial state should show "Auto-select"
    await expect(page.getByLabel('Program')).toContainText('Auto-select');

    // Change particle to Carbon (should trigger auto-select resolution)
    await page.getByLabel('Particle').click();
    await page.getByLabel('Selectable option').getByText('Carbon (C)').click();

    // Program should now show resolved program name, not just ID
    // TODO: Update expectation once implementation shows program name instead of ID
    await expect(page.getByLabel('Program')).not.toContainText('-1');
  });

  test('program combobox groups tabulated and analytical programs', async ({ page }) => {
    await gotoPage(page);

    await page.getByLabel('Program').click();

    // Should see section headers
    await expect(page.getByRole('option', { name: 'Tabulated Programs' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Analytical Programs' })).toBeVisible();
  });

  test('particle selection respects material compatibility', async ({ page }) => {
    await gotoPage(page);

    // Change material first
    await page.getByLabel('Material').click();
    await page.getByLabel('Selectable option').getByText('Lead').click();

    // Open particle combobox
    await page.getByLabel('Particle').click();

    // Only particles compatible with Lead should be shown
    // Based on compatibility matrix, this should include Proton, Alpha, etc.
    await expect(page.getByLabel('Selectable option').getByText('Proton')).toBeVisible();
  });
});
