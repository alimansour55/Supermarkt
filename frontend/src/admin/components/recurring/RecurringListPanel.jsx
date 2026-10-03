import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  ChevronDown,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getRecurringFrequencyLabel } from '../../../constants/deliveryOptions';
import { ListFilterSelect } from '../list';
import { Skeleton } from '../Skeleton';
import { formatCount, formatPrice } from '../../../utils/formatters';

const STATUS_TABS = [
  { value: 'active', labelAr: 'نشط', labelEn: 'Active' },
  { value: 'paused', labelAr: 'متوقف', labelEn: 'Paused' },
  { value: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' },
  { value: '', labelAr: 'الكل', labelEn: 'All' },
];

const DUE_FILTERS = [
  { value: '', labelAr: 'كل المواعيد', labelEn: 'All dates' },
  { value: 'today', labelAr: 'اليوم', labelEn: 'Due today' },
  { value: 'week', labelAr: 'هذا الأسبوع', labelEn: 'This week' },
  { value: 'overdue', labelAr: 'متأخر', labelEn: 'Overdue' },
];

const FREQUENCY_FILTERS = [
  { value: '', labelAr: 'كل التكرارات', labelEn: 'All frequencies' },
  { value: 'weekly', labelAr: 'أسبوعي', labelEn: 'Weekly' },
  { value: 'biweekly', labelAr: 'كل أسبوعين', labelEn: 'Biweekly' },
  { value: 'monthly', labelAr: 'شهري', labelEn: 'Monthly' },
];

function isOverdue(sub) {
  return sub.status === 'active'
    && sub.nextDeliveryDate
    && new Date(sub.nextDeliveryDate) < new Date(new Date().toDateString());
}

function isDueToday(sub) {
  if (!sub.nextDeliveryDate) return false;
  return new Date(sub.nextDeliveryDate).toDateString() === new Date().toDateString();
}

function formatNextDate(date, isAr) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status, isAr }) {
  const labels = {
    active: { ar: 'نشط', en: 'Active', cls: 'bg-emerald-100 text-emerald-800' },
    paused: { ar: 'متوقف', en: 'Paused', cls: 'bg-amber-100 text-amber-800' },
    cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-slate-100 text-slate-600' },
  };
  const info = labels[status] || labels.cancelled;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}>
      {isAr ? info.ar : info.en}
    </span>
  );
}

