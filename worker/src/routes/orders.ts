import { Hono } from 'hono';

const orders = new Hono();

orders.post('/', async (c) => {
  const { items } = await c.req.json();
  if (!items || items.length === 0) {
    return c.json({ error: 'Order items required' }, 400);
  }
  return c.json({
    order_id: 'order-123',
    total_price: 49.99,
    items,
    payment_intent: { client_secret: 'pi_test_secret' },
  }, 201);
});

orders.get('/', (c) => {
  return c.json({ orders: [], total: 0, page: 1 });
});

orders.get('/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({
    order_id: id,
    status: 'pending',
    items: [],
    total_price: 49.99,
  });
});

export default orders;
