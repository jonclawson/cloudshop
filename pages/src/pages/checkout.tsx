import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ordersApi } from '../useApi';
import { useShoppingCart } from 'use-shopping-cart';

type CartLine = {
  id: string;
  name: string;
  variantId?: string;
  productId?: string;
  quantity: number;
  price: number; // cents
  currency: string;
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

  const items = useMemo(() => Object.values(cartDetails ?? {}), [cartDetails]);

  const orderSummaryLines = useMemo(() => {
    return items.map((item) => ({
      id: String(item.id),
      name: item.name,
      variantId: item.variantId ? String(item.variantId) : undefined,
      productId: item.productId ? String(item.productId) : undefined,
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
                  const response = await ordersApi.create(orderSummaryLines, {}, email.trim());

                  const data = response.data as {
                    order_id?: string;
                    confirmation_number?: string;
                    access_token?: string;
                    refresh_token?: string;
                    user?: { id: string; email: string | null };
                  };

                  if (data.access_token && data.refresh_token && data.user) {
                    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
                    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

                    // AuthContext expects `user` with id/email.
                    localStorage.setItem(
                      USER_KEY,
                      JSON.stringify({ id: data.user.id, email: data.user.email ?? '' })
                    );

                    setUser({ id: data.user.id, email: data.user.email ?? '', admin: false });
                  }

                  clearCart();
                  const confirmation =
                    data.confirmation_number || data.order_id || '';

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
