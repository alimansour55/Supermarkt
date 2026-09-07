/** Actionable product-category API messages (English; admin UI localizes to Arabic). */
export const PRODUCT_CATEGORY_ERRORS = {
  required: 'Choose a product category before saving.',
  notFound: 'That category no longer exists — pick another from the list.',
  inactive: 'This category is inactive — activate it first or choose another.',
  hasChildrenMain: 'Choose a subcategory — products cannot be placed in a main category that has children.',
  hasChildren: 'Choose a subcategory — products cannot be placed in a category that has children.',
  mainMismatch: 'The selected category does not belong to this department — pick one under the same main category.',
  mainUnresolved: 'Could not resolve the main department for this category — pick the category again.',
};

export function productCategoryError(key) {
  return PRODUCT_CATEGORY_ERRORS[key] || PRODUCT_CATEGORY_ERRORS.required;
}
