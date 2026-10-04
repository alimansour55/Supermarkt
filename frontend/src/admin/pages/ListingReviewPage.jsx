import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '../../app/router';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, Pagination, useToast } from '../components';
import { useAdminStats } from '../context/AdminStatsContext';
import { hasPermission } from '../adminPermissions';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, LISTING_STATUS, apiError, label } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';

const STATES = ['pending', 'approved', 'rejected', 'paused', 'draft'];

const FIELD_LABELS = {
  nameAr: { ar: 'الاسم (عربي)', en: 'Name (Arabic)' },
  nameEn: { ar: 'الاسم (إنجليزي)', en: 'Name (English)' },
  descriptionAr: { ar: 'الوصف (عربي)', en: 'Description (Arabic)' },
  descriptionEn: { ar: 'الوصف (إنجليزي)', en: 'Description (English)' },
  brand: { ar: 'العلامة', en: 'Brand' },
  size: { ar: 'الحجم', en: 'Size' },
  category: { ar: 'القسم', en: 'Category' },
  specs: { ar: 'المواصفات', en: 'Specifications' },
  barcode: { ar: 'الباركود', en: 'Barcode' },
  unit: { ar: 'الوحدة', en: 'Unit' },
  searchKeywordsAr: { ar: 'كلمات بحث (عربي)', en: 'Keywords (Arabic)' },
  searchKeywordsEn: { ar: 'كلمات بحث (إنجليزي)', en: 'Keywords (English)' },
};
const HIDDEN_DIFF_FIELDS = new Set(['images', 'cloudinaryPublicIds', 'mediaTypes', 'mainCategory', 'categoryAncestors']);

function show(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object') {
      return value.map((s) => [s.keyAr || s.keyEn, s.valueAr || s.valueEn].filter(Boolean).join(': ')).join(' · ');
    }
    return value.join(', ');
  }
  return String(value);
}

function Thumbs({ media }) {
  if (!media?.length) return <span className="text-xs text-text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {media.slice(0, 6).map((m) => (
        <a key={m.url} href={m.url} target="_blank" rel="noreferrer">
          {m.type === 'video'
            ? <video src={m.url} className="h-14 w-14 rounded-lg object-cover ring-1 ring-border" muted />
            : <img src={m.url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-border" />}
        </a>
      ))}
    </div>
  );
}

