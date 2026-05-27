import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { verifyJWT } from '../middleware/auth';
import { mockPrintful } from '../services/mock';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
  JWT_SECRET?: string;
};

const admin = new Hono<{ Bindings }>();

async function assertAdmin(c: { env: Bindings; get: (key: string) => unknown }) {
  const auth = c.get('auth') as { userId: string } | undefined;
  const userId = auth?.userId;

  if (!userId) {
    throw new Error('UNAUTHENTICATED');
  }

  const db = getDb(c.env.DB);

  const userRow = await db
    .select({ admin: schema.users.admin })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (userRow.length === 0 || !userRow[0].admin) {
    throw new Error('FORBIDDEN');
  }
}

// POST /api/admin/sync-products - Manual Printful sync (admin-only)
admin.post('/sync-products', verifyJWT, async (c) => {
  try {
    await assertAdmin(c);
    const result = await mockPrintful.syncProducts();
    const db = getDb(c.env.DB);

    const syncedAtMs = result.synced_at;
    const provider = 'printful';
    const providerProducts = result.products;

    function filenameFromUrl(url: string): string {
      try {
        const u = new URL(url);
        const last = u.pathname.split('/').filter(Boolean).pop();
        return last || 'file';
      } catch {
        return 'file';
      }
    }

    // Drop + recreate (simple sync)
    await db.delete(schema.files);
    await db.delete(schema.productVariants);
    await db.delete(schema.products);

    let variantCount = 0;

    for (const p of providerProducts) {
      const providerProductId = String(p.external_id);

      const productInternalId = crypto.randomUUID();

      const variantPrices = p.variants.map((v) => Number(v.price));
      const basePrice =
        variantPrices.length > 0 && Number.isFinite(Math.min(...variantPrices))
          ? Math.min(...variantPrices)
          : 0;

      await db.insert(schema.products).values({
        id: productInternalId,
        name: p.title,
        sku: `printful-${providerProductId}`,
        description: p.description,
        base_price: basePrice,

        provider,
        provider_product_id: providerProductId,
        provider_sync_at: syncedAtMs,
      });

      // Insert product files from mock images[]
      if (Array.isArray(p.images)) {
        for (const url of p.images) {
          if (typeof url !== 'string') continue;
          await db.insert(schema.files).values({
            id: crypto.randomUUID(),
            parent: 'product',
            parent_id: productInternalId,
            url,
            filename: filenameFromUrl(url),
            meta: '{}',
          });
        }
      }

      // Insert variants + variant files from mock images[]
      for (const v of p.variants) {
        variantCount += 1;

        const providerVariantId = String(v.external_id);
        const variantInternalId = crypto.randomUUID();

        await db.insert(schema.productVariants).values({
          id: variantInternalId,
          product_id: productInternalId,
          size: 'size' in v ? (v.size ?? null) : null,
          color: 'color' in v ? (v.color ?? null) : null,
          price_override: Number(v.price),

          provider_variant_id: providerVariantId,
        });

        if (Array.isArray(v.images)) {
          for (const url of v.images) {
            if (typeof url !== 'string') continue;
            await db.insert(schema.files).values({
              id: crypto.randomUUID(),
              parent: 'variant',
              parent_id: variantInternalId,
              url,
              filename: filenameFromUrl(url),
              meta: '{}',
            });
          }
        }
      }
    }

    await db.insert(schema.productSyncLog).values({
      id: crypto.randomUUID(),
      synced_at: syncedAtMs,
      product_count: result.count,
      variant_count: variantCount,
      error_message: null,
    });

    return c.json({
      success: true,
      synced_count: result.count,
      synced_at: new Date(result.synced_at).toISOString(),
      products: result.products,
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')
    ) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to sync products' }, 500);
  }
});

// GET /api/admin/users - list users (admin-only)
admin.get('/users', verifyJWT, async (c) => {
  try {
    await assertAdmin(c);
    const db = getDb(c.env.DB);

    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        admin: schema.users.admin,
        created_at: schema.users.created_at,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.created_at))
      .limit(200);

    return c.json({ users });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')
    ) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// GET /api/admin/users/:id - user detail + that user's orders
admin.get('/users/:id', verifyJWT, async (c) => {
  try {
    await assertAdmin(c);
    const db = getDb(c.env.DB);

    const id = c.req.param('id');

    const user = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        admin: schema.users.admin,
        created_at: schema.users.created_at,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const orders = await db
      .select({
        id: schema.orders.id,
        status: schema.orders.status,
        total_price: schema.orders.total_price,
        created_at: schema.orders.created_at,
      })
      .from(schema.orders)
      .where(eq(schema.orders.user_id, id))
      .orderBy(desc(schema.orders.created_at))
      .limit(100);

    return c.json({
      user: user[0],
      orders,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')
    ) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// GET /api/admin/orders - list all orders
admin.get('/orders', verifyJWT, async (c) => {
  try {
    await assertAdmin(c);
    const db = getDb(c.env.DB);

    const orders = await db
      .select({
        id: schema.orders.id,
        status: schema.orders.status,
        total_price: schema.orders.total_price,
        created_at: schema.orders.created_at,
        user_id: schema.users.id,
        user_email: schema.users.email,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.user_id, schema.users.id))
      .orderBy(desc(schema.orders.created_at))
      .limit(200);

    return c.json({ orders });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')
    ) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

// GET /api/admin/orders/:id - order detail (+ owning user + items)
admin.get('/orders/:id', verifyJWT, async (c) => {
  try {
    await assertAdmin(c);
    const db = getDb(c.env.DB);

    const id = c.req.param('id');

    const orderRows = await db
      .select({
        order_id: schema.orders.id,
        status: schema.orders.status,
        total_price: schema.orders.total_price,
        created_at: schema.orders.created_at,
        user_id: schema.users.id,
        user_email: schema.users.email,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.user_id, schema.users.id))
      .where(eq(schema.orders.id, id))
      .limit(1);

    const order = orderRows[0];
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const itemRows = await db
      .select({
        order_item_id: schema.orderItems.id,
        product_variant_id: schema.orderItems.product_variant_id,
        quantity: schema.orderItems.quantity,
        price_at_purchase: schema.orderItems.price_at_purchase,

        product_name: schema.products.name,
        product_sku: schema.products.sku,
        size: schema.productVariants.size,
        color: schema.productVariants.color,
      })
      .from(schema.orderItems)
      .innerJoin(
        schema.productVariants,
        eq(schema.orderItems.product_variant_id, schema.productVariants.id)
      )
      .innerJoin(schema.products, eq(schema.productVariants.product_id, schema.products.id))
      .where(eq(schema.orderItems.order_id, id));

    return c.json({
      order_id: order.order_id,
      confirmation_number: order.order_id,
      status: order.status,
      total_price: order.total_price,
      created_at: order.created_at,
      user: { id: order.user_id, email: order.user_email },
      items: itemRows.map((row) => ({
        order_item_id: row.order_item_id,
        product_variant_id: row.product_variant_id,
        quantity: row.quantity,
        price_at_purchase: row.price_at_purchase,
        product_name: row.product_name,
        product_sku: row.product_sku,
        size: row.size,
        color: row.color,
      })),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')
    ) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

export default admin;
