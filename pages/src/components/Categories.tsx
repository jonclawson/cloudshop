import { Link } from 'react-router-dom';

export type CategoryCard = {
  id: string;
  title: string;
  imageUrl?: string;
  image_url?: string;
};

type CategoriesProps = {
  title?: string;
  categories: CategoryCard[];
};

export default function Categories({ title = 'Categories', categories }: CategoriesProps) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>

      {categories.length === 0 ? (
        <p className="text-sm text-gray-600">No categories available</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => {
            const imageSrc = cat.imageUrl ?? cat.image_url;

            return (
              <Link
                key={cat.id}
                to={`/category/${cat.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:shadow-lg transition"
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={cat.title}
                    className="w-full h-32 object-cover rounded-md mb-3 border border-gray-200"
                    loading="lazy"
                  />
                ) : null}

                <h3 className="font-semibold text-gray-900">{cat.title}</h3>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
