import ProductsSection, { type ProductCard } from '../components/products';
import Categories from '../components/Categories';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';

export default function HomePage() {
  const { products: dbProducts, loading: dbLoading, error: dbError } = useProducts();
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories();

  const dbCards = dbProducts as ProductCard[];

  return (
    <div className="main-class">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Our Products</h2>
      </div>

      {dbError ? <p className="text-sm text-red-600 mb-6">{dbError}</p> : null}
      <ProductsSection title="Featured Products" products={dbCards} />
      {dbLoading ? <p className="text-sm text-gray-600 mt-2">Loading featured products...</p> : null}

      <div className="mt-10" />
      {categoriesError ? <p className="text-sm text-red-600 mb-6">{categoriesError}</p> : null}

      <Categories
        title="Categories"
        categories={(categories ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          imageUrl: (c as any).imageUrl ?? (c as any).image_url,
        }))}
      />

      {categoriesLoading ? <p className="text-sm text-gray-600 mt-2">Loading categories...</p> : null}
    </div>
  );
}
