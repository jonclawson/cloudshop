import { Hono } from 'hono';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { verifyJWT, optionalAuth } from '../middleware/auth';
import {
  generateJWT,
  generateRandomPassword,
  generateRefreshToken,
  hashPassword,
} from '../services/authUtils';
import {
  createAndPollPrintfulEstimate,
  enrichEstimateOrderItemsWithPlacements,
  getPrintfulProducts,
  getPrintfulVariantById,
  resolveStateFromZip,
  submitPrintfulOrder,
} from '../services/printful';

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
  meta?: string
};

type AddressInput = {
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type CreateOrderBody = {
  items?: OrderRequestItem[];
  email?: string;
  billing_address?: AddressInput;
  shipping_address?: AddressInput;
  stripe_payment_id?: string;
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
  const environment = c.env.ENVIRONMENT ?? 'development';

  // In development/emulator we don’t want checkout spam tests to permanently hit 429s.
  if (environment !== 'production') return;

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

async function findOrCreateAddress(
  db: ReturnType<typeof getDb>,
  userId: string,
  addressInput: AddressInput
): Promise<string> {
  const { name, line1, line2, city, state, postal_code, country } = addressInput;

  // Normalize: trim whitespace, lowercase country/state for consistent matching
  const normalized = {
    name: name?.trim() ?? null,
    line1: line1?.trim() ?? null,
    line2: line2?.trim() ?? null,
    city: city?.trim() ?? null,
    state: state?.trim() ?? null,
    postal_code: postal_code?.trim() ?? null,
    country: country?.trim()?.toLowerCase() ?? null,
  };

  // Look for an exact match for this user
  const existing = await db
    .select({ id: schema.addresses.id })
    .from(schema.addresses)
    .where(
      and(
        eq(schema.addresses.user_id, userId),
        eq(schema.addresses.name, normalized.name),
        eq(schema.addresses.line1, normalized.line1),
        eq(schema.addresses.line2, normalized.line2),
        eq(schema.addresses.city, normalized.city),
        eq(schema.addresses.state, normalized.state),
        eq(schema.addresses.postal_code, normalized.postal_code),
        eq(schema.addresses.country, normalized.country)
      )
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  const addressId = crypto.randomUUID();
  await db.insert(schema.addresses).values({
    id: addressId,
    user_id: userId,
    name: normalized.name,
    line1: normalized.line1,
    line2: normalized.line2,
    city: normalized.city,
    state: normalized.state,
    postal_code: normalized.postal_code,
    country: normalized.country,
  });

  return addressId;
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
  const orderId = crypto.randomUUID().replace(/-/g, '');

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
      meta: item.meta ? String(item.meta) : null,
    };
  });

  const orderItemIds = orderItemRows.map((r) => r.id);
  const totalPrice = orderItemRows.reduce((sum, row) => sum + row.price_at_purchase * row.quantity, 0);

  const jwtSecret = c.env.JWT_SECRET || 'dev-secret';

  try {
    await db.insert(schema.orders).values({
      id: orderId,
      user_id: userId,
      stripe_payment_id: body.stripe_payment_id || 'pi_stub',
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

    // Persist billing and shipping addresses
    const addressTypes: Array<{ key: keyof CreateOrderBody; type: string }> = [
      { key: 'billing_address', type: 'billing' },
      { key: 'shipping_address', type: 'shipping' },
    ];

    for (const { key, type } of addressTypes) {
      const addrInput = body[key] as AddressInput | undefined;
      if (addrInput && addrInput.line1 && addrInput.name) {
        const addressId = await findOrCreateAddress(db, userId, addrInput);
        await db.insert(schema.orderAddresses).values({
          id: crypto.randomUUID(),
          order_id: orderId,
          address_id: addressId,
          address_type: type,
        });
      }
    }

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
        order_item_ids: orderItemIds,
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

// Link uploaded thumb/print user_upload rows to each order_item using the junction table.
type OrderItemUploadLink = {
  order_item_id: string;
  thumb_user_upload_id?: string;
  print_user_upload_id?: string;
};

orders.post('/:orderId/order-item-uploads', verifyJWT, async (c) => {
  const { userId } = c.get('auth') as { userId: string };
  const orderId = c.req.param('orderId');

  const links = (await c.req.json()) as OrderItemUploadLink[];

  if (!Array.isArray(links) || links.length === 0) {
    return c.json({ error: 'Upload links required' }, 400);
  }

  const db = getDb(c.env.DB);

  // Ensure order belongs to user.
  const orderRow = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.user_id, userId)))
    .limit(1);

  if (!orderRow[0]) return c.json({ error: 'Order not found' }, 404);

  const orderItemIds = Array.from(
    new Set(
      links
        .map((l) => l.order_item_id)
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
    )
  );

  if (orderItemIds.length === 0) {
    return c.json({ error: 'order_item_id required' }, 400);
  }

  // Idempotency: clear existing links for these order items.
  await db.delete(schema.orderItemUploads).where(inArray(schema.orderItemUploads.order_item_id, orderItemIds));

  const rowsToInsert: Array<{ id: string; order_item_id: string; user_upload_id: string }> = [];

  for (const link of links) {
    if (link.print_user_upload_id && link.print_user_upload_id.length > 0) {
      rowsToInsert.push({
        id: crypto.randomUUID(),
        order_item_id: link.order_item_id,
        user_upload_id: link.print_user_upload_id,
      });
    }
    if (link.thumb_user_upload_id && link.thumb_user_upload_id.length > 0) {
      rowsToInsert.push({
        id: crypto.randomUUID(),
        order_item_id: link.order_item_id,
        user_upload_id: link.thumb_user_upload_id,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    await db.insert(schema.orderItemUploads).values(rowsToInsert);
  }

  return c.json({ ok: true, order_id: orderId }, 201);
});

// Submit printful items in this order to Printful's API.
orders.post('/:orderId/submit-to-printful', verifyJWT, async (c) => {
  const { userId } = c.get('auth') as { userId: string };
  const orderId = c.req.param('orderId');

  const db = getDb(c.env.DB);

  // Ensure order belongs to user.
  const orderRow = await db
    .select({ id: schema.orders.id, user_id: schema.orders.user_id })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  if (!orderRow[0]) return c.json({ error: 'Order not found' }, 404);
  if (orderRow[0].user_id !== userId) return c.json({ error: 'Order not found' }, 404);

  try {
    const result = await submitPrintfulOrder({
      env: c.env,
      orderId,
    });

    return c.json(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === 'PRINTFUL_API_KEY_MISSING') {
      return c.json({ error: 'Printful API key not configured — cannot submit printful items' }, 400);
    }

    if (message === 'ORDER_NOT_FOUND') {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (message === 'SHIPPING_ADDRESS_REQUIRED') {
      return c.json({ error: 'Shipping address required to submit Printful order' }, 400);
    }

    if (message.startsWith('PRINTFUL_ORDER_FAILED:')) {
      const [, status, body] = message.match(/^PRINTFUL_ORDER_FAILED:(\d+):(.*)/) ?? [];
      return c.json(
        {
          error: 'Printful order submission failed',
          printful_status: Number(status),
          printful_body: body ?? message,
        },
        502
      );
    }

    console.error('Submit to Printful failed:', err);
    return c.json({ error: 'Failed to submit order to Printful' }, 500);
  }
});

// Get printful shipping estimate for order items.
orders.post('/printful-estimate', async (c) => {
  try {
    const body = await c.req.json<{
      recipient: { state_code?: string; country_code: string; zip?: string };
      order_items: Array<{
        catalog_variant_id: number;
        external_id: string;
        quantity: number;
        retail_price?: string;
        name?: string;
        options: {id: string, value: any}[];
      }>;
      retail_costs?: {
        currency?: string;
        discount?: string;
        shipping?: string;
        tax?: string;
      };
    }>();

    if (!body.recipient?.country_code) {
      return c.json({ error: 'Country code required' }, 400);
    }
    if (!body.order_items?.length) {
      return c.json({ error: 'Order items required' }, 400);
    }

    // Auto-resolve state from zip if not provided (US-only)
    let recipient = { ...body.recipient };
    if (!recipient.state_code && recipient.country_code === 'US' && recipient.zip) {
      const resolved = await resolveStateFromZip(recipient.zip);
      if (resolved) {
        recipient.state_code = resolved.stateCode;
      }
    }

    // Enrich order items with placement data (technique, dimensions, placeholder images)
    const enrichedOrderItems = await enrichEstimateOrderItemsWithPlacements(c.env, body.order_items);

    const payload = {
      recipient,
      order_items: enrichedOrderItems,
      retail_costs: body.retail_costs,
    };
    console.log('Creating Printful estimate with payload:', JSON.stringify(payload, null, 2));
    const result = await createAndPollPrintfulEstimate(c.env, payload);

    return c.json(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === 'MISSING_PRINTFUL_API_KEY') {
      return c.json({ error: 'Printful API key not configured' }, 400);
    }

    if (message.startsWith('PRINTFUL_ESTIMATE_CREATE_FAILED:')) {
      const [, status, body] = message.match(/^PRINTFUL_ESTIMATE_CREATE_FAILED:(\d+):(.*)/) ?? [];
      return c.json(
        {
          error: 'Printful estimate creation failed',
          printful_status: Number(status),
          printful_body: body ?? message,
        },
        502
      );
    }

    if (message.startsWith('PRINTFUL_ESTIMATE_GET_FAILED:')) {
      const [, status, body] = message.match(/^PRINTFUL_ESTIMATE_GET_FAILED:(\d+):(.*)/) ?? [];
      return c.json(
        {
          error: 'Printful estimate polling failed',
          printful_status: Number(status),
          printful_body: body ?? message,
        },
        502
      );
    }

    if (message === 'PRINTFUL_ESTIMATE_TIMEOUT') {
      return c.json({ error: 'Printful estimate timed out' }, 504);
    }

    if (message.startsWith('PRINTFUL_ESTIMATE_FAILED:')) {
      const reasons = message.replace('PRINTFUL_ESTIMATE_FAILED:', '');
      return c.json({ error: 'Printful estimate failed', reasons }, 502);
    }

    console.error('Printful estimate failed:', err);
    return c.json({ error: 'Failed to get estimate' }, 500);
  }
});

orders.get('/', verifyJWT, async (c) => {
  const { userId } = c.get('auth') as { userId: string };
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
  const { userId } = c.get('auth') as { userId: string };
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

    const orderItemIdList = itemRows.map((r) => String(r.order_item_id));
    const variantIdList = itemRows.map((r) => String(r.product_variant_id));

    // Hydrate thumb URLs (from user_uploads where design_name='thumb')
    let thumbUrlByOrderItemId = new Map<string, string>();
    if (orderItemIdList.length > 0) {
      const thumbRows = await db
        .select({
          order_item_id: schema.orderItemUploads.order_item_id,
          thumb_url: schema.userUploads.file_url,
        })
        .from(schema.orderItemUploads)
        .leftJoin(
          schema.userUploads,
          eq(schema.userUploads.id, schema.orderItemUploads.user_upload_id)
        )
        .where(
          and(
            eq(schema.userUploads.design_name, 'thumb'),
            inArray(schema.orderItemUploads.order_item_id, orderItemIdList)
          )
        );

      thumbUrlByOrderItemId = new Map(
        thumbRows.map((r) => [String(r.order_item_id), String(r.thumb_url)])
      );
    }

    // Hydrate default variant image URLs from files table (parent='variant')
    let variantImageUrlByVariantId = new Map<string, string>();
    if (variantIdList.length > 0) {
      const variantFiles = await db
        .select({
          variant_id: schema.files.parent_id,
          url: schema.files.url,
          created_at: schema.files.created_at,
        })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.parent, 'variant'),
            inArray(schema.files.parent_id, variantIdList)
          )
        )
        .orderBy(asc(schema.files.created_at));

      const firstByVariant = new Map<string, string>();
      for (const row of variantFiles) {
        const vid = String(row.variant_id);
        if (!firstByVariant.has(vid)) {
          firstByVariant.set(vid, String(row.url));
        }
      }
      variantImageUrlByVariantId = firstByVariant;
    }

    const needsPrintfulHydration = itemRows.some((r) => r.provider === 'printful');

    let printfulVariantIndex: Map<
      string,
      { productTitle: string; productSku: string; size: string | null; color: string | null }
    > = new Map();

    // More reliable size/color: fetch per-variant from Printful's variant endpoint.
    let printfulVariantSizeColorIndex: Map<string, { size: string | null; color: string | null }> = new Map();
    let printfulVariantImageUrlByVariantId: Map<string, string> = new Map();

    if (needsPrintfulHydration) {
      const printfulProducts = await getPrintfulProducts(
        { env: c.env as any },
        { maxProducts: 500 }
      );

      for (const prod of printfulProducts) {
        const productTitle = prod.title ?? prod.name ?? '';
        const productSku = String(prod.external_id ?? prod.id);

        for (const v of prod.variants ?? []) {
          const vid = String(v.id);

          printfulVariantIndex.set(vid, {
            productTitle,
            productSku,
            size: v.size ?? null,
            color: v.color ?? null,
          });

          const variantImageUrl = (v.images?.[0] ?? prod.images?.[0]) ?? null;
          if (variantImageUrl) {
            printfulVariantImageUrlByVariantId.set(vid, String(variantImageUrl));
          }
        }
      }

      const variantIdListForPrintful = [
        ...new Set(
          itemRows
            .filter((r) => r.provider === 'printful')
            .map((r) => String(r.product_variant_id))
        ),
      ];

      await Promise.all(
        variantIdListForPrintful.map(async (variantId) => {
          try {
            const v = await getPrintfulVariantById(
              { env: c.env as any },
              variantId
            );
            printfulVariantSizeColorIndex.set(variantId, {
              size: v.size ?? null,
              color: v.color ?? null,
            });

            if (v.imageUrl) {
              printfulVariantImageUrlByVariantId.set(variantId, String(v.imageUrl));
            }
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
        const thumbUrl = thumbUrlByOrderItemId.get(String(row.order_item_id)) ?? null;
        const variantImageUrl =
          variantImageUrlByVariantId.get(String(row.product_variant_id)) ?? null;

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

            thumb_url: thumbUrl,
            variant_image_url:
              variantImageUrl ?? printfulVariantImageUrlByVariantId.get(vid) ?? null,
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

          thumb_url: thumbUrl,
          variant_image_url: variantImageUrl,
        };
      }),
    });
  } catch (error) {
    console.error('Get order failed:', error);
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

export default orders;
