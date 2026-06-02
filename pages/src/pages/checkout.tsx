import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ordersApi, uploadsApi } from '../useApi';
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
};

// Extra fields we attach in product page
type CartLineWithUploads = CartLine & {
  image?: string; // thumb data URL (from product page)
  printAssetKey?: string; // IDB key for print file
};

function StripePaymentStub() {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="font-semibold mb-2">Stripe Payment</div>
      <div className="text-sm text-gray-600 mb-3">
        Stripe UI is wired-ready, but not functional yet (Stripe account/keys still pending).
      </div>

      <div className="rounded-md border border-dashed border-gray-300 p-4">
        <div className="text-sm text-gray-600">
          Payment form will be embedded here when Stripe is connected.
        </div>
      </div>
    </div>
  );
}

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

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const { cartDetails, formattedTotalPrice, clearCart } = useShoppingCart();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [email, setEmail] = useState<string>(user?.email ?? '');

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
    })) satisfies CartLine[];
  }, [items]);

  const emailValid = isValidEmail(email);

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

          <button
            disabled={processing || items.length === 0 || !emailValid}
            onClick={async () => {
              setError('');
              setProcessing(true);
              try {
                // 1) Create order + order_items first
                const response = await ordersApi.create(orderSummaryLines, {}, email.trim());
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

                // 4) Cleanup: delete IndexedDB print assets after successful linking
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

        <StripePaymentStub />
      </div>
    </div>
  );
}
