import { Hono } from "hono";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../db";

type Bindings = {
  DB: D1Database;
};

const products = new Hono<{ Bindings }>();

type ProductVariantResponse = {
  id: string;
  external_id?: string;
  title?: string;
  size?: string | null;
  color?: string | null;
  price: number; // dollars
};

type ProductResponse = {
  id: string;
  external_id?: string;
  title?: string;
  name?: string;
  description?: string | null;
  variants: ProductVariantResponse[];
};

function formatVariantTitle(size: string | null | undefined, color: string | null | undefined): string {
  const safeSize = size ?? '';
  const safeColor = color ?? '';
  return `${safeSize} / ${safeColor}`.replace(/\s\/\s/g, ' / ');
}

function toProductResponse(productRow: typeof schema.products.$inferSelect, variantRows: typeof schema.productVariants.$inferSelect[]): ProductResponse {
    const variants = variantRows.map((v) => {
      const priceDollars = v.price_override ?? productRow.base_price;

    return {
      id: String(v.id),
      external_id: v.printful_variant_id ?? undefined,
      title: formatVariantTitle(v.size, v.color),
      size: v.size,
      color: v.color,
      price: priceDollars,
    };
  });

  return {
    id: String(productRow.id),
    external_id: productRow.printful_product_id ?? String(productRow.id),
    title: productRow.name,
    name: productRow.name,
    description: productRow.description,
    variants,
  };
}

products.get('/', async (c) => {
  try {
    const db = getDb(c.env.DB);

    const productRows = await db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        description: schema.products.description,
        base_price: schema.products.base_price,
        printful_product_id: schema.products.printful_product_id,
      })
      .from(schema.products)
      .orderBy(desc(schema.products.created_at))
      .limit(200);

    if (productRows.length === 0) {
      return c.json({
        products: [],
        count: 0,
        synced_at: null,
      });
    }

    const productIds = productRows.map((p) => p.id);

    const variantRows = await db
      .select({
        id: schema.productVariants.id,
        product_id: schema.productVariants.product_id,
        size: schema.productVariants.size,
        color: schema.productVariants.color,
        price_override: schema.productVariants.price_override,
        printful_variant_id: schema.productVariants.printful_variant_id,
      })
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.product_id, productIds));

    const byProductId = new Map<string, typeof variantRows>();
    for (const row of variantRows) {
      const key = String(row.product_id);
      const list = byProductId.get(key) ?? [];
      list.push(row as any);
      byProductId.set(key, list);
    }

    const responseProducts = productRows.map((p) => {
      const v = byProductId.get(String(p.id)) ?? [];
      return toProductResponse(
        p as any,
        v as any
      );
    });

    return c.json({
      products: responseProducts,
      count: responseProducts.length,
      synced_at: null,
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

products.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const db = getDb(c.env.DB);

    const productRow = await db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        description: schema.products.description,
        base_price: schema.products.base_price,
        printful_product_id: schema.products.printful_product_id,
      })
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (productRow.length === 0) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const product = productRow[0];

    const variantRows = await db
      .select({
        id: schema.productVariants.id,
        product_id: schema.productVariants.product_id,
        size: schema.productVariants.size,
        color: schema.productVariants.color,
        price_override: schema.productVariants.price_override,
        printful_variant_id: schema.productVariants.printful_variant_id,
      })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.product_id, id))
      .orderBy(desc(schema.productVariants.created_at));

    return c.json(
      toProductResponse(product as any, variantRows as any)
    );
  } catch (error) {
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

export default products;
