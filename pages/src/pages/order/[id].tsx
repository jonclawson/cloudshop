import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { ordersApi } from '../../useApi';
import { useNavigate, useParams } from 'react-router-dom';

type OrderItem = {
  product_variant_id: string;
  quantity: number;
  price_at_purchase: number;
};

type OrderDetail = {
  id?: string;
  order_id?: string;
  confirmation_number?: string;
  status?: string;
  total_price?: number;
  created_at?: string;
  items?: OrderItem[];
};

export default function OrderDetailsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const formatMoney = (value: number | undefined) => {
    if (value === undefined || value === null || !Number.isFinite(value)) return '—';
    return moneyFormatter.format(value);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!id) return;

    const run = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await ordersApi.getById(id);
        setOrder((response.data as OrderDetail) ?? null);
      } catch (error) {
        console.error('Failed to fetch order:', error);
        setErrorMessage('We couldn’t load that order.');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [id, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="main-class flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to view orders</h2>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="main-class">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Order Details</h1>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            Back to orders
          </button>
        </div>

        {loading ? (
          <p>Loading order…</p>
        ) : errorMessage ? (
          <div className="text-center border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              View orders
            </button>
          </div>
        ) : order ? (
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="font-semibold text-lg">
                  Confirmation #{order.confirmation_number || order.order_id || order.id || '—'}
                </p>
                <p className="text-sm text-gray-600">{order.created_at ?? '—'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">{formatMoney(order.total_price)}</p>
                <p className="text-sm text-gray-600">{order.status ?? '—'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="font-semibold mb-3">Items</p>
              {order.items && order.items.length > 0 ? (
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.product_variant_id} className="flex justify-between gap-4">
                      <span className="text-sm text-gray-700">Variant {item.product_variant_id}</span>
                      <span className="text-sm text-gray-600">
                        Qty {item.quantity} • {formatMoney(item.price_at_purchase)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No items found for this order.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-600 mb-4">Order not found.</p>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Back to orders
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
