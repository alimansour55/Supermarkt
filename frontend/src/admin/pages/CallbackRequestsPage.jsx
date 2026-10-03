import { useEffect, useState } from 'react';
import { Phone, Check, X, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { normalizePhoneTel } from '../../utils/contactInfo';

const STATUSES = ['pending', 'contacted', 'closed'];

const STATUS_LABEL = {
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  contacted: { ar: 'تم الاتصال', en: 'Contacted' },
  closed: { ar: 'مغلق', en: 'Closed' },
};

function fmtDate(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function CallbackRequestsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();

  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = (nextStatus = status) => {
    setLoading(true);
    adminApi.listCallbackRequests({ status: nextStatus, limit: 50 })
      .then(({ data }) => {
        setItems(data.data || []);
        setStats(data.stats || {});
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل الطلبات' : 'Could not load requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('pending');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeStatus = (next) => {
    setStatus(next);
    load(next);
  };

  const updateRequest = async (id, nextStatus) => {
    setBusyId(id);
    try {
      await adminApi.updateCallbackRequest(id, { status: nextStatus });
      toast.success(isAr ? 'تم التحديث' : 'Updated');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر التحديث' : 'Update failed'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="grid gap-4 sm:grid-cols-3">
        {STATUSES.map((s) => (
          <article key={s} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-muted">
              <Phone className="h-5 w-5 text-primary-700" />
              <span className="text-sm">{isAr ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</span>
            </div>
            <p className="mt-3 text-2xl font-extrabold">{(stats[s] ?? 0).toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">{isAr ? 'طلبات الاتصال' : 'Callback requests'}</h2>
          <div className="flex gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-primary-600 text-white' : 'bg-surface text-text'}`}
              >
                {isAr ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center"><Loader size="lg" /></div>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
            {isAr ? 'لا توجد طلبات في هذه الحالة.' : 'No requests in this state.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {r.name}
                      <a href={normalizePhoneTel(r.phone)} className="ms-2 text-sm font-semibold text-primary-700 hover:underline" dir="ltr">
                        {r.phone}
                      </a>
                    </p>
                    {r.note && <p className="mt-1 text-sm text-text-muted">{r.note}</p>}
                    <p className="mt-1 text-xs text-text-muted">
                      {fmtDate(r.createdAt, isAr)}
                      {' · '}
                      {r.source === 'assistant' ? (isAr ? 'من المساعد الذكي' : 'via assistant') : (isAr ? 'من صفحة اتصل بنا' : 'via contact page')}
                      {r.user && ` · ${isAr ? 'عميل مسجّل' : 'registered customer'}`}
                    </p>
                    {r.handledBy?.name && (
                      <p className="text-xs text-text-muted">
                        {isAr ? 'بواسطة' : 'by'} {r.handledBy.name} · {fmtDate(r.handledAt, isAr)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.status === 'pending' && (
                      <>
                        <Button type="button" size="sm" disabled={busyId === r.id} onClick={() => updateRequest(r.id, 'contacted')}>
                          <Check className="h-4 w-4" />{isAr ? 'تم الاتصال' : 'Mark contacted'}
                        </Button>
                        <Button type="button" size="sm" variant="danger" disabled={busyId === r.id} onClick={() => updateRequest(r.id, 'closed')}>
                          <X className="h-4 w-4" />{isAr ? 'إغلاق' : 'Close'}
                        </Button>
                      </>
                    )}
                    {r.status !== 'pending' && (
                      <Button type="button" size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => updateRequest(r.id, 'pending')}>
                        <RotateCcw className="h-4 w-4" />{isAr ? 'إعادة فتح' : 'Reopen'}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
