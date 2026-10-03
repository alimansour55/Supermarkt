import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Download,
  MessageSquareOff,
  ShieldAlert,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAdminStats } from '../context/AdminStatsContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { downloadBlob } from '../utils/downloadBlob';
import Button from '../../components/ui/Button';
import { AdminListPage, ListFilterSelect } from '../components/list';
import { PageHeader, useConfirm, useToast } from '../components';
import ReviewDetailPanel from '../components/reviews/ReviewDetailPanel';
import ReviewProductFilterSidebar from '../components/reviews/ReviewProductFilterSidebar';

const STATUS_OPTIONS = [
  { value: '', ar: 'كل الحالات', en: 'All statuses' },
  { value: 'pending', ar: 'قيد المراجعة', en: 'Pending' },
  { value: 'approved', ar: 'منشور', en: 'Published' },
  { value: 'hidden', ar: 'مخفي', en: 'Hidden' },
  { value: 'rejected', ar: 'مرفوض', en: 'Rejected' },
];

function reviewRowKey(review) {
  if (!review?.product?._id || !review?._id) return null;
  return `${review.product._id}:${review._id}`;
}

function StarRow({ value, size = 'sm' }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  const boxClass = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={[boxClass, i <= n ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'].join(' ')}
        />
      ))}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'default', onClick, active }) {
  const tones = {
    default: { accent: 'bg-slate-300', icon: 'bg-slate-100 text-slate-600' },
    sky: { accent: 'bg-sky-400', icon: 'bg-sky-100 text-sky-700' },
    amber: { accent: 'bg-amber-400', icon: 'bg-amber-100 text-amber-700' },
    green: { accent: 'bg-emerald-400', icon: 'bg-emerald-100 text-emerald-700' },
    red: { accent: 'bg-red-400', icon: 'bg-red-100 text-red-700' },
    violet: { accent: 'bg-violet-400', icon: 'bg-violet-100 text-violet-700' },
  };
  const t = tones[tone] || tones.default;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'group relative overflow-hidden rounded-2xl border border-border bg-white p-4 text-start shadow-sm transition',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        active && 'ring-2 ring-primary-400 ring-offset-1',
      ].filter(Boolean).join(' ')}
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${t.accent} ${active ? 'opacity-100' : 'opacity-0 transition-opacity group-hover:opacity-60'}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
        </div>
        {Icon && (
          <span className={`shrink-0 rounded-xl p-2 ${t.icon}`}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
      </div>
    </Tag>
  );
}

