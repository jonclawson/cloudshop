import { Link } from 'react-router-dom';

export type ProductCardVariant = {
  id: string;
  price?: number;
};

export type ProductCardVariantSummary = {
  price?: number;
  id?: string;
};

export type ProductCard = {
  id: string;
  title?: string;
  description?: string;
  image?: string;
  variants?: ProductCardVariantSummary[];
};

type ProductsProps = {
  title: string;
  products: ProductCard[];
};

export default function ProductsSection({ title, products }: ProductsProps) {
  return (
  <>
    {products.length === 0 ? (
      <></>
      // <p className="text-sm text-gray-600">No products available</p>
    ) : (
    <section className="mb-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="block p-4 border border-gray-200 rounded-lg hover:shadow-lg transition"
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title ?? 'Product image'}
                  className="w-full h-32 object-cover rounded-md mb-3 border border-gray-200"
                  loading="lazy"
                />
              ) : null}

              <h3 className="font-semibold text-gray-900">{product.title}</h3>

              <p
                className="text-sm text-gray-600 line-clamp-3"
                title={product.description ?? ''}
              >
                {product.description}
              </p>

              {product.variants && product.variants.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  From ${product.variants[0].price}
                </p>
              )}
            </Link>
          ))}
        </div>
    </section>
      )}
  </>
  );
}
