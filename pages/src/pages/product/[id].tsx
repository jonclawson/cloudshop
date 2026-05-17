import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productsApi } from '../useApi';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productsApi.getById(id!);
        setProduct(response.data);
        if (response.data.variants && response.data.variants.length > 0) {
          setSelectedVariant(response.data.variants[0]);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!product) {
    return <div className="p-8">Product not found</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product image placeholder */}
          <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
            <span className="text-gray-500">{product.name}</span>
          </div>

          {/* Product details */}
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            <p className="text-gray-600 mb-4">{product.description}</p>

            {/* Variant selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Option
                </label>
                <select
                  value={selectedVariant?.id || ''}
                  onChange={(e) => {
                    const variant = product.variants.find(
                      (v: any) => v.id === e.target.value
                    );
                    setSelectedVariant(variant);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {product.variants.map((variant: any) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.title || `${variant.size} / ${variant.color}`} - $
                      {variant.price}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Add to cart button */}
            <button className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
