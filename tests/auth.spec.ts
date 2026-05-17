import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8787';

test.describe('Authentication', () => {
  test('should signup successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Fill signup form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Click signup button
    await page.click('button:has-text("Sign Up")');
    
    // Wait for redirect to home
    await page.waitForURL(`${BASE_URL}/`);
    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test('should login successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Click login button
    await page.click('button:has-text("Sign In")');
    
    // Wait for redirect to home
    await page.waitForURL(`${BASE_URL}/`);
    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Fill with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Click login button
    await page.click('button:has-text("Sign In")');
    
    // Should show error
    const errorDiv = page.locator('text=Authentication failed');
    await expect(errorDiv).toBeVisible({ timeout: 5000 });
  });
});
