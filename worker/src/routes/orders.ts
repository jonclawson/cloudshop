import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { verifyJWT } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
  JWT_SECRET?: string;
};

const orders = new Hono<{ Bindings }>();

type OrderRequestItem = {
  id?: string;
  name?: string;
  variantId?: string;
  productId?: string;
  quantity?: number;
  price?: number; // cents (from use-shopping-cart)
  currency?: string;
};

type CreateOrderBody = {
  items?: OrderRequestItem[];
  shipping_address?: unknown;
};

function toMoneyDollarsFromCents(cents: number): number {
  // cart prices come in as integer cents
  return cents / 100;
}

orders.post('/', verifyJWT, async (c) => {
  const auth = c.get('auth');
  const { userId } = auth;

  const body = (await c.req.json()) as CreateOrderBody;
  const cartItems = body.items;

  if (!cartItems || cartItems.length === 0) {
    return c.json({ error: 'Order items required' }, 400);
  }

  const orderId = crypto.randomUUID();

  // Map cart items -> order item rows
  const orderItemRows = cartItems.map((item) => {
    const quantity = Number(item.quantity ?? 0);
    const priceCents = Number(item.price ?? 0);

    if (!item.variantId) {
      throw new Error('Missing variantId on order item');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Invalid quantity on order item');
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      throw new Error('Invalid price on order item');
    }

    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_variant_id: String(item.variantId),
      quantity,
      price_at_purchase: toMoneyDollarsFromCents(priceCents),
      user_upload_id: null as string | null,
    };
  });

  const totalPrice = orderItemRows.reduce(
    (sum, row) => sum + row.price_at_purchase * row.quantity,
    0
  );

  const db = getDb(c.env.DB);

  try {
    await db.insert(schema.orders).values({
      id: orderId,
      user_id: userId,
      stripe_payment_id: 'pi_stub',
      status: 'pending',
      total_price: totalPrice,
      printful_order_id: null,
    });

    await db.insert(schema.orderItems).values(orderItemRows);

    // Keep Stripe as a stub for now (not testable until Stripe account/keys exist)
    return c.json(
      {
        order_id: orderId,
        confirmation_number: orderId,
        total_price: totalPrice,
        status: 'pending',
        items: cartItems,
        payment_intent: { client_secret: 'pi_stub_client_secret' },
      },
      201
    );
  } catch (error) {
    console.error('Create order failed:', error);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

orders.get('/', verifyJWT, async (c) => {
  const auth = c.get('auth');
  const { userId } = auth;

  const db = getDb(c.env.DB);

  try {
    const rows = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.user_id, userId))
      .orderBy(desc(schema.orders.created_at))
      .limit(50);

    return c.json({ orders: rows });
  } catch (error) {
    console.error('List orders failed:', error);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

orders.get('/:id', verifyJWT, async (c) => {
  const auth = c.get('auth');
  const { userId } = auth;

  const id = c.req.param('id');

  const db = getDb(c.env.DB);

  try {
    const orderRow = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);

    const order = orderRow[0];
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Ensure order belongs to the user
    if (order.user_id !== userId) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const itemRows = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.order_id, id));

    return c.json({
      order_id: order.id,
      confirmation_number: order.id,
      status: order.status,
      total_price: order.total_price,
      created_at: order.created_at,
      items: itemRows.map((row) => ({
        product_variant_id: row.product_variant_id,
        quantity: row.quantity,
        price_at_purchase: row.price_at_purchase,
      })),
    });
  } catch (error) {
    console.error('Get order failed:', error);
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

export default orders;
