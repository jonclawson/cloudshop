import { useMemo } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiResponse<T> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  url: string;
};

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  headers?: HeadersInit;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

type ApiClient = {
  request: <T>(path: string, options?: RequestOptions) => Promise<ApiResponse<T>>;
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) => Promise<ApiResponse<T>>;
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => Promise<ApiResponse<T>>;
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => Promise<ApiResponse<T>>;
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => Promise<ApiResponse<T>>;
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) => Promise<ApiResponse<T>>;
};

type ErrorResponse<T = unknown> = ApiResponse<T>;

class ApiError<T = unknown> extends Error {
  response: ErrorResponse<T>;

  constructor(message: string, response: ErrorResponse<T>) {
    super(message);
    this.name = 'ApiError';
    this.response = response;
  }
}

const isFormData = (value: unknown): value is FormData =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const isUrlSearchParams = (value: unknown): value is URLSearchParams =>
  typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams;

const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;

const buildErrorMessage = <T,>(data: T, status: number): string => {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return `Request failed with status ${status}`;
};

const parseResponseData = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as T;
  }

  return text as T;
};

const prepareBody = (body: unknown): BodyInit | undefined => {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === 'string' ||
    isFormData(body) ||
    isUrlSearchParams(body) ||
    isBlob(body) ||
    isArrayBuffer(body) ||
    ArrayBuffer.isView(body)
  ) {
    return body as BodyInit;
  }

  return JSON.stringify(body);
};

const hasJsonBody = (body: unknown): boolean =>
  body !== undefined &&
  body !== null &&
  !isFormData(body) &&
  !isUrlSearchParams(body) &&
  !isBlob(body) &&
  !isArrayBuffer(body) &&
  !ArrayBuffer.isView(body) &&
  typeof body !== 'string';

const buildHeaders = (
  headers: HeadersInit | undefined,
  auth: boolean,
  body: unknown
): Headers => {
  const nextHeaders = new Headers(headers);

  if (hasJsonBody(body) && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      nextHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  return nextHeaders;
};

const toApiResponse = <T>(response: Response, data: T): ApiResponse<T> => ({
  data,
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  url: response.url,
});

const throwApiError = <T>(response: Response, data: T): never => {
  throw new ApiError(buildErrorMessage(data, response.status), toApiResponse(response, data));
};

const refreshAccessToken = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await parseResponseData<{ access_token?: string }>(response);
    if (data?.access_token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const sendRequest = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> => {
  const {
    method = 'GET',
    body,
    headers,
    auth = false,
    retryOnUnauthorized = true,
  } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(headers, auth, body),
    body: prepareBody(body),
  });

  if (response.status === 401 && retryOnUnauthorized && path !== '/api/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return sendRequest<T>(path, {
        ...options,
        retryOnUnauthorized: false,
      });
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.location.href = '/login';
  }

  const data = await parseResponseData<T>(response);

  if (!response.ok) {
    throwApiError(response, data);
  }

  return toApiResponse(response, data);
};

const createApiClient = (): ApiClient => ({
  request: <T>(path: string, options?: RequestOptions) => sendRequest<T>(path, options),
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    sendRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    sendRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    sendRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    sendRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    sendRequest<T>(path, { ...options, method: 'DELETE' }),
});

export const useApi = () => useMemo(() => createApiClient(), []);

export const authApi = {
  signup: (email: string, password: string) =>
    sendRequest<{ access_token?: string }>(`/api/auth/signup`, {
      method: 'POST',
      body: { email, password },
    }),

  login: (email: string, password: string) =>
    sendRequest<{ access_token: string }>(`/api/auth/login`, {
      method: 'POST',
      body: { email, password },
    }),

  logout: () =>
    sendRequest<unknown>(`/api/auth/logout`, {
      method: 'POST',
      auth: true,
      body: {},
    }),
};

export type PrintstudioTemplateConfig = {
  template_width: number;
  template_height: number;
  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;

  image_url: string;
  background_color?: string | null;

  printfile_width: number;
  printfile_height: number;
  printfile_dpi: number;
};

