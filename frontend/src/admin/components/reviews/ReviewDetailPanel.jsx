import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  EyeOff,
  MessageSquare,
  Package,
  Pin,
  RotateCcw,
  ShieldCheck,
  Star,
  Trash2,
  User,
  UserX,
  X,
} from 'lucide-react';
import Button from '../../../components/ui/Button';

function StarRating({ rating, size = 'md' }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const sizeClass = size === 'lg' ? 'text-xl' : 'text-base';
  return (
    <span className={`inline-flex items-center gap-0.5 ${sizeClass}`} aria-label={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={[
            'h-4 w-4',
            size === 'lg' && 'h-5 w-5',
            star <= n ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200',
          ].filter(Boolean).join(' ')}
        />
      ))}
      <span className="ms-1.5 text-sm font-bold tabular-nums text-text">{Number(rating).toFixed(1)}</span>
    </span>
  );
}

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-sky-50 text-sky-800 ring-sky-200',
  hidden: 'bg-slate-100 text-slate-700 ring-slate-200',
  rejected: 'bg-red-50 text-red-800 ring-red-200',
};

function StatusBadge({ status, label }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {label}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border px-2 py-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(String(star))}
          aria-label={`${star} / 5`}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={[
              'h-4 w-4',
              star <= n ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200',
            ].join(' ')}
          />
        </button>
      ))}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true, collapsible = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        className={[
          'flex w-full items-center justify-between gap-2 text-start',
          collapsible ? 'cursor-pointer' : 'cursor-default',
        ].join(' ')}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </span>
        {collapsible && (
          <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {(!collapsible || open) && <div className="mt-3">{children}</div>}
    </section>
  );
}

