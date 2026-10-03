import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../../app/router';
import {
  CheckCircle2,
  FolderOpen,
  FolderTree,
  ImagePlus,
  Info,
  ListTree,
  Package,
  PackagePlus,
  Plus,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { localizeAdminApiError } from '../constants/productCategoryErrors';
import { adminNewProductUrl } from '../utils/adminProductRoutes';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { BulkActionsBar } from '../components/list';
import EmptyState from '../components/EmptyState';
import { useConfirm, useToast } from '../components';
import CategoryProductReassignPanel from '../components/CategoryProductReassignPanel';
import CategoryBulkImpactPanel from '../components/CategoryBulkImpactPanel';
import CategoryTreeCard, { CategoryInsertSlot } from '../components/CategoryTreeCard';
import {
  CATEGORY_LEVEL_LABELS,
  buildBulkCategoryImpact,
  buildCategoryActionWarning,
  buildCategoryTree,
  categoryHasActiveProducts,
  categoryRoleMeta,
  parentSelectLabel,
} from '../../utils/categoryHelpers';

const EMPTY_FORM = {
  nameAr: '',
  nameEn: '',
  slug: '',
  icon: '🛒',
  imageUrl: '',
  sortOrder: 0,
  parentCategory: '',
  isActive: true,
};

const LEVEL_HINTS = {
  1: {
    en: 'Top-level department shown in navigation.',
    ar: 'قسم من المستوى الأعلى يظهر في القائمة.',
  },
  2: {
    en: 'A group under a main category.',
    ar: 'مجموعة تحت القسم الرئيسي.',
  },
  3: {
    en: 'A sub-group. Can hold products only when it has no children.',
    ar: 'مجموعة فرعية. تحمل منتجات فقط إذا لم يكن لها أقسام فرعية.',
  },
  4: {
    en: 'Deepest level — always a product category.',
    ar: 'أعمق مستوى — دائمًا قسم منتجات.',
  },
};

function CategoryLevelPath({ level, isAr }) {
  return (
    <div className="flex flex-wrap items-center gap-0 text-xs sm:text-sm">
      {[1, 2, 3, 4].map((lvl) => {
        const active = lvl === level;
        const done = lvl < level;
        const labels = CATEGORY_LEVEL_LABELS[lvl];
        return (
          <span key={lvl} className="flex items-center">
            {lvl > 1 && (
              <span className={`mx-1 h-px w-4 sm:w-6 ${done || active ? 'bg-primary-300' : 'bg-slate-200'}`} />
            )}
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors ${
                active
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                  : done
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                    : 'bg-slate-100 text-text-muted'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                active ? 'bg-white/20' : 'bg-white/60'
              }`}
              >
                {lvl}
              </span>
              {isAr ? labels.ar : labels.en}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function CategoryForm({
  isAr,
  form,
  setForm,
  imagePreview,
  imageUrl,
  onImageUrlChange,
  onImageChange,
  onRemoveImage,
  onSubmit,
  onCancel,
  onAddProduct,
  levelNum,
  parentOptions,
  editingCategory = null,
}) {
  const editMeta = editingCategory ? categoryRoleMeta(editingCategory) : null;
  const isMaxDepth = levelNum === 4;
  const willBeLeaf = isMaxDepth || (editMeta?.isLeaf ?? true);
  const hint = LEVEL_HINTS[levelNum] || LEVEL_HINTS[1];

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 px-6 py-5">
        <div className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -start-6 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
              {editingCategory ? <Tag className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">
                {editingCategory
                  ? (isAr ? 'تعديل القسم' : 'Edit category')
                  : (isAr ? 'قسم جديد' : 'New category')}
              </h3>
              <p className="text-xs text-white/70">{isAr ? hint.ar : hint.en}</p>
            </div>
          </div>
          <CategoryLevelPath level={levelNum} isAr={isAr} />
        </div>
      </div>

      <div className="grid gap-5 p-6 sm:grid-cols-2">
        <div className={`sm:col-span-2 rounded-xl border px-4 py-3 text-sm ${
          willBeLeaf ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
        }`}
        >
          <div className="flex items-start gap-2.5">
            <Info className={`mt-0.5 h-4 w-4 shrink-0 ${willBeLeaf ? 'text-emerald-600' : 'text-amber-600'}`} />
            <div className="space-y-1.5">
              <p className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                willBeLeaf ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
              }`}
              >
                {editMeta?.isGroup
                  ? (isAr
                    ? `مجموعة فقط — ${editMeta.childCount} قسم فرعي`
                    : `Group only — ${editMeta.childCount} sub-categorie(s)`)
                  : willBeLeaf
                    ? (isAr
                      ? 'قسم منتجات — يمكن ربط المنتجات هنا'
                      : 'Product category — products can be assigned here')
                    : (isAr
                      ? 'بعد الحفظ يمكن إضافة أقسام فرعية'
                      : 'After saving you can add sub-categories')}
              </p>
              {editingCategory?.productCount > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary-800">
                  <Package className="h-3.5 w-3.5 shrink-0" />
                  {isAr
                    ? `${editingCategory.productCount} منتج مرتبط بهذا القسم.`
                    : `${editingCategory.productCount} product(s) linked to this category.`}
                </p>
              )}
            </div>
          </div>
        </div>

        <Input label={isAr ? 'الاسم (عربي)' : 'Name AR'} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
        <Input label={isAr ? 'الاسم (EN)' : 'Name EN'} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
        <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="diapers / pampers" />
        <Input label={isAr ? 'أيقونة (تُعرض للعملاء)' : 'Icon (shown to customers)'} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium">
            {isAr ? 'القسم الأب' : 'Parent category'}
          </label>
          <select
            className="w-full rounded-field border border-border bg-white px-4 py-2.5 text-text transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            value={form.parentCategory}
            onChange={(e) => setForm({ ...form, parentCategory: e.target.value })}
          >
            <option value="">{isAr ? '— بدون (قسم رئيسي) —' : '— None (main category) —'}</option>
            {parentOptions.map((c) => (
              <option key={c._id} value={c._id}>
                {parentSelectLabel(c, isAr)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-text-muted">
            {isAr
              ? 'المسار الكامل يظهر بجانب كل خيار (رئيسي › قسم › …). اترك بدون اختيار لجعله قسمًا رئيسيًا.'
              : 'Full path is shown for each option (Main › Category › …). Leave empty to make it a main category.'}
          </p>
        </div>

        <Input label={isAr ? 'الترتيب' : 'Sort order'} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />

        <label className="flex flex-col gap-1.5 self-end rounded-xl border border-border bg-slate-50/70 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-medium text-text">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded accent-primary-600" />
            {isAr ? 'نشط (يظهر في المتجر)' : 'Active (visible on storefront)'}
          </span>
          {!form.isActive && editingCategory && categoryHasActiveProducts(editingCategory) && (
            <span className="text-xs text-amber-700">
              {isAr
                ? `لا يمكن التعطيل — ${editingCategory.activeProductCount} منتج نشط. استخدم «نقل المنتجات» أولاً.`
                : `Cannot deactivate — ${editingCategory.activeProductCount} active product(s). Use “Move products” first.`}
            </span>
          )}
        </label>

        <div className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <ImagePlus className="h-3.5 w-3.5" />
          {isAr ? 'صورة القسم' : 'Category image'}
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-slate-50/70 p-4">
          <p className="text-xs text-text-muted">
            {isAr
              ? 'تظهر في الصفحة الرئيسية وقوائم الأقسام. بدون صورة يُستخدم الأيقونة أعلاه.'
              : 'Shown on homepage and category lists. The icon above is used if no photo is set.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <Input
              label={isAr ? 'رابط الصورة (اختياري)' : 'Image URL (optional)'}
              value={imageUrl}
              onChange={onImageUrlChange}
              placeholder="https://..."
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium">{isAr ? 'أو رفع صورة' : 'Or upload image'}</label>
              <input
                type="file"
                accept="image/*"
                onChange={onImageChange}
                className="block w-full cursor-pointer text-sm text-text-muted file:me-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-700"
              />
            </div>
          </div>
          {imagePreview && (
            <div className="flex flex-wrap items-end gap-4">
              <img src={imagePreview} alt="" className="h-24 w-24 rounded-2xl border border-border object-cover shadow-sm" />
              <Button type="button" variant="secondary" size="sm" onClick={onRemoveImage}>
                {isAr ? 'إزالة الصورة' : 'Remove image'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
        <Button type="submit">{isAr ? 'حفظ' : 'Save'}</Button>
        {onAddProduct && (
          <Button type="button" variant="secondary" onClick={onAddProduct}>
            <PackagePlus className="h-4 w-4" />
            {isAr ? 'إضافة منتج لهذا القسم' : 'Add product to this category'}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </form>
  );
}

function matchesQuery(cat, query) {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (cat.nameAr || '').toLowerCase().includes(needle)
    || (cat.nameEn || '').toLowerCase().includes(needle)
    || (cat.slug || '').toLowerCase().includes(needle);
}

function matchesStatus(cat, statusFilter) {
  if (statusFilter === 'true') return cat.isActive !== false;
  if (statusFilter === 'false') return cat.isActive === false;
  return true;
}

function pruneCategoryTree(nodes, predicate) {
  const out = [];
  (nodes || []).forEach((node) => {
    const children = pruneCategoryTree(node.children, predicate);
    if (predicate(node) || children.length) {
      out.push({ ...node, children });
    }
  });
  return out;
}

function collectTreeIds(nodes, acc = []) {
  (nodes || []).forEach((node) => {
    acc.push(node._id);
    collectTreeIds(node.children, acc);
  });
  return acc;
}

export default function CategoriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [clearImage, setClearImage] = useState(false);

  const [reassignState, setReassignState] = useState({
    open: false,
    category: null,
    action: 'delete',
    fromBulk: false,
  });
  const [reassignApplying, setReassignApplying] = useState(false);
  const [bulkImpact, setBulkImpact] = useState({ open: false, action: 'delete', impact: null });
  const [bulkApplying, setBulkApplying] = useState(false);

  const loadAllCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await adminApi.getCategories({
        limit: 500,
        sort: 'sortOrder',
        order: 'asc',
      });
      const cats = Array.isArray(res?.data) ? res.data : [];
      setAllCategories(cats);
      return cats;
    } catch {
      setAllCategories([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllCategories();
  }, [loadAllCategories]);

  const findCategory = useCallback((id) => (
    allCategories.find((c) => String(c._id) === String(id)) || null
  ), [allCategories]);

  const tree = useMemo(() => buildCategoryTree(allCategories), [allCategories]);

  const isFiltering = Boolean(search.trim()) || Boolean(statusFilter);
  const visibleTree = useMemo(() => {
    if (!isFiltering) return tree;
    return pruneCategoryTree(tree, (cat) => matchesQuery(cat, search) && matchesStatus(cat, statusFilter));
  }, [tree, isFiltering, search, statusFilter]);

  const visibleFlatIds = useMemo(() => collectTreeIds(visibleTree), [visibleTree]);

  const pageStats = useMemo(() => {
    const total = allCategories.length;
    const active = allCategories.filter((c) => c.isActive !== false).length;
    const leaf = allCategories.filter((c) => categoryRoleMeta(c).isLeaf).length;
    return { total, active, leaf, groups: total - leaf };
  }, [allCategories]);

  const refreshAll = useCallback(() => loadAllCategories(), [loadAllCategories]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const clearSelection = () => setSelectedIds([]);
  const allSelected = visibleFlatIds.length > 0 && visibleFlatIds.every((id) => selectedIds.includes(id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : visibleFlatIds);

  const toggleCollapse = (id) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
    setClearImage(false);
    setEditId(null);
    setEditingCategory(null);
    setShowForm(false);
  };

  const openAddForm = (parentCategory = null) => {
    setEditId(null);
    setEditingCategory(null);
    setForm({ ...EMPTY_FORM, parentCategory: parentCategory ? String(parentCategory._id) : '' });
    setImageFile(null);
    setImagePreview('');
    setClearImage(false);
    setShowForm(true);
  };

  const openEditForm = (cat) => {
    setEditId(cat._id);
    setEditingCategory(cat);
    setForm({
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      slug: cat.slug,
      icon: cat.icon || '🛒',
      imageUrl: cat.image || '',
      sortOrder: cat.sortOrder || 0,
      parentCategory: cat.parentCategory?._id || cat.parentCategory || '',
      isActive: cat.isActive !== false,
    });
    setImageFile(null);
    setClearImage(false);
    setImagePreview(cat.image || '');
    setShowForm(true);
  };

  const levelNum = useMemo(() => {
    if (!form.parentCategory) return 1;
    const parent = findCategory(form.parentCategory);
    return Math.min((parent?.level || 1) + 1, 4);
  }, [form.parentCategory, findCategory]);

  const parentOptions = useMemo(() => {
    const isDescendantOfEditing = (candidate) => {
      if (!editingCategory) return false;
      if (String(candidate._id) === String(editingCategory._id)) return true;
      return (candidate.ancestors || []).some(
        (a) => String(a?._id || a) === String(editingCategory._id),
      );
    };
    return allCategories
      .filter((c) => (c.level || 1) <= 3 && !isDescendantOfEditing(c))
      .sort((a, b) => (isAr ? a.nameAr.localeCompare(b.nameAr) : a.nameEn.localeCompare(b.nameEn)));
  }, [allCategories, editingCategory, isAr]);

  const buildFormData = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value === '' || value == null) return;
      fd.append(key, key === 'isActive' ? String(value) : value);
    });
    if (!form.parentCategory) fd.delete('parentCategory');
    if (imageFile) {
      fd.append('image', imageFile);
    } else if (clearImage) {
      fd.append('image', '');
    } else if (form.imageUrl?.trim()) {
      fd.append('image', form.imageUrl.trim());
    }
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      editingCategory
      && categoryHasActiveProducts(editingCategory)
      && form.isActive === false
      && editingCategory.isActive !== false
    ) {
      openReassignPanel(editingCategory, 'deactivate');
      return;
    }
    try {
      const payload = buildFormData();
      if (editId) await adminApi.updateCategory(editId, payload);
      else await adminApi.createCategory(payload);
      resetForm();
      refreshAll();
      toast.success(isAr ? 'تم حفظ القسم' : 'Category saved');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
    }
  };

  const openReassignPanel = (category, action, { fromBulk = false } = {}) => {
    setBulkImpact({ open: false, action: 'delete', impact: null });
    setReassignState({ open: true, category, action, fromBulk });
  };

  const reopenBulkImpact = useCallback(async (action) => {
    if (!selectedIds.length) return;
    const fresh = await loadAllCategories();
    const byId = new Map(fresh.map((c) => [String(c._id), c]));
    const selected = selectedIds.map((id) => byId.get(String(id))).filter(Boolean);
    if (!selected.length) return;
    setBulkImpact({ open: true, action, impact: buildBulkCategoryImpact(selected, action, isAr) });
  }, [selectedIds, loadAllCategories, isAr]);

  const handleReassignAndContinue = async (categoryPayload) => {
    const { category, action, fromBulk } = reassignState;
    if (!category) return;
    setReassignApplying(true);
    try {
      const { data: moveRes } = await adminApi.reassignCategoryProducts(category._id, categoryPayload);
      toast.success(isAr ? `تم نقل ${moveRes.affected} منتج` : `Moved ${moveRes.affected} product(s)`);
      if (fromBulk) {
        setReassignState({ open: false, category: null, action: 'delete', fromBulk: false });
        await reopenBulkImpact(action);
        return;
      }
      if (action === 'delete') {
        await adminApi.deleteCategory(category._id);
        toast.success(isAr ? 'تم حذف القسم' : 'Category deleted');
        resetForm();
      } else if (action === 'deactivate') {
        const fd = new FormData();
        fd.append('isActive', 'false');
        await adminApi.updateCategory(category._id, fd);
        toast.success(isAr ? 'تم تعطيل القسم' : 'Category deactivated');
        if (editId === category._id) {
          setForm((prev) => ({ ...prev, isActive: false }));
        }
      }
      setReassignState({ open: false, category: null, action: 'delete', fromBulk: false });
      refreshAll();
    } catch (err) {
      toast.error(localizeAdminApiError(
        err,
        isAr,
        'Could not move products — pick a valid leaf category and try again.',
        'تعذّر نقل المنتجات — اختر قسمًا فرعيًا صالحًا وحاول مرة أخرى.',
      ));
    } finally {
      setReassignApplying(false);
    }
  };

  const goAddProduct = useCallback((category) => {
    if (!category?._id) return;
    navigate(adminNewProductUrl(category._id));
  }, [navigate]);

  const tryCategoryAction = async (category, action) => {
    if (categoryHasActiveProducts(category)) {
      openReassignPanel(category, action);
      return;
    }
    const titles = {
      delete: isAr ? 'حذف القسم' : 'Delete category',
      deactivate: isAr ? 'تعطيل القسم' : 'Deactivate category',
    };
    const ok = await confirm({
      title: titles[action],
      message: buildCategoryActionWarning(category, action, isAr),
      confirmLabel: action === 'delete' ? (isAr ? 'حذف' : 'Delete') : (isAr ? 'تعطيل' : 'Deactivate'),
      variant: action === 'delete' ? 'danger' : 'primary',
    });
    if (!ok) return;
    try {
      if (action === 'delete') {
        await adminApi.deleteCategory(category._id);
        toast.success(isAr ? 'تم الحذف' : 'Deleted');
      } else {
        const fd = new FormData();
        fd.append('isActive', 'false');
        await adminApi.updateCategory(category._id, fd);
        toast.success(isAr ? 'تم التعطيل' : 'Deactivated');
      }
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message);
    }
  };

  const handleToggleActive = async (category) => {
    if (category.isActive === false) {
      try {
        const fd = new FormData();
        fd.append('isActive', 'true');
        await adminApi.updateCategory(category._id, fd);
        toast.success(isAr ? 'تم التفعيل' : 'Activated');
        refreshAll();
      } catch (err) {
        toast.error(err.response?.data?.message);
      }
      return;
    }
    await tryCategoryAction(category, 'deactivate');
  };

  const siblingsOf = useCallback((cat) => {
    const pid = cat.parentCategory?._id || cat.parentCategory || null;
    return allCategories
      .filter((c) => String(c.parentCategory?._id || c.parentCategory || '') === String(pid || ''))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [allCategories]);

  const moveCategory = async (cat, direction) => {
    const sibs = siblingsOf(cat);
    const idx = sibs.findIndex((s) => String(s._id) === String(cat._id));
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= sibs.length) return;
    const target = sibs[targetIdx];
    const pid = cat.parentCategory?._id || cat.parentCategory || null;
    try {
      await adminApi.reorderCategories({
        move: {
          id: cat._id,
          parentCategory: pid,
          ...(direction === 'up' ? { beforeId: target._id } : { afterId: target._id }),
        },
      });
      loadAllCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل إعادة الترتيب' : 'Reorder failed'));
    }
  };

  const openBulkImpact = (action) => {
    const selected = selectedIds.map((id) => findCategory(id)).filter(Boolean);
    if (!selected.length) {
      toast.error(isAr ? 'لم يُعثر على الأقسام المحددة' : 'Could not resolve selected categories');
      return;
    }
    setBulkImpact({ open: true, action, impact: buildBulkCategoryImpact(selected, action, isAr) });
  };

  const executeBulkAction = async (eligibleIds) => {
    if (!eligibleIds.length) return;
    setBulkApplying(true);
    try {
      await adminApi.bulkCategories(eligibleIds, bulkImpact.action);
      const skipped = bulkImpact.impact.total - eligibleIds.length;
      clearSelection();
      setBulkImpact({ open: false, action: 'delete', impact: null });
      refreshAll();
      toast.success(
        skipped > 0
          ? (isAr ? `تم التطبيق على ${eligibleIds.length} — تُخطي ${skipped}` : `Applied to ${eligibleIds.length} — ${skipped} skipped`)
          : (isAr ? `تم التطبيق على ${eligibleIds.length} قسم` : `Applied to ${eligibleIds.length} categories`),
      );
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل التحديث' : 'Update failed'));
    } finally {
      setBulkApplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-primary-900 to-primary-800 px-6 py-6 shadow-lg shadow-primary-900/10 sm:px-8">
        <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-primary-500/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -start-10 bottom-0 h-40 w-40 rounded-full bg-white/5 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur">
              <FolderTree className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {isAr ? 'إدارة الأقسام' : 'Manage categories'}
              </h1>
              <p className="mt-1 text-sm text-white/60">
                {isAr ? 'ابحث، رتّب، وعدّل أقسام المتجر من هنا' : 'Search, reorder, and edit your store categories'}
              </p>
            </div>
          </div>
          <Button type="button" size="sm" onClick={() => openAddForm(null)} className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20">
            <Plus className="h-4 w-4" />
            {isAr ? 'قسم رئيسي جديد' : 'New main category'}
          </Button>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: isAr ? 'إجمالي الأقسام' : 'Total categories', value: pageStats.total, icon: ListTree },
            { label: isAr ? 'نشطة' : 'Active', value: pageStats.active, icon: CheckCircle2 },
            { label: isAr ? 'مجموعات' : 'Groups', value: pageStats.groups, icon: FolderOpen },
            { label: isAr ? 'أقسام منتجات' : 'Product categories', value: pageStats.leaf, icon: Package },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl bg-white/[0.07] px-3.5 py-2.5 ring-1 ring-white/10 backdrop-blur">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-base font-semibold tabular-nums text-white">{value}</p>
                <p className="truncate text-[11px] text-white/55">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <CategoryForm
          isAr={isAr}
          form={form}
          setForm={setForm}
          imagePreview={imagePreview}
          imageUrl={form.imageUrl}
          onImageUrlChange={(e) => {
            const url = e.target.value;
            setForm({ ...form, imageUrl: url });
            setImageFile(null);
            setClearImage(false);
            if (url) setImagePreview(url);
            else if (!imageFile) setImagePreview('');
          }}
          onImageChange={(e) => {
            const file = e.target.files?.[0];
            setImageFile(file || null);
            setClearImage(false);
            if (file) {
              setImagePreview(URL.createObjectURL(file));
              setForm((prev) => ({ ...prev, imageUrl: '' }));
            }
          }}
          onRemoveImage={() => {
            setImageFile(null);
            setImagePreview('');
            setForm({ ...form, imageUrl: '' });
            setClearImage(true);
          }}
          onSubmit={handleSubmit}
          onCancel={resetForm}
          levelNum={levelNum}
          parentOptions={parentOptions}
          editingCategory={editingCategory}
          onAddProduct={
            editingCategory && categoryRoleMeta(editingCategory).isLeaf
              ? () => goAddProduct(editingCategory)
              : null
          }
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder={isAr ? 'بحث عن قسم...' : 'Search categories...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
            {[
              { value: '', label: isAr ? 'الكل' : 'All' },
              { value: 'true', label: isAr ? 'نشط' : 'Active' },
              { value: 'false', label: isAr ? 'معطل' : 'Inactive' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <BulkActionsBar
          count={selectedIds.length}
          isAr={isAr}
          onActivate={() => openBulkImpact('activate')}
          onDeactivate={() => openBulkImpact('deactivate')}
          onDelete={() => openBulkImpact('delete')}
          onClear={clearSelection}
        />

        {!loading && visibleTree.length > 0 && (
          <label className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded accent-primary-600"
              aria-label={isAr ? 'تحديد الكل' : 'Select all'}
            />
            {isAr ? `تحديد كل الأقسام الظاهرة (${visibleFlatIds.length})` : `Select all visible (${visibleFlatIds.length})`}
          </label>
        )}

        {loading ? (
          <div className="space-y-2 p-3 sm:p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : !visibleTree.length ? (
          <EmptyState
            icon={FolderOpen}
            title={isAr ? 'لا توجد أقسام' : 'No categories found'}
            description={isFiltering
              ? (isAr ? 'جرّب تعديل البحث أو الفلتر' : 'Try adjusting your search or filter')
              : undefined}
            action={!isFiltering ? (
              <Button size="sm" onClick={() => openAddForm(null)}>
                {isAr ? '+ قسم رئيسي جديد' : '+ New main category'}
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="space-y-1.5 p-3 sm:p-4">
            <CategoryInsertSlot
              isAr={isAr}
              label={isAr ? 'إضافة قسم رئيسي هنا' : 'Add main category here'}
              onInsert={() => openAddForm(null)}
            />
            {visibleTree.map((root) => (
              <div key={root._id}>
                <CategoryTreeCard
                  node={root}
                  depth={0}
                  isAr={isAr}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={toggleCollapse}
                  forceExpandAll={isFiltering}
                  siblingsOf={siblingsOf}
                  onEdit={openEditForm}
                  onAddChild={openAddForm}
                  onAddProduct={goAddProduct}
                  onMoveProducts={(cat) => openReassignPanel(cat, 'delete')}
                  onToggleActive={handleToggleActive}
                  onDelete={(cat) => tryCategoryAction(cat, 'delete')}
                  onMove={moveCategory}
                />
                <CategoryInsertSlot
                  isAr={isAr}
                  label={isAr ? 'إضافة قسم رئيسي هنا' : 'Add main category here'}
                  onInsert={() => openAddForm(null)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <CategoryProductReassignPanel
        open={reassignState.open}
        category={reassignState.category}
        categories={allCategories}
        isAr={isAr}
        pendingAction={reassignState.action}
        fromBulk={reassignState.fromBulk}
        applying={reassignApplying}
        onClose={() => setReassignState({ open: false, category: null, action: 'delete', fromBulk: false })}
        onReassignAndContinue={handleReassignAndContinue}
      />

      <CategoryBulkImpactPanel
        open={bulkImpact.open}
        impact={bulkImpact.impact}
        isAr={isAr}
        applying={bulkApplying}
        onClose={() => setBulkImpact({ open: false, action: 'delete', impact: null })}
        onConfirm={executeBulkAction}
        onReassign={(category) => openReassignPanel(category, bulkImpact.action, { fromBulk: true })}
      />
    </div>
  );
}
