import { Hono } from 'hono';
import { mockPrintful } from '../services/mock';
const products = new Hono();
// GET /api/products - List all products with variants
products.get('/', async (c) => {
    try {
        const useMocks = c.env.USE_MOCKS === 'true';
        if (useMocks) {
            const result = await mockPrintful.syncProducts();
            return c.json({
                products: result.products,
                count: result.count,
                synced_at: result.synced_at,
            });
        }
        // TODO: Implement real Printful API call
        // - Check D1 cache for products
        // - If cache miss or stale, fetch from Printful API
        // - Store in D1
        // - Return products
        return c.json({ products: [], count: 0 });
    }
    catch (error) {
        console.error('Error fetching products:', error);
        return c.json({ error: 'Failed to fetch products' }, 500);
    }
});
// GET /api/products/:id - Single product details
products.get('/:id', async (c) => {
    try {
        const productId = c.req.param('id');
        // TODO: Implement product detail fetch
        // - Fetch from D1 by ID
        // - Include all variants
        return c.json({
            id: productId,
            name: 'Product Name',
            description: 'Product description',
            base_price: 19.99,
            variants: [],
        });
    }
    catch (error) {
        console.error('Error fetching product:', error);
        return c.json({ error: 'Product not found' }, 404);
    }
});
export default products;
//# sourceMappingURL=products.js.map