export default function ReviewDetailPanel({
  review,
  isAr,
  busy,
  replyDraft,
  internalNoteDraft,
  editDraft,
  onReplyChange,
  onInternalNoteChange,
  onEditChange,
  onApprove,
  onHide,
  onReject,
  onRestore,
  onDelete,
  onSaveReply,
  onSaveInternalNote,
  onSaveEdit,
  onGrantReReview,
  onTogglePin,
  onToggleFeature,
  onBlockUser,
  onClose,
}) {
  if (!review) return null;

  const statusLabels = {
    pending: isAr ? 'قيد المراجعة' : 'Pending',
    approved: isAr ? 'منشور' : 'Published',
    hidden: isAr ? 'مخفي' : 'Hidden',
    rejected: isAr ? 'مرفوض' : 'Rejected',
  };

  const productName = isAr ? review.product?.nameAr : review.product?.nameEn;
  const customerInitial = (review.user?.name || '?').charAt(0).toUpperCase();
  const hasReplyDraft = replyDraft.trim().length > 0;
  const replyDirty = replyDraft.trim() !== (review.adminReply?.message || '').trim();

  return (
    <div className="flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      {/* Sticky header */}
      <div className="shrink-0 border-b border-border bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface ring-1 ring-border">
            {review.product?.image ? (
              <img src={review.product.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-5 w-5 text-text-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {isAr ? 'تفاصيل التقييم' : 'Review details'}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug">{productName}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-text-muted">#{String(review._id).slice(-8)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-text"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge status={review.status} label={statusLabels[review.status] || review.status} />
          {review.verifiedPurchase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <ShieldCheck className="h-3 w-3" />
              {isAr ? 'شراء موثق' : 'Verified'}
            </span>
          )}
          {review.pinned && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-800 ring-1 ring-inset ring-violet-200">
              {isAr ? 'مثبت' : 'Pinned'}
            </span>
          )}
          {review.featured && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
              {isAr ? 'مميز' : 'Featured'}
            </span>
          )}
          {review.reReviewAllowed && (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800 ring-1 ring-inset ring-teal-200">
              {isAr ? 'إعادة تقييم' : 'Re-review'}
            </span>
          )}
          {review.reportedCount > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-800 ring-1 ring-inset ring-red-200">
              {isAr ? `${review.reportedCount} بلاغ` : `${review.reportedCount} reports`}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        <div className="rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-4 ring-1 ring-amber-100">
          <StarRating rating={review.rating} size="lg" />
          {review.title && (
            <p className="mt-2 text-sm font-bold text-text">{review.title}</p>
          )}
          <blockquote className="mt-2 border-s-2 border-amber-300 ps-3 text-sm leading-relaxed text-text">
            {review.comment || (
              <span className="italic text-text-muted">{isAr ? 'بدون تعليق' : 'No comment'}</span>
            )}
          </blockquote>
        </div>

        {review.images?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {review.images.map((src, i) => (
              <a
                key={src || i}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="block h-16 w-16 overflow-hidden rounded-lg ring-1 ring-border transition hover:ring-primary-300"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-xl bg-surface px-4 py-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {customerInitial}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-text-muted">{isAr ? 'العميل' : 'Customer'}</p>
              <p className="truncate font-semibold">{review.user?.name || '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-text-muted">{isAr ? 'التاريخ' : 'Date'}</p>
            <p className="font-medium">
              {review.createdAt
                ? new Date(review.createdAt).toLocaleString(isAr ? 'ar-EG' : undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
                : '—'}
            </p>
          </div>
          {review.user?.email && (
            <div className="sm:col-span-2">
              <p className="text-[11px] text-text-muted">{isAr ? 'البريد' : 'Email'}</p>
              <p className="truncate font-medium">{review.user.email}</p>
            </div>
          )}
          {review.product?.slug && (
            <div className="sm:col-span-2">
              <Link
                to={`/products/${review.product.slug}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {isAr ? 'عرض المنتج في المتجر' : 'View product in store'}
              </Link>
            </div>
          )}
        </div>

        {review.adminReply?.message && (
          <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/60 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-800">
              <MessageSquare className="h-3.5 w-3.5" />
              {isAr ? 'رد المتجر' : 'Store reply'}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{review.adminReply.message}</p>
            {review.adminReply.repliedAt && (
              <p className="mt-1 text-[11px] text-primary-600/70">
                {new Date(review.adminReply.repliedAt).toLocaleString(isAr ? 'ar-EG' : undefined)}
              </p>
            )}
          </div>
        )}

        {review.internalNote && (
          <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3.5">
            <p className="text-xs font-bold text-amber-900">{isAr ? 'ملاحظة داخلية' : 'Internal note'}</p>
            <p className="mt-1 text-sm text-amber-950">{review.internalNote}</p>
          </div>
        )}

        <Section title={isAr ? 'إجراءات الإدارة' : 'Moderation'} icon={Check} defaultOpen>
          <div className="flex flex-wrap gap-2">
            {review.status === 'pending' && (
              <Button size="sm" disabled={busy} onClick={onApprove}>
                <Check className="h-4 w-4" />
                {isAr ? 'نشر' : 'Publish'}
              </Button>
            )}
            {review.status !== 'hidden' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onHide}>
                <EyeOff className="h-4 w-4" />
                {isAr ? 'إخفاء' : 'Hide'}
              </Button>
            )}
            {review.status !== 'rejected' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onReject}>
                {isAr ? 'رفض' : 'Reject'}
              </Button>
            )}
            {['hidden', 'rejected'].includes(review.status) && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onRestore}>
                <RotateCcw className="h-4 w-4" />
                {isAr ? 'استرجاع' : 'Restore'}
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={busy} onClick={onTogglePin}>
              <Pin className="h-4 w-4" />
              {review.pinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin') : (isAr ? 'تثبيت' : 'Pin')}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={onToggleFeature}>
              <Star className="h-4 w-4" />
              {review.featured ? (isAr ? 'إلغاء التمييز' : 'Unfeature') : (isAr ? 'تمييز' : 'Feature')}
            </Button>
            {!review.reReviewAllowed && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onGrantReReview}>
                {isAr ? 'السماح بتقييم جديد' : 'Allow re-review'}
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={busy} onClick={onBlockUser}>
              <UserX className="h-4 w-4" />
              {review.user?.reviewBlocked ? (isAr ? 'إلغاء الحظر' : 'Unblock') : (isAr ? 'حظر التقييمات' : 'Block')}
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              {isAr ? 'حذف' : 'Delete'}
            </Button>
          </div>
        </Section>

        <Section
          title={isAr ? 'رد المتجر' : 'Store reply'}
          icon={MessageSquare}
          collapsible
          defaultOpen={!review.adminReply?.message || replyDirty}
        >
          <textarea
            rows={3}
            value={replyDraft}
            onChange={(e) => onReplyChange(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder={isAr ? 'رد ظاهر للعميل على صفحة المنتج...' : 'Public reply visible on the product page...'}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-text-muted">
              {hasReplyDraft
                ? (isAr ? `${replyDraft.trim().length} حرف` : `${replyDraft.trim().length} chars`)
                : (isAr ? 'بدون رد بعد' : 'No reply yet')}
            </p>
            <Button size="sm" variant="secondary" disabled={busy || !replyDirty} onClick={onSaveReply}>
              {isAr ? 'حفظ الرد' : 'Save reply'}
            </Button>
          </div>
        </Section>

        <Section
          title={isAr ? 'ملاحظة داخلية' : 'Internal note'}
          icon={User}
          collapsible
          defaultOpen={Boolean(review.internalNote)}
        >
          <textarea
            rows={2}
            value={internalNoteDraft}
            onChange={(e) => onInternalNoteChange(e.target.value)}
            className="w-full rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-3 py-2.5 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
            placeholder={isAr ? 'للموظفين فقط — غير ظاهرة للعميل' : 'Staff only — not visible to customers'}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="secondary" disabled={busy} onClick={onSaveInternalNote}>
              {isAr ? 'حفظ الملاحظة' : 'Save note'}
            </Button>
          </div>
        </Section>

        <Section
          title={isAr ? 'تعديل التقييم' : 'Edit review'}
          icon={Star}
          collapsible
          defaultOpen={false}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StarPicker
              value={editDraft.rating}
              onChange={(rating) => onEditChange({ ...editDraft, rating })}
            />
            <input
              value={editDraft.title}
              onChange={(e) => onEditChange({ ...editDraft, title: e.target.value })}
              placeholder={isAr ? 'العنوان (اختياري)' : 'Title (optional)'}
              className="min-w-[10rem] flex-1 rounded-xl border border-border px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <textarea
            rows={3}
            value={editDraft.comment}
            onChange={(e) => onEditChange({ ...editDraft, comment: e.target.value })}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder={isAr ? 'نص التقييم' : 'Review text'}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" disabled={busy} onClick={onSaveEdit}>
              {isAr ? 'حفظ التعديل' : 'Save edit'}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
