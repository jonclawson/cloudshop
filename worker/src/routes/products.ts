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
  const result = await mockPrintful.syncProducts();
  const product = result.products.find((p) => +p.id === +id);
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }
  
  return c.json(product); 
});

export default products;
