import { Hono } from 'hono';
import { desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { verifyJWT, optionalAuth } from '../middleware/auth';
import {
  generateJWT,
  generateRandomPassword,
  generateRefreshToken,
  hashPassword,
} from '../services/authUtils';
import { getPrintfulProducts, getPrintfulVariantById } from '../services/printful';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
  JWT_SECRET?: string;
  KV: KVNamespace;
  PRINTFUL_API_KEY?: string;
};

const orders = new Hono<{ Bindings }>();

type OrderRequestItem = {
  id?: string;
  name?: string;
  variantId?: string;
  productId?: string;
  provider?: 'printful' | string;
  quantity?: number;
  price?: number; // cents (from use-shopping-cart)
  currency?: string;
};

type CreateOrderBody = {
  items?: OrderRequestItem[];
  shipping_address?: unknown;
  email?: string;
};

function toMoneyDollarsFromCents(cents: number): number {
  // cart prices come in as integer cents
  return cents / 100;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Pragmatic email validation for UX; backend must not trust it.
  // This is intentionally simple (no over-strict RFC validation).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function rateLimitCreateOrder(c: { env: Bindings }, key: string): Promise<void> {
  const limit = 5; // requests
  const windowMs = 60 * 60 * 1000; // 1 hour

  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const kvKey = `rate:orders:create:${windowId}:${key}`;

  const existing = await c.env.KV.get(kvKey);
  const current = existing ? Number(existing) : 0;

  if (Number.isFinite(current) && current >= limit) {
    // Match shape used across routes
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  const next = (Number.isFinite(current) ? current : 0) + 1;
  await c.env.KV.put(kvKey, String(next), { expirationTtl: 60 * 60 });
}

async function upsertUserByEmail(c: { env: Bindings; req: any }, email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return Promise.reject(new Error('INVALID_EMAIL'));
  }

  const db = getDb(c.env.DB);

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalized))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id as string;
  }

  // Create user with a server-generated random password.
  const userId = crypto.randomUUID();
  const randomPassword = generateRandomPassword(24);
  const passwordHash = await hashPassword(randomPassword);

  await db.insert(schema.users).values({
    id: userId,
    email: normalized,
    password_hash: passwordHash,
  });

  return userId;
}

