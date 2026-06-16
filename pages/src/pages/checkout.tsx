import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { AddressElement, Elements, PaymentElement } from '@stripe/react-stripe-js';

import { useAuth } from '../AuthContext';
import { ordersApi, uploadsApi } from '../useApi';
import PrintfulEstimate from '../components/PrintfulEstimate';
import { useShoppingCart } from 'use-shopping-cart';
import { deleteManyPrintAssets, getPrintFileBlob } from '../printAssetsIdb';

type CartLine = {
  id: string;
  name: string;
  variantId?: string;
  productId?: string;
  provider?: 'printful' | string;
  quantity: number;
  price: number; // cents
  currency: string;
  meta?: string; // JSON string for any extra meta (e.g. technique, options, etc.)
};

// Extra fields we attach in product page
type CartLineWithUploads = CartLine & {
  image?: string; // thumb data URL (from product page)
  printAssetKey?: string; // IDB key for print file
  technique?: string;
  options?: Record<string, string>;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';
const PRINT_ASSET_KEYS_LS_KEY = 'printAssetKeys';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

async function dataUrlToResizedBlob(
  dataUrl: string,
  maxSide: number,
  mimeType: string,
  quality: number
): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image for resize'));
  });

  const { width, height } = img;
  if (!width || !height) {
    throw new Error('Invalid image dimensions');
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = nextWidth;
  canvas.height = nextHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  ctx.drawImage(img, 0, 0, nextWidth, nextHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('Failed to convert canvas to blob'));
        else resolve(b);
      },
      mimeType,
      quality
    );
  });

  return blob;
}

async function createPaymentIntentUiClientSecret(params: {
  amountCents: number;
  currency: string;
  receiptEmail: string;
}): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/stripe/payment-intent-ui`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountCents,
      currency: params.currency,
      receipt_email: params.receiptEmail,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to create Stripe UI intent (${response.status}): ${text || response.statusText}`);
  }

  const data = (await response.json()) as { client_secret?: string };
  if (!data.client_secret) {
    throw new Error('Stripe returned missing client_secret');
  }
  return data.client_secret;
}

