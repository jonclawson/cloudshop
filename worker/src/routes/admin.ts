import { Hono } from 'hono';
import { mockPrintful } from '../services/mock';

const admin = new Hono();

admin.post('/sync-products', async (c) => {
  try {
    const result = await mockPrintful.syncProducts();
    return c.json({
      success: true,
      synced_count: result.count,
      synced_at: new Date(result.synced_at).toISOString(),
      products: result.products,
    });
  } catch (error) {
    return c.json({ error: 'Failed to sync products' }, 500);
  }
});

export default admin;
