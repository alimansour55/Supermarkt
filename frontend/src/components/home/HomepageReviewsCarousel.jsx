import { BadgeCheck, Star } from 'lucide-react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import ProductImage from '../ui/ProductImage';
import { ShopIconBadge } from '../ui/ShopIcon';

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} aria-hidden />
      ))}
    </div>
  );
}

/** Approved product reviews in a sliding row (data comes with the homepage response). */
export default function HomepageReviewsCarousel({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const reviews = section.reviews || [];
  if (!reviews.length) return null;

  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;

  return (
    <section className="container-app py-6">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
              <ShopIconBadge name={section.icon} />
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
      )}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:px-0">
        {reviews.map((review) => {
          const productName = isAr ? review.product?.nameAr || review.product?.nameEn : review.product?.nameEn || review.product?.nameAr;
          return (
            <article
              key={review.id}
              className="flex w-[78%] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm sm:w-[46%] lg:w-[calc(25%-0.6rem)]"
            >
              <Stars rating={review.rating} />
              {review.title && <h3 className="text-sm font-bold text-text">{review.title}</h3>}
              <p className="line-clamp-4 flex-1 text-sm leading-6 text-text-muted">“{review.comment}”</p>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-text">{review.name || (isAr ? 'عميل' : 'Customer')}</span>
                {review.verified && (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    {isAr ? 'مشتري مؤكد' : 'Verified buyer'}
                  </span>
                )}
              </div>
              {review.product?.slug && (
                <Link to={`/products/${review.product.slug}`} className="flex items-center gap-2 rounded-xl bg-surface-muted/60 p-2 text-xs font-medium text-text hover:bg-surface-muted">
                  <ProductImage
                    src={review.product.image}
                    className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white text-xl"
                    imgClassName="h-full w-full object-contain"
                    sizes="36px"
                    maxWidth={96}
                  />
                  <span className="line-clamp-1">{productName}</span>
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
