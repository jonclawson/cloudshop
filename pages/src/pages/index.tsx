import { useEffect, useState } from 'react';
import { productsApi } from '../useApi';

type Product = {
  id: string;
  title?: string;
  description?: string;
  variants?: Array<{ price?: number }>;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productsApi.getAll();
        setProducts((response.data.products || []) as Product[]);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Our Products</h2>

        {loading ? (
          <p>Loading products...</p>
        ) : products.length === 0 ? (
          <p>No products available</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product: Product) => (
              <a
                key={product.id}
                href={`/product/${product.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:shadow-lg transition"
              >
                <h3 className="font-semibold text-gray-900">{product.title}</h3>
                <p className="text-sm text-gray-600">{product.description}</p>
                {product.variants && product.variants.length > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    From ${product.variants[0].price}
                  </p>
                )}
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
