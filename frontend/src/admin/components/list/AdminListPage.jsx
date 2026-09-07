import { Search } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Pagination from '../Pagination';
import AdminDataTable from './AdminDataTable';

export default function AdminListPage({
  isAr,
  actions,
  filters,
  searchPlaceholder,
  q,
  onSearchChange,
  bulkBar,
  columns,
  data,
  loading,
  sort,
  onSort,
  selectable,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  rowActions,
  onRowClick,
  rowClassName,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination,
  onPageChange,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {actions}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder={searchPlaceholder}
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              className="ps-9"
            />
          </div>
          {filters && (
            <div className="flex flex-wrap items-end gap-3">
              {filters}
            </div>
          )}
        </div>

        {bulkBar}

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          sort={sort}
          onSort={onSort}
          selectable={selectable}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onToggleSelectAll={onToggleSelectAll}
          allSelected={allSelected}
          rowActions={rowActions}
          onRowClick={onRowClick}
          rowClassName={rowClassName}
          emptyIcon={emptyIcon}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={emptyAction}
          isAr={isAr}
        />

        {!loading && pagination?.total > 0 && (
          <div className="border-t border-border">
            <Pagination
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={onPageChange}
              isAr={isAr}
              className="rounded-none border-0 shadow-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
