import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Authentication', () => {
  test.describe.configure({ mode: 'serial' });

  let signupEmail: string;

  test('should signup successfully', async ({ page }) => {
    signupEmail = `test_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`;

    await page.goto(`${BASE_URL}/login`);

    // Switch to signup mode
    await page.click('button:has-text("Don\'t have an account? Sign Up")');

    // Fill signup form
    await page.fill('input[type="email"]', signupEmail);
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
    await page.fill('input[type="email"]', signupEmail);
    await page.fill('input[type="password"]', 'password123');

    // Click login button
    await page.click('button:has-text("Sign In")');

    // Wait for redirect to home
    await page.waitForURL(`${BASE_URL}/`);
    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Fill with invalid credentials (wrong password for the user created above)
    await page.fill('input[type="email"]', signupEmail);
    await page.fill('input[type="password"]', 'wrongpassword');

    // Click login button
    await page.click('button:has-text("Sign In")');

    // Should show error (see AuthContext -> new Error('Login failed'))
    const errorDiv = page.locator('text=Login failed');
    await expect(errorDiv).toBeVisible({ timeout: 5000 });
  });
});
