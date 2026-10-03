import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { adminApi } from '../adminApi';
import { ADMIN_PAGE_SIZE } from '../adminConstants';

const VIEW_STORAGE_KEY = 'adminProductsView';
const DENSITY_STORAGE_KEY = 'adminProductsDensity';
const COLUMNS_STORAGE_KEY = 'adminProductsHiddenColumns';

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readHiddenColumns() {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useProductsListPage({ initialFilters = {} }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(ADMIN_PAGE_SIZE);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState({ field: 'createdAt', order: 'desc' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [loadError, setLoadError] = useState('');

  const [view, setViewState] = useState(() => readLocal(VIEW_STORAGE_KEY, 'table'));
  const [density, setDensityState] = useState(() => readLocal(DENSITY_STORAGE_KEY, 'comfortable'));
  const [hiddenColumns, setHiddenColumnsState] = useState(() => readHiddenColumns());

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const debouncedQ = useDebouncedValue(q);

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

  const statsParams = useMemo(() => {
    const params = {};
    if (debouncedQ) params.q = debouncedQ;
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value != null) params[key] = value;
    });
    return params;
  }, [debouncedQ, filters]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    adminApi.getProducts(queryParams)
      .then(({ data: res }) => {
        setData(res.data ?? []);
        setPagination(res.pagination ?? { page: 1, pages: 1, total: 0, limit: pageSizeState });
        setSelectedIds((prev) => prev.filter((id) => res.data?.some((row) => row._id === id)));
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

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    adminApi.getProductsStats(statsParams)
      .then(({ data: res }) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [statsParams]);

  const filterKey = useMemo(
    () => JSON.stringify({ debouncedQ, filters, pageSizeState }),
    [debouncedQ, filters, pageSizeState],
  );
  const filterKeyRef = useRef(filterKey);

  useEffect(() => {
    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey;
      loadStats();
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, load]);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = data.map((row) => row._id).filter(Boolean);
      if (prev.length === allIds.length && allIds.length > 0) return [];
      return allIds;
    });
  }, [data]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);
  const allSelected = data.length > 0 && selectedIds.length === data.length;

  const setView = useCallback((next) => {
    setViewState(next);
    writeLocal(VIEW_STORAGE_KEY, next);
  }, []);

  const setDensity = useCallback((next) => {
    setDensityState(next);
    writeLocal(DENSITY_STORAGE_KEY, next);
  }, []);

  const setHiddenColumns = useCallback((next) => {
    setHiddenColumnsState(next);
    writeLocal(COLUMNS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggleColumn = useCallback((key) => {
    setHiddenColumnsState((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      writeLocal(COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

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
    view,
    setView,
    density,
    setDensity,
    hiddenColumns,
    setHiddenColumns,
    toggleColumn,
    stats,
    statsLoading,
    reloadStats: loadStats,
  };
}
