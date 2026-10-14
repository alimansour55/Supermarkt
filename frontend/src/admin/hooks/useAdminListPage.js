import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from '../../app/router';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ADMIN_PAGE_SIZE } from '../adminConstants';
import { readListUrlState, writeListUrlState } from '../utils/listUrlState';

/**
 * @param {object} options
 * @param {boolean} [options.syncUrl] keep search, filters, sort and page in the URL so views
 *   survive a reload and can be shared.
 */
export function useAdminListPage({
  fetchFn,
  initialFilters = {},
  initialSort = { field: 'createdAt', order: 'desc' },
  pageSize = ADMIN_PAGE_SIZE,
  syncUrl = false,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initial] = useState(() => (syncUrl
    ? readListUrlState(searchParams, { initialFilters, initialSort, pageSize })
    : { q: '', page: 1, pageSize, filters: initialFilters, sort: initialSort }));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(initial.q);
  const [page, setPage] = useState(initial.page);
  const [pageSizeState, setPageSizeState] = useState(initial.pageSize);
  const [filters, setFilters] = useState(initial.filters);
  const [sort, setSort] = useState(initial.sort);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: initial.pageSize,
  });
  const [loadError, setLoadError] = useState('');

  const debouncedQ = useDebouncedValue(q);
  const urlQ = syncUrl ? debouncedQ : '';
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const queryParams = useMemo(() => {
    const params = {
      page,
      limit: pageSizeState,
      sort: sort.field,
      order: sort.order,
    };
    if (debouncedQ) params.q = debouncedQ;
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value != null) params[key] = value;
    });
    return params;
  }, [page, pageSizeState, sort, debouncedQ, filters]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetchRef.current(queryParams)
      .then(({ data: res }) => {
        setData(res.data ?? []);
        setPagination(res.pagination ?? { page: 1, pages: 1, total: 0, limit: pageSizeState });
        setSelectedIds((prev) => prev.filter((id) => res.data?.some((row) => (row._id ?? row.id ?? row.code) === id)));
      })
      .catch((err) => {
        setData([]);
        const msg = err.response?.data?.message || err.message || 'Failed to load';
        setLoadError(
          err.code === 'ECONNABORTED' || msg === 'Network Error'
            ? 'Cannot reach API — run npm run dev (backend on port 5001)'
            : msg,
        );
      })
      .finally(() => setLoading(false));
  }, [queryParams, pageSizeState]);

  const filterKey = useMemo(
    () => JSON.stringify({ debouncedQ, filters, pageSizeState }),
    [debouncedQ, filters, pageSizeState],
  );
  const filterKeyRef = useRef(filterKey);

  useEffect(() => {
    if (!syncUrl) return;
    const next = writeListUrlState(
      searchParams,
      {
        q: urlQ, page, pageSize: pageSizeState, sort, filters,
      },
      { initialFilters, initialSort, pageSize },
    );
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // initialFilters / initialSort / pageSize are the page's fixed defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUrl, urlQ, page, pageSizeState, sort, filters, searchParams, setSearchParams]);

  useEffect(() => {
    // When filters/search/page-size change, reset to page 1 first and skip
    // this render's fetch — otherwise we'd fire one request with the stale
    // page + new filters, then immediately a second one once page resets.
    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    load();
  }, [filterKey, page, load]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patchFilters = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev.field !== field) return { field, order: 'asc' };
      if (prev.order === 'asc') return { field, order: 'desc' };
      return { field: 'createdAt', order: 'desc' };
    });
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = data.map((row) => row._id ?? row.id ?? row.code).filter(Boolean);
      if (prev.length === allIds.length && allIds.length > 0) return [];
      return allIds;
    });
  }, [data]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const allSelected = data.length > 0 && selectedIds.length === data.length;

  return {
    data,
    loading,
    q,
    setQ,
    page,
    setPage,
    pageSize: pageSizeState,
    setPageSize: setPageSizeState,
    filters,
    setFilter,
    patchFilters,
    sort,
    toggleSort,
    pagination,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    allSelected,
    reload: load,
    queryParams,
    loadError,
  };
}
