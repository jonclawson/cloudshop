import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Admin', () => {
  test('should sync products from admin page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/sync-products`);
    
    // Click sync button
    const syncBtn = page.locator('button:has-text("Sync Products from Printful")');
    await expect(syncBtn).toBeVisible({ timeout: 5000 });
    
    await syncBtn.click();
    
    // Wait for success message
    const successMsg = page.locator('text=Sync Complete');
    await expect(successMsg).toBeVisible({ timeout: 10000 });
  });

  test('should display warning on admin page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/sync-products`);
    
    // Warning should be visible
    const warning = page.locator('text=This page is for development only');
    await expect(warning).toBeVisible({ timeout: 5000 });
  });
});
