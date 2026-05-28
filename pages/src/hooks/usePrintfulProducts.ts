import { useEffect, useState } from 'react';
import { productsApi } from '../useApi';

export type PrintfulProductListItem = {
  id: string;
  title?: string;
  description?: string;
  variants?: Array<{ price?: number }>;
  image?: string;
};

export function usePrintfulProducts(categoryId?: string) {
  const [products, setProducts] = useState<PrintfulProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const response = await productsApi.getAll('printful', categoryId);
        const next = (response.data.products ?? []) as PrintfulProductListItem[];

        if (!cancelled) setProducts(next);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Failed to load printful products';
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
  }, [categoryId]);

  return { products, loading, error } as const;
}
