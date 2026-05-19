import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Checkout', () => {
  test('should show checkout UI when not logged in', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`);

    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible({ timeout: 5000 });

    // Checkout page currently always renders (no auth gate/message in the UI)
    await expect(page.getByLabel('Email (required)')).toBeVisible({ timeout: 5000 });

    const completeBtn = page.getByRole('button', { name: 'Complete Purchase' });
    await expect(completeBtn).toBeVisible({ timeout: 5000 });
    await expect(completeBtn).toBeDisabled(); // empty cart disables the button
  });

  test('should show complete purchase button on checkout page', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`);

    const completeBtn = page.getByRole('button', { name: 'Complete Purchase' });
    await expect(completeBtn).toBeVisible({ timeout: 5000 });
  });
});
