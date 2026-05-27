import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { getPrintfulProductById, getPrintfulProducts, type PrintfulProductResponse } from '../services/printful';

type Bindings = {
  DB: D1Database;
  PRINTFUL_API_KEY?: string;
};

const products = new Hono<{ Bindings }>();

type ProductVariantResponse = {
  id: string;
  external_id?: string;
  title?: string;
  size?: string | null;
  color?: string | null;
  price: number; // dollars
  images?: string[];
};

type ProductResponse = {
  id: string;
  external_id?: string;
  title?: string;
  name?: string;
  description?: string | null;
  variants: ProductVariantResponse[];
  image?: string; // list endpoint: one image

  // detail endpoint: multiple images
  images?: string[];
};

function formatVariantTitle(size: string | null | undefined, color: string | null | undefined): string {
  const safeSize = size ?? '';
  const safeColor = color ?? '';
  return `${safeSize} / ${safeColor}`.replace(/\s\/\s/g, ' / ');
}

function toProductResponse(
  productRow: typeof schema.products.$inferSelect,
  variantRows: typeof schema.productVariants.$inferSelect[],
  productImages?: string[],
  variantImagesById?: Map<string, string[]>
): ProductResponse {
  const variants: ProductVariantResponse[] = variantRows.map((v) => {
    const priceDollars = v.price_override ?? productRow.base_price;

    const images =
      variantImagesById ? variantImagesById.get(String(v.id)) ?? [] : undefined;

    return {
      id: String(v.id),
      external_id: v.provider_variant_id ?? undefined,
      title: formatVariantTitle(v.size, v.color),
      size: v.size,
      color: v.color,
      price: priceDollars,
      images,
    };
  });

  return {
    id: String(productRow.id),
    external_id: productRow.provider_product_id ?? String(productRow.id),
    title: productRow.name,
    name: productRow.name,
    description: productRow.description,
    variants,
    images: productImages,
  };
}

function productProviderKey(product: { external_id?: string; id: string }): string {
  return product.external_id ?? product.id;
}

function mergeDbAndPrintfulProducts(
  dbProducts: ProductResponse[],
  dbProviderProductIds: Set<string>,
  printfulProducts: PrintfulProductResponse[]
): ProductResponse[] {
  const merged: ProductResponse[] = [...dbProducts];

  for (const p of printfulProducts) {
    const providerKey = productProviderKey(p);
    if (dbProviderProductIds.has(providerKey)) continue;
    merged.push(p as unknown as ProductResponse);
  }

  return merged;
}

products.get('/', async (c) => {
  try {
    const db = getDb(c.env.DB);

    // --- DB products ---
    const productRows = await db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        description: schema.products.description,
        base_price: schema.products.base_price,
        provider_product_id: schema.products.provider_product_id,
      })
      .from(schema.products)
      .orderBy(desc(schema.products.created_at))
      .limit(200);

    const dbProducts: ProductResponse[] = [];

    if (productRows.length > 0) {
      const productIds = productRows.map((p) => p.id);

      const variantRows = await db
        .select({
          id: schema.productVariants.id,
          product_id: schema.productVariants.product_id,
          size: schema.productVariants.size,
          color: schema.productVariants.color,
          price_override: schema.productVariants.price_override,
          provider_variant_id: schema.productVariants.provider_variant_id,
        })
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.product_id, productIds));

      // --- Attach list image (first product file image) ---
      const productFiles = await db
        .select({
          parent_id: schema.files.parent_id,
          url: schema.files.url,
        })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.parent, 'product'),
            inArray(schema.files.parent_id, productIds as string[])
          )
        )
        .orderBy(asc(schema.files.created_at));

      const firstImageByProductId = new Map<string, string>();
      for (const row of productFiles) {
        const pid = String(row.parent_id);
        if (!firstImageByProductId.has(pid)) {
          firstImageByProductId.set(pid, String(row.url));
        }
      }

      const byProductId = new Map<string, typeof variantRows>();
      for (const row of variantRows) {
        const key = String(row.product_id);
        const list = byProductId.get(key) ?? [];
        list.push(row);
        byProductId.set(key, list);
      }

      for (const p of productRows) {
        const v = byProductId.get(String(p.id)) ?? [];
        dbProducts.push({
          ...toProductResponse(p as any, v as any),
          image: firstImageByProductId.get(String(p.id)),
        });
      }
    }

    const dbProviderProductIds = new Set(productRows.map((p) => String(p.provider_product_id)));

    // --- Printful products (live, no DB writes) ---
    let printfulProducts: PrintfulProductResponse[] = [];
    try {
      const fetched = await getPrintfulProducts(c, { maxProducts: 200 });
      console.log(`Fetched ${fetched.length} products from Printful`);  
      printfulProducts = fetched;
    } catch (err) {
      // If Printful fails (missing key, network, etc.), keep DB behavior.
      console.error('Failed to fetch Printful products:', err);
      printfulProducts = [];
    }

    const merged = mergeDbAndPrintfulProducts(dbProducts, dbProviderProductIds, printfulProducts);

    return c.json({
      products: merged,
      count: merged.length,
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
        provider_product_id: schema.products.provider_product_id,
      })
      .from(schema.products)
      .where(or(eq(schema.products.id, id), eq(schema.products.provider_product_id, id)))
      .limit(1);

    if (productRow.length > 0) {
      const product = productRow[0];

      const variantRows = await db
        .select({
          id: schema.productVariants.id,
          product_id: schema.productVariants.product_id,
          size: schema.productVariants.size,
          color: schema.productVariants.color,
          price_override: schema.productVariants.price_override,
          provider_variant_id: schema.productVariants.provider_variant_id,
        })
        .from(schema.productVariants)
        .where(eq(schema.productVariants.product_id, product.id))
        .orderBy(desc(schema.productVariants.created_at));

      const productImagesRows = await db
        .select({
          url: schema.files.url,
        })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.parent, 'product'),
            eq(schema.files.parent_id, product.id)
          )
        )
        .orderBy(asc(schema.files.created_at));

      const productImages = productImagesRows.map((r) => String(r.url));

      const variantIds = variantRows.map((v) => v.id);
      const variantImagesById = new Map<string, string[]>();

      if (variantIds.length > 0) {
        const variantFiles = await db
          .select({
            parent_id: schema.files.parent_id,
            url: schema.files.url,
          })
          .from(schema.files)
          .where(
            and(
              eq(schema.files.parent, 'variant'),
              inArray(schema.files.parent_id, variantIds as string[])
            )
          )
          .orderBy(asc(schema.files.created_at));

        for (const row of variantFiles) {
          const vid = String(row.parent_id);
          const list = variantImagesById.get(vid) ?? [];
          list.push(String(row.url));
          variantImagesById.set(vid, list);
        }
      }

      return c.json(
        toProductResponse(
          product as any,
          variantRows as any,
          productImages,
          variantImagesById
        )
      );
    }

    // DB didn't know this id: try Printful live.
    try {
      const printful = await getPrintfulProductById(c, id);
      if (!printful) {
        return c.json({ error: 'Product not found' }, 404);
      }
      return c.json(printful as unknown as ProductResponse);
    } catch (err) {
      console.error('Failed to fetch Printful product by id:', err);
      return c.json({ error: 'Product not found' }, 404);
    }
  } catch (error) {
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

export default products;
