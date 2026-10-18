import { useCallback, useEffect, useState } from 'react';
import { Phone, MessageCircle, CheckCircle2, Undo2, PhoneCall } from 'lucide-react';
import { adminApi } from '../adminApi';
import Pagination from './Pagination';
import { useToast } from './Toast';
import { formatPrice, formatRelativeTime } from '../../utils/formatters';
import { normalizePhoneIntl } from '../../pages/driver/driverUtils';

const SHOWN_ITEMS = 3;

const CONTACTED_OPTIONS = [
  { value: 'no', ar: 'لم يتم التواصل', en: 'Not called yet' },
  { value: 'yes', ar: 'تم التواصل', en: 'Called' },
  { value: '', ar: 'الكل', en: 'All' },
];

const IDLE_OPTIONS = [
  { value: 0, ar: 'أي وقت (حتى أثناء التسوق)', en: 'Any time (incl. still shopping)' },
  { value: 0.25, ar: 'متروكة منذ 15 دقيقة+', en: 'Idle 15 min+' },
  { value: 1, ar: 'متروكة منذ ساعة+', en: 'Idle 1h+' },
  { value: 6, ar: 'منذ 6 ساعات+', en: 'Idle 6h+' },
  { value: 24, ar: 'منذ يوم+', en: 'Idle 1 day+' },
];

const selectCls = 'rounded-xl border border-border bg-white px-3 py-2 text-sm';

function whatsappLink(phone, name, isAr) {
  const n = normalizePhoneIntl(phone);
  if (!n) return '';
  const first = String(name || '').split(' ')[0];
  const text = isAr
    ? `مرحباً ${first}، لاحظنا أن لديك منتجات في سلتك. هل يمكننا مساعدتك في إكمال طلبك؟`
    : `Hi ${first}, we noticed you left some items in your cart. Can we help you complete your order?`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

function ItemsSummary({ items, isAr }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, SHOWN_ITEMS);
  const name = (i) => {
    const base = (isAr ? i.nameAr : i.nameEn) || i.nameAr || i.nameEn || '—';
    const variant = isAr ? i.variantLabelAr : i.variantLabelEn;
    return variant ? `${base} (${variant})` : base;
  };
  return (
    <div className="text-xs">
      {shown.map((i) => (
        <p key={`${i.productId}-${i.variantLabelEn}`} className="truncate">
          <span className="tabular-nums text-text-muted">{i.quantity}×</span> {name(i)}
        </p>
      ))}
      {items.length > SHOWN_ITEMS && (
        <button type="button" onClick={() => setOpen(!open)} className="font-semibold text-primary-700 hover:underline">
          {open ? (isAr ? 'عرض أقل' : 'Show less') : (isAr ? `+${items.length - SHOWN_ITEMS} أخرى` : `+${items.length - SHOWN_ITEMS} more`)}
        </button>
      )}
    </div>
  );
}

/**
 * Customers with an idle cart right now, with call / WhatsApp buttons and a "called" mark so
 * staff don't phone the same customer twice. Works whether or not automatic reminders are on.
 */
