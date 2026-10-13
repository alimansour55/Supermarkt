import { useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext } from '../../app/router';
import { History } from 'lucide-react';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { EmptyState, PageHeader, Segmented, TableSkeleton } from '../ui';

const ACTIONS = {
  'product.create': { ar: 'أضاف منتجاً', en: 'added a product' },
  'product.update': { ar: 'عدّل منتجاً', en: 'edited a product' },
  'product.stock': { ar: 'غيّر المخزون', en: 'changed stock' },
  'product.submit': { ar: 'أرسل منتجاً للمراجعة', en: 'submitted a product' },
  'product.pause': { ar: 'أوقف منتجاً', en: 'paused a product' },
  'product.unpause': { ar: 'أعاد تشغيل منتج', en: 'resumed a product' },
  'product.delete': { ar: 'حذف منتجاً', en: 'deleted a product' },
  'product.duplicate': { ar: 'نسخ منتجاً', en: 'duplicated a product' },
  'product.import': { ar: 'استورد منتجات', en: 'imported products' },
  'inventory.update': { ar: 'حدّث السعر/المخزون', en: 'updated price/stock' },
  'order.status': { ar: 'غيّر حالة طلب', en: 'updated an order' },
  'store.profile': { ar: 'عدّل بيانات المتجر', en: 'edited the store profile' },
  'store.bank': { ar: 'غيّر بيانات البنك', en: 'changed bank details' },
  'team.add': { ar: 'أضاف موظفاً', en: 'added a team member' },
  'team.update': { ar: 'عدّل موظفاً', en: 'updated a team member' },
  'security.login': { ar: 'سجّل الدخول', en: 'signed in' },
  'security.password_change': { ar: 'غيّر كلمة المرور', en: 'changed their password' },
  'security.password_reset': { ar: 'أعاد تعيين كلمة المرور', en: 'reset their password' },
  'security.2fa_on': { ar: 'فعّل التحقق بخطوتين', en: 'turned on 2-step verification' },
  'security.2fa_off': { ar: 'أوقف التحقق بخطوتين', en: 'turned off 2-step verification' },
  'security.sign_out_all': { ar: 'سجّل الخروج من كل الأجهزة', en: 'signed out everywhere' },
};

const FIELD = { price: { ar: 'السعر', en: 'Price', money: true }, oldPrice: { ar: 'قبل الخصم', en: 'Was', money: true }, stock: { ar: 'المخزون', en: 'Stock' }, nameEn: { ar: 'الاسم (EN)', en: 'Name (EN)' }, nameAr: { ar: 'الاسم (ع)', en: 'Name (AR)' }, status: { ar: 'الحالة', en: 'Status' } };

/** Readable details: "Price 200 → 180". */
function Details({ details, isAr }) {
  if (!details || typeof details !== 'object') return null;
  const parts = Object.entries(details).map(([key, v]) => {
    const f = FIELD[key];
    const fmt = (x) => (x == null || x === '' ? '—' : f?.money ? formatPrice(x) : Array.isArray(x) ? x.join(', ') : String(x));
    const name = f ? (isAr ? f.ar : f.en) : key;
    if (Array.isArray(v) && v.length === 2 && f) return `${name}: ${fmt(v[0])} → ${fmt(v[1])}`;
    return `${name}: ${fmt(v)}`;
  });
  return <p className="mt-0.5 text-xs text-slate-500" dir="auto">{parts.join(' · ')}</p>;
}

const linkFor = (a) => (a.entityType === 'product' && a.action !== 'product.delete' ? `/seller-center/products/${a.entityId}`
  : a.entityType === 'shipment' ? `/seller-center/orders/${a.entityId}` : null);

/** Owner-only: everything the team did in Seller Center, newest first. */
export default function SellerActivityPage() {
  const { isAr, me } = useOutletContext();
  const [area, setArea] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const isOwner = me.user.role === 'seller_owner';

  useEffect(() => {
    if (!isOwner) return;
    sellerApi.listActivity({ area: area || undefined, page, limit: 40 }).then(({ data: d }) => setData(d)).catch(() => setData({ data: [], pagination: { pages: 1 } }));
  }, [area, page, isOwner]);

  if (!isOwner) return <Navigate to="/seller-center" replace />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={History} title={isAr ? 'سجل النشاط' : 'Activity log'} description={isAr ? 'كل ما قام به فريقك في مركز البائعين خلال آخر سنة.' : 'Everything your team did in Seller Center over the last year.'} />
      <div className="mb-4 overflow-x-auto">
        <Segmented
          options={[
            { value: '', label: isAr ? 'الكل' : 'All' },
            { value: 'product', label: isAr ? 'المنتجات' : 'Products' },
            { value: 'inventory', label: isAr ? 'المخزون' : 'Inventory' },
            { value: 'order', label: isAr ? 'الطلبات' : 'Orders' },
            { value: 'store', label: isAr ? 'المتجر' : 'Store' },
            { value: 'team', label: isAr ? 'الفريق' : 'Team' },
            { value: 'security', label: isAr ? 'الأمان' : 'Security' },
          ]}
          value={area}
          onChange={(v) => { setPage(1); setData(null); setArea(v); }}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!data ? <TableSkeleton /> : data.data.length === 0 ? (
          <EmptyState icon={History} title={isAr ? 'لا يوجد نشاط بعد' : 'No activity yet'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((a) => {
              const meta = ACTIONS[a.action];
              const to = linkFor(a);
              const label = a.label && (to ? <Link to={to} className="font-semibold text-indigo-700 hover:underline">{a.label}</Link> : <span className="font-semibold">{a.label}</span>);
              return (
                <li key={a._id} className="flex gap-3 px-5 py-3 text-sm">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{(a.actorName || '?').slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p><span className="font-semibold">{a.actorName || (isAr ? 'النظام' : 'System')}</span> {meta ? (isAr ? meta.ar : meta.en) : a.action} {label}</p>
                    <Details details={a.details} isAr={isAr} />
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(a.createdAt).toLocaleString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {data?.pagination?.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
          <span>{page} / {data.pagination.pages}</span>
          <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
        </div>
      )}
    </div>
  );
}
