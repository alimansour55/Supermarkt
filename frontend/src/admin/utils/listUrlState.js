/**
 * Admin list state <-> URL query string, for lists that keep their view in the
 * address bar (useAdminListPage with `syncUrl`). Only keys the page declares are
 * read or written, so unrelated params survive.
 */

const LIST_KEYS = ['q', 'page', 'limit', 'sort', 'order'];

/** Read list state from URLSearchParams, falling back to the page's defaults. */
export function readListUrlState(params, { initialFilters, initialSort, pageSize }) {
  const filters = { ...initialFilters };
  Object.keys(initialFilters).forEach((key) => {
    if (params.has(key)) filters[key] = params.get(key);
  });
  const limit = Number(params.get('limit'));
  return {
    q: params.get('q') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: Number.isInteger(limit) && limit > 0 ? limit : pageSize,
    filters,
    sort: params.get('sort')
      ? { field: params.get('sort'), order: params.get('order') === 'asc' ? 'asc' : 'desc' }
      : initialSort,
  };
}

/** New URLSearchParams with the list state written over `current`; defaults are left out. */
export function writeListUrlState(current, state, { initialFilters, initialSort, pageSize }) {
  const next = new URLSearchParams(current);
  [...LIST_KEYS, ...Object.keys(initialFilters)].forEach((key) => next.delete(key));

  if (state.q) next.set('q', state.q);
  if (state.page > 1) next.set('page', String(state.page));
  if (state.pageSize !== pageSize) next.set('limit', String(state.pageSize));
  if (state.sort.field !== initialSort.field || state.sort.order !== initialSort.order) {
    next.set('sort', state.sort.field);
    next.set('order', state.sort.order);
  }
  Object.entries(state.filters).forEach(([key, value]) => {
    if (value !== '' && value != null && value !== initialFilters[key]) next.set(key, String(value));
  });
  return next;
}
