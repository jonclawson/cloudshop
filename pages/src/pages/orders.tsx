import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { ordersApi } from '../useApi';
import { useSearchParams } from 'react-router-dom';

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

export default function OrdersPage() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const confirmation = useMemo(() => searchParams.get('confirmation'), [searchParams]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const run = async () => {
      setLoading(true);
      try {
        if (confirmation) {
          const response = await ordersApi.getById(confirmation);
          setOrderDetail((response.data as OrderDetail) ?? null);
        } else {
          const response = await ordersApi.getAll();
          setOrders((response.data.orders as OrderDetail[]) || []);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [confirmation, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to view orders</h2>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  const showConfirmation = Boolean(confirmation);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8">
          {showConfirmation ? 'Order Confirmed' : 'Your Orders'}
        </h1>

        {loading ? (
          <p>Loading orders...</p>
        ) : showConfirmation ? (
          orderDetail ? (
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-lg">
                    Confirmation #{orderDetail.confirmation_number || orderDetail.order_id || orderDetail.id}
                  </p>
                  <p className="text-sm text-gray-600">{orderDetail.created_at}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${orderDetail.total_price}</p>
                  <p className="text-sm text-gray-600">{orderDetail.status}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="font-semibold mb-3">Items</p>
                {orderDetail.items && orderDetail.items.length > 0 ? (
                  <div className="space-y-2">
                    {orderDetail.items.map((item) => (
                      <div key={item.product_variant_id} className="flex justify-between gap-4">
                        <span className="text-sm text-gray-700">Variant {item.product_variant_id}</span>
                        <span className="text-sm text-gray-600">
                          Qty {item.quantity} • ${item.price_at_purchase}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No items found for this order.</p>
                )}
              </div>

              <div className="pt-4">
                <a
                  href="/"
                  className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
                >
                  Continue shopping
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-4">We couldn’t load that order confirmation.</p>
              <a href="/" className="text-indigo-600 hover:text-indigo-700">
                Start shopping
              </a>
            </div>
          )
        ) : orders.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-600 mb-4">You haven't placed any orders yet</p>
            <a href="/" className="text-indigo-600 hover:text-indigo-700">
              Start shopping
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const id = order.id || order.order_id;
              return (
                <div key={id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">Order #{id}</p>
                      <p className="text-sm text-gray-600">{order.created_at}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${order.total_price}</p>
                      <p className="text-sm text-gray-600">{order.status}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
