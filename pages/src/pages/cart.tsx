import { useEffect, useMemo } from 'react';
import PrintfulEstimate from '../components/PrintfulEstimate';
import { useShoppingCart } from 'use-shopping-cart';
import { useNavigate, Link } from 'react-router-dom';
import { deletePrintAssets } from '../printAssetsIdb';

const PRINT_ASSET_KEYS_LS_KEY = 'printAssetKeys';

type CartItemWithExtras = {
  // use-shopping-cart adds these fields
  id: string;
  name: string;
  quantity: number;
  formattedValue: string;
  image?: string;
  technique?: {key: string; display_name: string; is_default: boolean};

  // extra fields we added on addItem()
  printAssetKey?: string;
};

function readKnownPrintAssetKeys(): string[] {
  try {
    const raw = localStorage.getItem(PRINT_ASSET_KEYS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function writeKnownPrintAssetKeys(keys: string[]): void {
  try {
    localStorage.setItem(PRINT_ASSET_KEYS_LS_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

export default function CartPage() {
  const navigate = useNavigate();
  const { cartDetails, cartCount, formattedTotalPrice, removeItem, incrementItem, decrementItem, clearCart } =
    useShoppingCart();

  const items = useMemo(() => Object.values(cartDetails ?? {}) as CartItemWithExtras[], [cartDetails]);

  const referencedKeys = useMemo(() => {
    const keys = items.map((i) => i.printAssetKey).filter((k): k is string => typeof k === 'string' && k.length > 0);
    return Array.from(new Set(keys));
  }, [items]);

  const referencedKeysKey = useMemo(() => referencedKeys.slice().sort().join('|'), [referencedKeys]);

  // Cleanup: delete any known print assets that are no longer referenced by current cart items.
  useEffect(() => {
    let cancelled = false;

    const cleanup = async () => {
      const knownKeys = readKnownPrintAssetKeys();
      const knownSet = new Set(knownKeys);
      const referencedSet = new Set(referencedKeys);

      const toDelete = Array.from(knownSet).filter((k) => !referencedSet.has(k));
      if (toDelete.length > 0) {
        try {
          await deletePrintAssets(toDelete);
        } catch (err) {
          console.error('Failed to delete stale print assets:', err);
        }
      }

      // Update registry to only referenced keys (even if delete fails, avoid infinite growth).
      if (!cancelled) writeKnownPrintAssetKeys(referencedKeys);
    };

    void cleanup();

    return () => {
      cancelled = true;
    };
  }, [referencedKeysKey]);

  const cartItemsForEstimate = useMemo(() => {
    // Filter to printful items and map to the format PrintfulEstimate expects
    return items
      .filter((item) => (item as any).provider === 'printful')
      .map((item) => ({
        catalog_variant_id: Number((item as any).variantId || item.id),
        external_id: String((item as any).productId || item.id),
        quantity: item.quantity,
        retail_price: ((item as any).price / 100).toFixed(2),
        name: item.name,
        technique: item.technique?.key
      }));
  }, [items]);

  return (
    <div className="main-class">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <p className="text-gray-600 mt-2">
            {cartCount} item{cartCount === 1 ? '' : 's'}
          </p>
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
          <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Continue shopping
          </Link>
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
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-16 w-16 rounded-md object-cover border border-gray-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-md bg-gray-50 border border-gray-200" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{item.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.formattedValue} total
                      </p>
                    </div>
                  </div>
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

          {cartItemsForEstimate.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-6">
              <PrintfulEstimate
                mode="manual"
                orderItems={cartItemsForEstimate}
              />
            </div>
          )}

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
  );
}
