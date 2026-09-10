/**
 * Escape user-supplied text so it can be embedded safely in a RegExp / Mongo
 * `$regex` query. Without this, inputs like "+20", "(", or "a*b" throw
 * "Invalid regular expression" and surface as a 500 to the caller.
 */
export function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default escapeRegex;
