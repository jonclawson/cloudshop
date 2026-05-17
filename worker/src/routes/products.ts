import { Hono } from 'hono';
import { mockPrintful } from '../services/mock';

const products = new Hono();

products.get('/', async (c) => {
  try {
    const result = await mockPrintful.syncProducts();
    return c.json({
      products: result.products,
      count: result.count,
      synced_at: result.synced_at,
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

products.get('/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({
    id,
    name: 'Product Name',
    description: 'Product description',
    base_price: 19.99,
    variants: [],
  });
});

export default products;
