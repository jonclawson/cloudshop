import { mockPrintful } from './mock';

type PrintfulEnv = {
  PRINTFUL_API_KEY?: string;
  USE_MOCKS?: string;
};

export type PrintfulProductVariantResponse = {
  id: string;
  external_id?: string;
  title?: string;
  size?: string | null;
  color?: string | null;
  price: number; // dollars
};

export type PrintfulProductResponse = {
  id: string;
  external_id?: string;
  title?: string;
  name?: string;
  description?: string | null;
  variants: PrintfulProductVariantResponse[];
};

type PrintfulListResponse = {
  result: unknown;
  paging?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
};

type UnknownRecord = Record<string, unknown>;

function formatVariantTitle(size: string | null | undefined, color: string | null | undefined): string {
  const safeSize = size ?? '';
  const safeColor = color ?? '';
  return `${safeSize} / ${safeColor}`.replace(/\s\/\s/g, ' / ');
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : String(value);
}

function normalizeMoneyToDollars(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

  if (Number.isInteger(value) && value > 1000) {
    return value / 100;
  }

  return value;
}

function normalizeMarkdownDescription(value: string | undefined): string | null {
  if (!value) return null;

  // Printful sometimes sends literal "\n" sequences; convert them to real newlines.
  // Also normalize CRLF -> LF.
  const withNewlines = value.replace(/•/g, '- ');
  console.log('Normalized description:', { original: value, withNewlines });

  // Keep as a string (not a persisted file). Trim only outer whitespace.
  const trimmed = withNewlines.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizePrintfulVariant(variant: UnknownRecord): PrintfulProductVariantResponse {
  const id = asString(variant.id) ?? crypto.randomUUID();
  const externalId = asString(variant.external_id);

  const size = (variant.size ?? null) as string | null;
  const color = (variant.color ?? null) as string | null;

  const rawPrice = variant.price;
  const price = normalizeMoneyToDollars(rawPrice);

  const title = asString(variant.title) ?? formatVariantTitle(size, color);

  return {
    id,
    external_id: externalId,
    title,
    size: size ?? null,
    color: color ?? null,
    price,
  };
}

function normalizePrintfulProduct(product: UnknownRecord): PrintfulProductResponse {
  const externalId = asString(product.external_id);
  const printfulId = asString(product.id) ?? crypto.randomUUID();

  // Use external_id as the stable storefront identifier when available.
  // This allows /api/products/:id to resolve without DB writes.
  const storefrontProductId = externalId ?? printfulId;

  const variantsRaw = product.variants;
  const variantsList = Array.isArray(variantsRaw) ? variantsRaw : [];

  const variants: PrintfulProductVariantResponse[] = variantsList
    .map((v) => (typeof v === 'object' && v !== null ? normalizePrintfulVariant(v as UnknownRecord) : null))
    .filter((v): v is PrintfulProductVariantResponse => Boolean(v));

  const name = asString(product.name);
  const title = asString(product.title) ?? name;

  return {
    id: storefrontProductId,
    external_id: externalId,
    title,
    name,
    description: normalizeMarkdownDescription(asString(product.description)),
    variants,
  };
}

function shouldUseMocks(env: PrintfulEnv): boolean {
  return env.USE_MOCKS === 'true';
}

function normalizeMockProducts(mockProducts: unknown[]): PrintfulProductResponse[] {
  return mockProducts
    .filter((p) => typeof p === 'object' && p !== null)
    .map((p) => normalizePrintfulProduct(p as UnknownRecord));
}

let cachedProducts: PrintfulProductResponse[] | null = null;
let cacheExpiresAtMs = 0;
let cachedProductsSource: 'mocks' | 'printful' | null = null;

function getProductsSource(c: { env: PrintfulEnv }): 'mocks' | 'printful' {
  const useMocks = shouldUseMocks(c.env) || !c.env.PRINTFUL_API_KEY;
  return useMocks ? 'mocks' : 'printful';
}

async function fetchPrintfulProductsPage(env: PrintfulEnv, limit: number, offset: number): Promise<PrintfulListResponse> {
  const apiKey = env.PRINTFUL_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_PRINTFUL_API_KEY');
  }

  const url = new URL('https://api.printful.com/products');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PRINTFUL_PRODUCTS_FAILED:${response.status}:${text.slice(0, 200)}`);
  }

  return (await response.json()) as PrintfulListResponse;
}

async function fetchPrintfulProductById(env: PrintfulEnv, id: string): Promise<PrintfulProductResponse> {
  const apiKey = env.PRINTFUL_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_PRINTFUL_API_KEY');
  }

  const url = new URL(`https://api.printful.com/products/${encodeURIComponent(id)}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    throw new Error('PRINTFUL_PRODUCT_NOT_FOUND');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PRINTFUL_PRODUCT_FAILED:${response.status}:${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { result?: unknown };

  // Printful typically wraps in { result: ... }. If not, fall back to the full body.
  const rawProduct = (data as any).result ?? data;
  if (!rawProduct || typeof rawProduct !== 'object') {
    throw new Error('PRINTFUL_PRODUCT_INVALID_PAYLOAD');
  }
  console.log(`Fetched product ${id} from Printful`, rawProduct);

  return normalizePrintfulProduct(rawProduct.product as UnknownRecord);
}

