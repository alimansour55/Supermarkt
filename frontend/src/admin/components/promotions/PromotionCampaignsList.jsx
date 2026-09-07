import {
  Clock,
  Infinity as InfinityIcon,
  Layers,
  Pause,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../list';
import {
  PROMOTION_SCHEDULE_FILTER_OPTIONS,
  PROMOTION_STATUS_FILTER_OPTIONS,
  PROMOTION_STATUS_LABELS,
  describePromotionRules,
  formatSchedulePoint,
  getPromotionTargetLabel,
  getPromotionTypeChipClass,
  getPromotionTypeMeta,
  isLimitedSchedule,
  promotionTypeFilterOptions,
} from '../../utils/promotionUtils';

function StatusPill({ status, isAr }) {
  const meta = PROMOTION_STATUS_LABELS[status] || PROMOTION_STATUS_LABELS.paused;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {isAr ? meta.ar : meta.en}
    </span>
  );
}

function ScheduleCell({ row, isAr }) {
  const limited = isLimitedSchedule(row);
  const start = formatSchedulePoint(row.startsAt, isAr);
  const end = formatSchedulePoint(row.endsAt, isAr);

  if (!limited) {
    return (
      <div className="min-w-[9rem] space-y-1">
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
          <InfinityIcon className="h-3 w-3" aria-hidden />
          {isAr ? 'مفتوح' : 'Open'}
        </span>
        {start ? (
          <p className="text-[11px] text-text-muted">
            {isAr ? 'من' : 'From'} {start.label}
          </p>
        ) : (
          <p className="text-[11px] text-text-muted">{isAr ? 'بدون بداية محددة' : 'No start date'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-[9rem] space-y-1">
      <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-900">
        <Clock className="h-3 w-3" aria-hidden />
        {isAr ? 'عرض محدود' : 'Limited'}
      </span>
      <div className="space-y-0.5 text-[11px] tabular-nums text-text-muted">
        <p>{start?.label || '—'}</p>
        <p className="font-medium text-text">→ {end?.label || '—'}</p>
      </div>
    </div>
  );
}

export default function PromotionCampaignsList({
  isAr,
  list,
  onRowClick,
  onToggleRow,
  onDeleteRow,
  onBulk,
}) {
  const columns = [
    {
      key: 'name',
      header: isAr ? 'الحملة' : 'Campaign',
      sortKey: 'nameEn',
      render: (row) => {
        const name = isAr ? row.nameAr : row.nameEn;
        const target = getPromotionTargetLabel(row.targetMode, isAr);
        return (
          <div className="flex min-w-[11rem] items-start gap-3">
            <span className="shrink-0 rounded-lg bg-orange-600 px-2 py-1 text-[10px] font-bold leading-none text-white shadow-sm">
              {row.badgeAr || row.badgeEn || '—'}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-text">{name}</p>
              <p className="mt-0.5 text-xs text-text-muted">{describePromotionRules(row, isAr)}</p>
              {target && (
                <p className="mt-1 text-[10px] font-medium text-slate-500">{target}</p>
              )}
              {row.homepageSectionId && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700">
                  🏠 {isAr ? 'معروض في الصفحة الرئيسية' : 'Featured on homepage'}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: isAr ? 'النوع' : 'Type',
      render: (row) => {
        const meta = getPromotionTypeMeta(row.type);
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${getPromotionTypeChipClass(row.type)}`}>
            <span aria-hidden>{meta.icon}</span>
            {isAr ? meta.labelAr : meta.labelEn}
          </span>
        );
      },
    },
    {
      key: 'products',
      header: isAr ? 'منتجات' : 'Products',
      render: (row) => (
        <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-800 shadow-sm">
          {row.productCount ?? 0}
        </span>
      ),
    },
    {
      key: 'dates',
      header: isAr ? 'الفترة' : 'Schedule',
      sortKey: 'startsAt',
      render: (row) => <ScheduleCell row={row} isAr={isAr} />,
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (row) => <StatusPill status={row.status} isAr={isAr} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="inline-flex overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRowClick(row); }}
            className="border-e border-border p-2 text-orange-700 transition-colors hover:bg-orange-50"
            title={isAr ? 'تعديل' : 'Edit'}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => onToggleRow(row, e)}
            className="border-e border-border p-2 text-slate-600 transition-colors hover:bg-slate-50"
            title={row.status === 'active' ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تفعيل' : 'Activate')}
          >
            {row.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => onDeleteRow(row, e)}
            className="p-2 text-red-600 transition-colors hover:bg-red-50"
            title={isAr ? 'حذف' : 'Delete'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminListPage
      isAr={isAr}
      q={list.q}
      onSearchChange={list.setQ}
      searchPlaceholder={isAr ? 'بحث بالاسم أو الشارة...' : 'Search name or badge...'}
      sort={list.sort}
      onSort={list.toggleSort}
      onRowClick={onRowClick}
      rowClassName={() => 'cursor-pointer transition-colors hover:bg-orange-50/50'}
      filters={(
        <>
          <ListFilterSelect
            showLabel
            label={isAr ? 'الحالة' : 'Status'}
            value={list.filters.status}
            onChange={(v) => list.setFilter('status', v)}
            options={[
              { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
              ...PROMOTION_STATUS_FILTER_OPTIONS.map((o) => ({
                value: o.value,
                label: isAr ? o.labelAr : o.labelEn,
              })),
            ]}
          />
          <ListFilterSelect
            showLabel
            label={isAr ? 'المدة' : 'Duration'}
            value={list.filters.schedule}
            onChange={(v) => list.setFilter('schedule', v)}
            options={[
              { value: '', label: isAr ? 'كل المدد' : 'All durations' },
              ...PROMOTION_SCHEDULE_FILTER_OPTIONS.map((o) => ({
                value: o.value,
                label: isAr ? o.labelAr : o.labelEn,
              })),
            ]}
          />
          <ListFilterSelect
            showLabel
            label={isAr ? 'نوع العرض' : 'Offer type'}
            value={list.filters.type}
            onChange={(v) => list.setFilter('type', v)}
            options={[
              { value: '', label: isAr ? 'كل الأنواع' : 'All types' },
              ...promotionTypeFilterOptions().map((t) => ({
                value: t.value,
                label: isAr ? t.labelAr : t.labelEn,
              })),
            ]}
          />
        </>
      )}
      bulkBar={(
        <BulkActionsBar
          count={list.selectedIds.length}
          isAr={isAr}
          onActivate={() => onBulk('activate', isAr ? 'تفعيل الحملات' : 'Activate campaigns')}
          onDeactivate={() => onBulk('pause', isAr ? 'إيقاف الحملات' : 'Pause campaigns')}
          onDelete={() => onBulk('delete', isAr ? 'حذف الحملات' : 'Delete campaigns')}
          onClear={list.clearSelection}
        />
      )}
      columns={columns}
      data={list.data}
      loading={list.loading}
      selectable
      selectedIds={list.selectedIds}
      onToggleSelect={list.toggleSelect}
      onToggleSelectAll={list.toggleSelectAll}
      allSelected={list.allSelected}
      pagination={list.pagination}
      onPageChange={list.setPage}
      emptyIcon={Layers}
      emptyTitle={isAr ? 'لا حملات بعد' : 'No campaigns yet'}
      emptyDescription={isAr ? 'أنشئ حملة جديدة أو حوّل منتجات الخصم من تبويب «منتجات بخصم»' : 'Create a campaign or convert product offers from the Product offers tab'}
    />
  );
}
