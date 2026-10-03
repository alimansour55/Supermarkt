import { categoryHasChildren, isRootCategory } from '../../utils/categoryHelpers';
import { productCategoryError } from '../constants/productCategoryErrors';

/** Validate a product leaf category id (missing, inactive, or parent with children). */
export function validateProductCategoryLeaf(leafId, categories = [], isAr) {
  if (!leafId) {
    return productCategoryError('required', isAr);
  }
  const leaf = categories.find((c) => String(c._id) === String(leafId));
  if (!leaf) {
    return productCategoryError('notFound', isAr);
  }
  if (leaf.isActive === false) {
    return productCategoryError('inactive', isAr);
  }
  if (categoryHasChildren(categories, leafId)) {
    return isRootCategory(leaf)
      ? productCategoryError('hasChildrenMain', isAr)
      : productCategoryError('hasChildren', isAr);
  }
  return '';
}