type AddressInput = {
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const { cartDetails, formattedTotalPrice, clearCart } = useShoppingCart();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [email, setEmail] = useState<string>(user?.email ?? '');

  const [billingAddress, setBillingAddress] = useState<AddressInput | null>(null);
  const [shippingAddress, setShippingAddress] = useState<AddressInput | null>(null);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const items = useMemo(() => Object.values(cartDetails ?? {}) as CartLineWithUploads[], [cartDetails]);

  const orderSummaryLines = useMemo(() => {
    return items.map((item) => ({
      id: String(item.id),
      name: item.name,
      variantId: item.variantId ? String(item.variantId) : undefined,
      productId: item.productId ? String(item.productId) : undefined,
      provider: item.provider,
      quantity: item.quantity,
      price: item.price,
      currency: item.currency,
      meta: JSON.stringify({ technique: item.technique, options: item.options }), // Include extra meta for display in order summary
    })) satisfies CartLine[];
  }, [items]);

  const orderItemsForEstimate = useMemo(() => {
    return items
      .filter((item) => item.provider === 'printful')
      .map((item) => ({
        catalog_variant_id: Number(item.variantId || item.id),
        external_id: String(item.productId || item.id),
        quantity: item.quantity,
        retail_price: (item.price / 100).toFixed(2),
        name: item.name,
      }));
  }, [items]);

  const shippingAddressForEstimate = useMemo(() => {
    if (!shippingAddress) return undefined;
    return {
      state_code: shippingAddress.state ?? undefined,
      country_code: shippingAddress.country ?? '',
      zip: shippingAddress.postal_code ?? undefined,
    };
  }, [shippingAddress]);

  const emailValid = isValidEmail(email);

  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

  const stripePromise = useMemo(() => {
    if (!stripePublishableKey) return null;
    return loadStripe(stripePublishableKey);
  }, [stripePublishableKey]);

  const totalAmountCents = useMemo(() => {
    return items.reduce((sum, line) => sum + line.price * line.quantity, 0);
  }, [items]);

  const currency = useMemo(() => {
    return items[0]?.currency ?? 'usd';
  }, [items]);

  const [stripeClientSecret, setStripeClientSecret] = useState<string>('');
  const [stripeUiError, setStripeUiError] = useState<string>('');
  const [stripeUiLoading, setStripeUiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      if (!stripePublishableKey) return;
      if (!emailValid) return;
      if (items.length === 0) return;
      if (!Number.isFinite(totalAmountCents) || totalAmountCents <= 0) return;

      setStripeUiError('');
      setStripeUiLoading(true);

      try {
        const clientSecret = await createPaymentIntentUiClientSecret({
          amountCents: totalAmountCents,
          currency: currency.toLowerCase(),
          receiptEmail: email.trim(),
        });

        if (!cancelled) setStripeClientSecret(clientSecret);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load Stripe UI';
        if (!cancelled) setStripeUiError(message);
      } finally {
        if (!cancelled) setStripeUiLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [stripePublishableKey, emailValid, email, items.length, totalAmountCents, currency]);

  return (
    <div className="main-class">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid gap-6">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-gray-600">Your cart is empty.</p>
            ) : (
              orderSummaryLines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{line.name}</div>
                    <div className="text-sm text-gray-600">Qty: {line.quantity}</div>
                  </div>
                  <div className="text-right font-semibold">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: line.currency.toUpperCase(),
                    }).format((line.price / 100) * line.quantity)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-semibold">{formattedTotalPrice}</span>
          </div>

          {orderItemsForEstimate.length > 0 && (
            <PrintfulEstimate
              mode="auto"
              orderItems={orderItemsForEstimate}
              shippingAddress={shippingAddressForEstimate}
            />
          )}

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="checkout-email">
              Email (required)
            </label>
            <input
              id="checkout-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              placeholder="you@example.com"
            />
            {!emailValid && email.trim().length > 0 && (
              <p className="mt-2 text-sm text-red-600">Please enter a valid email address.</p>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="font-semibold mb-2">Checkout details</div>
          <div className="text-sm text-gray-600 mb-3">
            Stripe forms are displayed (billing/shipping/payment UI only). No payment is processed yet.
          </div>

          {!stripePublishableKey && (
            <div className="rounded-md border border-dashed border-gray-300 p-4">
              <div className="text-sm text-gray-600">
                Missing <span className="font-semibold">VITE_STRIPE_PUBLISHABLE_KEY</span>. Stripe UI can’t render.
              </div>
            </div>
          )}

          {stripePublishableKey && (
            <div className="space-y-4">
              {stripeUiError && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {stripeUiError}
                </div>
              )}

              {!stripeUiLoading && stripeClientSecret && stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Billing address</div>
                      <AddressElement
                        options={{ mode: 'billing', allowedCountries: ['US', 'CA'] }}
                        onChange={(e) => {
                          if (e.complete) {
                            setBillingAddress({
                              name: e.value.name,
                              line1: e.value.address.line1,
                              line2: e.value.address.line2 ?? null,
                              city: e.value.address.city,
                              state: e.value.address.state,
                              postal_code: e.value.address.postal_code,
                              country: e.value.address.country,
                            });
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Shipping address</div>
                      <AddressElement
                        options={{ mode: 'shipping', allowedCountries: ['US', 'CA'] }}
                        onChange={(e) => {
                          if (e.complete) {
                            setShippingAddress({
                              name: e.value.name,
                              line1: e.value.address.line1,
                              line2: e.value.address.line2 ?? null,
                              city: e.value.address.city,
                              state: e.value.address.state,
                              postal_code: e.value.address.postal_code,
                              country: e.value.address.country,
                            });
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Payment info</div>
                      <PaymentElement options={{ layout: 'tabs' }} />
                    </div>
                  </div>
                </Elements>
              )}

              {stripeUiLoading && (
                <div className="rounded-md border border-dashed border-gray-300 p-4">
                  <div className="text-sm text-gray-600">Loading Stripe UI…</div>
                </div>
              )}

              {stripeUiError === '' && !stripeUiLoading && !stripeClientSecret && (
                <div className="rounded-md border border-dashed border-gray-300 p-4">
                  <div className="text-sm text-gray-600">
                    Enter a valid email to load the Stripe forms.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          <button
            disabled={processing || items.length === 0 || !emailValid}
            onClick={async () => {
              setError('');
              setProcessing(true);
              try {
                // 1) Create order + order_items first
                const response = await ordersApi.create(
                  orderSummaryLines,
                  {
                    billing_address: billingAddress ?? undefined,
                    shipping_address: shippingAddress ?? undefined,
                  },
                  email.trim()
                );
                const data = response.data as {
                  order_id?: string;
                  order_item_ids?: string[];
                  confirmation_number?: string;
                  access_token?: string;
                  refresh_token?: string;
                  user?: { id: string; email: string | null };
                };

                const orderId = data.order_id;
                const orderItemIds = data.order_item_ids;

                if (!orderId || !orderItemIds || orderItemIds.length !== items.length) {
                  throw new Error('Checkout failed: missing order ids');
                }

                // Ensure uploads + linking endpoints can auth immediately.
                if (data.access_token && data.refresh_token && data.user) {
                  localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
                  localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

                  localStorage.setItem(
                    USER_KEY,
                    JSON.stringify({ id: data.user.id, email: data.user.email ?? '' })
                  );

                  setUser({
                    id: data.user.id,
                    email: data.user.email ?? '',
                    admin: false,
                  });
                }

                // 2) Upload thumb + printfile for each cart line
                const thumbUploadsAndPrintUploads = await Promise.all(
                  items.map(async (cartLine, idx) => {
                    // If there is no print asset key, we do NOTHING for this cart line
                    // (no thumb upload, no print upload, no linking for it).
                    const printAssetKey = cartLine.printAssetKey;
                    if (!printAssetKey) {
                      return null;
                    }

                    const thumbDataUrl = cartLine.image;
                    if (!thumbDataUrl) {
                      throw new Error(`Missing thumb for cart item ${idx + 1}`);
                    }

                    // "Optimal size": resize only when the thumb is a data URL.
                    // The fallback thumb (remote URL) can fail due to CORS, so we upload it as-is.
                    let thumbFile: File;

                    if (thumbDataUrl.startsWith('data:')) {
                      const thumbBlobResized = await dataUrlToResizedBlob(
                        thumbDataUrl,
                        512,
                        'image/jpeg',
                        0.85
                      );
                      thumbFile = new File(
                        [thumbBlobResized],
                        `thumb-${orderItemIds[idx]}.jpg`,
                        { type: 'image/jpeg' }
                      );
                    } else {
                      // Remote fallback thumb URLs can trigger CORS failures when fetched in-browser.
                      // Proxy through our worker so the browser sees same-origin responses.
                      const proxiedUrl = `${API_BASE_URL}/api/image-proxy?url=${encodeURIComponent(thumbDataUrl)}`;
                      const thumbResp = await fetch(proxiedUrl);
                      const thumbBlob = await thumbResp.blob();
                      thumbFile = new File(
                        [thumbBlob],
                        `thumb-${orderItemIds[idx]}`,
                        { type: thumbBlob.type || 'application/octet-stream' }
                      );
                    }

                    const printBlob = await getPrintFileBlob(printAssetKey);
                    if (!printBlob) {
                      throw new Error(`Printfile missing from IndexedDB for cart item ${idx + 1}`);
                    }

                    // Name/extension for print file: keep as-is (type may vary).
                    const printFile = new File([printBlob], `print-${orderItemIds[idx]}`, {
                      type: printBlob.type || 'application/octet-stream',
                    });

                    const [thumbUpload, printUpload] = await Promise.all([
                      uploadsApi.create(thumbFile, 'thumb'),
                      uploadsApi.create(printFile, 'print'),
                    ]);

                    const thumbUploadData = thumbUpload.data as { user_upload_id?: string };
                    const printUploadData = printUpload.data as { user_upload_id?: string };

                    if (!thumbUploadData.user_upload_id || !printUploadData.user_upload_id) {
                      throw new Error('Upload failed: missing user_upload_id');
                    }

                    return {
                      order_item_id: orderItemIds[idx],
                      thumb_user_upload_id: thumbUploadData.user_upload_id,
                      print_user_upload_id: printUploadData.user_upload_id,
                    };
                  })
                );

                // 3) Link uploaded thumb + print to each order_item
                const thumbUploadsAndPrintUploadsFiltered = thumbUploadsAndPrintUploads.filter(
                  (v): v is {
                    order_item_id: string;
                    thumb_user_upload_id: string;
                    print_user_upload_id: string;
                  } => v !== null
                );

                if (thumbUploadsAndPrintUploadsFiltered.length > 0) {
                  await ordersApi.linkOrderItemUploads(orderId, thumbUploadsAndPrintUploadsFiltered);
                }

                // 4) Submit printful items to Printful (if any)
                const pfResult = await ordersApi.submitToPrintful(orderId);
                console.log('Printful submission result:', pfResult.data);

                // 5) Cleanup: delete IndexedDB print assets after successful linking
                const printKeys = Array.from(
                  new Set(
                    items
                      .map((i) => i.printAssetKey)
                      .filter((k): k is string => typeof k === 'string' && k.length > 0)
                  )
                );

                if (printKeys.length > 0) {
                  await deleteManyPrintAssets(printKeys);
                }
                localStorage.removeItem(PRINT_ASSET_KEYS_LS_KEY);

                clearCart();

                const confirmation = data.confirmation_number || orderId || '';
                navigate(`/orders?confirmation=${encodeURIComponent(confirmation)}`);
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : 'Checkout failed';
                setError(message);
              } finally {
                setProcessing(false);
              }
            }}
            className="mt-8 w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : 'Complete Purchase'}
          </button>
        </div>

      </div>
    </div>
  );
}
