import { Hono } from 'hono';
import { mockPrintful } from '../services/mock';
const admin = new Hono();
// POST /api/admin/sync-products - Manual Printful sync
admin.post('/sync-products', async (c) => {
    try {
        const useMocks = c.env.USE_MOCKS === 'true';
        if (useMocks) {
            const result = await mockPrintful.syncProducts();
            return c.json({
                success: true,
                synced_count: result.count,
                synced_at: new Date(result.synced_at).toISOString(),
                products: result.products,
            });
        }
        // TODO: Implement real Printful sync
        // - Call Printful API to fetch products
        // - Store in D1
        // - Log sync event to product_sync_log table
        return c.json({
            success: true,
            synced_count: 0,
            synced_at: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Error syncing products:', error);
        return c.json({ error: 'Failed to sync products', details: error.message }, 500);
    }
});
export default admin;
//# sourceMappingURL=admin.js.map