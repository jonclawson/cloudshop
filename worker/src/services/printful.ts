import { mockPrintful } from './mock';
import { generateR2PresignedUrl } from './r2PresignedUrl';

type PrintfulEnv = {
  PRINTFUL_API_KEY?: string;
  USE_MOCKS?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
};

export type PrintfulProductVariantResponse = {
  id: string;
  external_id?: string;
  title?: string;
  size?: string | null;
  color?: string | null;
  price: number; // dollars

  // Used by product detail page (GET /api/products/:id)
  images?: string[];
};

export type PrintfulProductResponse = {
  id: string;
  provider: 'printful';
  external_id?: string;
  title?: string;
  name?: string;
  description?: string | null;
  variants: PrintfulProductVariantResponse[];

  // Used by the UI product list page (GET /api/products)
  image?: string;

  // Used by the product detail page thumbnails (GET /api/products/:id)
  images?: string[];
  custom?: unknown[];
  options?: unknown[];
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
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    if (Number.isInteger(value) && value > 1000) return value / 100;
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    // If Printful ever returns "1999" (cents), we can still handle it.
    if (Number.isInteger(parsed) && parsed > 1000) return parsed / 100;
    return parsed;
  }

  return 0;
}

function normalizeMarkdownDescription(value: string | undefined): string | null {
  if (!value) return null;

  // Printful sometimes sends literal "\n" sequences; convert them to real newlines.
  // Also normalize CRLF -> LF.
  const withNewlines = value.replace(/•/g, '- ');
  // console.log('Normalized description:', { original: value, withNewlines });

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

  const imageFromPayload = asString(variant.image);

  return {
    id,
    external_id: externalId,
    title,
    size: size ?? null,
    color: color ?? null,
    price,
    images: imageFromPayload ? [imageFromPayload] : undefined,
  };
}

