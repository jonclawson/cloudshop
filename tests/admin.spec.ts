import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8787';

test.describe('Admin', () => {
  const adminEmail = 'admin@example.com';
  const adminPassword = 'password123';

  const gotoHomeAfterLogin = async (page: any) => {
    // Home page has stable heading "Our Products"
    await expect(page.locator('text=Our Products')).toBeVisible({ timeout: 60000 });
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 60000 });
  };

  const loginAsAdmin = async (page: any) => {
    // Ensure seeded admin exists with the known password (non-prod)
    await page.request.post(`${API_URL}/api/auth/signup`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);

    await page.click('button:has-text("Sign In")');

    // Wait for stable UI instead of waiting for "/" navigation with "load"
    await gotoHomeAfterLogin(page);
  };

  test('should sync products from admin page', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/admin/sync-products`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Warning is a reliable indicator the page loaded
    await expect(
      page.locator('text=This page is for development only'),
    ).toBeVisible({ timeout: 10000 });

    const syncBtn = page.locator('button:has-text("Sync Products from Printful")');
    await expect(syncBtn).toBeVisible({ timeout: 10000 });

    await syncBtn.click();

    const successMsg = page.locator('text=Sync Complete');
    await expect(successMsg).toBeVisible({ timeout: 30000 });
  });

  test('should display warning on admin page', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/admin/sync-products`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const warning = page.locator('text=This page is for development only');
    await expect(warning).toBeVisible({ timeout: 10000 });
  });
});
