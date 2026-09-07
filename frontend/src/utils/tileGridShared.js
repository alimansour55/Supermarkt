/** Shared responsive grid classes — matches BrandRow tile layout. */
export const TILE_GRID_COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  8: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8',
};

export function tileGridClass(columns = 4) {
  return TILE_GRID_COLS[columns] || TILE_GRID_COLS[4];
}

export function normalizeTileColumns(columns, max = 8) {
  const allowed = [2, 3, 4, 5, 6, 8];
  const n = Number(columns) || 4;
  if (allowed.includes(n)) return n;
  return Math.min(max, Math.max(2, n));
}

/** Compact promo tile height — fixed so cards stay short when stretched full width. */
export const PROMO_TILE_HEIGHT_CLASS = 'h-[96px] sm:h-[100px]';

/** Horizontal scroll row — only when more tiles than fit on one row. */
export function promoScrollRowClass() {
  return 'flex w-max gap-3';
}

/** Fixed width per scroll tile — used only when the row overflows. */
export const PROMO_TILE_WIDTH_CLASS =
  'w-[min(70vw,220px)] sm:w-[min(38vw,240px)] md:w-[min(26vw,260px)]';

/** Full-width grid — tiles span the page container; column count follows item count. */
export function centeredPromoGridClass(itemCount, maxColumns = 3) {
  const n = Math.min(Math.max(1, itemCount), maxColumns);
  const base = 'grid w-full gap-3';
  if (n === 1) return `${base} grid-cols-1`;
  if (n === 2) return `${base} grid-cols-1 sm:grid-cols-2`;
  if (n === 3) return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  if (n === 4) return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`;
  if (n === 5) return `${base} grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`;
  return `${base} grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`;
}

/** Use a full-width grid when every tile fits on one row; otherwise horizontal scroll. */
export function promoUsesFullWidthGrid(itemCount, maxColumns = 3) {
  return itemCount <= maxColumns;
}
