import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { hasPermission } from '../adminPermissions';
import { apiError } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';

const STATUS = {
  pending: { ar: 'بانتظار الموافقة', en: 'Pending', tone: 'bg-amber-100 text-amber-900' },
  approved: { ar: 'مجدول', en: 'Scheduled', tone: 'bg-sky-100 text-sky-800' },
  active: { ar: 'يعمل', en: 'Running', tone: 'bg-emerald-100 text-emerald-800' },
  ended: { ar: 'انتهى', en: 'Ended', tone: 'bg-slate-200 text-slate-700' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'bg-red-100 text-red-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', tone: 'bg-slate-100 text-slate-600' },
};
const TABS = ['pending', 'approved', 'active', 'ended', 'rejected', 'cancelled'];

/** Staff review of seller-funded promotions; approved ones start on their own schedule. */
export default function SellerPromotionsAdminPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = hasPermission(user, 'sellers:write');
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setItems(null);
    adminApi.listSellerPromotions({ status }).then(({ data }) => setItems(data.data || [])).catch(() => setItems([]));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const review = async (p, decision) => {
    let note = '';
    if (decision === 'reject') {
      note = window.prompt(isAr ? 'سبب الرفض (يظهر للبائع):' : 'Reason (shown to the seller):') || '';
      if (!note.trim()) return;
    }
    setBusy(p._id);
    try {
      await adminApi.reviewSellerPromotion(p._id, { decision, note });
      toast.success(isAr ? 'تم' : 'Done');
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التنفيذ' : 'Action failed'));
    } finally {
      setBusy('');
    }
  };

  const fmt = (d) => new Date(d).toLocaleString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <PageHeader
        description={isAr ? 'خصومات يدفعها البائع من ربحه. بعد موافقتك تبدأ وتنتهي وحدها.' : 'Discounts the seller pays for. Once you approve, they start and stop on their own.'}
      />
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-primary-600 text-white' : 'bg-white ring-1 ring-border'}`}>
            {isAr ? STATUS[s].ar : STATUS[s].en}
          </button>
        ))}
      </div>
      {!items ? <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div> : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">{isAr ? 'لا توجد عروض هنا.' : 'No promotions here.'}</p>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <article key={p._id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50 text-lg font-extrabold text-primary-700">-{p.percent}%</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{p.name} <span className="font-normal text-text-muted">· {p.seller ? (isAr ? p.seller.nameAr : p.seller.nameEn) : ''}</span></p>
                <p className="text-sm text-text-muted">{fmt(p.startsAt)} → {fmt(p.endsAt)}</p>
                <p className="text-xs text-text-muted">
                  {p.scope === 'all' ? (isAr ? 'كل منتجات البائع' : 'All seller products') : p.scope === 'sections' ? (isAr ? `${p.sections.length} قسم` : `${p.sections.length} section(s)`) : (isAr ? `${p.products.length} منتج` : `${p.products.length} product(s)`)}
                  {p.productCount != null && ` · ${isAr ? `${p.productCount} منتج حالياً` : `${p.productCount} products now`}`}
                </p>
                {p.reviewNote && <p className="mt-1 text-xs text-red-700">{p.reviewNote}</p>}
              </div>
              <StatusBadge map={STATUS} value={p.status} isAr={isAr} />
              {canWrite && p.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === p._id} onClick={() => review(p, 'approve')}><CheckCircle2 className="h-4 w-4" />{isAr ? 'موافقة' : 'Approve'}</Button>
                  <Button size="sm" variant="danger" disabled={busy === p._id} onClick={() => review(p, 'reject')}><XCircle className="h-4 w-4" />{isAr ? 'رفض' : 'Reject'}</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
