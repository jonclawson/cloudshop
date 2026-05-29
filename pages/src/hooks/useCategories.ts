import { useEffect, useState } from 'react';
import { useApi } from '../useApi';

type Category = {
  id: string;
  parentId?: number | null;
  title: string;
  image_url?: string;
  imageUrl?: string;
};

export function useCategories() {
  const api = useApi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get<{ categories?: Category[] }>(`/api/categories`);
        const next = (response.data.categories ?? []) as (Category & { parentId?: number })[];

        if (!cancelled) setCategories(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load categories');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [api]);

  return { categories, loading, error } as const;
}
