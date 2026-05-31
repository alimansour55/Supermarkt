import { ScrollText } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, ListFilterSelect } from '../components/list';
import { formatDate } from '../../utils/formatters';
import { roleLabel } from '../adminPermissions';

const ACTION_LABELS = {
  create: { en: 'Created', ar: 'إنشاء' },
  update: { en: 'Updated', ar: 'تحديث' },
  delete: { en: 'Deleted', ar: 'حذف' },
  status_change: { en: 'Status change', ar: 'تغيير حالة' },
  bulk: { en: 'Bulk action', ar: 'إجراء جماعي' },
};

const ENTITY_LABELS = {
  product: { en: 'Product', ar: 'منتج' },
  order: { en: 'Order', ar: 'طلب' },
  user: { en: 'User', ar: 'مستخدم' },
  category: { en: 'Category', ar: 'قسم' },
  coupon: { en: 'Coupon', ar: 'كوبون' },
  banner: { en: 'Banner', ar: 'بانر' },
};

export default function AuditLogPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getAuditLogs(params),
    initialFilters: { entityType: '', action: '' },
  });

  const actionLabel = (action) => {
    const l = ACTION_LABELS[action];
    return l ? (isAr ? l.ar : l.en) : action;
  };

  const entityLabel = (type) => {
    const l = ENTITY_LABELS[type];
    return l ? (isAr ? l.ar : l.en) : type;
  };

  const columns = [
    {
      key: 'createdAt',
      header: isAr ? 'التاريخ' : 'Date',
      sortKey: 'createdAt',
      render: (row) => (
        <span className="text-text-muted">{formatDate(row.createdAt, isAr ? 'ar-EG' : 'en-GB')}</span>
      ),
    },
    {
      key: 'actor',
      header: isAr ? 'المستخدم' : 'User',
      render: (row) => (
        <div>
          <p className="font-medium">{row.actorName || row.actor?.name || '—'}</p>
          <p className="text-xs text-text-muted">{roleLabel(row.actorRole || row.actor?.role, isAr)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: isAr ? 'الإجراء' : 'Action',
      sortKey: 'action',
      render: (row) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
          {actionLabel(row.action)}
        </span>
      ),
    },
    {
      key: 'entity',
      header: isAr ? 'العنصر' : 'Entity',
      render: (row) => (
        <div>
          <p className="text-xs text-text-muted">{entityLabel(row.entityType)}</p>
          <p className="font-medium">{row.entityLabel || row.entityId || '—'}</p>
        </div>
      ),
    },
    {
      key: 'changes',
      header: isAr ? 'التغييرات' : 'Changes',
      render: (row) => {
        if (!row.changes || typeof row.changes !== 'object') return '—';
        const entries = Object.entries(row.changes).slice(0, 3);
        return (
          <ul className="max-w-xs space-y-0.5 text-xs text-text-muted">
            {entries.map(([key, val]) => (
              <li key={key}>
                <span className="font-medium text-text">{key}</span>
                {val?.from !== undefined && (
                  <> : {String(val.from)} → {String(val.to)}</>
                )}
              </li>
            ))}
          </ul>
        );
      },
    },
  ];

  return (
    <AdminListPage
      isAr={isAr}
      q={list.q}
      onSearchChange={list.setQ}
      searchPlaceholder={isAr ? 'بحث في السجل...' : 'Search audit log...'}
      sort={list.sort}
      onSort={list.toggleSort}
      filters={(
        <>
          <ListFilterSelect
            label={isAr ? 'النوع' : 'Entity'}
            value={list.filters.entityType}
            onChange={(v) => list.setFilter('entityType', v)}
            options={[
              { value: '', label: isAr ? 'الكل' : 'All' },
              ...Object.entries(ENTITY_LABELS).map(([value, l]) => ({
                value,
                label: isAr ? l.ar : l.en,
              })),
            ]}
          />
          <ListFilterSelect
            label={isAr ? 'الإجراء' : 'Action'}
            value={list.filters.action}
            onChange={(v) => list.setFilter('action', v)}
            options={[
              { value: '', label: isAr ? 'الكل' : 'All' },
              ...Object.entries(ACTION_LABELS).map(([value, l]) => ({
                value,
                label: isAr ? l.ar : l.en,
              })),
            ]}
          />
        </>
      )}
      columns={columns}
      data={list.data}
      loading={list.loading}
      pagination={list.pagination}
      onPageChange={list.setPage}
      emptyIcon={ScrollText}
      emptyTitle={isAr ? 'لا يوجد سجل' : 'No audit entries'}
      emptyDescription={isAr ? 'ستظهر هنا إجراءات الإدارة' : 'Admin actions will appear here'}
    />
  );
}
