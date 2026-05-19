import { useShoppingCart } from 'use-shopping-cart';
import { useNavigate } from 'react-router-dom';

export default function CartPage() {
  const navigate = useNavigate();
  const {
    cartDetails,
    cartCount,
    formattedTotalPrice,
    removeItem,
    incrementItem,
    decrementItem,
    clearCart,
  } = useShoppingCart();

  const items = Object.values(cartDetails ?? {});

  return (
    <div className="main-class">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Shopping Cart</h1>
            <p className="text-gray-600 mt-2">{cartCount} item{cartCount === 1 ? '' : 's'}</p>
          </div>

          {items.length > 0 && (
              <button
                type="button"
                onClick={() => clearCart()}
                className="self-start sm:self-auto text-sm font-medium text-red-600 hover:text-red-700"
              >
                Clear cart
              </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-600 mb-4">Your cart is empty</p>
            <a href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Continue shopping
            </a>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="grid gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900">{item.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.formattedValue} total
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => decrementItem(item.id, { count: 1 })}
                      className="h-10 w-10 rounded-md border border-gray-300 text-lg font-semibold hover:bg-gray-100"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      −
                    </button>

                    <span className="min-w-8 text-center font-medium">{item.quantity}</span>

                    <button
                      type="button"
                      onClick={() => incrementItem(item.id, { count: 1 })}
                      className="h-10 w-10 rounded-md border border-gray-300 text-lg font-semibold hover:bg-gray-100"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="ml-2 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formattedTotalPrice}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
