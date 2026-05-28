import { useEffect, useState } from 'react';
import { productsApi } from '../useApi';

export type ProductListItem = {
  id: string;
  title?: string;
  description?: string;
  variants?: Array<{ price?: number }>;
  image?: string;
};

export function useProducts() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const response = await productsApi.getAll();
        const next = (response.data.products ?? []) as ProductListItem[];

        if (!cancelled) setProducts(next);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Failed to load products';
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, error } as const;
}
