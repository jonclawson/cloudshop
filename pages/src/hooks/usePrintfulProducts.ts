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
        // Hide stale products immediately when category changes.
        setProducts([]);
        setLoading(true);
        setError(null);

        const response = await productsApi.getAll('printful', categoryId);
        const next = (response.data.products ?? []) as PrintfulProductListItem[];

        // Printful (or our normalization) can occasionally return duplicate ids.
        // Deduping prevents React "duplicate key" warnings in the product grid.
        const deduped = Array.from(
          new Map(next.map((p) => [String(p.id), p])).values()
        );

        if (!cancelled) setProducts(deduped);
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
