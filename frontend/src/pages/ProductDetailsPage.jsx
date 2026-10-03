import { useParams, Link, useLoaderData } from '../app/router';
import { lazy, Suspense, useState, useMemo, useEffect } from 'react';
import { Heart, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { useProduct } from '../hooks/useProduct';
import { getDiscountPercent, getPromotionHighlight, getProductAvailableStock } from '../utils/productHelpers';
import { formatPrice } from '../utils/formatters';
import ProductGrid from '../components/product/ProductGrid';
import ProductVariantPicker, { getSelectedVariantLine, buildCartProduct } from '../components/product/ProductVariantPicker';
import Button from '../components/ui/Button';
import ProductImage from '../components/ui/ProductImage';
import { Skeleton } from '../components/ui/Skeleton';
import { scrollToSection } from '../utils/scrollToTop';
import { isVideoUrl, pickProductEmoji } from '../utils/imageHelpers';
import SecondItemPriceHighlight from '../components/promo/SecondItemPriceHighlight';
import { getUnitLabel } from '../constants/productUnits';

const ProductReviewsSection = lazy(() => import('../components/product/ProductReviewsSection'));

function getGalleryMedia(product) {
  const raw = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : [];
  const types = product.mediaTypes || [];
  return raw
    .filter((src) => typeof src === 'string' && (src.startsWith('http') || src.startsWith('/')))
    .map((url, index) => ({
      url,
      type: types[index] || (isVideoUrl(url) ? 'video' : 'image'),
    }));
}

function ProductDetailSkeleton() {
  return (
    <div className="container-app mx-auto max-w-5xl py-6 pb-36 lg:py-8 lg:pb-8">
      <div className="grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Skeleton className="aspect-square rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="hidden h-12 w-full rounded-xl lg:block" />
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailsPage() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const loaderData = useLoaderData();
  const { product, loading, refetch } = useProduct(slug, loaderData?.product);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const isAr = language === 'ar';

  useEffect(() => {
    if (!product?.variants?.length) {
      setSelectedVariant(null);
      return;
    }
    const def = product.variants.find((v) => v.isDefault) || product.variants[0];
    setSelectedVariant(def);
  }, [product?._id, product?.variants]);

  const line = useMemo(
    () => (product ? getSelectedVariantLine(product, selectedVariant) : null),
    [product, selectedVariant],
  );

  const displayPrice = line?.price ?? product?.price ?? 0;
  const inStock = line?.inStock ?? product?.inStock;
  const maxStock = line?.availableStock ?? getProductAvailableStock(product, line?.variantId);

  useEffect(() => {
    if (maxStock != null && maxStock > 0) {
      setQuantity((current) => Math.min(current, maxStock));
    }
  }, [maxStock, product?._id, line?.variantId]);

  const galleryMedia = useMemo(
    () => (product ? getGalleryMedia(product) : []),
    [product],
  );

  const similar = useMemo(() => {
    if (!product) return [];
    const fbtIds = new Set((product.frequentlyBoughtTogetherProducts || []).map((p) => p._id));
    return (product.relatedProducts || [])
      .filter((p) => p._id !== product._id && !fbtIds.has(p._id))
      .slice(0, 8);
  }, [product]);

  if (loading && !product) return <ProductDetailSkeleton />;

  if (!product) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'المنتج غير موجود' : 'Product not found'}</p>
        <Link to="/products" className="mt-4 inline-block text-primary-600">{isAr ? 'تصفح المنتجات' : 'Browse Products'}</Link>
      </div>
    );
  }

  const name = isAr ? product.name : product.nameEn;
  const description = isAr ? product.descriptionAr || product.description : product.descriptionEn || product.description;
  const discount = getDiscountPercent({ ...product, price: displayPrice });
  const promotion = getPromotionHighlight({ ...product, price: displayPrice }, language);
  const compareAtPrice = product.compareAtPrice ?? product.oldPrice;
  const fbt = (product.frequentlyBoughtTogetherProducts || []).slice(0, 4);
  const mainMedia = galleryMedia[activeImage] || galleryMedia[0];
  const mainImage = mainMedia?.type === 'image'
    ? mainMedia.url
    : (galleryMedia.length === 0 ? pickProductEmoji(product) : null);
  const favorited = isFavorite(product._id);

  const handleAdd = (openDrawer = true) => {
    addItem(buildCartProduct(product, line), quantity, openDrawer);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const qtyControl = (
    <div className="flex items-center rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setQuantity(Math.max(1, quantity - 1))}
        className="flex h-11 w-11 items-center justify-center hover:bg-surface active:bg-slate-100"
        aria-label={isAr ? 'تقليل' : 'Decrease'}
      >
        <Minus className="h-5 w-5" />
      </button>
      <span className="w-10 text-center font-semibold">{quantity}</span>
      <button
        type="button"
        onClick={() => setQuantity((q) => {
          const next = q + 1;
          return maxStock != null ? Math.min(next, maxStock) : next;
        })}
        disabled={maxStock != null && quantity >= maxStock}
        className="flex h-11 w-11 items-center justify-center hover:bg-surface active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={isAr ? 'زيادة' : 'Increase'}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <div className="container-app mx-auto max-w-5xl py-6 pb-36 lg:py-8 lg:pb-8">
      <div className="grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-slate-50">
            {mainMedia?.type === 'video' ? (
              <video
                key={mainMedia.url}
                src={mainMedia.url}
                className="h-full w-full object-contain"
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <ProductImage
                src={mainImage}
                alt={name}
                className="h-full w-full"
                imgClassName="h-full w-full object-contain p-6"
              />
            )}
            {promotion && (
              <span className={`absolute start-4 top-4 rounded-xl px-3 py-1.5 text-sm font-bold text-white shadow-md ${promotion.className}`}>
                {promotion.icon ? `${promotion.icon} ` : ''}{promotion.label}
              </span>
            )}
            {!promotion && discount > 0 && (
              <span className="absolute start-4 top-4 rounded-xl bg-red-500 px-3 py-1 text-sm font-bold text-white">-{discount}%</span>
            )}
            <button
              type="button"
              onClick={() => toggleFavorite(product._id, product)}
              className={[
                'absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-md',
                'active:scale-95 transition-transform',
                favorited ? 'text-red-500' : 'text-text-muted hover:text-red-400',
              ].join(' ')}
              aria-label={favorited ? (isAr ? 'إزالة من المفضلة' : 'Remove from favorites') : (isAr ? 'أضف للمفضلة' : 'Add to favorites')}
            >
              <Heart className={`h-5 w-5 ${favorited ? 'fill-current' : ''}`} />
            </button>
          </div>
          {galleryMedia.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {galleryMedia.map((item, index) => (
                <button
                  key={`${item.url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 ${
                    activeImage === index ? 'border-primary-600' : 'border-border'
                  }`}
                >
                  {item.type === 'video' ? (
                    <>
                      <video
                        src={item.url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 text-[10px] font-bold text-white">
                        ▶
                      </span>
                    </>
                  ) : (
                    <ProductImage
                      src={item.url}
                      alt=""
                      className="h-full w-full"
                      imgClassName="h-full w-full object-contain"
                      placeholderClassName="scale-50"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-text-muted">{getUnitLabel(product, isAr)}</p>
          {product.reviewCount > 0 && product.rating > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="flex items-center gap-1 text-amber-500">
                {'★'.repeat(Math.floor(product.rating || 0))}
                <span className="text-sm text-text-muted">
                  ({Number(product.rating).toFixed(1)} · {product.reviewCount} {isAr ? 'تقييم' : 'reviews'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('product-reviews', 'smooth')}
                className="text-sm font-semibold text-primary-600 underline-offset-2 transition-colors hover:text-primary-700 hover:underline"
              >
                {isAr ? 'عرض التعليقات' : 'See comments'}
              </button>
            </div>
          )}
          {description && (
            <p className="mt-4 text-sm leading-relaxed text-text-muted">{description}</p>
          )}
          {product.sku && (
            <p className="mt-2 text-xs text-text-muted">SKU: {line?.sku || product.sku}</p>
          )}
          <ProductVariantPicker
            product={product}
            selectedVariantId={selectedVariant?._id}
            onSelect={setSelectedVariant}
            isAr={isAr}
          />
          {product.specs?.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-white p-4">
              <h2 className="mb-3 text-sm font-bold">{isAr ? 'المواصفات' : 'Specifications'}</h2>
              <dl className="divide-y divide-border text-sm">
                {product.specs.map((spec, i) => (
                  <div key={i} className="flex justify-between gap-4 py-2">
                    <dt className="text-text-muted">{isAr ? spec.keyAr || spec.keyEn : spec.keyEn || spec.keyAr}</dt>
                    <dd className="font-medium text-end">{isAr ? spec.valueAr || spec.valueEn : spec.valueEn || spec.valueAr}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div className="mt-6 w-full text-start">
            {promotion?.type === 'second_percent_off' ? (
              <div className="mb-3 flex justify-start">
                <SecondItemPriceHighlight item={{ ...product, price: displayPrice }} isAr={isAr} />
              </div>
            ) : promotion?.sublabel && (
              <p className="mb-2 inline-flex rounded-xl bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800">
                {promotion.sublabel}
              </p>
            )}
            <div className="inline-flex items-baseline gap-3 tabular-nums" dir="ltr">
              {compareAtPrice != null && Number(compareAtPrice) > Number(displayPrice) && (
                <span className="text-lg text-text-muted line-through">{formatPrice(compareAtPrice)}</span>
              )}
              <span className="text-3xl font-bold text-primary-700">{formatPrice(displayPrice)}</span>
            </div>
          </div>
          <div className="mt-6 hidden items-center gap-3 lg:flex">
            {qtyControl}
            <Button onClick={() => handleAdd(true)} disabled={!inStock} size="lg" className="flex-1">
              {added ? (isAr ? '✓ تمت الإضافة' : '✓ Added') : (isAr ? 'أضف للسلة' : 'Add to Cart')}
            </Button>
            <button
              type="button"
              onClick={() => toggleFavorite(product._id, product)}
              className={[
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors',
                favorited
                  ? 'border-red-200 bg-red-50 text-red-500'
                  : 'border-border text-text-muted hover:border-red-200 hover:text-red-400',
              ].join(' ')}
              aria-label={favorited ? (isAr ? 'إزالة من المفضلة' : 'Remove from favorites') : (isAr ? 'أضف للمفضلة' : 'Add to favorites')}
            >
              <Heart className={`h-5 w-5 ${favorited ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {fbt.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 text-xl font-bold">{isAr ? 'يُشترى معاً بكثرة' : 'Frequently bought together'}</h2>
          <ProductGrid products={fbt} />
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 text-xl font-bold">{isAr ? 'منتجات مشابهة' : 'Similar products'}</h2>
          <ProductGrid products={similar} />
        </section>
      )}

      <Suspense fallback={<Skeleton className="mt-14 h-48 rounded-2xl" />}>
        <ProductReviewsSection product={product} isAr={isAr} onSubmitted={refetch} />
      </Suspense>

      <div
        className="fixed inset-x-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md lg:hidden"
        style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-3">
          {qtyControl}
          <button
            type="button"
            onClick={() => handleAdd(false)}
            disabled={!inStock}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
          >
            <ShoppingCart className="h-5 w-5" aria-hidden />
            {added ? (isAr ? 'تمت الإضافة' : 'Added') : (isAr ? 'أضف للسلة' : 'Add to Cart')}
          </button>
        </div>
        <p className="mt-1 w-full text-start text-sm font-semibold text-primary-700 tabular-nums">
          {formatPrice(displayPrice * quantity)}
        </p>
      </div>
    </div>
  );
}
