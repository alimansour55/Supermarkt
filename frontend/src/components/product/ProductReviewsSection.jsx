import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProductReviewForm from './ProductReviewForm';

function RatingDistribution({ product, isAr }) {
  const total = product.reviewCount || 0;
  const rows = product.ratingDistribution || [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }));

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-5 text-center text-sm text-text-muted">
        {isAr ? 'لا توجد تقييمات معتمدة بعد' : 'No approved reviews yet'}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-end gap-3">
        <span className="text-4xl font-extrabold text-text">{Number(product.rating || 0).toFixed(1)}</span>
        <div className="pb-1">
          <div className="text-amber-500">{'★'.repeat(Math.round(product.rating || 0))}</div>
          <p className="text-sm text-text-muted">{total} {isAr ? 'تقييم' : 'reviews'}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.rating} className="grid grid-cols-[36px_1fr_28px] items-center gap-2 text-xs">
            <span>{row.rating}★</span>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: total ? `${(row.count / total) * 100}%` : '0%' }} />
            </div>
            <span className="text-text-muted">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductReviewsSection({ product, isAr, onSubmitted }) {
  const { isAuthenticated } = useAuth();

  return (
    <section id="product-reviews" className="mt-14 scroll-mt-[5.5rem] md:scroll-mt-28">
      <h2 className="mb-5 text-xl font-bold">{isAr ? 'تقييمات العملاء' : 'Customer Reviews'}</h2>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <RatingDistribution product={product} isAr={isAr} />
        <div className="space-y-4">
          <ProductReviewForm
            productId={product._id}
            productSlug={product.slug}
            isAr={isAr}
            isAuthenticated={isAuthenticated}
            onSubmitted={onSubmitted}
          />

          {product.reviews?.length ? product.reviews.map((review) => (
            <article key={review._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{review.userName}</span>
                <span className="text-amber-500">{'★'.repeat(Number(review.rating || 0))}</span>
                {review.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isAr ? 'شراء موثق' : 'Verified purchase'}
                  </span>
                )}
              </div>
              {review.title && <p className="mt-1 font-semibold text-text">{review.title}</p>}
              {review.comment && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-muted">{review.comment}</p>}
              {review.adminReply?.message && (
                <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/50 p-3">
                  <p className="text-xs font-bold text-primary-800">
                    {isAr ? 'رد المتجر' : 'Store reply'}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-text">{review.adminReply.message}</p>
                </div>
              )}
              <p className="mt-3 text-xs text-text-muted">{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}</p>
            </article>
          )) : (
            <div className="rounded-2xl border border-border bg-white p-5 text-sm text-text-muted">
              {isAr ? 'لا توجد تقييمات معتمدة بعد.' : 'No approved reviews yet.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