function ListingCard({ item, isAr, canWrite, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isNew = item.listingStatus === 'pending_review';
  const changes = item.pendingChanges || {};
  const diffKeys = Object.keys(changes).filter((k) => !HIDDEN_DIFF_FIELDS.has(k));
  const mediaChanged = Boolean(changes.images);

  const act = async (kind) => {
    let note = '';
    if (kind !== 'approve') {
      note = window.prompt(isAr ? 'ما الذي يجب على البائع تعديله؟' : 'What should the seller fix?') || '';
      if (!note.trim()) return;
    }
    setBusy(true);
    try {
      if (kind === 'approve') await adminApi.approveListing(item._id);
      else await adminApi.rejectListing(item._id, { note, unlist: kind === 'unlist' });
      toast.success(isAr ? 'تم' : 'Done');
      onDone();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر تنفيذ الإجراء' : 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{isAr ? item.nameAr : item.nameEn}</h3>
            <StatusBadge map={LISTING_STATUS} value={item.listingStatus} isAr={isAr} />
            {item.pendingChangesAt && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">{isAr ? 'تعديل معلّق' : 'Edit pending'}</span>}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {item.seller ? (isAr ? item.seller.nameAr : item.seller.nameEn) : '—'}
            {' · '}{formatPrice(item.price)}
            {' · '}{label(FULFILLMENT, item.fulfilledBy, isAr)}
            {' · '}{isAr ? 'المخزون' : 'Stock'}: {item.stock}
          </p>
          <p className="text-xs text-text-muted" dir="ltr">{item.sku}{item.barcode ? ` · ${item.barcode}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.isActive && (
            <a href={`/${isAr ? 'ar' : 'en'}/products/${item.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-border">
              <ExternalLink className="h-3.5 w-3.5" />{isAr ? 'عرض' : 'View'}
            </a>
          )}
          {canWrite && (isNew || item.pendingChangesAt) && (
            <>
              <Button size="sm" disabled={busy} onClick={() => act('approve')}><CheckCircle2 className="h-4 w-4" />{isAr ? 'اعتماد' : 'Approve'}</Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => act('reject')}><XCircle className="h-4 w-4" />{isAr ? 'رفض' : 'Reject'}</Button>
            </>
          )}
          {canWrite && !isNew && !item.pendingChangesAt && ['approved', 'paused'].includes(item.listingStatus) && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act('unlist')}>{isAr ? 'إزالة من المتجر' : 'Take down'}</Button>
          )}
        </div>
      </div>

      {isNew && (
        <div className="mt-4 grid gap-4 md:grid-cols-[auto,1fr]">
          <Thumbs media={item.media} />
          <div className="space-y-1 text-sm">
            <p><span className="text-text-muted">{isAr ? 'القسم: ' : 'Category: '}</span>{item.categorySlug || '—'}</p>
            {item.brand && <p><span className="text-text-muted">{isAr ? 'العلامة: ' : 'Brand: '}</span>{item.brand}</p>}
            <p className="line-clamp-3 whitespace-pre-line">{isAr ? item.descriptionAr || item.descriptionEn : item.descriptionEn || item.descriptionAr}</p>
            {item.variants?.length > 0 && (
              <p className="text-xs text-text-muted">{item.variants.map((v) => `${isAr ? v.valueAr : v.valueEn} (${formatPrice(v.price)})`).join(' · ')}</p>
            )}
          </div>
        </div>
      )}

      {item.pendingChangesAt && (diffKeys.length > 0 || mediaChanged) && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-amber-200">
          <table className="w-full text-sm">
            <thead className="bg-amber-50 text-xs text-amber-900">
              <tr>
                <th className="px-3 py-2 text-start">{isAr ? 'الحقل' : 'Field'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'المعروض الآن' : 'Live now'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'المقترح' : 'Proposed'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {mediaChanged && (
                <tr>
                  <td className="px-3 py-2 font-medium">{isAr ? 'الصور' : 'Images'}</td>
                  <td className="px-3 py-2"><Thumbs media={item.media} /></td>
                  <td className="px-3 py-2"><Thumbs media={item.pendingMedia} /></td>
                </tr>
              )}
              {diffKeys.map((k) => (
                <tr key={k}>
                  <td className="px-3 py-2 font-medium">{FIELD_LABELS[k] ? (isAr ? FIELD_LABELS[k].ar : FIELD_LABELS[k].en) : k}</td>
                  <td className="max-w-xs px-3 py-2 text-text-muted">{k === 'category' ? item.categorySlug : show(item[k])}</td>
                  <td className="max-w-xs px-3 py-2">{k === 'category' ? (isAr ? 'قسم جديد' : 'New category') : show(changes[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {item.reviewNote && item.listingStatus === 'rejected' && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{isAr ? 'ملاحظة الرفض: ' : 'Rejection note: '}{item.reviewNote}</p>
      )}
    </article>
  );
}

export default function ListingReviewPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const { refreshStats } = useAdminStats();
  const canWrite = hasPermission(user, 'sellers:write');
  const [searchParams, setSearchParams] = useSearchParams();
  const state = searchParams.get('state') || 'pending';
  const sellerId = searchParams.get('seller') || '';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.listListingQueue({ state, seller: sellerId || undefined, page, limit: 20 })
      .then(({ data }) => {
        setItems(data.data || []);
        setPagination(data.pagination);
      })
      .catch(() => toast.error(isAr ? 'تعذّر التحميل' : 'Could not load listings'))
      .finally(() => setLoading(false));
  }, [state, sellerId, page, isAr, toast]);

  useEffect(() => { load(); }, [load]);

  const setState = (next) => {
    setPage(1);
    const params = { state: next };
    if (sellerId) params.seller = sellerId;
    setSearchParams(params);
  };

  const stateLabel = (s) => (s === 'pending' ? (isAr ? 'بانتظار المراجعة' : 'Waiting for review') : label(LISTING_STATUS, s, isAr));

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'مراجعة منتجات البائعين' : 'Listing review'}
        description={isAr ? 'المنتجات الجديدة والتعديلات لا تظهر للعملاء قبل اعتمادها.' : 'New listings and content edits stay hidden from customers until approved.'}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {STATES.map((s) => (
          <button key={s} type="button" onClick={() => setState(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${state === s ? 'bg-primary-600 text-white' : 'bg-white text-text ring-1 ring-border'}`}>
            {stateLabel(s)}
          </button>
        ))}
        {sellerId && (
          <button type="button" onClick={() => setSearchParams({ state })} className="ms-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold">
            {isAr ? 'كل البائعين ×' : 'All sellers ×'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
          {state === 'pending' ? (isAr ? 'لا شيء بانتظار المراجعة 🎉' : 'Nothing waiting for review 🎉') : (isAr ? 'لا توجد منتجات.' : 'No listings.')}
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ListingCard key={item._id} item={item} isAr={isAr} canWrite={canWrite} onDone={() => { load(); refreshStats(); }} />
          ))}
        </div>
      )}
      {pagination?.pages > 1 && <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} isAr={isAr} />}
    </div>
  );
}
