import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ADMIN_PAGE_SIZE } from '../adminConstants';

export function useAdminListPage({
  fetchFn,
  initialFilters = {},
  initialSort = { field: 'createdAt', order: 'desc' },
  pageSize = ADMIN_PAGE_SIZE,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState(initialSort);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: pageSize,
  });
  const [loadError, setLoadError] = useState('');

  const debouncedQ = useDebouncedValue(q);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const queryParams = useMemo(() => {
    const params = {
      page,
      limit: pageSize,
      sort: sort.field,
      order: sort.order,
    };
    if (debouncedQ) params.q = debouncedQ;
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value != null) params[key] = value;
    });
    return params;
  }, [page, pageSize, sort, debouncedQ, filters]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetchRef.current(queryParams)
      .then(({ data: res }) => {
        setData(res.data ?? []);
        setPagination(res.pagination ?? { page: 1, pages: 1, total: 0, limit: pageSize });
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
  }, [queryParams, pageSize]);

  const filterKey = useMemo(
    () => JSON.stringify({ debouncedQ, filters }),
    [debouncedQ, filters],
  );

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    load();
  }, [load]);

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
