import { useEffect, useState } from 'react';
import { Link } from '../../app/router';
import { Star, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { reviewService } from '../../services/apiServices';
import Button from '../ui/Button';
import Textarea from '../ui/Textarea';

function ReviewStatusBadge({ status, isAr }) {
  if (status === 'approved') {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
        {isAr ? 'منشور' : 'Published'}
      </span>
    );
  }
  if (status === 'hidden') {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
        {isAr ? 'مخفي' : 'Hidden'}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
      {isAr ? 'قيد المراجعة' : 'Pending approval'}
    </span>
  );
}

function SubmittedReviewCard({ review, isAr, compact }) {
  const rating = Number(review?.rating || 0);
  const status = review?.status || 'pending';

  return (
    <div className={`rounded-2xl border border-emerald-200 bg-emerald-50/50 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
        <p className="text-sm font-semibold text-text">
          {isAr ? 'تم إرسال تقييمك' : 'Your review was submitted'}
        </p>
        <ReviewStatusBadge status={status} isAr={isAr} />
        {review?.verifiedPurchase && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isAr ? 'شراء موثق' : 'Verified purchase'}
          </span>
        )}
      </div>

      <div className="mb-2 flex items-center gap-1" aria-label={`${rating} stars`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          />
        ))}
      </div>

      {review?.title && <p className="mb-1 font-semibold text-text">{review.title}</p>}

      {review?.comment ? (
        <p className="whitespace-pre-line text-sm leading-6 text-text-muted">{review.comment}</p>
      ) : (
        <p className="text-sm text-text-muted italic">
          {isAr ? 'بدون تعليق نصي' : 'No written comment'}
        </p>
      )}

      {review?.adminReply?.message && (
        <div className="mt-4 rounded-xl border border-primary-100 bg-white p-3">
          <p className="text-xs font-bold text-primary-800">
            {isAr ? 'رد المتجر' : 'Store reply'}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-text">{review.adminReply.message}</p>
        </div>
      )}

      <p className="mt-3 text-xs text-text-muted">
        {isAr
          ? 'لا يمكن تعديل التقييم بعد الإرسال.'
          : 'Reviews cannot be edited after submission.'}
      </p>
    </div>
  );
}

export default function ProductReviewForm({
  productId,
  productSlug,
  orderId = null,
  isAr,
  isAuthenticated,
  compact = false,
  showOnOrder = false,
  onSubmitted,
}) {
  const [eligibility, setEligibility] = useState(null);
  const [loadingEligibility, setLoadingEligibility] = useState(Boolean(isAuthenticated && productId));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !productId) {
      setEligibility(null);
      setLoadingEligibility(false);
      return undefined;
    }

    let active = true;
    setLoadingEligibility(true);
    reviewService.getEligibility(productId, orderId)
      .then(({ data }) => {
        if (!active) return;
        setEligibility(data.data);
      })
      .catch(() => {
        if (active) {
          setEligibility({ canReview: false, hasReview: false, myReview: null });
        }
      })
      .finally(() => {
        if (active) setLoadingEligibility(false);
      });

    return () => { active = false; };
  }, [isAuthenticated, productId, orderId]);

  const submitReview = async (e) => {
    e.preventDefault();
    if (eligibility?.hasReview) return;

    setSubmitting(true);
    setMessage('');
    try {
      await reviewService.submit(productId, { rating, comment, orderId });
      setMessage(isAr ? 'تم إرسال تقييمك للمراجعة' : 'Your review was submitted for moderation');
      const { data } = await reviewService.getEligibility(productId, orderId);
      setEligibility(data.data);
      setRating(5);
      setComment('');
      onSubmitted?.();
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        const { data } = await reviewService.getEligibility(productId, orderId);
        setEligibility(data.data);
        setMessage(isAr ? 'لقد قيّمت هذا المنتج مسبقاً' : 'You already reviewed this product');
      } else {
        setMessage(error.response?.data?.message || (isAr ? 'تعذر إرسال التقييم' : 'Could not submit review'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!productId) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className={`rounded-2xl border border-border bg-white ${compact ? 'p-4' : 'p-5'} text-sm text-text-muted`}>
        <Link to="/login" className="font-semibold text-primary-600">{isAr ? 'سجّل الدخول' : 'Sign in'}</Link>
        {' '}
        {isAr ? 'لتقييم المنتجات التي اشتريتها.' : 'to review products you purchased.'}
      </div>
    );
  }

  if (loadingEligibility) {
    return (
      <div className={`rounded-2xl border border-border bg-white ${compact ? 'p-4' : 'p-5'} text-sm text-text-muted`}>
        {isAr ? 'جار التحقق من أهلية التقييم...' : 'Checking review eligibility...'}
      </div>
    );
  }

  if (eligibility?.hasReview && eligibility?.myReview) {
    return (
      <SubmittedReviewCard
        review={eligibility.myReview}
        isAr={isAr}
        compact={compact}
      />
    );
  }

  const showReReviewBanner = eligibility?.reReviewAllowed && eligibility?.canReview;

  if (!eligibility?.canReview) {
    let deliveredOnlyMessage;
    if (eligibility?.productNotInOrder) {
      deliveredOnlyMessage = isAr
        ? 'لا يمكن ربط هذا المنتج ببنود الطلب. تواصل مع الدعم إن كان المنتج موجوداً في طلبك.'
        : 'This product could not be matched to your order items. Contact support if it was in your order.';
    } else if (showOnOrder && eligibility?.requiresDelivery) {
      deliveredOnlyMessage = isAr
        ? 'التقييم متاح بعد تم التسليم فقط.'
        : 'Rating is available only after delivery is complete.';
    } else if (showOnOrder) {
      deliveredOnlyMessage = isAr
        ? 'تعذّر فتح نموذج التقييم لهذا المنتج. جرّب تحديث الصفحة أو تواصل مع الدعم.'
        : 'Could not open the review form for this item. Try refreshing or contact support.';
    } else {
      deliveredOnlyMessage = isAr
        ? 'يمكنك تقييم هذا المنتج بعد تم تسليم الطلب.'
        : 'You can review this product after your order is delivered.';
    }
    return (
      <div className={`rounded-2xl border border-dashed border-border bg-surface ${compact ? 'p-4' : 'p-5'} text-sm text-text-muted`}>
        {deliveredOnlyMessage}
        {productSlug && (
          <span>
            {' '}
            <Link to="/orders" className="font-semibold text-primary-600">{isAr ? 'عرض طلباتي' : 'View my orders'}</Link>
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submitReview} className={`rounded-2xl border border-primary-100 bg-primary-50/40 ${compact ? 'p-4' : 'p-5'}`}>
      {showReReviewBanner && (
        <p className="mb-3 rounded-xl border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-800">
          {isAr
            ? 'منحتك الإدارة فرصة لتقييم جديد — يمكنك مشاركة تجربة أفضل.'
            : 'Our team invited you to submit an updated review.'}
        </p>
      )}
      <div className="mb-3">
        <p className="text-sm font-semibold text-text">
          {isAr ? 'قيّم هذا المنتج' : 'Rate this product'}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {isAr ? 'يمكنك الإرسال مرة واحدة فقط' : 'You can submit one review only'}
        </p>
      </div>

      <div className="mb-3 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={value <= rating ? 'text-amber-400' : 'text-slate-300'}
            aria-label={`${value} stars`}
          >
            <Star className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} fill-current`} />
          </button>
        ))}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder={isAr ? 'اكتب رأيك في المنتج...' : 'Write your review...'}
      />

      {message && <p className="mt-2 text-sm text-text-muted">{message}</p>}

      <Button type="submit" className="mt-3" size={compact ? 'sm' : 'md'} disabled={submitting}>
        {submitting ? (isAr ? 'جار الإرسال...' : 'Submitting...') : (isAr ? 'إرسال التقييم' : 'Submit review')}
      </Button>
    </form>
  );
}
