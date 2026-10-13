import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from '../../app/router';
import { MessageSquareReply, RotateCcw } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { apiError } from '../sellerLabels';
import StatusBadge from '../StatusBadge';
import { EmptyState, PageHeader, TableSkeleton } from '../ui';
import { fmtDateTime } from '../sellerUtils';

const RETURN_STATUS = {
  pending: { ar: 'بانتظار قرار المتجر', en: 'Waiting for decision', tone: 'bg-amber-100 text-amber-900' },
  approved: { ar: 'تمت الموافقة', en: 'Approved', tone: 'bg-emerald-100 text-emerald-800' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'bg-slate-200 text-slate-700' },
};
const CONDITION = {
  unopened: { ar: 'مغلق', en: 'Unopened' },
  opened: { ar: 'مفتوح', en: 'Opened' },
  damaged: { ar: 'تالف', en: 'Damaged' },
};
const TABS = ['', 'pending', 'approved', 'rejected'];

/**
 * Returns of the seller's items. Staff decide and refund (the marketplace owns the customer
 * relationship); the seller follows each one and can add their side of the story.
 */
export default function SellerReturnsPage() {
  const { isAr, refreshSummary } = useOutletContext();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const [data, setData] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    sellerApi.listReturns({ status: status || undefined }).then(({ data: d }) => setData(d)).catch(() => setData({ data: [], counts: {} }));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const save = async (r) => {
    try {
      await sellerApi.noteReturn(r.orderId, r._id, note);
      toast.success(isAr ? 'تم إرسال ردك لفريق المتجر' : 'Your note was sent to the store team');
      setNoteFor(null);
      setNote('');
      load();
      refreshSummary?.();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإرسال' : 'Could not send'));
    }
  };

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={RotateCcw}
        title={isAr ? 'المرتجعات' : 'Returns'}
        description={isAr
          ? 'طلبات إرجاع منتجاتك. يراجعها فريق المتجر ويرد المبلغ للعميل، ويُخصم من رصيدك عند الموافقة. أضف ردك إن كان لديك ما يوضّح الموقف.'
          : 'Return requests for your items. The store team decides and refunds the customer; approved returns are deducted from your balance. Add your side if it helps.'}
      />
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const n = tab ? counts[tab] || 0 : total;
          const on = status === tab;
          return (
            <button key={tab || 'all'} type="button" onClick={() => setSearchParams(tab ? { status: tab } : {})} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${on ? 'bg-indigo-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>
              {tab ? (isAr ? RETURN_STATUS[tab].ar : RETURN_STATUS[tab].en) : (isAr ? 'الكل' : 'All')}
              <span className={`rounded-full px-1.5 text-[11px] ${on ? 'bg-white/20' : 'bg-slate-100'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!data ? <TableSkeleton /> : data.data.length === 0 ? (
          <EmptyState icon={RotateCcw} title={isAr ? 'لا توجد مرتجعات' : 'No returns'} text={isAr ? 'رائع — لا توجد طلبات إرجاع هنا.' : 'Great — no return requests here.'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((r) => (
              <li key={r._id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  {r.image ? <img src={r.image} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" /> : <span className="h-14 w-14 rounded-lg bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.quantity}× {isAr ? r.nameAr : r.nameEn || r.nameAr}</p>
                    <p className="text-xs text-slate-500">
                      <Link to={`/seller-center/orders/${r.shipmentId}`} className="font-semibold text-indigo-700 hover:underline" dir="ltr">{r.shipmentNumber}</Link>
                      {' · '}{fmtDateTime(r.requestedAt, isAr)}
                      {r.itemCondition && ` · ${isAr ? CONDITION[r.itemCondition]?.ar : CONDITION[r.itemCondition]?.en}`}
                    </p>
                    <p className="mt-1 text-sm"><span className="text-slate-500">{isAr ? 'السبب: ' : 'Reason: '}</span>{(isAr ? r.reasonAr : r.reasonEn) || r.reasonAr || r.reasonEn || '—'}</p>
                    {r.customerNote && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm">“{r.customerNote}”</p>}
                    {r.adminNote && <p className="mt-1 text-xs text-slate-600">{isAr ? 'ملاحظة المتجر: ' : 'Store note: '}{r.adminNote}</p>}
                    {r.sellerNote && <p className="mt-1 rounded-lg bg-indigo-50 p-2 text-xs text-indigo-900">{isAr ? 'ردك: ' : 'Your note: '}{r.sellerNote}</p>}
                  </div>
                  <div className="text-end">
                    <StatusBadge map={RETURN_STATUS} value={r.status} isAr={isAr} />
                    <p className="mt-2 text-sm font-semibold tabular-nums">{formatPrice(r.refundAmount || r.lineTotal)}</p>
                    <p className="text-xs text-slate-500">{r.status === 'approved' ? (isAr ? 'خُصم من رصيدك' : 'deducted from your balance') : (isAr ? 'قيمة المرتجع' : 'return value')}</p>
                  </div>
                </div>
                {noteFor === r._id ? (
                  <div className="mt-3 flex flex-wrap gap-2 ps-[4.5rem]">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className="min-w-[16rem] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={isAr ? 'مثال: المنتج شُحن مغلقاً — نرجو إرفاق صور.' : 'e.g. The item shipped sealed — please ask for photos.'} />
                    <div className="flex flex-col gap-2">
                      <button type="button" disabled={!note.trim()} onClick={() => save(r)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'إرسال' : 'Send'}</button>
                      <button type="button" onClick={() => setNoteFor(null)} className="rounded-xl px-4 py-2 text-sm ring-1 ring-slate-200">{isAr ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  </div>
                ) : r.status === 'pending' && (
                  <button type="button" onClick={() => { setNoteFor(r._id); setNote(r.sellerNote || ''); }} className="mt-2 inline-flex items-center gap-1.5 ps-[4.5rem] text-sm font-semibold text-indigo-700 hover:underline">
                    <MessageSquareReply className="h-4 w-4" />{r.sellerNote ? (isAr ? 'تعديل ردك' : 'Edit your note') : (isAr ? 'أضف ردك' : 'Add your side')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