orders.post('/', optionalAuth, async (c) => {
  const auth = c.get('auth') as { userId: string } | undefined;
  const authUserId = auth?.userId;

  const body = (await c.req.json()) as CreateOrderBody;
  const cartItems = body.items;

  if (!cartItems || cartItems.length === 0) {
    return c.json({ error: 'Order items required' }, 400);
  }

  // ---- Rate limiting (anonymous checkout path) ----
  // For authenticated users, keep the behavior unchanged (no extra limiting).
  if (!authUserId) {
    const emailForKey =
      typeof body.email === 'string' && body.email ? normalizeEmail(body.email) : 'missing-email';
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      c.req.header('x-forwarded-for') ||
      'unknown-ip';
    const key = `${emailForKey}:${ip}`;
    try {
      await rateLimitCreateOrder(c as { env: Bindings }, key);
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMIT_EXCEEDED') {
        return c.json({ error: 'Too many requests' }, 429);
      }
      throw err;
    }
  }

  // If anonymous, resolve/create by email.
  let userId = authUserId;
  if (!userId) {
    const email = body.email;
    if (typeof email !== 'string' || !email) {
      return c.json({ error: 'Email required for checkout' }, 400);
    }

    try {
      userId = await upsertUserByEmail(c as { env: Bindings; req: any }, email);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_EMAIL') {
        return c.json({ error: 'Invalid email' }, 400);
      }
      console.error('Upsert user failed:', err);
      return c.json({ error: 'Checkout failed' }, 500);
    }
  }

  // ---- Ensure referenced FK rows exist to avoid FOREIGN KEY constraint failures ----
  // For printful items, we do NOT create DB synthetic products/variants.
  const variantIds = new Set<string>();
  const productIds = new Set<string>();
  const productIdByVariantId = new Map<string, string>();
  const productBasePriceDollarsByProductId = new Map<string, number>();

  for (const item of cartItems) {
    if (!item.variantId) throw new Error('Missing variantId on order item');
    if (!item.productId) throw new Error('Missing productId on order item');

    const isPrintful = item.provider === 'printful';

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

    // Only build FK insertion sets for non-printful items.
    if (!isPrintful) {
      variantIds.add(variantId);
      productIds.add(productId);
      productIdByVariantId.set(variantId, productId);

      if (!productBasePriceDollarsByProductId.has(productId)) {
        productBasePriceDollarsByProductId.set(productId, toMoneyDollarsFromCents(priceCents));
      }
    }
  }

  const db = getDb(c.env.DB);
  const variantIdList = [...variantIds];
  const productIdList = [...productIds];

  // Insert missing products (non-printful only)
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

          provider: 'printful',
          provider_product_id: productId,
          provider_sync_at: null,
        }))
      );
    }
  }

  // Insert missing product variants (non-printful only)
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

          provider_variant_id: variantId,
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

    const isPrintful = item.provider === 'printful';

    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_variant_id: variantId,
      provider: isPrintful ? 'printful' : null,
      quantity,
      price_at_purchase: toMoneyDollarsFromCents(priceCents),
      user_upload_id: null as string | null,
    };
  });

  const totalPrice = orderItemRows.reduce((sum, row) => sum + row.price_at_purchase * row.quantity, 0);

  const jwtSecret = c.env.JWT_SECRET || 'dev-secret';

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

    // Return tokens for both anonymous + authenticated flow so frontend can load order confirmation.
    const accessToken = await generateJWT(userId, jwtSecret);
    const refreshToken = await generateRefreshToken(userId, jwtSecret);
    const refreshTokenHash = await hashPassword(refreshToken);

    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    await db.insert(schema.refreshTokens).values({
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: refreshTokenHash,
      expires_at: expiresAt,
    });

    // Get email for response (handy for frontend AuthContext)
    const userRow = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const userEmail = userRow[0]?.email;

    return c.json(
      {
        order_id: orderId,
        confirmation_number: orderId,
        total_price: totalPrice,
        status: 'pending',
        items: cartItems,
        payment_intent: { client_secret: 'pi_stub_client_secret' },

        user: userEmail ? { id: userId, email: userEmail } : { id: userId, email: null },
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      201
    );
  } catch (error) {
    console.error('Create order failed:', error);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

orders.get('/', verifyJWT, async (c) => {
  const auth = c.get('auth') as { userId: string };
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
  const auth = c.get('auth') as { userId: string };
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
      .select({
        order_item_id: schema.orderItems.id,
        product_variant_id: schema.orderItems.product_variant_id,
        provider: schema.orderItems.provider,

        quantity: schema.orderItems.quantity,
        price_at_purchase: schema.orderItems.price_at_purchase,

        product_name: schema.products.name,
        product_sku: schema.products.sku,
        size: schema.productVariants.size,
        color: schema.productVariants.color,
      })
      .from(schema.orderItems)
      .leftJoin(
        schema.productVariants,
        eq(schema.orderItems.product_variant_id, schema.productVariants.id)
      )
      .leftJoin(schema.products, eq(schema.productVariants.product_id, schema.products.id))
      .where(eq(schema.orderItems.order_id, id));

    const needsPrintfulHydration = itemRows.some((r) => r.provider === 'printful');

    let printfulVariantIndex: Map<
      string,
      { productTitle: string; productSku: string; size: string | null; color: string | null }
    > = new Map();

    // More reliable size/color: fetch per-variant from Printful's variant endpoint.
    let printfulVariantSizeColorIndex: Map<string, { size: string | null; color: string | null }> = new Map();

    if (needsPrintfulHydration) {
      const printfulProducts = await getPrintfulProducts(
        { env: c.env as any },
        { maxProducts: 500 }
      );

      for (const prod of printfulProducts) {
        const productTitle = prod.title ?? prod.name ?? '';
        const productSku = String(prod.external_id ?? prod.id);

        for (const v of prod.variants ?? []) {
          printfulVariantIndex.set(String(v.id), {
            productTitle,
            productSku,
            size: v.size ?? null,
            color: v.color ?? null,
          });
        }
      }

      const variantIdList = [
        ...new Set(
          itemRows
            .filter((r) => r.provider === 'printful')
            .map((r) => String(r.product_variant_id))
        ),
      ];

      await Promise.all(
        variantIdList.map(async (variantId) => {
          try {
            const v = await getPrintfulVariantById(
              { env: c.env as any },
              variantId
            );
            printfulVariantSizeColorIndex.set(variantId, {
              size: v.size ?? null,
              color: v.color ?? null,
            });
          } catch {
            // Keep missing entries; mapping will fall back to list-based values.
          }
        })
      );
    }

    return c.json({
      order_id: order.id,
      confirmation_number: order.id,
      status: order.status,
      total_price: order.total_price,
      created_at: order.created_at,
        items: itemRows.map((row) => {
        if (row.provider === 'printful') {
          const vid = String(row.product_variant_id);
          const idx = printfulVariantIndex.get(vid);
          const sc = printfulVariantSizeColorIndex.get(vid);

          return {
            order_item_id: row.order_item_id,
            product_variant_id: row.product_variant_id,
            quantity: row.quantity,
            price_at_purchase: row.price_at_purchase,
            product_name: row.product_name ?? idx?.productTitle ?? `Printful ${row.product_variant_id}`,
            product_sku: row.product_sku ?? idx?.productSku ?? `printful-${row.product_variant_id}`,
            size: sc?.size ?? idx?.size ?? row.size ?? null,
            color: sc?.color ?? idx?.color ?? row.color ?? null,
          };
        }

        return {
          order_item_id: row.order_item_id,
          product_variant_id: row.product_variant_id,
          quantity: row.quantity,
          price_at_purchase: row.price_at_purchase,
          product_name: row.product_name,
          product_sku: row.product_sku,
          size: row.size,
          color: row.color,
        };
      }),
    });
  } catch (error) {
    console.error('Get order failed:', error);
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

export default orders;