function SubscriptionRow({ sub, isAr, selected, onSelect }) {
  const overdue = isOverdue(sub);
  const dueToday = isDueToday(sub);
  const schedule = sub.scheduleSummary || (isAr ? sub.scheduleSummaryAr : sub.scheduleSummaryEn);
  const subtotal = sub.subtotal ?? (sub.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const accentBorder = selected
    ? 'border-s-primary-600'
    : overdue
      ? 'border-s-amber-500'
      : dueToday
        ? 'border-s-violet-500'
        : 'border-s-transparent';

  return (
    <button
      type="button"
      onClick={() => onSelect(sub)}
      className={[
        'group mx-2 mb-2 w-[calc(100%-1rem)] rounded-xl border border-border/80 px-4 py-3.5 text-start shadow-sm transition-all',
        'border-s-[3px]',
        accentBorder,
        selected
          ? 'bg-primary-50/90 ring-1 ring-primary-200/50'
          : overdue
            ? 'bg-amber-50/40 hover:bg-amber-50/70 hover:shadow'
            : dueToday
              ? 'bg-violet-50/30 hover:bg-violet-50/60 hover:shadow'
              : 'bg-white hover:border-border hover:bg-slate-50/80 hover:shadow',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-bold text-text">{sub.customerName || '—'}</p>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-inset ring-amber-200">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {isAr ? 'متأخر' : 'Overdue'}
              </span>
            )}
            {!overdue && dueToday && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-inset ring-violet-200">
                <CalendarClock className="h-3 w-3" aria-hidden />
                {isAr ? 'اليوم' : 'Today'}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-text-muted" dir="ltr">
            {sub.customerPhone || sub.phone}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted/90">{schedule}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-end group-hover:bg-white/80">
          <p className="text-sm font-bold tabular-nums text-text">{formatPrice(subtotal)}</p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium text-text-muted">
            <Calendar className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            {formatNextDate(sub.nextDeliveryDate, isAr)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
        <StatusBadge status={sub.status} isAr={isAr} />
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-text-muted">
          {getRecurringFrequencyLabel(sub.frequency, isAr)}
        </span>
      </div>
    </button>
  );
}

function hasAdvancedFilters(due, frequency) {
  return Boolean(due || frequency);
}

function SubscriptionRowSkeleton() {
  return (
    <div className="mx-2 mb-2 w-[calc(100%-1rem)] rounded-xl border border-border/80 border-s-[3px] border-s-transparent bg-white px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <div className="shrink-0 space-y-2 text-end">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      <div className="mt-3 flex gap-1.5 border-t border-border/50 pt-2.5">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function RecurringListPanel({
  isAr,
  items,
  loading,
  selectedId,
  onSelect,
  searchInput,
  onSearchChange,
  status,
  onStatusChange,
  due,
  onDueChange,
  frequency,
  onFrequencyChange,
  onClearAdvanced,
  onRefresh,
  className = 'flex',
}) {
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedFilters(due, frequency));
  const advancedActive = hasAdvancedFilters(due, frequency);

  const totalLabel = useMemo(() => {
    if (loading) return '…';
    return formatCount(items.length);
  }, [loading, items.length]);

  return (
    <aside
      className={[
        className,
        'w-full shrink-0 flex-col border-e border-border bg-white md:w-[380px] lg:w-[420px] xl:w-[440px]',
      ].join(' ')}
    >
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-text">
              <RefreshCw className="h-4 w-4 text-primary-600" aria-hidden />
              {isAr ? 'الاشتراكات' : 'Subscriptions'}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {isAr ? `${totalLabel} نتيجة` : `${totalLabel} results`}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:bg-slate-50 hover:text-text disabled:opacity-50"
            aria-label={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو الهاتف...' : 'Search name or phone...'}
            className="w-full rounded-xl border border-border py-2.5 ps-10 pe-3 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15"
          />
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value || 'all'}
                type="button"
                onClick={() => onStatusChange(tab.value)}
                className={[
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 text-text-muted hover:bg-slate-200 hover:text-text',
                ].join(' ')}
              >
                {isAr ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-slate-50/80 px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-slate-100 hover:text-text"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {isAr ? 'فلاتر المواعيد' : 'Schedule filters'}
              {advancedActive && (
                <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                  {isAr ? 'مفعّل' : 'Active'}
                </span>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-3 rounded-xl border border-border bg-white p-3">
              <ListFilterSelect
                label={isAr ? 'موعد التوصيل' : 'Delivery date'}
                showLabel
                value={due}
                onChange={onDueChange}
                options={DUE_FILTERS.map((f) => ({
                  value: f.value,
                  label: isAr ? f.labelAr : f.labelEn,
                }))}
                className="w-full min-w-0"
              />
              <ListFilterSelect
                label={isAr ? 'التكرار' : 'Frequency'}
                showLabel
                value={frequency}
                onChange={onFrequencyChange}
                options={FREQUENCY_FILTERS.map((f) => ({
                  value: f.value,
                  label: isAr ? f.labelAr : f.labelEn,
                }))}
                className="w-full min-w-0"
              />
              {advancedActive && (
                <button
                  type="button"
                  onClick={onClearAdvanced}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800"
                >
                  <X className="h-3.5 w-3.5" />
                  {isAr ? 'مسح الفلاتر' : 'Clear filters'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/30 px-0.5 py-2 scrollbar-thin">
        {loading ? (
          <div className="space-y-0 pt-2" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <SubscriptionRowSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Calendar className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-text">
              {isAr ? 'لا توجد نتائج' : 'No subscriptions found'}
            </p>
            <p className="mt-1 max-w-xs text-xs text-text-muted">
              {searchInput || advancedActive || status !== 'active'
                ? (isAr ? 'جرّب تغيير الفلاتر أو البحث' : 'Try adjusting filters or search')
                : (isAr ? 'ستظهر الاشتراكات النشطة هنا' : 'Active subscriptions will appear here')}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {items.map((sub) => (
              <SubscriptionRow
                key={sub._id}
                sub={sub}
                isAr={isAr}
                selected={selectedId === sub._id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
