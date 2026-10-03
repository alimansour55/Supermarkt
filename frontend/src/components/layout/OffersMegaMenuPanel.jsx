import { Link } from '../../app/router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getCachedOffers, loadOffersForMega } from '../../utils/megaMenuCache';
import { getDiscountPercent } from '../../utils/productHelpers';
import { pickProductImage } from '../../utils/imageHelpers';
import ProductImage from '../ui/ProductImage';

const OFFER_COUNT = 12;

function OfferDealCard({ product, isAr, onNavigate }) {
  const title = isAr ? (product.nameAr || product.name || '') : (product.nameEn || product.name || '');
  const discount = getDiscountPercent(product);
  const price = product.price ?? 0;
  const compareAt = product.compareAtPrice ?? product.originalPrice;
  const hasCompare = compareAt && compareAt > price;
  const currency = isAr ? 'ج.م' : 'EGP';

  return (
    <Link
      to={`/products/${product.slug}`}
      onClick={onNavigate}
      className="group flex w-[118px] shrink-0 flex-col sm:w-[128px]"
    >
      <div className="relative overflow-hidden rounded-lg border border-border/80 bg-white transition-shadow hover:border-primary-200 hover:shadow-md">
        <div className="relative h-[72px] w-full bg-surface/50 sm:h-[78px]">
          {discount > 0 && (
            <span className="absolute start-1 top-1 z-10 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
              -{discount}%
            </span>
          )}
          <ProductImage
            src={pickProductImage(product)}
            alt={title}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-105"
            placeholderClassName="bg-surface/30"
          />
        </div>
      </div>

      <div className="mt-1.5 space-y-0.5 px-0.5">
        <p className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-tight text-text group-hover:text-primary-800 sm:text-xs">
          {title}
        </p>
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-xs font-bold text-red-600 sm:text-[13px]">
            {price.toFixed(0)}
            <span className="ms-0.5 text-[9px] font-semibold">{currency}</span>
          </span>
          {hasCompare && (
            <span className="text-[10px] text-text-muted line-through">
              {compareAt.toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function OfferSkeleton() {
  return (
    <div className="w-[118px] shrink-0 sm:w-[128px]">
      <div className="h-[72px] animate-pulse rounded-lg bg-surface sm:h-[78px]" />
      <div className="mt-1.5 space-y-1">
        <div className="h-2.5 animate-pulse rounded bg-surface" />
        <div className="h-2.5 w-2/3 animate-pulse rounded bg-surface" />
      </div>
    </div>
  );
}

export default function OffersMegaMenuPanel({ onNavigate }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const scrollRef = useRef(null);
  const [products, setProducts] = useState(() => getCachedOffers() || []);
  const [loading, setLoading] = useState(!getCachedOffers());

  useEffect(() => {
    const cached = getCachedOffers();
    if (cached?.length) {
      setProducts(cached);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    loadOffersForMega(OFFER_COUNT)
      .then((data) => {
        if (active) setProducts(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  const ChevronPrev = isAr ? ChevronRight : ChevronLeft;
  const ChevronNext = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 sm:px-5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-text sm:text-base">
            {isAr ? 'عروض اليوم' : "Today's deals"}
          </h3>
          <p className="truncate text-[11px] text-text-muted sm:text-xs">
            {isAr ? 'خصومات لفترة محدودة' : 'Limited-time savings'}
          </p>
        </div>
        <Link
          to="/offers"
          onClick={onNavigate}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 sm:px-4 sm:py-2 sm:text-sm"
        >
          {isAr ? 'كل العروض' : 'All offers'}
        </Link>
      </div>

      <div className="relative px-4 py-3 sm:px-5 sm:py-4">
        {products.length > 4 && (
          <>
            <button
              type="button"
              onClick={() => scroll(-1)}
              className="absolute start-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-white p-1 shadow-sm transition-colors hover:bg-surface md:flex"
              aria-label={isAr ? 'السابق' : 'Previous'}
            >
              <ChevronPrev className="h-4 w-4 text-text" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              className="absolute end-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-white p-1 shadow-sm transition-colors hover:bg-surface md:flex"
              aria-label={isAr ? 'التالي' : 'Next'}
            >
              <ChevronNext className="h-4 w-4 text-text" />
            </button>
          </>
        )}

        {loading && !products.length ? (
          <div className="flex gap-3 overflow-hidden pb-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <OfferSkeleton key={i} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin"
          >
            {products.map((product) => (
              <OfferDealCard
                key={String(product._id || product.slug)}
                product={product}
                isAr={isAr}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-text-muted">
              {isAr ? 'لا توجد عروض حالياً.' : 'No offers available right now.'}
            </p>
            <Link
              to="/offers"
              onClick={onNavigate}
              className="mt-2 inline-block text-xs font-semibold text-primary-700 hover:underline"
            >
              {isAr ? 'تصفح العروض' : 'Browse offers'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
