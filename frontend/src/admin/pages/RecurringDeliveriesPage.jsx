import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useConfirm, useToast } from '../components';
import RecurringDetailPanel from '../components/RecurringDetailPanel';
import RecurringListPanel from '../components/recurring/RecurringListPanel';
import { Skeleton } from '../components/Skeleton';
import Loader from '../../components/ui/Loader';
import { formatCount, formatPrice } from '../../utils/formatters';
import { scrollToTop } from '../../utils/scrollToTop';

export default function RecurringDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('active');
  const [due, setDue] = useState('');
  const [frequency, setFrequency] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const loadList = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.getRecurringDeliveries({
        status: status || undefined,
        due: due || undefined,
        frequency: frequency || undefined,
        search: search || undefined,
      }),
      adminApi.getRecurringStats(),
    ])
      .then(([listRes, statsRes]) => {
        setItems(listRes.data.data || []);
        setStats(statsRes.data.data || null);
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل التوصيل الدوري' : 'Could not load recurring deliveries'))
      .finally(() => setLoading(false));
  }, [status, due, frequency, search, isAr, toast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const { data } = await adminApi.getRecurringDelivery(id);
      setSelected(data.data);
    } catch {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !selectedId && items.length > 0) {
      setSelectedId(items[0]._id);
      loadDetail(items[0]._id);
    }
  }, [loading, items, selectedId, loadDetail]);

  const handleSelect = (sub) => {
    setSelectedId(sub._id);
    setMobileShowDetail(true);
    loadDetail(sub._id);
    scrollToTop();
  };

  const handleBack = () => {
    setMobileShowDetail(false);
  };

  const refreshAll = async (id = selectedId) => {
    loadList();
    if (id) await loadDetail(id);
  };

  const handleAction = async (action) => {
    if (!selectedId) return;
    if (action === 'cancel') {
      const ok = await confirm({
        title: isAr ? 'إلغاء الاشتراك؟' : 'Cancel subscription?',
        message: isAr ? 'لن يتلقى العميل توصيلات دورية بعد الآن.' : 'Customer will no longer receive recurring deliveries.',
        confirmLabel: isAr ? 'إلغاء الاشتراك' : 'Cancel subscription',
        variant: 'danger',
      });
      if (!ok) return;
    }
    if (action === 'advance') {
      const ok = await confirm({
        title: isAr ? 'تأكيد التوصيل؟' : 'Confirm delivery?',
        message: isAr
          ? 'سيتم تسجيل التوصيل الحالي وتحديد موعد التوصيل التالي تلقائياً.'
          : 'Current delivery will be marked fulfilled and the next date scheduled.',
        confirmLabel: isAr ? 'تم التوصيل' : 'Mark delivered',
      });
      if (!ok) return;
    }

    setUpdating(true);
    try {
      if (action === 'pause') await adminApi.pauseRecurringDelivery(selectedId);
      if (action === 'resume') await adminApi.resumeRecurringDelivery(selectedId);
      if (action === 'cancel') await adminApi.cancelRecurringDelivery(selectedId);
      if (action === 'advance') await adminApi.advanceRecurringDelivery(selectedId);
      toast.success(isAr ? 'تم التحديث' : 'Updated');
      await refreshAll(selectedId);
    } catch {
      toast.error(isAr ? 'فشلت العملية' : 'Action failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNotes = async (adminNotes) => {
    if (!selectedId) return;
    setUpdating(true);
    try {
      await adminApi.updateRecurringDelivery(selectedId, { adminNotes });
      toast.success(isAr ? 'تم حفظ الملاحظات' : 'Notes saved');
      await refreshAll(selectedId);
    } catch {
      toast.error(isAr ? 'تعذر الحفظ' : 'Save failed');
    } finally {
      setUpdating(false);
    }
  };

  const rows = useMemo(() => items.map((sub) => ({
    ...sub,
    subtotal: sub.subtotal ?? (sub.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0),
  })), [items]);

  const statsLoading = loading && !stats;

  const statChips = [
    {
      key: 'active',
      label: isAr ? 'نشط' : 'Active',
      value: formatCount(stats?.active ?? 0),
      icon: RefreshCw,
      tone: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-emerald-200/60',
      active: status === 'active' && !due,
      onClick: () => { setStatus('active'); setDue(''); scrollToTop(); },
    },
    {
      key: 'dueToday',
      label: isAr ? 'مستحق اليوم' : 'Due today',
      value: formatCount(stats?.dueToday ?? 0),
      icon: CalendarClock,
      tone: 'bg-violet-50 text-violet-800 hover:bg-violet-100 ring-violet-200/60',
      active: due === 'today',
      onClick: () => { setStatus('active'); setDue('today'); scrollToTop(); },
    },
    {
      key: 'overdue',
      label: isAr ? 'متأخر' : 'Overdue',
      value: formatCount(stats?.overdue ?? 0),
      icon: AlertTriangle,
      tone: 'bg-amber-50 text-amber-900 hover:bg-amber-100 ring-amber-200/60',
      active: due === 'overdue',
      onClick: () => { setStatus('active'); setDue('overdue'); scrollToTop(); },
    },
    {
      key: 'pipeline',
      label: isAr ? 'قيمة نشطة' : 'Active value',
      value: formatPrice(stats?.pipelineValue ?? 0),
      icon: TrendingUp,
      tone: 'bg-primary-50 text-primary-800 ring-primary-200/60',
      isMoney: true,
    },
  ];

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 px-0.5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
            <RefreshCw className="h-6 w-6 text-primary-600" aria-hidden />
            {isAr ? 'إدارة التوصيل الدوري' : 'Recurring delivery'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            {isAr
              ? 'إدارة اشتراكات التوصيل المتكرر — جداول العملاء، المواعيد القادمة، وإتمام الدورات.'
              : 'Manage repeat delivery subscriptions — schedules, upcoming runs, and fulfillment.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {statChips.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClick}
                disabled={!chip.onClick}
                className={[
                  'inline-flex min-w-[7.5rem] items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-start shadow-sm transition-all',
                  chip.tone,
                  chip.active ? 'border-transparent ring-2 ring-inset' : 'border-border/60',
                  chip.onClick ? 'cursor-pointer hover:shadow' : 'cursor-default',
                ].join(' ')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60">
                  <Icon className="h-4 w-4 opacity-80" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{chip.label}</p>
                  {statsLoading ? (
                    <Skeleton className="mt-1 h-4 w-10" />
                  ) : (
                    <p className="text-base font-bold tabular-nums leading-tight">{chip.value}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <RecurringListPanel
          isAr={isAr}
          items={rows}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          status={status}
          onStatusChange={setStatus}
          due={due}
          onDueChange={setDue}
          frequency={frequency}
          onFrequencyChange={setFrequency}
          onClearAdvanced={() => { setDue(''); setFrequency(''); }}
          onRefresh={loadList}
          className={mobileShowDetail ? 'hidden lg:flex' : 'flex'}
        />

        <div
          className={[
            'min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-slate-50/60 to-slate-50/20 scrollbar-thin',
            !mobileShowDetail ? 'hidden lg:flex' : 'flex',
          ].join(' ')}
        >
          {selectedId && (
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text-muted hover:bg-slate-50"
              >
                {isAr ? '← القائمة' : '← List'}
              </button>
              <span className="truncate text-sm font-bold text-text">
                {selected?.customerName || (isAr ? 'تفاصيل الاشتراك' : 'Subscription details')}
              </span>
            </div>
          )}

          <div className="flex-1 p-4 lg:p-6">
            {loading && !selected ? (
              <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
                <Loader />
              </div>
            ) : !selected && !detailLoading && items.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <CalendarClock className="h-8 w-8" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-text">
                  {isAr ? 'لا توجد اشتراكات' : 'No subscriptions here'}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-text-muted">
                  {isAr
                    ? 'لا توجد اشتراكات مطابقة للفلاتر الحالية. جرّب تغيير الفلاتر أو البحث.'
                    : 'Nothing matches the current filters. Try adjusting the filters or search.'}
                </p>
              </div>
            ) : !selected && !detailLoading ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                  <CalendarClock className="h-8 w-8" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-text">
                  {isAr ? 'اختر اشتراكاً' : 'Select a subscription'}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-text-muted">
                  {isAr
                    ? 'انقر على أي اشتراك من القائمة لعرض الجدول، العنوان، المنتجات، وإتمام التوصيل.'
                    : 'Click any subscription to view schedule, address, items, and mark deliveries.'}
                </p>
              </div>
            ) : (
              <RecurringDetailPanel
                subscription={selected}
                loading={detailLoading}
                isAr={isAr}
                updating={updating}
                onAction={handleAction}
                onSaveNotes={handleSaveNotes}
                embedded
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
