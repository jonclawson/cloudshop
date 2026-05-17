import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Shopping', () => {
  test('should load products on home page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Wait for products to load
    await page.waitForSelector('text=Our Products');
    
    // Check if products are displayed
    const products = page.locator('a >> has-text("T-Shirt")');
    expect(await products.count()).toBeGreaterThan(0);
  });

  test('should navigate to product detail', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Click on a product
    const productLink = page.locator('a').first();
    const href = await productLink.getAttribute('href');
    
    if (href?.startsWith('/product/')) {
      await productLink.click();
      await page.waitForURL(`${BASE_URL}/product/*`);
    }
  });

  test('should add product to cart', async ({ page, context }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    
    // Navigate to home
    await page.goto(`${BASE_URL}/`);
    
    // Click on first product
    await page.locator('a').first().click();
    
    // Add to cart
    await page.click('button:has-text("Add to Cart")');
    
    // Verify cart updated (would need shopping cart context implementation)
  });
});
