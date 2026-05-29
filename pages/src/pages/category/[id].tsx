import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProductsSection, { type ProductCard } from '../../components/products';
import { usePrintfulProducts } from '../../hooks/usePrintfulProducts';
import CategoryNav from '../../components/category-nav';
import { useCategories } from '../../hooks/useCategories';

export default function CategoryPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories();
  const { products, loading, error } = usePrintfulProducts(id);

  const cards = products as unknown as ProductCard[];

  const navCategories = useMemo(
    () =>
      (categories ?? []).map((c) => ({
        id: String(c.id),
        title: c.title,
        parentId: typeof c.parentId === 'number' ? c.parentId : null,
      })),
    [categories]
  );

  return (
    <div className="main-class">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Category</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          Back to home
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="md:block hidden">
          {categoriesError ? (
            <p className="text-sm text-red-600">Failed to load categories</p>
          ) : categoriesLoading ? (
            <p className="text-sm text-gray-600">Loading categories...</p>
          ) : (
            <CategoryNav currentCategoryId={id ?? ''} categories={navCategories} />
          )}
        </div>

        <div className="flex-1">
          {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
          {loading ? <p className="text-sm text-gray-600 mb-4">Loading category products...</p> : null}

          <ProductsSection title="Printful Products" products={cards} />
        </div>
      </div>
    </div>
  );
}
