import ProductsSection, { type ProductCard } from '../components/products';
import { useProducts } from '../hooks/useProducts';
import { usePrintfulProducts } from '../hooks/usePrintfulProducts';

export default function HomePage() {
  const { products: dbProducts, loading: dbLoading, error: dbError } = useProducts();
  const { products: printfulProducts, loading: printfulLoading, error: printfulError } = usePrintfulProducts();

  const dbCards = dbProducts as ProductCard[];
  const printfulCards = printfulProducts as ProductCard[];

  return (
    <div className="main-class">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Our Products</h2>
      </div>

      {dbError ? <p className="text-sm text-red-600 mb-6">{dbError}</p> : null}
      <ProductsSection title="Featured Products" products={dbCards} />
      {dbLoading ? <p className="text-sm text-gray-600 mt-2">Loading featured products...</p> : null}

      <div className="mt-10" />
      {printfulError ? <p className="text-sm text-red-600 mb-6">{printfulError}</p> : null}
      <ProductsSection title="Products" products={printfulCards} />
      {printfulLoading ? <p className="text-sm text-gray-600 mt-2">Loading products...</p> : null}
    </div>
  );
}
