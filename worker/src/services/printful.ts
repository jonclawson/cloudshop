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

  // Don’t use the global cache when filtering by category; the cached data was built
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