export const productsApi = {
  getAll: (provider?: 'printful', categoryId?: string) => {
    const params: string[] = [];
    if (provider) params.push(`provider=${encodeURIComponent(provider)}`);
    if (categoryId) params.push(`category_id=${encodeURIComponent(categoryId)}`);

    const query = params.length > 0 ? `?${params.join('&')}` : '';

    return sendRequest<{ products?: unknown[] }>(`/api/products${query}`);
  },

  getById: (id: string) => sendRequest<unknown>(`/api/products/${id}`),
};

export const templatesApi = {
  getPrintstudioTemplateConfig: (productId: string, variantId?: string | number, technique?: string) => {
    const params = new URLSearchParams();
    if (variantId !== undefined) params.set('variant_id', String(variantId));
    if (technique) params.set('technique', technique);
    const query = params.toString() ? `?${params.toString()}` : '';
    return sendRequest<PrintstudioTemplateConfig>(`/api/products/${encodeURIComponent(productId)}/template${query}`);
  },
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

export type PrintfulEstimateResponse = {
  id: string;
  status: string;
  costs: {
    calculation_status: string;
    currency: string;
    subtotal: string;
    discount: string;
    shipping: string;
    digitization: string;
    additional_fee: string;
    fulfillment_fee: string;
    retail_delivery_fee: string;
    vat: string;
    tax: string;
    total: string;
  };
  retail_costs: {
    calculation_status: string;
    currency: string;
    subtotal: string;
    discount: string;
    shipping: string;
    vat: string;
    tax: string;
    total: string;
  };
  failure_reasons: string[];
};

export const ordersApi = {
  getPrintfulEstimate: (payload: {
    recipient: { state_code?: string; country_code: string; zip?: string };
    order_items: Array<{
      catalog_variant_id: number;
      external_id: string;
      quantity: number;
      retail_price?: string;
      name?: string;
    }>;
    retail_costs?: {
      currency?: string;
      discount?: string;
      shipping?: string;
      tax?: string;
    };
  }) =>
    sendRequest<PrintfulEstimateResponse>(`/api/orders/printful-estimate`, {
      method: 'POST',
      body: payload,
    }),

  create: (
    items: unknown[],
    addresses: { billing_address?: AddressInput; shipping_address?: AddressInput },
    email: string
  ) =>
    sendRequest<unknown>(`/api/orders`, {
      method: 'POST',
      auth: false,
      body: { items, email, ...addresses },
    }),

  linkOrderItemUploads: (
    orderId: string,
    links: Array<{
      order_item_id: string;
      thumb_user_upload_id?: string;
      print_user_upload_id?: string;
    }>
  ) =>
    sendRequest<unknown>(`/api/orders/${orderId}/order-item-uploads`, {
      method: 'POST',
      auth: true,
      body: links,
    }),

  submitToPrintful: (orderId: string) =>
    sendRequest<{
      submitted: boolean;
      printful_order_id?: string;
      printful_item_count: number;
    }>(`/api/orders/${orderId}/submit-to-printful`, {
      method: 'POST',
      auth: true,
    }),

  getAll: () =>
    sendRequest<{ orders?: unknown[] }>(`/api/orders`, {
      auth: true,
    }),

  getById: (id: string) =>
    sendRequest<unknown>(`/api/orders/${id}`, {
      auth: true,
    }),
};

export const uploadsApi = {
  create: (file: File, designName: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('design_name', designName);

    return sendRequest<unknown>(`/api/uploads`, {
      method: 'POST',
      auth: true,
      body: formData,
    });
  },

  getAll: () =>
    sendRequest<unknown>(`/api/uploads`, {
      auth: true,
    }),

  delete: (id: string) =>
    sendRequest<unknown>(`/api/uploads/${id}`, {
      method: 'DELETE',
      auth: true,
    }),
};

export const adminApi = {
  syncProducts: () =>
    sendRequest<unknown>(`/api/admin/sync-products`, {
      method: 'POST',
      auth: true,
      body: {},
    }),

  getUsers: () =>
    sendRequest<{ users?: unknown[] }>(`/api/admin/users`, {
      auth: true,
    }),

  getUserById: (id: string) =>
    sendRequest<unknown>(`/api/admin/users/${id}`, {
      auth: true,
    }),

  getOrders: () =>
    sendRequest<{ orders?: unknown[] }>(`/api/admin/orders`, {
      auth: true,
    }),

  getOrderById: (id: string) =>
    sendRequest<unknown>(`/api/admin/orders/${id}`, {
      auth: true,
    }),
};