async function getMockProducts(env: PrintfulEnv): Promise<PrintfulProductResponse[]> {
  if (!shouldUseMocks(env)) {
    throw new Error('PRINTFUL_MOCKS_DISABLED');
  }

  const mock = await mockPrintful.getProducts();
  if (!Array.isArray(mock)) return [];
  return normalizeMockProducts(mock);
}

export async function getPrintfulProducts(
  c: { env: PrintfulEnv },
  options?: { maxProducts?: number; cacheTtlMs?: number }
) {
  const maxProducts = options?.maxProducts ?? 200;
  const cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes

  const productsSource = getProductsSource(c);

  const nowMs = Date.now();
  if (
    cachedProducts &&
    cachedProductsSource === productsSource &&
    nowMs < cacheExpiresAtMs
  ) {
    return cachedProducts.slice(0, maxProducts);
  }

  // In local/dev, prefer mocks (or if PRINTFUL_API_KEY isn't present).
  if (productsSource === 'mocks') {
    try {
      const mockProducts = await getMockProducts(c.env);
      cachedProducts = mockProducts;
      cachedProductsSource = 'mocks';
      cacheExpiresAtMs = Date.now() + cacheTtlMs;
      return cachedProducts.slice(0, maxProducts);
    } catch {
      // If mocks are disabled/missing, fall back to empty (route catches and keeps DB-only).
      cachedProducts = [];
      cachedProductsSource = 'mocks';
      cacheExpiresAtMs = Date.now() + cacheTtlMs;
      return [];
    }
  }

  const limitPerPage = 100;
  let offset = 0;

  const all: PrintfulProductResponse[] = [];

  for (let page = 0; page < 50; page++) {
    if (all.length >= maxProducts) break;

    const data = await fetchPrintfulProductsPage(c.env, limitPerPage, offset);

    const rawResult = (data as PrintfulListResponse).result;
    const productsArray = Array.isArray(rawResult) ? rawResult : [];

    for (const p of productsArray) {
      if (!p || typeof p !== 'object') continue;
      all.push(normalizePrintfulProduct(p as UnknownRecord));
      if (all.length >= maxProducts) break;
    }

    const paging = data.paging;
    const total = paging?.total;
    const nextOffset = (paging?.offset ?? offset) + (paging?.limit ?? limitPerPage);

    offset = nextOffset;

    if (typeof total === 'number' && all.length >= total) break;
    if (productsArray.length === 0) break;
  }

  cachedProducts = all;
  cachedProductsSource = 'printful';
  cacheExpiresAtMs = Date.now() + cacheTtlMs;

  return cachedProducts.slice(0, maxProducts);
}

export async function getPrintfulProductById(c: { env: PrintfulEnv }, id: string) {
  // Prefer the dedicated endpoint first to avoid O(n) list fetches.
  // If it doesn't work (e.g. id is external_id and the endpoint expects internal id),
  // fall back to list-search using the normalized id mapping.
  if (shouldUseMocks(c.env) || !c.env.PRINTFUL_API_KEY) {
    const products = await getPrintfulProducts(c, { maxProducts: 500 });
    return products.find((p) => p.id === id || p.external_id === id) ?? null;
  }

  try {
    return await fetchPrintfulProductById(c.env, id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'PRINTFUL_PRODUCT_NOT_FOUND') {
      const products = await getPrintfulProducts(c, { maxProducts: 500 });
      return products.find((p) => p.id === id || p.external_id === id) ?? null;
    }

    // For other errors, keep the previous behavior as a safety net.
    const products = await getPrintfulProducts(c, { maxProducts: 500 });
    return products.find((p) => p.id === id || p.external_id === id) ?? null;
  }
}
