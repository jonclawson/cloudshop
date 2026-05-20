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

  test('should reset password via forgot-password + reset-password (dev token)', async ({
    page,
  }) => {
    const API_BASE_URL = 'http://localhost:8787';
    const initialPassword = 'password123';
    const signupEmail = `reset_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`;
    const newPassword = `password_${Date.now()}_new`;

    // 1) Create user via API (so this test is self-contained)
    const signupResp = await page.request.post(`${API_BASE_URL}/api/auth/signup`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ email: signupEmail, password: initialPassword }),
    });
    expect(signupResp.status()).toBe(201);

    // 2) Request reset token (dev-only hook)
    const forgotResp = await page.request.post(`${API_BASE_URL}/api/auth/forgot-password`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ email: signupEmail }),
    });
    expect(forgotResp.status()).toBe(200);

    const forgotJson = (await forgotResp.json()) as { reset_token?: string; error?: string };
    expect(forgotJson.reset_token, 'reset_token should be returned in development').toBeTruthy();

    const token = forgotJson.reset_token as string;

    // 3) Reset password UI
    await page.goto(`${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`);
    await page.fill('input[type="password"]', newPassword);
    await page.locator('form').locator('input[type="password"]').nth(1).fill(newPassword);
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Password updated successfully')).toBeVisible({
      timeout: 5000,
    });

    // 4) Login with new password
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', signupEmail);
    await page.fill('input[type="password"]', newPassword);
    await page.click('button:has-text("Sign In")');

    const errorDiv = page.locator('text=Login failed');

    const redirectPromise = page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
    const loginFailurePromise = errorDiv
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => {
        throw new Error(
          'Expected login to succeed after password reset, but UI showed "Login failed".'
        );
      });

    await Promise.race([redirectPromise, loginFailurePromise]);
    expect(page.url()).toBe(`${BASE_URL}/`);
  });
});
