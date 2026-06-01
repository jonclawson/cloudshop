import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useShoppingCart } from 'use-shopping-cart';
import { useParams } from 'react-router-dom';
import PrintStudio from 'printstudio';
import 'printstudio/dist/printstudio.css';
import { productsApi, templatesApi, type PrintstudioTemplateConfig } from '../../useApi';
import { useNavigate } from 'react-router-dom';
import FullScreenDialog from '../../components/FullScreenDialog';
type ProductVariant = {
  id: number | string;
  external_id?: string;
  title?: string;
  size?: string;
  color?: string;
  price: number;
  images?: string[];
};

type Product = {
  id: number | string;
  external_id?: string;
  title?: string;
  name?: string;
  description?: string;
  variants?: ProductVariant[];
  images?: string[]; // product images

  // Printful-normalized products set this.
  provider?: 'printful' | string;
};

export default function ProductPage() {
  const router = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { addItem } = useShoppingCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [mainImageSrc, setMainImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productsApi.getById(id!);
        const nextProduct = response.data as Product;
        setProduct(nextProduct);
        if (nextProduct.variants && nextProduct.variants.length > 0) {
          setSelectedVariant(nextProduct.variants[0]);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const displayName = product?.title || product?.name || 'Product';
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [printFileUrl, setPrintFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!printFileUrl) return;
    return () => {
      URL.revokeObjectURL(printFileUrl);
    };
  }, [printFileUrl]);

  const allImages = useMemo(() => {
    const productImages = product?.images ?? [];
    const variantImages = selectedVariant?.images ?? [];
    const merged = [...productImages, ...variantImages];
    if (printFileUrl) merged.unshift(printFileUrl);
    return merged.filter(Boolean);
  }, [product?.images, selectedVariant?.images, printFileUrl]);

  useEffect(() => {
    setMainImageSrc(allImages[0] ?? null);
  }, [allImages]);
  const priceLabel = useMemo(() => {
    const price = selectedVariant?.price ?? 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }, [selectedVariant]);

  const priceInCents = useMemo(
    () => Math.round((selectedVariant?.price ?? 0) * 100),
    [selectedVariant]
  );

  const [printStudioConfig, setPrintStudioConfig] = useState<PrintstudioTemplateConfig | null>(null);
  const [printStudioLoading, setPrintStudioLoading] = useState(false);
  const [printStudioError, setPrintStudioError] = useState<string | null>(null);

  const handlePrintStudioExportComplete = async (file: File) => {
    // Store the exported file temporarily until "Add to Cart" is clicked.
    setPrintFile(file);

    const nextUrl = URL.createObjectURL(file);

    setPrintFileUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      return nextUrl;
    });

    // Close the dialog + show the exported image immediately.
    setCustomizeOpen(false);
    setMainImageSrc(nextUrl);
  };

  useEffect(() => {
    const fetchTemplateConfig = async () => {
      if (!customizeOpen) return;
      if (!selectedVariant) return;
      if (!id) return;

      let cancelled = false;

      setPrintStudioLoading(true);
      setPrintStudioError(null);
      setPrintStudioConfig(null);

      try {
        const response = await templatesApi.getPrintstudioTemplateConfig(id, selectedVariant.id);
        if (!cancelled) {
          setPrintStudioConfig(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load printstudio template config:', err);
          setPrintStudioError('Failed to load print studio configuration.');
          setPrintStudioConfig(null);
        }
      } finally {
        if (!cancelled) {
          setPrintStudioLoading(false);
        }
      }

      return () => {
        cancelled = true;
      };
    };

    void fetchTemplateConfig();
  }, [customizeOpen, id, selectedVariant?.id]);

  const handleAddToCart = () => {
    if (!product || !selectedVariant) {
      return;
    }

    // "Until the product is added to cart": clear the temporary export once added.
    // (Navigation away from this page will also drop state, but this keeps intent explicit.)
    // Note: we are not uploading/attaching to cart in this task.
    if (printFile) {
      setPrintFile(null);
    }
    if (printFileUrl && printFile) {
      URL.revokeObjectURL(printFileUrl);
      setPrintFileUrl(null);
    }

    addItem({
      id: String(selectedVariant.external_id ?? selectedVariant.id),
      name: `${displayName} - ${selectedVariant.title || selectedVariant.size || selectedVariant.color || 'Default'}`,
      price: priceInCents,
      currency: 'USD',
      image: '',
      variantId: String(selectedVariant.id),
      productId: String(product.id),
      provider: product.provider,
    });
    router('/cart');
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!product) {
    return <div className="p-8">Product not found</div>;
  }

  return (
    <div className="main-class">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="bg-gray-100 rounded-lg h-96 overflow-hidden">
              {mainImageSrc ? (
                <img
                  src={mainImageSrc}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <span className="text-gray-500 text-center px-4">{displayName}</span>
                </div>
              )}
            </div>

            {allImages.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {allImages.map((src) => {
                  const isSelected = src === mainImageSrc;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setMainImageSrc(src)}
                      className={[
                        'shrink-0 rounded-md border overflow-hidden',
                        isSelected ? 'border-black' : 'border-transparent',
                      ].join(' ')}
                      aria-label={`Show image for ${displayName}`}
                    >
                      <img
                        src={src}
                        alt={displayName}
                        loading="lazy"
                        className="h-16 w-16 object-cover cursor-pointer"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-4">{displayName}</h1>
            <div className="text-gray-600 mb-4">
              <ReactMarkdown
                skipHtml
                components={{
                  p: ({ node, ...props }) => <p {...props} className="mb-4 last:mb-0" />,
                  ul: ({ node, ...props }) => (
                    <ul {...props} className="list-disc ml-6 mb-4 last:mb-0" />
                  ),
                  li: ({ node, ...props }) => <li {...props} className="mt-1" />,
                }}
              >
                {product.description ?? ''}
              </ReactMarkdown>
            </div>

            {product.variants && product.variants.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Option
                </label>
                <select
                  value={selectedVariant?.id || ''}
                  onChange={(e) => {
                    const variant = product.variants?.find(
                      (v) => String(v.id) === e.target.value
                    );
                    setSelectedVariant(variant || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {product.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.title || `${variant.size} / ${variant.color}`} - {priceLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedVariant}
              className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>

            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="w-full mt-3 bg-white text-black border-2 border-black py-3 rounded-md hover:bg-black hover:text-white transition cursor-pointer"
            >
              customize
            </button>
          </div>
        </div>

        <FullScreenDialog
          open={customizeOpen}
          onClose={() => setCustomizeOpen(false)}
          title="Customize"
        >
          {printStudioLoading || !printStudioConfig ? (
            <div className="p-6">
              {printStudioError ? (
                <div className="text-red-600">{printStudioError}</div>
              ) : (
                <div>Loading print studio...</div>
              )}
            </div>
          ) : (
            <PrintStudio
              config={{
                ...printStudioConfig,
                onExportComplete: handlePrintStudioExportComplete,
              }}
            />
          )}
        </FullScreenDialog>
    </div>
  );
}
