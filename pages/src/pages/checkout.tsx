import React, { useMemo, useState } from 'react';
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

export default function CheckoutPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const {
    cartDetails,
    formattedTotalPrice,
    clearCart,
  } = useShoppingCart();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to checkout</h2>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
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
                      <div className="text-sm text-gray-600">
                        Qty: {line.quantity}
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      {/* formattedTotalPrice is for the entire cart; use unit line totals for line display */}
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

            {error && (
              <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <button
              disabled={processing || items.length === 0}
              onClick={async () => {
                setError('');
                setProcessing(true);
                try {
                  const response = await ordersApi.create(
                    orderSummaryLines,
                    { /* shipping_address placeholder */ }
                  );

                  const data = response.data as {
                    order_id?: string;
                    confirmation_number?: string;
                  };

                  clearCart();
                  const confirmation = data.confirmation_number || data.order_id || '';
                  navigate(`/orders?confirmation=${encodeURIComponent(confirmation)}`);
                } catch (e: unknown) {
                  const message = e instanceof Error ? e.message : 'Checkout failed';
                  setError(message);
                } finally {
                  setProcessing(false);
                }
              }}
              className="mt-8 w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Complete Purchase'}
            </button>
          </div>

          <StripePaymentStub />
        </div>
      </div>
    </div>
  );
}
