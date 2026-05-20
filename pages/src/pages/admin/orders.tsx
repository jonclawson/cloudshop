import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../useApi';
import { useAuth } from '../../AuthContext';

type AdminOrder = {
  id: string;
  status: string;
  total_price: number;
  created_at: string;
  user_id?: string;
  user_email?: string;
};

export default function AdminOrdersPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
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

    const run = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await adminApi.getOrders();
        setOrders((response.data.orders as AdminOrder[]) || []);
      } catch (err) {
        console.error('Failed to fetch admin orders:', err);
        setErrorMessage('Not authorized to view orders.');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [isAuthenticated]);

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
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Admin - Orders</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          Back home
        </button>
      </div>

      {errorMessage ? (
        <div className="border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-700 mb-4">{errorMessage}</p>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Login
          </a>
        </div>
      ) : loading ? (
        <p>Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="text-center border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => navigate(`/admin/orders/${order.id}`)}
              className="w-full border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">Order #{order.id}</p>
                  <p className="text-sm text-gray-600 truncate">{order.user_email ?? order.user_id ?? '—'}</p>
                  <p className="text-sm text-gray-600 truncate">{order.created_at ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(order.total_price)}</p>
                  <p className="text-sm text-gray-600">{order.status ?? '—'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
