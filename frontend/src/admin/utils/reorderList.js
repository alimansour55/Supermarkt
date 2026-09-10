/**
 * Move an item within a list and renumber every item's `sortOrder` by position.
 *
 * @param {Array<object>} list      source list (not mutated)
 * @param {number} fromIndex        current index of the dragged item
 * @param {number} toIndex          target index
 * @param {{ step?: number, startAt?: number }} [options]
 *        step    - gap between consecutive sortOrder values (default 1)
 *        startAt - sortOrder of the first item (default 0)
 * @returns {Array<object>} a new list with updated `sortOrder` fields
 */
export function reorderList(list, fromIndex, toIndex, { step = 1, startAt = 0 } = {}) {
  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  if (removed === undefined) return list;
  next.splice(toIndex, 0, removed);
  return next.map((item, index) => ({
    ...item,
    sortOrder: startAt + index * step,
  }));
}
