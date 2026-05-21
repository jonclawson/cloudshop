import { useEffect, useMemo, useState } from 'react';
import { useShoppingCart } from 'use-shopping-cart';
import { useParams } from 'react-router-dom';
import { productsApi } from '../../useApi';
import { useNavigate } from 'react-router-dom';
type ProductVariant = {
  id: number | string;
  external_id?: string;
  title?: string;
  size?: string;
  color?: string;
  price: number;
};

type Product = {
  id: number | string;
  external_id?: string;
  title?: string;
  name?: string;
  description?: string;
  variants?: ProductVariant[];
};

export default function ProductPage() {
  const router = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { addItem } = useShoppingCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productsApi.getById(id!);
        const nextProduct = response.data as Product;
        setProduct(nextProduct);
        if (nextProduct.variants && nextProduct.variants.length > 0) {
          setSelectedVariant(nextProduct.variants[0]);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const displayName = product?.title || product?.name || 'Product';
  const priceLabel = useMemo(() => {
    const price = selectedVariant?.price ?? 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }, [selectedVariant]);

  const priceInCents = useMemo(
    () => Math.round((selectedVariant?.price ?? 0) * 100),
    [selectedVariant]
  );

  const handleAddToCart = () => {
    if (!product || !selectedVariant) {
      return;
    }

    addItem({
      id: String(selectedVariant.external_id ?? selectedVariant.id),
      name: `${displayName} - ${selectedVariant.title || selectedVariant.size || selectedVariant.color || 'Default'}`,
      price: priceInCents,
      currency: 'USD',
      image: '',
      variantId: String(selectedVariant.id),
      productId: String(product.id),
    });
    router('/cart');
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!product) {
    return <div className="p-8">Product not found</div>;
  }

  return (
    <div className="main-class">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
            <span className="text-gray-500 text-center px-4">{displayName}</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-4">{displayName}</h1>
            <p className="text-gray-600 mb-4">{product.description}</p>

            {product.variants && product.variants.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Option
                </label>
                <select
                  value={selectedVariant?.id || ''}
                  onChange={(e) => {
                    const variant = product.variants?.find(
                      (v) => String(v.id) === e.target.value
                    );
                    setSelectedVariant(variant || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {product.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.title || `${variant.size} / ${variant.color}`} - {priceLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedVariant}
              className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>
          </div>
        </div>
    </div>
  );
}
