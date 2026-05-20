import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../AuthContext';
import { adminApi } from '../../../useApi';

type AdminUserDetail = {
  user: {
    id: string;
    email: string;
    admin: boolean;
    created_at?: string;
  };
  orders: Array<{
    id: string;
    status: string;
    total_price: number;
    created_at: string;
  }>;
};

export default function AdminUserDetailPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
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
      setUserDetail(null);

      try {
        const response = await adminApi.getUserById(id);
        setUserDetail((response.data as AdminUserDetail) ?? null);
      } catch (err) {
        console.error('Failed to fetch admin user:', err);
        setErrorMessage('Not authorized to view this user.');
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
        <h1 className="text-3xl font-bold">Admin - User</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            Back to users
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-700 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
          >
            View users
          </button>
        </div>
      ) : loading ? (
        <p>Loading user…</p>
      ) : !userDetail ? (
        <div className="text-center border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600">User not found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-lg font-semibold truncate">{userDetail.user.email}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Created: {userDetail.user.created_at ?? '—'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={[
                    'rounded-md border px-3 py-1 text-xs font-medium',
                    userDetail.user.admin
                      ? 'border-green-400 bg-green-100 text-green-800'
                      : 'border-gray-200 bg-white text-gray-700',
                  ].join(' ')}
                >
                  {userDetail.user.admin ? 'Admin' : 'User'}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-xl font-semibold">Orders</h2>
              <p className="text-sm text-gray-600">{userDetail.orders.length} order(s)</p>
            </div>

            {userDetail.orders.length === 0 ? (
              <p className="text-sm text-gray-600">No orders found for this user.</p>
            ) : (
              <div className="space-y-3">
                {userDetail.orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className="w-full border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">Order #{order.id}</p>
                        <p className="text-sm text-gray-600 truncate">{order.created_at}</p>
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
        </div>
      )}
    </div>
  );
}
