import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Checkout', () => {
  test('should require login for checkout', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`);
    
    // Should see login message or be redirected
    const loginMessage = page.locator('text=Please sign in to checkout');
    const loginLink = page.locator('a:has-text("Go to login")');
    
    await expect(loginMessage.or(loginLink)).toBeVisible({ timeout: 5000 });
  });

  test('should complete checkout flow', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    
    // Navigate to checkout
    await page.goto(`${BASE_URL}/checkout`);
    
    // Complete purchase button should be visible
    const completeBtn = page.locator('button:has-text("Complete Purchase")');
    await expect(completeBtn).toBeVisible({ timeout: 5000 });
  });
});
