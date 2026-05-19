import { Hono } from 'hono';
import { desc, eq, inArray } from 'drizzle-orm';
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
  const auth = c.get('auth') as { userId: string };
  const { userId } = auth;

  const body = (await c.req.json()) as CreateOrderBody;
  const cartItems = body.items;

  if (!cartItems || cartItems.length === 0) {
    return c.json({ error: 'Order items required' }, 400);
  }

  // ---- Ensure referenced FK rows exist to avoid FOREIGN KEY constraint failures ----
  // order_items.product_variant_id -> product_variants.id -> product_id -> products.id
  const variantIds = new Set<string>();
  const productIds = new Set<string>();
  const productIdByVariantId = new Map<string, string>();
  const productBasePriceDollarsByProductId = new Map<string, number>();

  for (const item of cartItems) {
    if (!item.variantId) throw new Error('Missing variantId on order item');
    if (!item.productId) throw new Error('Missing productId on order item');

    const variantId = String(item.variantId);
    const productId = String(item.productId);

    const quantity = Number(item.quantity ?? 0);
    const priceCents = Number(item.price ?? 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Invalid quantity on order item');
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      throw new Error('Invalid price on order item');
    }

    variantIds.add(variantId);
    productIds.add(productId);
    productIdByVariantId.set(variantId, productId);

    if (!productBasePriceDollarsByProductId.has(productId)) {
      productBasePriceDollarsByProductId.set(productId, toMoneyDollarsFromCents(priceCents));
    }
  }

  const db = getDb(c.env.DB);
  const variantIdList = [...variantIds];
  const productIdList = [...productIds];

  // Insert missing products
  if (productIdList.length > 0) {
    const existingProducts = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(inArray(schema.products.id, productIdList));

    const existingProductIdSet = new Set(existingProducts.map((r) => r.id));
    const missingProductIds = productIdList.filter((id) => !existingProductIdSet.has(id));

    if (missingProductIds.length > 0) {
      await db.insert(schema.products).values(
        missingProductIds.map((productId) => ({
          id: productId,
          sku: `synthetic-${productId}`,
          name: `Synthetic product ${productId}`,
          description: null,
          base_price: productBasePriceDollarsByProductId.get(productId) ?? 0,
          printful_product_id: null,
          printful_sync_at: null,
        }))
      );
    }
  }

  // Insert missing product variants
  if (variantIdList.length > 0) {
    const existingVariants = await db
      .select({ id: schema.productVariants.id })
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.id, variantIdList));

    const existingVariantIdSet = new Set(existingVariants.map((r) => r.id));
    const missingVariantIds = variantIdList.filter((id) => !existingVariantIdSet.has(id));

    if (missingVariantIds.length > 0) {
      await db.insert(schema.productVariants).values(
        missingVariantIds.map((variantId) => ({
          id: variantId,
          product_id: productIdByVariantId.get(variantId)!,
          size: null,
          color: null,
          price_override: null,
          printful_variant_id: null,
        }))
      );
    }
  }

  // ---- Create order + items ----
  const orderId = crypto.randomUUID();

  const orderItemRows = cartItems.map((item) => {
    const quantity = Number(item.quantity ?? 0);
    const priceCents = Number(item.price ?? 0);

    const variantId = item.variantId ? String(item.variantId) : undefined;
    const productId = item.productId ? String(item.productId) : undefined;

    if (!variantId) throw new Error('Missing variantId on order item');
    if (!productId) throw new Error('Missing productId on order item');

    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_variant_id: variantId,
      quantity,
      price_at_purchase: toMoneyDollarsFromCents(priceCents),
      user_upload_id: null as string | null,
    };
  });

  const totalPrice = orderItemRows.reduce(
    (sum, row) => sum + row.price_at_purchase * row.quantity,
    0
  );

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
