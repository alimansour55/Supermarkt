import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readListUrlState, writeListUrlState } from '../src/admin/utils/listUrlState.js';

const defaults = {
  initialFilters: { status: '', segment: '' },
  initialSort: { field: 'createdAt', order: 'desc' },
  pageSize: 20,
};

test('reads known keys and ignores unknown ones', () => {
  const state = readListUrlState(
    new URLSearchParams('q=mona&page=3&limit=50&sort=totalSpent&order=asc&segment=vip&hack=1'),
    defaults,
  );
  assert.deepEqual(state, {
    q: 'mona',
    page: 3,
    pageSize: 50,
    filters: { status: '', segment: 'vip' },
    sort: { field: 'totalSpent', order: 'asc' },
  });
});

test('falls back to defaults for missing or junk values', () => {
  const state = readListUrlState(new URLSearchParams('page=-4&limit=abc'), defaults);
  assert.equal(state.page, 1);
  assert.equal(state.pageSize, 20);
  assert.deepEqual(state.sort, defaults.initialSort);
});

test('writes only non-default values and keeps unrelated params', () => {
  const next = writeListUrlState(
    new URLSearchParams('tab=info&status=active'),
    {
      q: '', page: 1, pageSize: 20, sort: defaults.initialSort, filters: { status: '', segment: 'at_risk' },
    },
    defaults,
  );
  assert.equal(next.toString(), 'tab=info&segment=at_risk');
});

test('round-trips a full view', () => {
  const state = {
    q: '0100', page: 2, pageSize: 100, sort: { field: 'lastOrderAt', order: 'desc' }, filters: { status: 'suspended', segment: '' },
  };
  const params = writeListUrlState(new URLSearchParams(), state, defaults);
  assert.deepEqual(readListUrlState(params, defaults), state);
});
