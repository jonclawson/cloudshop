import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Shopping', () => {
  test('should load products on home page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Wait for products section to render and for at least one product link to exist.
    await expect(page.getByRole('heading', { name: 'Our Products' })).toBeVisible({ timeout: 5000 });

    const productLinks = page.locator('a[href^="/product/"]');
    await page.waitForTimeout(250); // allow productsApi to settle in client-only cart mode
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to product detail', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    const productLinks = page.locator('a[href^="/product/"]');
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(0);

    await productLinks.first().click();
    await page.waitForURL(`${BASE_URL}/product/*`);
  });

  test('should add product to cart', async ({ page }) => {
    // Ensure a product exists.
    await page.goto(`${BASE_URL}/`);
    const productLinks = page.locator('a[href^="/product/"]');
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(0);

    // Go to product page and add to cart.
    await productLinks.first().click();
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Add to Cart")');

    // Product page routes to /cart.
    await page.waitForURL(`${BASE_URL}/cart`);

    // Cart should no longer be empty.
    await expect(page.getByText('Your cart is empty')).not.toBeVisible({ timeout: 5000 });

    // Basic sanity: cart page UI should be there.
    await expect(page.getByRole('heading', { name: 'Shopping Cart' })).toBeVisible({ timeout: 5000 });
  });
});
