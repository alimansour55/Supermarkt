import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { fetchProduct, fetchProductsByCategory } from '../services/productApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDiscountPercent } from '../data/mockData';
import { formatPrice } from '../utils/formatters';
import ProductGrid from '../components/product/ProductGrid';
import Button from '../components/ui/Button';

function isImageUrl(src) {
  return typeof src === 'string' && (src.startsWith('http') || src.startsWith('/'));
}

function getGalleryImages(product) {
  const raw = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : [];
  const urls = raw.filter(isImageUrl);
  return urls.length ? urls : [];
}

function ProductDetailSkeleton() {
  return (
    <div className="container-app animate-pulse py-8 pb-36 lg:pb-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-slate-200" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-100" />
          <div className="h-10 w-1/3 rounded bg-slate-200" />
          <div className="hidden h-12 w-full rounded-xl bg-slate-200 lg:block" />
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailsPage() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const { addItem } = useCart();
  const { data: product, loading } = useAsyncData(() => fetchProduct(slug), [slug]);
  const { data: relatedData } = useAsyncData(
    () => product ? fetchProductsByCategory(product.category || product.categorySlug) : Promise.resolve({ products: [] }),
    [product?.category, product?.categorySlug],
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const isAr = language === 'ar';

  const galleryImages = useMemo(
    () => (product ? getGalleryImages(product) : []),
    [product],
  );

  if (loading) return <ProductDetailSkeleton />;

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
  const discount = getDiscountPercent(product);
  const related = (relatedData?.products || []).filter((p) => p._id !== product._id).slice(0, 6);
  const mainImage = galleryImages[activeImage] || galleryImages[0];

  const handleAdd = (openDrawer = true) => {
    addItem(product, quantity, openDrawer);
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
        onClick={() => setQuantity(quantity + 1)}
        className="flex h-11 w-11 items-center justify-center hover:bg-surface active:bg-slate-100"
        aria-label={isAr ? 'زيادة' : 'Increase'}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <div className="container-app py-6 pb-36 lg:py-8 lg:pb-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100">
            {mainImage ? (
              <img src={mainImage} alt={name} className="h-full w-full object-contain p-6" loading="eager" />
            ) : (
              <span className="text-[120px]">{product.emoji || '🛍️'}</span>
            )}
            {discount > 0 && (
              <span className="absolute start-4 top-4 rounded-xl bg-red-500 px-3 py-1 text-sm font-bold text-white">-{discount}%</span>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {galleryImages.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 ${
                    activeImage === index ? 'border-primary-600' : 'border-border'
                  }`}
                >
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-text-muted">{product.unit}</p>
          <div className="mt-2 flex items-center gap-1 text-amber-500">
            {'★'.repeat(Math.floor(product.rating || 0))}
            <span className="text-sm text-text-muted">({product.rating})</span>
          </div>
          {description && (
            <p className="mt-4 text-sm leading-relaxed text-text-muted">{description}</p>
          )}
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary-700">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-lg text-text-muted line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
          </div>
          <div className="mt-6 hidden items-center gap-4 lg:flex">
            {qtyControl}
            <Button onClick={() => handleAdd(true)} disabled={!product.inStock} size="lg" className="flex-1">
              {added ? (isAr ? '✓ تمت الإضافة' : '✓ Added') : (isAr ? 'أضف للسلة' : 'Add to Cart')}
            </Button>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 text-xl font-bold">{isAr ? 'منتجات مشابهة' : 'Related Products'}</h2>
          <ProductGrid products={related} />
        </section>
      )}

      <div
        className="fixed inset-x-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md lg:hidden"
        style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-3">
          {qtyControl}
          <button
            type="button"
            onClick={() => handleAdd(false)}
            disabled={!product.inStock}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
          >
            <ShoppingCart className="h-5 w-5" aria-hidden />
            {added ? (isAr ? 'تمت الإضافة' : 'Added') : (isAr ? 'أضف للسلة' : 'Add to Cart')}
          </button>
        </div>
        <p className="mt-1 text-center text-sm font-semibold text-primary-700">{formatPrice(product.price * quantity)}</p>
      </div>
    </div>
  );
}
