/** Admin route for new product form, optionally pre-filling a leaf category. */
export function adminNewProductUrl(categoryId) {
  if (!categoryId) return '/admin/products/new';
  return `/admin/products/new?category=${encodeURIComponent(String(categoryId))}`;
}
