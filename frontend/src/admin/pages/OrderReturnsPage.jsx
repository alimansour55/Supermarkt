import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminStats } from '../context/AdminStatsContext';
import { useToast } from '../components';
import ReturnRequestCard from '../components/returns/ReturnRequestCard';
import { isRejectNoteValid } from '../../constants/returnRejectReasons';
import { scrollToTop } from '../../utils/scrollToTop';

const TABS = [
  { id: '', labelAr: 'الكل', labelEn: 'All' },
  { id: 'pending', labelAr: 'بانتظار الموافقة', labelEn: 'Pending' },
  { id: 'approved', labelAr: 'موافق عليها', labelEn: 'Approved' },
  { id: 'rejected', labelAr: 'مرفوضة', labelEn: 'Rejected' },
];

export default function OrderReturnsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const { refreshStats } = useAdminStats();

  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [updatingId, setUpdatingId] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (opts = {}) => {
    const filter = opts.statusFilter ?? statusFilter;
    const pageNum = opts.page ?? page;
    setLoading(true);
    setLoadError('');
    try {
      const { data: res } = await adminApi.getReturns({
        page: pageNum,
        limit: 20,
        ...(filter ? { status: filter } : {}),
        ...(debouncedQ ? { q: debouncedQ } : {}),
      });
      setData(res.data || []);
      setStats(res.stats || { pending: 0, approved: 0, rejected: 0, all: 0 });
      setPagination(res.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      setData([]);
      setStats({ pending: 0, approved: 0, rejected: 0, all: 0 });
      const msg = err.response?.data?.message || err.message || '';
      setLoadError(
        err.code === 'ECONNABORTED' || msg === 'Network Error'
          ? (isAr ? 'تعذّر الاتصال بالخادم — شغّل الـ backend على المنفذ 5001' : 'Cannot reach API — start backend on port 5001')
          : (msg || (isAr ? 'فشل تحميل المرتجعات' : 'Failed to load returns')),
      );
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedQ, isAr]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedQ]);

  const handleTabChange = (tabId) => {
    setStatusFilter(tabId);
    scrollToTop();
  };

  const handleReview = useCallback(async (row, action) => {
    const returnId = String(row._id);
    const note = (reviewNotes[returnId] || reviewNotes[row._id] || '').trim();
    if (action === 'reject' && !isRejectNoteValid(note)) {
      toast.error(
        isAr
          ? 'يرجى كتابة سبب الرفض أو اختيار أحد الأسباب المقترحة'
          : 'Please enter a rejection reason or pick a suggested reason',
      );
      return;
    }
    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    setUpdatingId(returnId);
    try {
      const { data } = await adminApi.reviewReturn(row.orderId, returnId, {
        action,
        adminNote: note,
      });

      const updatedReturn = data.order?.returns?.find(
        (r) => String(r._id) === returnId,
      );

      setHighlightedId(returnId);
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[returnId];
        delete next[row._id];
        return next;
      });

      // Stay on "All" so the row stays visible with its new status (not hidden by Pending filter)
      setStatusFilter('');
      setPage(1);

      setData((prev) => prev.map((r) => (
        String(r._id) === returnId
          ? {
            ...r,
            status: nextStatus,
            adminNote: updatedReturn?.adminNote ?? r.adminNote,
            refundAmount: updatedReturn?.refundAmount ?? r.refundAmount,
          }
          : r
      )));

      await load({ statusFilter: '', page: 1 });

      toast.success(
        action === 'approve'
          ? (isAr ? 'تمت الموافقة — الطلب ما زال في القائمة (الكل)' : 'Approved — still listed under All')
          : (isAr ? 'تم الرفض — الطلب ما زال في القائمة (الكل)' : 'Rejected — still listed under All'),
      );

      refreshStats();
      scrollToTop();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل التحديث' : 'Update failed'));
      await load({ statusFilter: '', page: 1 });
    } finally {
      setUpdatingId(null);
    }
  }, [isAr, load, refreshStats, reviewNotes, toast]);

  const handleRejectedAction = useCallback(async (row, action) => {
    const returnId = String(row._id);
    const note = (reviewNotes[returnId] || reviewNotes[row._id] || '').trim();
    if (action === 'reject' && !isRejectNoteValid(note)) {
      toast.error(
        isAr
          ? 'يرجى كتابة سبب الرفض أو اختيار أحد الأسباب المقترحة'
          : 'Please enter a rejection reason or pick a suggested reason',
      );
      return;
    }

    const nextStatus = action === 'approve' ? 'approved' : action === 'reopen' ? 'pending' : 'rejected';
    setUpdatingId(returnId);
    try {
      const { data } = await adminApi.reviewReturn(row.orderId, returnId, {
        action,
        adminNote: note,
      });

      const updatedReturn = data.order?.returns?.find(
        (r) => String(r._id) === returnId,
      );

      setHighlightedId(returnId);
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[returnId];
        delete next[row._id];
        return next;
      });

      if (action === 'reopen') {
        setStatusFilter('pending');
      } else {
        setStatusFilter('');
      }
      setPage(1);

      setData((prev) => prev.map((r) => (
        String(r._id) === returnId
          ? {
            ...r,
            status: nextStatus,
            adminNote: updatedReturn?.adminNote ?? r.adminNote,
            refundAmount: updatedReturn?.refundAmount ?? r.refundAmount,
          }
          : r
      )));

      await load({ statusFilter: action === 'reopen' ? 'pending' : '', page: 1 });

      const successMsg = {
        reject: isAr ? 'تم تحديث سبب الرفض' : 'Rejection reason updated',
        approve: isAr ? 'تمت الموافقة على الإرجاع' : 'Return approved',
        reopen: isAr ? 'تم إعادة الطلب للمراجعة — تبويب بانتظار الموافقة' : 'Sent back to pending review',
      };
      toast.success(successMsg[action] || successMsg.reject);

      refreshStats();
      scrollToTop();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل التحديث' : 'Update failed'));
      await load();
    } finally {
      setUpdatingId(null);
    }
  }, [isAr, load, refreshStats, reviewNotes, toast]);

  const handleFulfillment = useCallback(async (row, fulfillmentStatus) => {
    const returnId = String(row._id);
    setUpdatingId(returnId);
    try {
      await adminApi.updateReturnFulfillment(row.orderId, returnId, fulfillmentStatus);
      toast.success(
        fulfillmentStatus === 'completed'
          ? (isAr ? 'تم الاسترجاع — تم تحديث الطلب في «الطلبات»' : 'Returned — order synced in Orders')
          : (isAr ? 'تم تحديث مرحلة الاسترجاع' : 'Return stage updated'),
      );
      setHighlightedId(returnId);
      await load({ statusFilter: '', page: 1 });
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل التحديث' : 'Update failed'));
    } finally {
      setUpdatingId(null);
    }
  }, [isAr, load, refreshStats, toast]);

  const tabCount = (tabId) => {
    if (!tabId) return stats.all;
    return stats[tabId] ?? 0;
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-bold text-text">
            <RotateCcw className="h-4 w-4 text-primary-600" />
            {isAr ? 'إدارة المرتجعات' : 'Returns management'}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'pending', color: 'bg-amber-100 text-amber-900' },
              { key: 'approved', color: 'bg-green-100 text-green-900' },
              { key: 'rejected', color: 'bg-red-100 text-red-900' },
            ].map(({ key, color }) => (
              <span key={key} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${color}`}>
                {tabCount(key)}
                {' '}
                {TABS.find((t) => t.id === key)?.[isAr ? 'labelAr' : 'labelEn']}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isAr ? 'بحث برقم الطلب، العميل، المنتج...' : 'Search order #, customer, product...'}
              className="w-full rounded-lg border border-border py-1.5 ps-8 pe-2.5 text-sm"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const active = statusFilter === tab.id;
            const count = tabCount(tab.id);
            return (
              <button
                key={tab.id || 'all'}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={[
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                  active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 text-text-muted hover:bg-slate-200',
                ].join(' ')}
              >
                {isAr ? tab.labelAr : tab.labelEn}
                <span className="ms-1 opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4 text-sm text-red-900"
        >
          <p className="font-bold">{isAr ? 'تعذّر تحميل القائمة' : 'Could not load returns'}</p>
          <p className="mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-10 text-center">
          <RotateCcw className="mx-auto h-8 w-8 text-text-muted/40" />
          <p className="mt-2 text-sm font-medium text-text-muted">
            {isAr ? 'لا توجد طلبات إرجاع' : 'No return requests'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((row) => {
            const rowId = String(row._id);
            return (
            <ReturnRequestCard
              key={rowId}
              row={row}
              isAr={isAr}
              updating={updatingId === rowId}
              highlighted={highlightedId === rowId}
              reviewNote={reviewNotes[rowId] || ''}
              onReviewNoteChange={(v) => setReviewNotes((prev) => ({ ...prev, [rowId]: v }))}
              onApprove={() => handleReview(row, 'approve')}
              onReject={() => handleReview(row, 'reject')}
              onRejectedAction={(action) => handleRejectedAction(row, action)}
              onFulfillmentChange={(status) => handleFulfillment(row, status)}
            />
          );})}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => { setPage((p) => p - 1); scrollToTop(); }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {isAr ? 'السابق' : 'Prev'}
          </button>
          <span className="px-2 py-1.5 text-sm text-text-muted">
            {page} / {pagination.pages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() => { setPage((p) => p + 1); scrollToTop(); }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
