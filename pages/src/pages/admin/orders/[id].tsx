import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../AuthContext';
import { adminApi } from '../../../useApi';

type AdminOrderDetail = {
  order_id: string;
  confirmation_number?: string;
  status: string;
  total_price: number;
  created_at: string;
  user: { id: string; email: string };
  items: Array<{
    order_item_id: string;
    product_variant_id: string;
    quantity: number;
    price_at_purchase: number;
    product_name: string;
    product_sku: string;
    size: string | null;
    color: string | null;
  }>;
};

export default function AdminOrderDetailPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
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
      setOrder(null);

      try {
        const response = await adminApi.getOrderById(id);
        setOrder((response.data as AdminOrderDetail) ?? null);
      } catch (err) {
        console.error('Failed to fetch admin order:', err);
        setErrorMessage('Not authorized to view this order.');
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
          <h2 className="text-2xl font-bold mb-4">Please sign in to view admin</h2>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="main-class">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">Admin - Order</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/orders')}
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          Back to orders
        </button>
      </div>

      {errorMessage ? (
        <div className="text-center border border-gray-200 rounded-lg p-6">
          <p className="text-gray-700 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
          >
            View orders
          </button>
        </div>
      ) : loading ? (
        <p>Loading order…</p>
      ) : !order ? (
        <div className="text-center border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600">Order not found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-lg truncate">
                  Order #{order.confirmation_number || order.order_id || '—'}
                </p>
                <p className="text-sm text-gray-600">{order.created_at ?? '—'}</p>
                <p className="text-sm text-gray-600 truncate mt-2">
                  Customer: {order.user.email}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">{formatMoney(order.total_price)}</p>
                <p className="text-sm text-gray-600">{order.status ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-xl font-semibold">Items</h2>
              <p className="text-sm text-gray-600">{order.items.length} item(s)</p>
            </div>

            {order.items.length === 0 ? (
              <p className="text-sm text-gray-600">No items found for this order.</p>
            ) : (
              <div className="space-y-3">
                {order.items.map((item) => {
                  const lineTotal = item.price_at_purchase * item.quantity;
                  return (
                    <div
                      key={item.order_item_id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-lg border border-gray-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {item.product_name || `Product ${item.product_variant_id}`}
                        </p>
                        <p className="text-xs text-gray-600 truncate">SKU {item.product_sku || '—'}</p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
                            Size: {item.size || '—'}
                          </span>
                          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
                            Color: {item.color || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm text-gray-700 sm:text-right">
                        <p className="font-medium">Qty {item.quantity}</p>
                        <p className="text-gray-600">
                          {formatMoney(item.price_at_purchase)} each
                        </p>
                        <p className="font-semibold text-gray-900">Line total: {formatMoney(lineTotal)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
