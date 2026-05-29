import { Hono } from 'hono';
import { getPrintfulCategories } from '../services/printful';

type Bindings = {
  DB: D1Database;
  PRINTFUL_API_KEY?: string;
};

const categories = new Hono<{ Bindings }>();

type CategoryResponseItem = {
  id: number;
  parentId: number;
  title: string;
  image_url: string;
};

categories.get('/', async (c) => {
  try {
    const items = await getPrintfulCategories({ env: c.env as any });
    const categoriesList: CategoryResponseItem[] = items.map((x) => ({
      id: Number(x.id),
      parentId: Number(x.parentId ?? 0),
      title: x.title,
      image_url: x.imageUrl,
    }));

    return c.json({ categories: categoriesList, count: categoriesList.length, synced_at: null });
  } catch (error) {
    console.error('Get categories failed:', error);
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

export default categories;
