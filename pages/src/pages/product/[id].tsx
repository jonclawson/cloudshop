import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import PrintStudio from 'printstudio';
import 'printstudio/dist/printstudio.css';
import { useShoppingCart } from 'use-shopping-cart';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { productsApi, templatesApi, type PrintstudioTemplateConfig } from '../../useApi';
import PrintfulEstimate from '../../components/PrintfulEstimate';
import { putPrintFile } from '../../printAssetsIdb';
import FullScreenDialog from '../../components/FullScreenDialog';

const techniqueKeys = [
    "cut-sew",
    "digital",
    "direct-to-fabric",
    "dtfilm",
    "dtg",
    "embroidery",
    "sublimation",
    "uv"
];

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
  images?: string[];

  provider?: 'printful' | string;
  custom?: {id: string, additional_price: string}[];
  options?: {id: string, type: string, title: string, values: any, additional_price: string}[];
  techniques?: {key: string, display_name: string, is_default: boolean}[];
};

const PRINT_ASSET_KEYS_LS_KEY = 'printAssetKeys';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function ProductPage() {
  const router = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { addItem } = useShoppingCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  const [mainImageSrc, setMainImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const [printFile, setPrintFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbFileUrl, setThumbFileUrl] = useState<string | null>(null);

  const [options, setOptions] = useState<{[key: string]: any}>({});
  const [technique, setTechnique] = useState<{key: string, display_name: string, is_default: boolean} | null>(null);

  useEffect(() => {
    if (!thumbFileUrl) return;

    return () => {
      URL.revokeObjectURL(thumbFileUrl);
    };
  }, [thumbFileUrl]);

  const allImages = useMemo(() => {
    const productImages = product?.images ?? [];
    const variantImages = selectedVariant?.images ?? [];
    const merged = [...(variantImages.length === 0 ? productImages : []), ...variantImages];

    if (thumbFileUrl) merged.unshift(thumbFileUrl);

    return merged.filter(Boolean);
  }, [product?.images, selectedVariant?.images, thumbFileUrl]);

  useEffect(() => {
    setMainImageSrc(allImages[0] ?? null);
  }, [allImages]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productsApi.getById(id!);
        const nextProduct = response.data as Product;

        setProduct(nextProduct);

        if (nextProduct.variants && nextProduct.variants.length > 0) {
          const variants = nextProduct.variants;

          const mediumBySize =
            variants.find((v) => typeof v.size === 'string' && v.size.toUpperCase() === 'M') ??
            null;

          const mediumByTitle =
            variants.find((v) =>
              typeof v.title === 'string'
                ? v.title.toLowerCase().includes('medium')
                : false
            ) ?? null;

          setSelectedVariant(mediumBySize ?? mediumByTitle ?? variants[0]);

          if (nextProduct.options) {
            nextProduct.options.forEach((option) => {
              if (option.values) {
                const firstValue = Object.entries(option.values)[0];
                setOptions((prev) => ({
                  ...prev,
                  [option.id]: {option, value: firstValue},
                }));
              }
            });
          }

          if (nextProduct.techniques) {
            const defaultTechnique = nextProduct.techniques.find(t => t.is_default) ?? nextProduct.techniques[0];
            setTechnique(defaultTechnique);
          }
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchProduct();
  }, [id]);

  const displayName = product?.title || product?.name || 'Product';

  const priceLabel = useMemo(() => {
    const price = selectedVariant?.price ?? 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }, [selectedVariant]);

    const variantPriceLabel = useCallback((price: number = 0) => {
    // const price = selectedVariant?.price ?? 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }, [product]);

  const priceInCents = useMemo(
    () => Math.round((selectedVariant?.price ?? 0) * 100),
    [selectedVariant]
  );

  const [printStudioConfig, setPrintStudioConfig] = useState<PrintstudioTemplateConfig | null>(null);
  const [printStudioLoading, setPrintStudioLoading] = useState(false);
  const [printStudioError, setPrintStudioError] = useState<string | null>(null);

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
        const response = await templatesApi.getPrintstudioTemplateConfig(id, selectedVariant.id, technique?.key);
        if (!cancelled) setPrintStudioConfig(response.data);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load print studio template config:', err);
          setPrintStudioError('Failed to load print studio configuration.');
          setPrintStudioConfig(null);
        }
      } finally {
        if (!cancelled) setPrintStudioLoading(false);
      }

      return () => {
        cancelled = true;
      };
    };

    void fetchTemplateConfig();
  }, [customizeOpen, id, selectedVariant?.id]);

  const handlePrintStudioExportComplete = (file: File) => {
    // Captures the exported artwork (print file) for later persistence.
    setPrintFile(file);
    setCustomizeOpen(false);
  };

  const handlePrintStudioSaveThumb = (file: File) => {
    // Captures thumb for preview rendering.
    setThumbFile(file);

    const nextUrl = URL.createObjectURL(file);
    setThumbFileUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      return nextUrl;
    });

    setCustomizeOpen(false);
    setMainImageSrc(nextUrl);
  };

  const clearTempState = () => {
    setPrintFile(null);

    if (thumbFileUrl) URL.revokeObjectURL(thumbFileUrl);
    setThumbFile(null);
    setThumbFileUrl(null);
  };

  const getFallbackVariantOrProductImageUrl = () => {
    if (!product) return '';

    const hasVariants = Boolean(product.variants && product.variants.length > 0);

    if (hasVariants) {
      return selectedVariant?.images?.[0] ?? '';
    }

    return product.images?.[0] ?? '';
  };

  const addThumbDataUrlToCartItem = async (): Promise<string> => {
    if (!thumbFile) {
      return getFallbackVariantOrProductImageUrl();
    }

    return await readFileAsDataUrl(thumbFile);
  };

  const addPrintFileToIndexedDbAndRegister = async (): Promise<string | undefined> => {
    if (!printFile) return undefined;

    const assetKey = crypto.randomUUID();
    await putPrintFile(assetKey, printFile);

    const existingRaw = localStorage.getItem(PRINT_ASSET_KEYS_LS_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as unknown[]) : [];
    const list = existing.filter((x): x is string => typeof x === 'string');

    if (!list.includes(assetKey)) {
      list.push(assetKey);
      localStorage.setItem(PRINT_ASSET_KEYS_LS_KEY, JSON.stringify(list));
    }

    return assetKey;
  };

  const handleAddToCart = async () => {
    if (!product || !selectedVariant) return;

    const thumbDataUrl = await addThumbDataUrlToCartItem();
    const printAssetKey = await addPrintFileToIndexedDbAndRegister();

    addItem({
      id: String(selectedVariant.external_id ?? selectedVariant.id) + (printAssetKey ? `-${printAssetKey}` : ''),
      name: `${displayName} - ${
        selectedVariant.title || selectedVariant.size || selectedVariant.color || 'Default'
      }`,
      price: priceInCents,
      currency: 'USD',

      // IMPORTANT: thumb (data URL) is stored here for cart display.
      image: thumbDataUrl,

      technique,

      options,

      template: printStudioConfig,

      // These extra fields will be used by cart/cleanup later.
      printAssetKey: printAssetKey ?? undefined,

      variantId: String(selectedVariant.id),
      productId: String(product.id),
      provider: product.provider,
    } as any);

    clearTempState();
    router('/cart');
  };

  const handleOptionChange = (optionId: string, value: any) => {
    const option = product?.options?.find((o) => o.id === optionId);
    setOptions((prev) => ({
      ...prev,
      [optionId]: {option, value: JSON.parse(value)},
    }));
  }

  const handleTechniqueChange = (techniqueKey: string) => {
    const technique = product?.techniques?.find((t) => t.key === techniqueKey) ?? null;
    setTechnique(technique);
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!product) return <div className="p-8">Product not found</div>;

  return (
    <div className="main-class">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className=" rounded-lg h-96 overflow-hidden">
            {mainImageSrc ? (
              <img src={mainImageSrc} alt={displayName} className="w-full h-full object-contain" />
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
                      className="h-16 w-16 object-contain cursor-pointer"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-4">{displayName}</h1>
          <div className="mb-4">
            {product.variants && product.variants.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Option</label>
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
                      {variant.title || `${variant.size} / ${variant.color}`} - {variantPriceLabel(variant.price)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {product.techniques && product?.techniques.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Technique</label>
                <select
                  disabled={product.techniques.length <= 1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  onChange={(e) => handleTechniqueChange(e.target.value)}
                >
                  {(product as Product).techniques?.map((technique: {key?: string, display_name?: string}) => (
                    <option key={technique.key} value={technique.key}>
                      {technique.display_name || technique.key}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(technique?.key === 'embroidery' || technique?.key === 'cut-sew') && product.options && product.options.length > 0 && (
              <div className="mb-3">
                {product?.options.map((option) => (
                  <div key={option.id} className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{option.title}</label>

                    {(option.type === 'radio' || option.type === 'select' || option.type === 'multi_select') && (
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      multiple={option.type === 'multi_select'}
                      onChange={(e) => handleOptionChange(option.id, e.target.value)}
                      >
                      {option.values && Object.entries(option.values).map(([key, value]: [string, any]) => (
                        <option key={key} value={JSON.stringify({[key]: value})}>
                          {value} {option.additional_price ? `(+${option.additional_price})` : ''}
                        </option>
                      ))}
                    </select>
                    )}
                    
                    {option.type === 'text' && (
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder={option.title}
                        onChange={(e) => handleOptionChange(option.id, JSON.stringify(e.target.value))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}


            {product.custom && product.custom.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Ensure preview uses defaults until user saves a thumb.
                clearTempState();
                setCustomizeOpen(true);
              }}
              className="w-full mb-3 bg-white text-black border-2 border-black py-3 rounded-md hover:bg-black hover:text-white transition cursor-pointer"
            >
              customize
              {product.custom?.map((custom: { id?: string, additional_price?: string }) => 
                custom?.id === 'default' && (
                  <span key={custom.id} >
                    {custom?.additional_price}
                  </span>
                )
              )}
            </button>
            )}

            <button
              type="button"
              onClick={() => void handleAddToCart()}
              disabled={!selectedVariant}
              className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>

            {product.provider === 'printful' && selectedVariant && (
              <PrintfulEstimate
                mode="manual"
                orderItems={[
                  {
                    catalog_variant_id: Number(selectedVariant.id),
                    external_id: String(product.external_id ?? product.id),
                    quantity: 1,
                    retail_price: selectedVariant.price.toFixed(2),
                    name: displayName,
                    technique: technique?.key
                  },
                ]}
                retailCosts={{
                  currency: 'USD',
                }}
              />
            )}
          </div>
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

        </div>
      </div>

      <FullScreenDialog
        open={customizeOpen}
        onClose={() => {
          setCustomizeOpen(false);
        }}
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
              onSaveThumb: handlePrintStudioSaveThumb,
            }}
          />
        )}
      </FullScreenDialog>
    </div>
  );
}