function normalizePrintfulProduct(product: UnknownRecord, variantsOverrideRaw?: unknown): PrintfulProductResponse {
  const externalId = asString(product.external_id);
  const printfulId = asString(product.id) ?? crypto.randomUUID();

  // Use external_id as the stable storefront identifier when available.
  // This allows /api/products/:id to resolve without DB writes.
  const storefrontProductId = externalId ?? printfulId;

  const variantsRaw =
    variantsOverrideRaw !== undefined ? variantsOverrideRaw : (product.variants as unknown);

  const variantsList = Array.isArray(variantsRaw) ? variantsRaw : [];

  const variants: PrintfulProductVariantResponse[] = variantsList
    .map((v) =>
      typeof v === 'object' && v !== null ? normalizePrintfulVariant(v as UnknownRecord) : null
    )
    .filter((v): v is PrintfulProductVariantResponse => Boolean(v));

  const name = asString(product.name);
  const title = asString(product.title) ?? name;

  // Printful payload
  const imageFromPayload = asString(product.image);

  // Product detail wants `images: string[]`
  // Mock fallback: `images: string[]`
  const imagesRaw = (product as any).images;
  const mockImages =
    Array.isArray(imagesRaw)
      ? imagesRaw.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
      : undefined;

  const imagesFromPayload = imageFromPayload ? [imageFromPayload] : undefined;

  const productImageForList = imageFromPayload ?? mockImages?.[0];

  const files = Array.isArray((product as any).files) ? (product as any).files : [];

  const options = Array.isArray((product as any).options) ? (product as any).options : [];

  return {
    id: storefrontProductId,
    external_id: externalId,
    provider: 'printful',
    title,
    name,
    description: normalizeMarkdownDescription(asString((product as any).description)),
    variants,
    image: productImageForList,
    images: imagesFromPayload ?? mockImages,
    custom: files,
    options
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

async function fetchPrintfulProductsPage(
  env: PrintfulEnv,
  limit: number,
  offset: number,
  categoryId?: string
): Promise<PrintfulListResponse> {
  const apiKey = env.PRINTFUL_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_PRINTFUL_API_KEY');
  }

  const url = new URL('https://api.printful.com/products');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (categoryId) {
    url.searchParams.set('category_id', categoryId);
  }

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
  // console.log(`Fetched product ${id} from Printful`, rawProduct);

  // Printful detail endpoint returns:
  // { result: { product: {...}, variants: [...] } }
  // so we must normalize variants from `result.variants`, not from `result.product.variants`.
  const rawVariants = (rawProduct as any).variants;

  return normalizePrintfulProduct(rawProduct.product as UnknownRecord, rawVariants);
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
  options?: { maxProducts?: number; cacheTtlMs?: number; categoryId?: string }
) {
  const maxProducts = options?.maxProducts ?? 200;
  const cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes
  const categoryId = options?.categoryId;

  const productsSource = getProductsSource(c);

  // Don't use the global cache when filtering by category; the cached data was built
  // for the unfiltered list.
  if (!categoryId) {
    const nowMs = Date.now();
    if (cachedProducts && cachedProductsSource === productsSource && nowMs < cacheExpiresAtMs) {
      return cachedProducts.slice(0, maxProducts);
    }
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

    const data = await fetchPrintfulProductsPage(c.env, limitPerPage, offset, categoryId);

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

  if (!categoryId) {
    cachedProducts = all;
    cachedProductsSource = 'printful';
    cacheExpiresAtMs = Date.now() + cacheTtlMs;
    return cachedProducts.slice(0, maxProducts);
  }

  return all.slice(0, maxProducts);
}

export async function getPrintfulVariantById(c: { env: PrintfulEnv }, id: string) {
  const apiKey = c.env.PRINTFUL_API_KEY;
  if (!apiKey) throw new Error('MISSING_PRINTFUL_API_KEY');

  const url = new URL(`https://api.printful.com/products/variant/${encodeURIComponent(id)}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    throw new Error('PRINTFUL_VARIANT_NOT_FOUND');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PRINTFUL_VARIANT_FAILED:${response.status}:${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { result?: unknown };
  const raw = (data as any).result ?? data;

  if (!raw || typeof raw !== 'object') {
    throw new Error('PRINTFUL_VARIANT_INVALID_PAYLOAD');
  }

  const variant = (raw as any).variant ?? raw;

  const size = asString(variant.size) ?? null;
  const color = asString(variant.color) ?? null;
  const imageUrl = asString(variant.image) ?? null;

  return {
    id: asString(variant.id) ?? id,
    size,
    color,
    imageUrl,
    product_id: asString(variant.product_id) ?? null,
  };
}

export type PrintfulCategoryResponse = {
  id: number;
  parentId: number;
  title: string;
  imageUrl: string;
};

type PrintfulCategoriesResponse = {
  code?: number;
  result?: {
    categories?: Array<{
      id?: number | string;
      title?: string;
      image_url?: string;
      imageUrl?: string;
    }>;
  };
};

export async function getPrintfulCategories(c: { env: PrintfulEnv }): Promise<PrintfulCategoryResponse[]> {
  const apiKey = c.env.PRINTFUL_API_KEY;
  if (!apiKey) throw new Error('MISSING_PRINTFUL_API_KEY');

  const url = new URL('https://api.printful.com/categories');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PRINTFUL_CATEGORIES_FAILED:${response.status}:${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as PrintfulCategoriesResponse;

  const categoriesRaw = data?.result?.categories ?? [];
  const normalized: PrintfulCategoryResponse[] = categoriesRaw
    .map((cat) => {
      const idNum = typeof cat.id === 'string' ? Number.parseInt(cat.id, 10) : cat.id;
      if (!Number.isFinite(idNum as number)) return null;

      const parentIdRaw =
        typeof (cat as any).parent_id === 'string'
          ? Number.parseInt((cat as any).parent_id, 10)
          : (cat as any).parent_id;

      const parentId = Number.isFinite(parentIdRaw) ? (parentIdRaw as number) : 0;

      const title = typeof cat.title === 'string' ? cat.title : '';
      const imageUrl =
        typeof (cat.image_url ?? cat.imageUrl) === 'string'
          ? String(cat.image_url ?? cat.imageUrl)
          : '';

      if (!title || !imageUrl) return null;

      return { id: idNum as number, parentId, title, imageUrl };
    })
    .filter((x): x is PrintfulCategoryResponse => Boolean(x));

  return normalized;
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

export type PrintstudioTemplateConfig = {
  template_width: number;
  template_height: number;
  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;

  image_url: string;
  background_color?: string | null;

  /**
   * Target export dimensions (from api/mockup-generator/printfiles/*)
   */
  printfile_width: number;
  printfile_height: number;
  printfile_dpi: number;
};

type PrintfulMockupTemplate = {
  catalog_variant_ids?: number[];
  placement?: string;
  technique?: string;
  image_url?: string;
  background_url?: string | null;
  background_color?: string | null;

  printfile_id: number;

  template_width: number;
  template_height: number;

  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;

  template_positioning?: string;
  orientation?: string;
  template_type?: string | null;
  role?: string;
};

type PrintfulPrintfile = {
  printfile_id: number;
  width: number;
  height: number;
  dpi: number;
  fill_mode?: string;
  can_rotate?: boolean;
};

function getFirstDefined<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}

function pickPrintfulMockupTemplate(templates: PrintfulMockupTemplate[], opts?: { variantId?: string }): PrintfulMockupTemplate {
  if (templates.length === 0) {
    throw new Error('PRINTFUL_MOCKUP_TEMPLATES_EMPTY');
  }

  const variantNum = opts?.variantId ? Number.parseInt(opts.variantId, 10) : NaN;

  if (Number.isFinite(variantNum)) {
    const matchedByVariant = templates.find((t) => Array.isArray(t.catalog_variant_ids) && t.catalog_variant_ids.includes(variantNum));
    if (matchedByVariant) return matchedByVariant;
  }

  const matchedPrimaryFront = templates.find((t) => t.role === 'primary' && t.placement === 'front');
  if (matchedPrimaryFront) return matchedPrimaryFront;

  const matchedPrimary = templates.find((t) => t.role === 'primary');
  if (matchedPrimary) return matchedPrimary;

  const matchedFront = templates.find((t) => t.placement === 'front');
  if (matchedFront) return matchedFront;

  return templates[0];
}

function mapToPrintstudioTemplateConfig(template: PrintfulMockupTemplate, printfiles: PrintfulPrintfile[]): PrintstudioTemplateConfig {
  const printfileId = template.printfile_id;
  const matchedPrintfile =
    printfiles.find((pf) => Number(pf.printfile_id) === Number(printfileId)) ?? printfiles[0];

  if (!matchedPrintfile) {
    throw new Error('PRINTFUL_PRINTFILES_EMPTY');
  }

  const image_url = getFirstDefined(template.image_url ?? null, '');
  if (!image_url) {
    throw new Error('PRINTFUL_TEMPLATE_MISSING_IMAGE_URL');
  }

  return {
    template_width: template.template_width,
    template_height: template.template_height,

    print_area_width: template.print_area_width,
    print_area_height: template.print_area_height,
    print_area_top: template.print_area_top,
    print_area_left: template.print_area_left,

    image_url,
    background_color: template.background_color ?? null,

    printfile_width: matchedPrintfile.width,
    printfile_height: matchedPrintfile.height,
    printfile_dpi: matchedPrintfile.dpi,
  };
}

export async function getPrintfulMockupTemplates(c: { env: PrintfulEnv }, catalogProductId: string): Promise<PrintfulMockupTemplate[]> {
  const apiKey = c.env.PRINTFUL_API_KEY;
  if (!apiKey) throw new Error('MISSING_PRINTFUL_API_KEY');

  const url = new URL(`https://api.printful.com/v2/catalog-products/${encodeURIComponent(catalogProductId)}/mockup-templates`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PRINTFUL_MOCKUP_TEMPLATES_FAILED:${response.status}:${text.slice(0, 200)}`);
  }

  const body = (await response.json()) as { data?: unknown };
  const rawData = body.data;

  if (!Array.isArray(rawData)) return [];

  const templates: PrintfulMockupTemplate[] = rawData
    .filter((t) => typeof t === 'object' && t !== null)
    .map((t) => t as unknown as PrintfulMockupTemplate)
    .filter((t) => typeof t.printfile_id === 'number');

  return templates;
}

export async function getPrintfulMockupGeneratorPrintfiles(
  c: { env: PrintfulEnv },
  catalogProductId: string
): Promise<PrintfulPrintfile[]> {
  const apiKey = c.env.PRINTFUL_API_KEY;
  if (!apiKey) throw new Error('MISSING_PRINTFUL_API_KEY');

  const url = new URL(`https://api.printful.com/mockup-generator/printfiles/${encodeURIComponent(catalogProductId)}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PRINTFUL_PRINTFILES_FAILED:${response.status}:${text.slice(0, 200)}`);
  }

  const body = (await response.json()) as unknown;

  const result = (body as any)?.result ?? body;
  const printfilesRaw = (result as any)?.printfiles;

  if (!Array.isArray(printfilesRaw)) return [];

  const printfiles: PrintfulPrintfile[] = printfilesRaw
    .filter((pf) => typeof pf === 'object' && pf !== null)
    .map((pf) => pf as unknown as PrintfulPrintfile)
    .filter((pf) => typeof pf.printfile_id === 'number');

  return printfiles;
}

export async function getPrintstudioTemplateConfig(
  c: { env: PrintfulEnv },
  catalogProductId: string,
  opts?: { variantId?: string }
): Promise<PrintstudioTemplateConfig> {
  const [templates, printfiles] = await Promise.all([
    getPrintfulMockupTemplates(c, catalogProductId),
    getPrintfulMockupGeneratorPrintfiles(c, catalogProductId),
  ]);

  const template = pickPrintfulMockupTemplate(templates, opts);
  return mapToPrintstudioTemplateConfig(template, printfiles);
}

// ----------------------------------------------------------------------
// Signed file URL helpers (HMAC-SHA256)
// ----------------------------------------------------------------------

/**
 * Creates an HMAC-SHA256 signature for a file key + expiration timestamp.
 * Returns base64url-encoded signature.
 */
async function signFileToken(fileKey: string, expires: number, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${fileKey}:${expires}`);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const sigBytes = new Uint8Array(signature);
  // base64url encode (no padding)
  return btoa(String.fromCharCode(...sigBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Generates a signed URL for a file key that Printful can fetch.
 */
export async function buildSignedFileUrl(
  origin: string,
  fileKey: string,
  secret: string,
  ttlSeconds: number = 3600
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await signFileToken(fileKey, expires, secret);
  const encodedKey = encodeURIComponent(fileKey);
  return `${origin}/api/uploads/file/${encodedKey}?token=${token}&expires=${expires}`;
}

/**
 * Validates a signed file URL token. Returns true if the token is valid and not expired.
 */
export async function verifySignedFileToken(
  fileKey: string,
  expires: number,
  token: string,
  secret: string
): Promise<boolean> {
  // Check expiration first (fast path)
  const now = Math.floor(Date.now() / 1000);
  if (now > expires) return false;

  const expectedToken = await signFileToken(fileKey, expires, secret);
  // Constant-time comparison to prevent timing attacks
  if (expectedToken.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedToken.length; i++) {
    diff |= expectedToken.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}

// ----------------------------------------------------------------------
// Printful order submission (POST /v2/orders)
// ----------------------------------------------------------------------

export type PrintfulOrderRecipient = {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  state_name?: string;
  country_code: string;
  country_name?: string;
  zip: string;
  phone?: string;
  email: string;
  tax_number?: string;
};

export type PrintfulOrderItemLayer = {
  type: 'file';
  url: string;
  layer_options?: Array<{ name: string; value: boolean | string | number }>;
  position: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
};

export type PrintfulOrderItemPlacement = {
  placement: string;
  technique: string;
  print_area_type: 'simple';
  layers: PrintfulOrderItemLayer[];
  placement_options?: Array<{ name: string; value: boolean | string | number }>;
};

export type PrintfulOrderItem = {
  source: 'catalog';
  catalog_variant_id: number;
  external_id: string;
  quantity: number;
  retail_price?: string;
  name?: string;
  placements?: PrintfulOrderItemPlacement[];
  orientation?: string;
  product_options?: Array<{ name: string; value: boolean | string | number }>;
};

export type PrintfulOrderRequestBody = {
  external_id: string;
  shipping: string;
  recipient: PrintfulOrderRecipient;
  items: PrintfulOrderItem[];
  retail_costs?: {
    currency: string;
    discount?: string;
    shipping?: string;
    tax?: string;
  };
};

export type PrintfulOrderResponse = {
  id: string;
  external_id: string;
  status: string;
};

// ----------------------------------------------------------------------
// Catalog API helpers (v2) — used for placement/technique/dimension lookup
// ----------------------------------------------------------------------

type CatalogProductPlacement = {
  placement: string;
  technique: string;
  layers: Array<{ type: string; layer_options?: Array<{ name: string; type: string }> }>;
};

type CatalogProductResponse = {
  id: number;
  techniques: Array<{ key: string; display_name: string }>;
  placements: CatalogProductPlacement[];
};

type PlacementDimension = {
  placement: string;
  height: number;
  width: number;
  orientation: string;
};

/**
 * Fetches a catalog product's valid placements and techniques.
 * Used to determine correct placement keys and techniques for order items.
 */
async function fetchCatalogProduct(c: { env: PrintfulEnv }, catalogProductId: string): Promise<CatalogProductResponse | null> {
  const apiKey = c.env.PRINTFUL_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`https://api.printful.com/v2/catalog-products/${encodeURIComponent(catalogProductId)}`);

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { data?: unknown };
    return (body as any)?.data as CatalogProductResponse ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches placement dimensions for a specific catalog variant.
 * Returns the dimensions array so the caller can find the matching placement.
 */
async function fetchCatalogVariantPlacementDimensions(
  c: { env: PrintfulEnv },
  catalogProductId: string,
  catalogVariantId: number
): Promise<PlacementDimension[]> {
  const apiKey = c.env.PRINTFUL_API_KEY;
  if (!apiKey) return [];

  const url = new URL(`https://api.printful.com/v2/catalog-products/${encodeURIComponent(catalogProductId)}/catalog-variants`);

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (!response.ok) return [];

    const body = (await response.json()) as { data?: unknown };
    const variantsData = (body as any)?.data as Array<any> ?? [];
    const variant = variantsData.find((v: any) => Number(v.id) === catalogVariantId);

    return (variant?.placement_dimensions ?? []) as PlacementDimension[];
  } catch {
    return [];
  }
}

/**
 * Fetches a Printful catalog product id for a given variant id.
 * The Printful products list maps variant ids to their parent catalog product id.
 */
async function getCatalogProductIdForVariant(c: { env: PrintfulEnv }, variantId: string): Promise<string | null> {
  try {
    const v = await getPrintfulVariantById(c, variantId);
    return v.product_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Submits a Printful order for the given order's printful items.
 *
 * 1. Validates the order exists with printful items
 * 2. Reads shipping address from order_addresses + addresses
 * 3. For each printful order item: gets the print file, generates a signed URL,
 *    looks up template dimensions, builds a Printful placement
 * 4. Calls POST https://api.printful.com/v2/orders
 * 5. Stores printful_order_id on the order
 *
 * Returns the Printful API response.
 */
export async function submitPrintfulOrder(
  params: {
    env: PrintfulEnv & { DB: D1Database; JWT_SECRET?: string };
    orderId: string;
  }
): Promise<{
  submitted: boolean;
  printful_order_id?: string;
  printful_response?: unknown;
  printful_item_count: number;
}> {
  const { env, orderId } = params;
  const apiKey = env.PRINTFUL_API_KEY;
  if (!apiKey) {
    throw new Error('PRINTFUL_API_KEY_MISSING');
  }

  const { getDb, schema } = await import('../db');
  const { and, eq, inArray } = await import('drizzle-orm');
  const db = getDb(env.DB);

  // Fetch order
  const orderRows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  const order = orderRows[0];
  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  // Get the order's user email
  const userRows = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, order.user_id))
    .limit(1);
  const userEmail = userRows[0]?.email ?? '';

  // Fetch order items that are printful
  const dbOrderItems = await db
    .select()
    .from(schema.orderItems)
    .where(
      and(
        eq(schema.orderItems.order_id, orderId),
        eq(schema.orderItems.provider, 'printful')
      )
    );

  if (dbOrderItems.length === 0) {
    return {
      submitted: false,
      printful_item_count: 0,
    };
  }

  // Get shipping address for this order
  const shippingAddrRows = await db
    .select({
      address_id: schema.orderAddresses.address_id,
    })
    .from(schema.orderAddresses)
    .where(
      and(
        eq(schema.orderAddresses.order_id, orderId),
        eq(schema.orderAddresses.address_type, 'shipping')
      )
    )
    .limit(1);

  let recipient: PrintfulOrderRecipient | null = null;

  if (shippingAddrRows[0]) {
    const addrRows = await db
      .select()
      .from(schema.addresses)
      .where(eq(schema.addresses.id, shippingAddrRows[0].address_id))
      .limit(1);

    const addr = addrRows[0];
    if (addr) {
      recipient = {
        name: addr.name ?? '',
        address1: addr.line1 ?? '',
        address2: addr.line2 ?? undefined,
        city: addr.city ?? '',
        state_code: addr.state ?? undefined,
        country_code: (addr.country ?? '').toUpperCase(),
        zip: addr.postal_code ?? '',
        email: userEmail,
      };
    }
  }

  if (!recipient) {
    throw new Error('SHIPPING_ADDRESS_REQUIRED');
  }

  // Build order items for Printful
  const orderItemIds = dbOrderItems.map((oi) => oi.id);

  // Fetch print uploads for these order items
  const printUploadRows = await db
    .select({
      order_item_id: schema.orderItemUploads.order_item_id,
      user_upload_id: schema.orderItemUploads.user_upload_id,
      file_key: schema.userUploads.file_key,
      file_url: schema.userUploads.file_url,
    })
    .from(schema.orderItemUploads)
    .leftJoin(
      schema.userUploads,
      eq(schema.userUploads.id, schema.orderItemUploads.user_upload_id)
    )
    .where(
      and(
        eq(schema.userUploads.design_name, 'print'),
        inArray(schema.orderItemUploads.order_item_id, orderItemIds)
      )
    );

  const printFileByOrderItemId = new Map<string, { file_key: string; file_url: string }>();
  for (const row of printUploadRows) {
    if (row.file_key && row.file_url) {
      printFileByOrderItemId.set(String(row.order_item_id), {
        file_key: String(row.file_key),
        file_url: String(row.file_url),
      });
    }
  }

  const items: PrintfulOrderItem[] = [];

  for (const orderItem of dbOrderItems) {
    const variantId = String(orderItem.product_variant_id);
    const catalogVariantId = Number(variantId);
    if (!Number.isFinite(catalogVariantId)) continue;

    // Get print file for this order item
    const printFile = printFileByOrderItemId.get(String(orderItem.id));
    if (!printFile) {
      // Skip items without print files — they can't be submitted
      continue;
    }

    // Generate a presigned URL for the print file using R2 S3-compatible signing
    const signedUrl = await generateR2PresignedUrl(env, printFile.file_key, 3600);
    console.log(`Generated signed URL for order item ${orderItem.id}: ${signedUrl}`);

    // Look up catalog product id from the variant endpoint
    const catalogProductId = await getCatalogProductIdForVariant({ env }, variantId);
    console.log(`Mapped variant ID ${variantId} to catalog product ID ${catalogProductId}`);

    // Fetch placement info from the Catalog API (v2) rather than mockup-templates
    let placement: string = 'front';
    let technique: string = 'dtfilm';
    let width: number = 10;
    let height: number = 10;

    if (catalogProductId) {
      // Fetch the catalog product to get valid placements and techniques
      const catalogProduct = await fetchCatalogProduct({ env }, catalogProductId);
      console.log(`Fetched catalog product ${catalogProductId}:`, catalogProduct ? `${catalogProduct.placements?.length ?? 0} placements` : 'null');

      if (catalogProduct?.placements) {
        // Find the front placement (or first available)
        const frontPlacement = catalogProduct.placements.find((p) => p.placement === 'front')
          ?? catalogProduct.placements[0];

        if (frontPlacement) {
          placement = frontPlacement.placement;
          technique = frontPlacement.technique;

          // Fetch per-variant placement dimensions
          const dimensions = await fetchCatalogVariantPlacementDimensions({ env }, catalogProductId, catalogVariantId);
          const frontDim = dimensions.find((d) => d.placement === frontPlacement.placement);
          console.log(`Placement dimensions for variant ${catalogVariantId}, placement ${frontPlacement.placement}:`, frontDim ?? 'none');

          if (frontDim) {
            width = frontDim.width;
            height = frontDim.height;
          }
        }
      }
    }

    items.push({
      source: 'catalog',
      catalog_variant_id: catalogVariantId,
      external_id: String(orderItem.id),
      quantity: orderItem.quantity,
      retail_price: orderItem.price_at_purchase.toFixed(2),
      placements: [
        {
          placement,
          technique,
          print_area_type: 'simple',
          layers: [
            {
              type: 'file',
              url: signedUrl,
              position: {
                width,
                height,
                top: 0,
                left: 0,
              },
            },
          ],
        },
      ],
    });
  }

  if (items.length === 0) {
    return {
      submitted: false,
      printful_item_count: 0,
    };
  }

  // Build the complete payload
  const payload: PrintfulOrderRequestBody = {
    external_id: orderId,
    shipping: 'STANDARD',
    recipient,
    items,
  };

  // Call Printful v2 API
  const response = await fetch('https://api.printful.com/v2/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`PRINTFUL_ORDER_FAILED:${response.status}:${errorText.slice(0, 500)}`);
  }

  const printfulBody = (await response.json()) as { data?: { id?: string } };
  const printfulOrderId = (printfulBody as any)?.data?.id ?? String((printfulBody as any)?.id ?? '');

  // Store printful_order_id on the order
  if (printfulOrderId) {
    await db
      .update(schema.orders)
      .set({ printful_order_id: printfulOrderId })
      .where(eq(schema.orders.id, orderId));
  }

  return {
    submitted: true,
    printful_order_id: printfulOrderId || undefined,
    printful_response: printfulBody,
    printful_item_count: items.length,
  };
}