function RatingOverview({ distribution, average, total, isAr }) {
  const publishedTotal = [5, 4, 3, 2, 1].reduce((sum, star) => sum + (distribution[star] || 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 border-b border-border pb-4 text-center sm:border-b-0 sm:border-e sm:pb-0 sm:pe-6">
          <p className="text-4xl font-extrabold tabular-nums text-text">{Number(average || 0).toFixed(1)}</p>
          <StarRow value={average} size="lg" />
          <p className="text-xs font-medium text-text-muted">
            {total ?? publishedTotal} {isAr ? 'تقييم إجمالاً' : 'total reviews'}
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-text">{isAr ? 'توزيع النجوم' : 'Star distribution'}</p>
            <p className="text-[11px] text-text-muted">{isAr ? 'التقييمات المنشورة فقط' : 'Published reviews only'}</p>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star] || 0;
              const pct = publishedTotal > 0 ? Math.round((count / publishedTotal) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="flex w-6 shrink-0 items-center justify-end gap-0.5 text-xs font-bold text-text-muted">
                    {star}
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="absolute inset-y-0 start-0 rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-end text-xs font-bold tabular-nums text-text-muted">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();
  const { refreshStats } = useAdminStats();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [actionKey, setActionKey] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [internalNoteDraft, setInternalNoteDraft] = useState('');
  const [editDraft, setEditDraft] = useState({ rating: 5, title: '', comment: '' });

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getReviews(params),
    initialFilters: {
      productId: '',
      mainCategory: '',
      subCategory: '',
      brand: '',
      status: '',
      rating: '',
      hasReply: '',
      verified: '',
      reported: '',
    },
  });

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    adminApi.getReviewStats()
      .then(({ data }) => setStats(data.data || null))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (!selectedReview) return;
    setReplyDraft(selectedReview.adminReply?.message || '');
    setInternalNoteDraft(selectedReview.internalNote || '');
    setEditDraft({
      rating: String(selectedReview.rating || 5),
      title: selectedReview.title || '',
      comment: selectedReview.comment || '',
    });
  }, [selectedReview?._id, selectedReview?.product?._id]);

  const patchReview = async (review, payload, successMsg) => {
    const key = reviewRowKey(review);
    if (!key) return null;
    setActionKey(key);
    try {
      const { data } = await adminApi.updateReviewStatus(review.product._id, review._id, payload);
      const updated = data.data;
      list.reload();
      loadStats();
      refreshStats();
      if (selectedReview && reviewRowKey(selectedReview) === key) {
        setSelectedReview(updated);
      }
      toast.success(successMsg);
      return updated;
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'تعذّر التحديث' : 'Update failed'));
      return null;
    } finally {
      setActionKey(null);
    }
  };

  const selectedItems = useMemo(() => list.selectedIds.map((id) => {
    const row = list.data.find((r) => r._id === id);
    return row ? { productId: row.product._id, reviewId: row._id } : null;
  }).filter(Boolean), [list.selectedIds, list.data]);

  const runBulk = async (action, labelAr, labelEn) => {
    if (!selectedItems.length) return;
    const ok = action === 'delete' ? await confirm({
      title: isAr ? 'حذف التقييمات' : 'Delete reviews',
      message: isAr ? `حذف ${selectedItems.length} تقييماً؟` : `Delete ${selectedItems.length} review(s)?`,
      confirmLabel: isAr ? 'حذف' : 'Delete',
      variant: 'danger',
    }) : true;
    if (!ok) return;
    try {
      await adminApi.bulkReviews(selectedItems, action);
      list.clearSelection();
      list.reload();
      loadStats();
      refreshStats();
      toast.success(isAr ? labelAr : labelEn);
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'فشل الإجراء الجماعي' : 'Bulk action failed'));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await adminApi.exportReviews(list.queryParams);
      downloadBlob(data, 'reviews-export.csv');
    } catch {
      toast.error(isAr ? 'تعذّر التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      render: (row) => <span className="font-mono text-xs">{String(row._id).slice(-6)}</span>,
    },
    {
      key: 'customer',
      header: isAr ? 'العميل' : 'Customer',
      render: (row) => row.user?.name || '—',
    },
    {
      key: 'product',
      header: isAr ? 'المنتج' : 'Product',
      render: (row) => (
        <span className="line-clamp-1 max-w-[10rem]">{isAr ? row.product?.nameAr : row.product?.nameEn}</span>
      ),
    },
    {
      key: 'rating',
      header: isAr ? 'النجوم' : 'Stars',
      sortKey: 'rating',
      render: (row) => <StarRow value={row.rating} />,
    },
    {
      key: 'comment',
      header: isAr ? 'التعليق' : 'Comment',
      render: (row) => (
        <span className="line-clamp-2 max-w-xs text-text-muted">{row.comment || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (row) => {
        const labels = { pending: isAr ? 'معلق' : 'Pending', approved: isAr ? 'منشور' : 'Published', hidden: isAr ? 'مخفي' : 'Hidden', rejected: isAr ? 'مرفوض' : 'Rejected' };
        const styles = {
          pending: 'bg-amber-50 text-amber-800 ring-amber-200',
          approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
          hidden: 'bg-slate-100 text-slate-700 ring-slate-200',
          rejected: 'bg-red-50 text-red-800 ring-red-200',
        };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${styles[row.status] || styles.hidden}`}>
            {labels[row.status] || row.status}
          </span>
        );
      },
    },
    {
      key: 'verified',
      header: isAr ? 'موثق؟' : 'Verified?',
      render: (row) => (row.verifiedPurchase ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')),
    },
    {
      key: 'reply',
      header: isAr ? 'رد؟' : 'Reply?',
      render: (row) => (row.hasReply || row.adminReply?.message ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')),
    },
    {
      key: 'created',
      header: isAr ? 'التاريخ' : 'Created',
      sortKey: 'createdAt',
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString(isAr ? 'ar-EG' : undefined) : '—'),
    },
  ];

  const busy = selectedReview ? actionKey === reviewRowKey(selectedReview) : false;

  const applyProductScope = (patch) => {
    Object.entries(patch).forEach(([key, value]) => list.setFilter(key, value ?? ''));
  };

  return (
    <div className="space-y-6">
      <PageHeader />

      {stats?.duplicateAlertGroups > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            {isAr
              ? `تنبيه: ${stats.duplicateAlertGroups} مجموعة تعليقات متكررة (3+ مرات). راجع التقييمات المشبوهة.`
              : `${stats.duplicateAlertGroups} duplicate comment group(s) detected (3+ repeats). Review for spam.`}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label={isAr ? 'إجمالي التقييمات' : 'Total reviews'}
          value={statsLoading ? '…' : (stats?.total ?? 0)}
          icon={Star}
          onClick={() => list.setFilter('status', '')}
          active={!list.filters.status}
        />
        <StatCard
          label={isAr ? 'جديد اليوم' : 'New today'}
          value={statsLoading ? '…' : (stats?.newToday ?? 0)}
          icon={TrendingUp}
          tone="sky"
        />
        <StatCard
          label={isAr ? 'معلقة' : 'Pending'}
          value={statsLoading ? '…' : (stats?.pending ?? 0)}
          icon={Clock}
          tone="amber"
          onClick={() => list.setFilter('status', list.filters.status === 'pending' ? '' : 'pending')}
          active={list.filters.status === 'pending'}
        />
        <StatCard
          label={isAr ? 'منشورة' : 'Published'}
          value={statsLoading ? '…' : (stats?.approved ?? 0)}
          icon={ThumbsUp}
          tone="green"
          onClick={() => list.setFilter('status', list.filters.status === 'approved' ? '' : 'approved')}
          active={list.filters.status === 'approved'}
        />
        <StatCard
          label={isAr ? 'مرفوضة' : 'Rejected'}
          value={statsLoading ? '…' : (stats?.rejected ?? 0)}
          icon={ThumbsDown}
          tone="red"
          onClick={() => list.setFilter('status', list.filters.status === 'rejected' ? '' : 'rejected')}
          active={list.filters.status === 'rejected'}
        />
        <StatCard
          label={isAr ? 'بدون رد' : 'No reply'}
          value={statsLoading ? '…' : (stats?.withoutReply ?? 0)}
          icon={MessageSquareOff}
          onClick={() => list.setFilter('hasReply', list.filters.hasReply === 'no' ? '' : 'no')}
          active={list.filters.hasReply === 'no'}
        />
        <StatCard
          label={isAr ? 'مبلغ عنها' : 'Reported'}
          value={statsLoading ? '…' : (stats?.reported ?? 0)}
          icon={ShieldAlert}
          tone="red"
          onClick={() => list.setFilter('reported', list.filters.reported === 'yes' ? '' : 'yes')}
          active={list.filters.reported === 'yes'}
        />
      </div>

      {stats?.starDistribution && (
        <RatingOverview
          distribution={stats.starDistribution}
          average={stats.averageRating}
          total={stats.total}
          isAr={isAr}
        />
      )}

      <div dir="ltr" className="grid gap-6 lg:grid-cols-[minmax(260px,280px)_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_400px]">
        <ReviewProductFilterSidebar
          isAr={isAr}
          filters={list.filters}
          onChange={applyProductScope}
        />

        <div className="min-w-0" dir={isAr ? 'rtl' : 'ltr'}>
        <AdminListPage
          isAr={isAr}
          actions={(
            <Button size="sm" variant="secondary" disabled={exporting} onClick={exportCsv}>
              <Download className="h-4 w-4" />
              {isAr ? 'تصدير' : 'Export'}
            </Button>
          )}
          searchPlaceholder={isAr ? 'بحث في التقييمات...' : 'Search reviews...'}
          q={list.q}
          onSearchChange={list.setQ}
          filters={(
            <>
              <ListFilterSelect
                value={list.filters.status}
                onChange={(v) => list.setFilter('status', v)}
                options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: isAr ? o.ar : o.en }))}
                isAr={isAr}
              />
              <ListFilterSelect
                value={list.filters.rating}
                onChange={(v) => list.setFilter('rating', v)}
                options={[
                  { value: '', label: isAr ? 'كل النجوم' : 'All stars' },
                  ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: isAr ? `${r} نجوم` : `${r} stars` })),
                ]}
                isAr={isAr}
              />
              <ListFilterSelect
                value={list.filters.hasReply}
                onChange={(v) => list.setFilter('hasReply', v)}
                options={[
                  { value: '', label: isAr ? 'الرد' : 'Reply' },
                  { value: 'yes', label: isAr ? 'مع رد' : 'With reply' },
                  { value: 'no', label: isAr ? 'بدون رد' : 'No reply' },
                ]}
                isAr={isAr}
              />
              <ListFilterSelect
                value={list.filters.verified}
                onChange={(v) => list.setFilter('verified', v)}
                options={[
                  { value: '', label: isAr ? 'التوثيق' : 'Verified' },
                  { value: 'yes', label: isAr ? 'موثق' : 'Verified' },
                  { value: 'no', label: isAr ? 'غير موثق' : 'Not verified' },
                ]}
                isAr={isAr}
              />
            </>
          )}
          bulkBar={list.selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-primary-100 bg-primary-50 px-4 py-3">
              <span className="text-sm font-medium text-primary-800">{isAr ? `${list.selectedIds.length} محدد` : `${list.selectedIds.length} selected`}</span>
              <Button size="sm" variant="secondary" onClick={() => runBulk('publish', 'تم النشر', 'Published')}>{isAr ? 'نشر' : 'Publish'}</Button>
              <Button size="sm" variant="secondary" onClick={() => runBulk('hide', 'تم الإخفاء', 'Hidden')}>{isAr ? 'إخفاء' : 'Hide'}</Button>
              <Button size="sm" variant="secondary" onClick={() => runBulk('feature', 'تم التمييز', 'Featured')}>{isAr ? 'تمييز' : 'Feature'}</Button>
              <Button size="sm" variant="danger" onClick={() => runBulk('delete', 'تم الحذف', 'Deleted')}>{isAr ? 'حذف' : 'Delete'}</Button>
              <button type="button" className="text-sm text-text-muted" onClick={list.clearSelection}>{isAr ? 'إلغاء' : 'Clear'}</button>
            </div>
          )}
          columns={columns}
          data={list.data}
          loading={list.loading}
          sort={list.sort}
          onSort={list.toggleSort}
          selectable
          selectedIds={list.selectedIds}
          onToggleSelect={list.toggleSelect}
          onToggleSelectAll={list.toggleSelectAll}
          allSelected={list.allSelected}
          onRowClick={(row) => setSelectedReview(row)}
          rowClassName={(row) => (selectedReview && reviewRowKey(row) === reviewRowKey(selectedReview) ? 'bg-primary-50/40' : '')}
          emptyIcon={Star}
          emptyTitle={isAr ? 'لا توجد تقييمات' : 'No reviews'}
          emptyDescription={isAr ? 'ستظهر تقييمات العملاء هنا' : 'Customer reviews will appear here'}
          pagination={list.pagination}
          onPageChange={list.setPage}
        />
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start" dir={isAr ? 'rtl' : 'ltr'}>
          {selectedReview ? (
            <>
              <div className="mb-3 flex items-center gap-2 xl:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text-muted hover:bg-slate-50"
                >
                  {isAr ? '← القائمة' : '← List'}
                </button>
              </div>
              <ReviewDetailPanel
              review={selectedReview}
              isAr={isAr}
              busy={busy}
              replyDraft={replyDraft}
              internalNoteDraft={internalNoteDraft}
              editDraft={editDraft}
              onReplyChange={setReplyDraft}
              onInternalNoteChange={setInternalNoteDraft}
              onEditChange={setEditDraft}
              onClose={() => setSelectedReview(null)}
              onApprove={() => patchReview(selectedReview, { status: 'approved' }, isAr ? 'تم النشر' : 'Published')}
              onHide={() => patchReview(selectedReview, { status: 'hidden' }, isAr ? 'تم الإخفاء' : 'Hidden')}
              onReject={() => patchReview(selectedReview, { status: 'rejected' }, isAr ? 'تم الرفض' : 'Rejected')}
              onRestore={() => patchReview(selectedReview, { status: 'pending' }, isAr ? 'تم الاسترجاع' : 'Restored')}
              onDelete={async () => {
                const ok = await confirm({ title: isAr ? 'حذف' : 'Delete', message: isAr ? 'حذف هذا التقييم؟' : 'Delete this review?', variant: 'danger' });
                if (!ok) return;
                setActionKey(reviewRowKey(selectedReview));
                try {
                  await adminApi.deleteReview(selectedReview.product._id, selectedReview._id);
                  setSelectedReview(null);
                  list.reload();
                  loadStats();
                  refreshStats();
                  toast.success(isAr ? 'تم الحذف' : 'Deleted');
                } finally {
                  setActionKey(null);
                }
              }}
              onSaveReply={() => patchReview(selectedReview, { adminReply: replyDraft.trim() }, isAr ? 'تم حفظ الرد' : 'Reply saved')}
              onSaveInternalNote={() => patchReview(selectedReview, { internalNote: internalNoteDraft }, isAr ? 'تم حفظ الملاحظة' : 'Note saved')}
              onSaveEdit={() => patchReview(selectedReview, {
                rating: Number(editDraft.rating),
                title: editDraft.title,
                comment: editDraft.comment,
              }, isAr ? 'تم التعديل' : 'Review updated')}
              onGrantReReview={() => patchReview(selectedReview, { grantReReview: true }, isAr ? 'يمكن للعميل التقييم مجدداً' : 'Re-review enabled')}
              onTogglePin={() => patchReview(selectedReview, { pinned: !selectedReview.pinned }, isAr ? 'تم تحديث التثبيت' : 'Pin updated')}
              onToggleFeature={() => patchReview(selectedReview, { featured: !selectedReview.featured }, isAr ? 'تم تحديث التمييز' : 'Feature updated')}
              onBlockUser={() => patchReview(selectedReview, { blockUserFromReviews: !selectedReview.user?.reviewBlocked }, isAr ? 'تم تحديث حالة الحظر' : 'Block status updated')}
              />
            </>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                <Star className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-bold text-text">
                {isAr ? 'اختر تقييماً من الجدول' : 'Select a review from the table'}
              </p>
              <p className="mt-1.5 max-w-xs text-xs text-text-muted">
                {isAr
                  ? 'انقر على أي تقييم لعرض التفاصيل الكاملة والرد والإجراءات الإدارية'
                  : 'Click any review to view details, reply, and moderation actions'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
