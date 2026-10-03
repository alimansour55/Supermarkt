import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCategories, fetchCategoryTree } from '../services/productApi';
import {
  buildCategoryTree,
  flattenCategoryTree,
  getChildCategories,
  getLeafCategories,
  getRootCategories,
} from '../utils/categoryHelpers';
import { invalidateMegaMenuCache } from '../utils/megaMenuCache';
import { readSessionCache, writeSessionCache } from '../utils/sessionCache';
import { isHydrating } from '../utils/hydration';

const CATEGORIES_CACHE_KEY = 'mp_categories_v1';

const CategoriesContext = createContext({
  categories: [],
  rootCategories: [],
  categoryTree: [],
  loading: true,
  refetchCategories: async () => {},
  getChildren: () => [],
});

export function getCategoryLabel(category, isAr) {
  if (!category) return '';
  return isAr ? (category.nameAr || category.name) : (category.nameEn || category.name);
}

function fromTree(tree) {
  if (!Array.isArray(tree) || !tree.length) return null;
  return {
    flat: flattenCategoryTree(tree).filter((cat) => cat.isActive !== false),
    tree: tree.filter((cat) => cat.isActive !== false),
  };
}

/**
 * @param {object} props
 * @param {object[]} [props.initialTree] category tree loaded during SSR (root loader)
 */
export function CategoriesProvider({ children, initialTree = null }) {
  // SSR data wins; the session cache is only read outside hydration so the first
  // browser render matches the server HTML.
  const [initial] = useState(() => fromTree(initialTree)
    || (isHydrating() ? null : readSessionCache(CATEGORIES_CACHE_KEY)));
  const cached = initial;
  const [categories, setCategories] = useState(() => initial?.flat ?? []);
  const [categoryTree, setCategoryTree] = useState(() => initial?.tree ?? []);
  const [loading, setLoading] = useState(() => !initial);

  const refetchCategories = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const data = await fetchCategoryTree();
      const tree = Array.isArray(data) ? data : [];
      const flat = flattenCategoryTree(tree).filter((cat) => cat.isActive !== false);
      const activeTree = tree.filter((cat) => cat.isActive !== false);
      setCategories(flat);
      setCategoryTree(activeTree);
      writeSessionCache(CATEGORIES_CACHE_KEY, { flat, tree: activeTree });
      invalidateMegaMenuCache();
    } catch {
      try {
        const data = await fetchCategories();
        const list = Array.isArray(data) ? data : [];
        const active = list.filter((cat) => cat.isActive !== false);
        const tree = buildCategoryTree(active);
        setCategories(active);
        setCategoryTree(tree);
        writeSessionCache(CATEGORIES_CACHE_KEY, { flat: active, tree });
      } catch {
        setCategories((prev) => (prev.length ? prev : []));
        setCategoryTree((prev) => (prev.length ? prev : []));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTree?.length) {
      // Fresh from the server — just prime the session cache.
      writeSessionCache(CATEGORIES_CACHE_KEY, initial);
      return;
    }
    refetchCategories(Boolean(cached));
  // Initial load only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchCategories]);

  const rootCategories = useMemo(() => getRootCategories(categories), [categories]);
  const resolvedTree = useMemo(
    () => (categoryTree.length ? categoryTree : buildCategoryTree(categories)),
    [categoryTree, categories],
  );
  const leafCategories = useMemo(() => getLeafCategories(categories), [categories]);

  const getChildren = useCallback(
    (parentSlug) => getChildCategories(categories, parentSlug),
    [categories],
  );

  const value = useMemo(
    () => ({
      categories,
      rootCategories,
      categoryTree: resolvedTree,
      leafCategories,
      loading,
      refetchCategories,
      getChildren,
    }),
    [categories, rootCategories, resolvedTree, leafCategories, loading, refetchCategories, getChildren],
  );

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider');
  return ctx;
}

export default CategoriesContext;