export default function CartFollowUps({ isAr }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [capped, setCapped] = useState(false);
  const [stillShopping, setStillShopping] = useState(0);
  const [contacted, setContacted] = useState('no');
  const [minIdleHours, setMinIdleHours] = useState(1);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getCartFollowUps({ contacted, minIdleHours, sort, page, limit: 15 });
      setRows(data.data || []);
      setPagination(data.pagination || null);
      setCapped(Boolean(data.capped));
      setStillShopping(Number(data.stillShopping) || 0);
    } catch {
      setStillShopping(0);
      setRows([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [contacted, minIdleHours, sort, page]);

  useEffect(() => { load(); }, [load]);

  const filter = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const mark = async (row, value) => {
    setBusyId(row.userId);
    try {
      await adminApi.setCartFollowUp(row.userId, { contacted: value });
      toast.success(value
        ? (isAr ? `تم تسجيل التواصل مع ${row.user.name}` : `Marked ${row.user.name} as called`)
        : (isAr ? 'تم إلغاء العلامة' : 'Mark removed'));
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><PhoneCall className="h-5 w-5" /></span>
          <div>
            <h2 className="font-bold">{isAr ? 'سلال للمتابعة بالهاتف' : 'Carts to follow up'}</h2>
            <p className="text-sm text-text-muted">
              {isAr
                ? 'عملاء مسجلون تركوا منتجات في السلة ولم يطلبوا بعد. اتصل بهم ثم علّمهم كـ "تم التواصل".'
                : 'Signed-in customers who left items in their cart and haven\'t ordered. Call them, then mark them as called.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={contacted} onChange={filter(setContacted)} className={selectCls} aria-label={isAr ? 'حالة التواصل' : 'Call status'}>
            {CONTACTED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{isAr ? o.ar : o.en}</option>)}
          </select>
          <select value={minIdleHours} onChange={filter((v) => setMinIdleHours(Number(v)))} className={selectCls} aria-label={isAr ? 'مدة الترك' : 'Idle for'}>
            {IDLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{isAr ? o.ar : o.en}</option>)}
          </select>
          <select value={sort} onChange={filter(setSort)} className={selectCls} aria-label={isAr ? 'الترتيب' : 'Sort'}>
            <option value="recent">{isAr ? 'الأحدث أولاً' : 'Most recent first'}</option>
            <option value="value">{isAr ? 'الأعلى قيمة أولاً' : 'Highest value first'}</option>
          </select>
        </div>
      </div>

      {!loading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
          {contacted === 'no'
            ? (isAr ? 'لا يوجد عملاء بانتظار اتصال الآن.' : 'Nobody waiting for a call right now.')
            : (isAr ? 'لا توجد سلال مطابقة.' : 'No matching carts.')}
        </p>
      ) : (
        <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-text-muted">
              <tr className="border-b border-border">
                <th className="py-2 text-start font-medium">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="py-2 text-start font-medium">{isAr ? 'في السلة' : 'In the cart'}</th>
                <th className="py-2 text-end font-medium">{isAr ? 'القيمة' : 'Value'}</th>
                <th className="py-2 text-start font-medium ps-4">{isAr ? 'آخر نشاط' : 'Last activity'}</th>
                <th className="py-2 text-end font-medium">{isAr ? 'تواصل' : 'Contact'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const wa = row.user.phone ? whatsappLink(row.user.phone, row.user.name, isAr) : '';
                return (
                  <tr key={row.userId} className="border-b border-border align-top last:border-0">
                    <td className="py-3 pe-3">
                      <p className="font-semibold">{row.user.name || '—'}</p>
                      {row.user.phone
                        ? <a href={`tel:${row.user.phone}`} className="text-xs text-primary-700 hover:underline" dir="ltr">{row.user.phone}</a>
                        : <p className="text-xs text-text-muted">{isAr ? 'لا يوجد رقم' : 'No phone'}</p>}
                      {row.user.email && <p className="text-xs text-text-muted" dir="ltr">{row.user.email}</p>}
                    </td>
                    <td className="max-w-[240px] py-3 pe-3"><ItemsSummary items={row.items} isAr={isAr} /></td>
                    <td className="py-3 text-end tabular-nums">
                      <span className="font-semibold">{formatPrice(row.cartValue)}</span>
                      <span className="block text-xs text-text-muted">{row.itemCount} {isAr ? 'منتج' : 'items'}</span>
                    </td>
                    <td className="py-3 ps-4 text-xs">
                      <p>{formatRelativeTime(row.lastActivityAt, isAr)}</p>
                      {row.remindersSent > 0 && (
                        <p className="text-text-muted">{isAr ? `أُرسل ${row.remindersSent} تذكير تلقائي` : `${row.remindersSent} auto reminder${row.remindersSent > 1 ? 's' : ''} sent`}</p>
                      )}
                      {row.followUp && (
                        <p className={row.contacted ? 'font-semibold text-emerald-700' : 'text-text-muted'}>
                          {row.contacted
                            ? (isAr ? 'تم الاتصال' : 'Called')
                            : (isAr ? 'اتصال سابق' : 'Previously called')}
                          {' '}{formatRelativeTime(row.followUp.contactedAt, isAr)}
                          {row.followUp.contactedByName ? ` · ${row.followUp.contactedByName}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {row.user.phone && (
                          <a href={`tel:${row.user.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface">
                            <Phone className="h-3.5 w-3.5" />{isAr ? 'اتصال' : 'Call'}
                          </a>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                            <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                          </a>
                        )}
                        {row.contacted ? (
                          <button type="button" disabled={busyId === row.userId} onClick={() => mark(row, false)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface">
                            <Undo2 className="h-3.5 w-3.5" />{isAr ? 'تراجع' : 'Undo'}
                          </button>
                        ) : (
                          <button type="button" disabled={busyId === row.userId} onClick={() => mark(row, true)} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                            <CheckCircle2 className="h-3.5 w-3.5" />{isAr ? 'تم الاتصال' : 'Mark called'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {stillShopping > 0 && minIdleHours > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>
            {isAr
              ? `${stillShopping} عميل عدّل سلته مؤخراً (منذ أقل من ${minIdleHours >= 1 ? `${minIdleHours} ساعة` : '15 دقيقة'}) وقد يكون ما زال يتسوق، لذلك لا يظهر هنا.`
              : `${stillShopping} customer${stillShopping > 1 ? 's' : ''} changed their cart less than ${minIdleHours >= 1 ? `${minIdleHours}h` : '15 min'} ago and may still be shopping, so they're hidden.`}
          </span>
          <button type="button" onClick={() => { setMinIdleHours(0); setPage(1); }} className="font-semibold underline hover:no-underline">
            {isAr ? 'اعرضهم' : 'Show them'}
          </button>
        </div>
      )}
      {capped && (
        <p className="mt-3 text-xs text-text-muted">{isAr ? 'تُعرض أحدث 1000 سلة فقط.' : 'Only the 1000 most recent carts are checked.'}</p>
      )}
      {pagination && (
        <Pagination
          className="mt-4"
          page={pagination.page}
          pages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
          isAr={isAr}
        />
      )}
    </section>
  );
}
