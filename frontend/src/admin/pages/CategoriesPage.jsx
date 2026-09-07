import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FolderOpen, Layers, Package, PackagePlus, Tag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { localizeAdminApiError } from '../constants/productCategoryErrors';
import { adminNewProductUrl } from '../utils/adminProductRoutes';
import { useAdminListPage } from '../hooks/useAdminListPage';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import AdminCategoryTree from '../components/AdminCategoryTree';
import CategoryProductReassignPanel from '../components/CategoryProductReassignPanel';
import CategoryBulkImpactPanel from '../components/CategoryBulkImpactPanel';
import {
  CATEGORY_LEVEL_LABELS,
  buildBulkCategoryImpact,
  buildCategoryActionWarning,
  categoryHasActiveProducts,
  categoryLabel,
  categoryLevelLabel,
  categoryRoleLabel,
  categoryRoleMeta,
  getCategoryAncestorPath,
  getRootCategories,
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

const TAB_HINTS = {
  1: {
    en: 'Top-level departments shown in navigation. Group sub-categories — products attach to deeper levels.',
    ar: 'أقسام المستوى الأعلى في القائمة. تجمع أقساماً فرعية — المنتجات تُربط بالمستويات الأعمق.',
  },
  2: {
    en: 'Mid-level groups under a main category. Products attach to leaf nodes below.',
    ar: 'مجموعات تحت القسم الرئيسي. المنتجات تُربط بأقسام الطرف (بدون أبناء).',
  },
  3: {
    en: 'Sub-groups. Can hold products only when they have no children.',
    ar: 'مجموعات فرعية. يمكن ربط المنتجات فقط إذا لم يكن للقسم أقسام فرعية.',
  },
  4: {
    en: 'Deepest level — always a product category (no further nesting).',
    ar: 'أعمق مستوى — دائماً قسم منتجات (لا يمكن إضافة مستوى أعمق).',
  },
};

function CategoryLevelPath({ level, isAr }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs sm:text-sm">
      {[1, 2, 3, 4].map((lvl) => {
        const active = lvl === level;
        const labels = CATEGORY_LEVEL_LABELS[lvl];
        return (
          <span key={lvl} className="flex items-center gap-1">
            {lvl > 1 && <ChevronRight className="h-3.5 w-3.5 text-text-muted" />}
            <span
              className={`rounded-lg px-2.5 py-1 font-medium ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-text-muted'
              }`}
            >
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
  level,
  parentCategories,
  parentsLoading = false,
  editingCategory = null,
}) {
  const levelNum = Number(level) || 1;
  const isRoot = levelNum === 1;
  const levelLabel = CATEGORY_LEVEL_LABELS[levelNum] || CATEGORY_LEVEL_LABELS[1];
  const parentLabel = CATEGORY_LEVEL_LABELS[levelNum - 1] || CATEGORY_LEVEL_LABELS[1];
  const editMeta = editingCategory ? categoryRoleMeta(editingCategory) : null;
  const isMaxDepth = levelNum === 4;
  const willBeLeaf = isMaxDepth || (editMeta?.isLeaf ?? true);

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div className="space-y-3 sm:col-span-2">
        <CategoryLevelPath level={levelNum} isAr={isAr} />
        <p className="text-sm text-text-muted">
          {isAr ? TAB_HINTS[levelNum].ar : TAB_HINTS[levelNum].en}
        </p>
      </div>

      <div className="sm:col-span-2 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
        <p className="font-semibold text-text">
          {isAr ? `المستوى ${levelNum}: ${levelLabel.ar}` : `Level ${levelNum}: ${levelLabel.en}`}
        </p>
        <p className="mt-1 text-text-muted">
          {isRoot
            ? (isAr
              ? 'لا يحتاج قسمًا أبًا — يظهر في قائمة الأقسام الرئيسية.'
              : 'No parent needed — appears as a top-level shop category.')
            : (isAr
              ? `يجب اختيار ${parentLabel.ar} كقسم أب.`
              : `Must be placed under a ${parentLabel.en.toLowerCase()}.`)}
        </p>
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${
          willBeLeaf
            ? 'bg-emerald-50 text-emerald-900'
            : 'bg-amber-50 text-amber-900'
        }`}>
          {editMeta?.isGroup
            ? (isAr
              ? `مجموعة فقط — ${editMeta.childCount} قسم فرعي. المنتجات تُربط بالمستويات الأعمق.`
              : `Group only — ${editMeta.childCount} sub-categorie(s). Products attach to deeper levels.`)
            : willBeLeaf
              ? (isAr
                ? 'قسم منتجات — يمكن ربط المنتجات هنا (آخر مستوى بدون أبناء).'
                : 'Product category — products can be assigned here (leaf node).')
              : (isAr
                ? 'بعد الحفظ يمكن إضافة أقسام فرعية — المنتجات تُربط عند آخر مستوى.'
                : 'After saving you can add sub-categories — products attach at the deepest level.')}
        </p>
        {editingCategory?.productCount > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-primary-800">
            <Package className="h-3.5 w-3.5 shrink-0" />
            {isAr
              ? `${editingCategory.productCount} منتج مرتبط بهذا القسم.`
              : `${editingCategory.productCount} product(s) linked to this category.`}
          </p>
        )}
      </div>

      <Input label={isAr ? 'الاسم (عربي)' : 'Name AR'} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
      <Input label={isAr ? 'الاسم (EN)' : 'Name EN'} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
      <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="diapers / pampers" />
      <Input label="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />

      {!isRoot && (
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium">
            {isAr ? `${parentLabel.ar} (القسم الأب) *` : `${parentLabel.en} (parent) *`}
          </label>
          <select
            className="w-full rounded-xl border border-border px-4 py-2.5"
            value={form.parentCategory}
            onChange={(e) => setForm({ ...form, parentCategory: e.target.value })}
            required
            disabled={parentsLoading}
          >
            <option value="">
              {parentsLoading
                ? (isAr ? 'جاري التحميل...' : 'Loading...')
                : (isAr ? `اختر ${parentLabel.ar}` : `Select ${parentLabel.en.toLowerCase()}`)}
            </option>
            {parentCategories.map((c) => (
              <option key={c._id} value={c._id}>
                {parentSelectLabel(c, isAr)}
              </option>
            ))}
          </select>
          {!parentsLoading && parentCategories.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              {Number(level) === 2
                ? (isAr
                  ? 'لا يوجد قسم رئيسي بعد. أضف قسمًا رئيسيًا من تبويب «قسم رئيسي» أولاً.'
                  : 'No main categories yet. Add one under the Main category tab first.')
                : (isAr
                  ? `لا توجد ${parentLabel.ar} متاحة. أضف المستوى الأعلى أولاً.`
                  : `No ${parentLabel.en.toLowerCase()} available. Add the parent level first.`)}
            </p>
          )}
          <p className="mt-1.5 text-xs text-text-muted">
            {isAr
              ? 'المسار الكامل يظهر بجانب كل خيار (رئيسي › قسم › …).'
              : 'Full path is shown for each option (Main › Category › …).'}
          </p>
        </div>
      )}

      <Input label={isAr ? 'الترتيب' : 'Sort order'} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="flex items-center gap-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
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

      <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-slate-50 p-4">
        <p className="text-sm font-semibold text-text">
          {isAr ? 'صورة القسم (تظهر في الموقع)' : 'Category photo (shown on storefront)'}
        </p>
        <Input
          label={isAr ? 'رابط الصورة (اختياري)' : 'Image URL (optional)'}
          value={imageUrl}
          onChange={onImageUrlChange}
          placeholder="https://..."
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium">{isAr ? 'أو رفع صورة' : 'Or upload image'}</label>
          <input type="file" accept="image/*" onChange={onImageChange} className="block w-full text-sm" />
        </div>
        {imagePreview && (
          <div className="flex flex-wrap items-end gap-4">
            <img src={imagePreview} alt="" className="h-24 w-24 rounded-2xl border border-border object-cover shadow-sm" />
            <Button type="button" variant="secondary" size="sm" onClick={onRemoveImage}>
              {isAr ? 'إزالة الصورة' : 'Remove image'}
            </Button>
          </div>
        )}
        <p className="text-xs text-text-muted">
          {isAr
            ? 'يُعرض في الصفحة الرئيسية، قائمة الأقسام، والأقسام الفرعية. بدون صورة يُستخدم الأيقونة.'
            : 'Shown on homepage, category lists, and subcategory pages. Icon is used if no photo.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button type="submit">{isAr ? 'حفظ' : 'Save'}</Button>
        {onAddProduct && (
          <Button type="button" variant="secondary" onClick={onAddProduct}>
            <PackagePlus className="h-4 w-4" />
            {isAr ? 'إضافة منتج لهذا القسم' : 'Add product to this category'}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [tab, setTab] = useState('1');
  const [parentCategories, setParentCategories] = useState([]);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [clearImage, setClearImage] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedTreeId, setSelectedTreeId] = useState('');
  const [showTreeMobile, setShowTreeMobile] = useState(false);
  const [reassignState, setReassignState] = useState({
    open: false,
    category: null,
    action: 'delete',
    fromBulk: false,
  });
  const [reassignApplying, setReassignApplying] = useState(false);
  const [bulkImpact, setBulkImpact] = useState({ open: false, action: 'delete', impact: null });
  const [bulkApplying, setBulkApplying] = useState(false);
  const [treeActionIntent, setTreeActionIntent] = useState(null);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getCategories({
      ...params,
      level: tab,
    }),
    initialFilters: { isActive: '', parentCategory: '' },
  });

  const loadAllCategories = useCallback(async () => {
    setTreeLoading(true);
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
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllCategories();
  }, [loadAllCategories]);

  const loadParentCategories = useCallback(async () => {
    if (tab === '1') {
      setParentCategories([]);
      return;
    }
    setParentsLoading(true);
    try {
      const parentLevel = Number(tab) - 1;
      const params = parentLevel === 1
        ? { limit: 500, rootsOnly: 'true', sort: 'sortOrder', order: 'asc' }
        : { limit: 500, level: String(parentLevel), sort: 'sortOrder', order: 'asc' };
      const { data: res } = await adminApi.getCategories(params);
      setParentCategories(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setParentCategories([]);
    } finally {
      setParentsLoading(false);
    }
  }, [tab]);

  const getDirectChildCount = useCallback((categoryId) => (
    allCategories.filter((c) => {
      const pid = c.parentCategory?._id || c.parentCategory;
      return pid && String(pid) === String(categoryId);
    }).length
  ), [allCategories]);

  const listParentCategory = useMemo(() => {
    const parentId = list.filters.parentCategory;
    if (!parentId) return null;
    return allCategories.find((c) => String(c._id) === String(parentId)) || null;
  }, [list.filters.parentCategory, allCategories]);

  const handleTabChange = useCallback((nextTab) => {
    list.setFilter('parentCategory', '');
    list.setQ('');
    setTab(nextTab);
  }, [list]);

  const clearListParentFilter = useCallback(() => {
    list.setFilter('parentCategory', '');
    list.setQ('');
  }, [list]);

  const refreshAll = useCallback(() => {
    list.reload();
    loadAllCategories();
    loadParentCategories();
  }, [list, loadAllCategories, loadParentCategories]);

  useEffect(() => {
    loadParentCategories();
  }, [tab, loadParentCategories]);

  useEffect(() => {
    if (showForm) loadParentCategories();
  }, [showForm, loadParentCategories]);

  useEffect(() => {
    list.setPage(1);
    list.reload();
    if (treeActionIntent) return;
    setShowForm(false);
    setEditId(null);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyEditForm = useCallback((cat) => {
    setSelectedTreeId(String(cat._id));
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
  }, []);

  useEffect(() => {
    if (!treeActionIntent) return;

    if (treeActionIntent.type === 'addRoot') {
      if (tab !== '1') {
        setTab('1');
        return;
      }
      setSelectedTreeId('');
      setEditId(null);
      setEditingCategory(null);
      setForm({
        ...EMPTY_FORM,
        sortOrder: treeActionIntent.sortOrder ?? 0,
      });
      setImageFile(null);
      setImagePreview('');
      setClearImage(false);
      setShowForm(true);
      setShowTreeMobile(false);
      setTreeActionIntent(null);
      return;
    }

    const cat = treeActionIntent.category;
    const targetLevel = treeActionIntent.type === 'addChild'
      ? String(Math.min(Number(cat.level || 1) + 1, 4))
      : String(cat.level || 1);

    if (tab !== targetLevel) {
      setTab(targetLevel);
      return;
    }

    if (treeActionIntent.type === 'edit') {
      applyEditForm(cat);
    } else if (treeActionIntent.type === 'addChild') {
      const parentLevel = Number(cat.level || 1);
      if (parentLevel >= 4) {
        toast.error(isAr ? 'أقصى عمق 4 مستويات' : 'Maximum depth is 4 levels');
      } else {
        setSelectedTreeId(String(cat._id));
        setEditId(null);
        setEditingCategory(null);
        setForm({ ...EMPTY_FORM, parentCategory: cat._id });
        setImageFile(null);
        setImagePreview('');
        setClearImage(false);
        setShowForm(true);
        setShowTreeMobile(false);
      }
    }
    setTreeActionIntent(null);
  }, [treeActionIntent, tab, applyEditForm, isAr, toast]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
    setClearImage(false);
    setEditId(null);
    setEditingCategory(null);
    setShowForm(false);
  };

  const buildFormData = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value === '' || value == null) return;
      fd.append(key, key === 'isActive' ? String(value) : value);
    });
    fd.append('level', tab);
    if (tab === '1') {
      fd.delete('parentCategory');
    }
    if (imageFile) {
      fd.append('image', imageFile);
    } else if (clearImage) {
      fd.append('image', '');
    } else if (form.imageUrl?.trim()) {
      fd.append('image', form.imageUrl.trim());
    }
    return fd;
  };

  const resolveSelectedCategories = useCallback((ids) => {
    const byId = new Map();
    allCategories.forEach((c) => byId.set(String(c._id), c));
    list.data.forEach((c) => {
      const key = String(c._id);
      if (!byId.has(key)) byId.set(key, c);
    });
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
  }, [allCategories, list.data]);

  const openReassignPanel = (category, action, { fromBulk = false } = {}) => {
    setBulkImpact({ open: false, action: 'delete', impact: null });
    setReassignState({ open: true, category, action, fromBulk });
  };

  const reopenBulkImpact = useCallback(async (action) => {
    if (!list.selectedIds.length) return;
    const fresh = await loadAllCategories();
    const byId = new Map(fresh.map((c) => [String(c._id), c]));
    list.data.forEach((c) => {
      const key = String(c._id);
      if (!byId.has(key)) byId.set(key, c);
    });
    const selected = list.selectedIds.map((id) => byId.get(String(id))).filter(Boolean);
    if (!selected.length) return;
    list.reload();
    setBulkImpact({
      open: true,
      action,
      impact: buildBulkCategoryImpact(selected, action, isAr),
    });
  }, [list, loadAllCategories, isAr]);

  const handleReassignAndContinue = async (categoryPayload) => {
    const { category, action, fromBulk } = reassignState;
    if (!category) return;
    setReassignApplying(true);
    try {
      const { data: moveRes } = await adminApi.reassignCategoryProducts(category._id, categoryPayload);
      toast.success(
        isAr
          ? `تم نقل ${moveRes.affected} منتج`
          : `Moved ${moveRes.affected} product(s)`,
      );
      if (fromBulk) {
        setReassignState({ open: false, category: null, action: 'delete', fromBulk: false });
        list.reload();
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
    if (!ok) return false;
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
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tab !== '1' && !form.parentCategory) {
      toast.error(isAr ? 'اختر القسم الأب' : 'Select a parent category');
      return;
    }
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

  const handleEdit = (cat) => {
    const level = String(cat.level || 1);
    if (level !== tab) {
      setTreeActionIntent({ type: 'edit', category: cat });
      return;
    }
    applyEditForm(cat);
  };

  const handleTreeAddRoot = () => {
    if (tab !== '1') {
      setTreeActionIntent({ type: 'addRoot' });
      return;
    }
    setSelectedTreeId('');
    setEditId(null);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
    setClearImage(false);
    setShowForm(true);
    setShowTreeMobile(false);
  };

  const computeRootSortOrder = useCallback((afterCategoryId) => {
    const roots = getRootCategories(allCategories)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (!afterCategoryId) {
      return roots.length ? Math.max(0, (roots[0].sortOrder ?? 10) - 10) : 10;
    }
    const idx = roots.findIndex((r) => String(r._id) === String(afterCategoryId));
    const current = roots[idx];
    const next = roots[idx + 1];
    if (!current) return (roots.length + 1) * 10;
    if (!next) return (current.sortOrder ?? 0) + 10;
    return Math.floor(((current.sortOrder ?? 0) + (next.sortOrder ?? 0)) / 2) || (current.sortOrder ?? 0) + 5;
  }, [allCategories]);

  const handleTreeAddRootAt = useCallback((afterCategoryId = null) => {
    const sortOrder = computeRootSortOrder(afterCategoryId);
    if (tab !== '1') {
      setTreeActionIntent({ type: 'addRoot', sortOrder });
      return;
    }
    setSelectedTreeId('');
    setEditId(null);
    setEditingCategory(null);
    setForm({ ...EMPTY_FORM, sortOrder });
    setImageFile(null);
    setImagePreview('');
    setClearImage(false);
    setShowForm(true);
    setShowTreeMobile(false);
  }, [tab, computeRootSortOrder]);

  const handleTreeReorder = useCallback(async (payload) => {
    try {
      await adminApi.reorderCategories(payload);
      await loadAllCategories();
      list.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل إعادة الترتيب' : 'Reorder failed'));
      loadAllCategories();
    }
  }, [loadAllCategories, list, isAr, toast]);

  const handleTreeAddChild = (parentCat) => {
    const parentLevel = Number(parentCat.level || 1);
    if (parentLevel >= 4) {
      toast.error(isAr ? 'أقصى عمق 4 مستويات' : 'Maximum depth is 4 levels');
      return;
    }
    const childLevel = String(parentLevel + 1);
    if (childLevel !== tab) {
      setTreeActionIntent({ type: 'addChild', category: parentCat });
      return;
    }
    setSelectedTreeId(String(parentCat._id));
    setEditId(null);
    setEditingCategory(null);
    setForm({ ...EMPTY_FORM, parentCategory: parentCat._id });
    setImageFile(null);
    setImagePreview('');
    setClearImage(false);
    setShowForm(true);
    setShowTreeMobile(false);
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

  const handleTreeSelect = (cat) => {
    const id = String(cat._id);
    setSelectedTreeId(id);
    list.setQ('');
    setShowTreeMobile(false);

    const level = Number(cat.level || 1);
    const childCount = getDirectChildCount(id);

    if (childCount > 0) {
      const childTab = String(Math.min(level + 1, 4));
      list.setFilter('parentCategory', id);
      if (childTab !== tab) {
        setTab(childTab);
      }
      return;
    }

    const parentId = cat.parentCategory?._id || cat.parentCategory || '';
    list.setFilter('parentCategory', parentId ? String(parentId) : '');
    const levelTab = String(level);
    if (levelTab !== tab) {
      setTab(levelTab);
    }
  };

  const openBulkImpact = (action) => {
    const selected = resolveSelectedCategories(list.selectedIds);
    if (!selected.length) {
      toast.error(isAr ? 'لم يُعثر على الأقسام المحددة' : 'Could not resolve selected categories');
      return;
    }
    const impact = buildBulkCategoryImpact(selected, action, isAr);
    setBulkImpact({ open: true, action, impact });
  };

  const executeBulkAction = async (eligibleIds) => {
    if (!eligibleIds.length) return;
    setBulkApplying(true);
    try {
      await adminApi.bulkCategories(eligibleIds, bulkImpact.action);
      const skipped = bulkImpact.impact.total - eligibleIds.length;
      list.clearSelection();
      setBulkImpact({ open: false, action: 'delete', impact: null });
      refreshAll();
      toast.success(
        skipped > 0
          ? (isAr
            ? `تم التطبيق على ${eligibleIds.length} — تُخطي ${skipped}`
            : `Applied to ${eligibleIds.length} — ${skipped} skipped`)
          : (isAr ? `تم التطبيق على ${eligibleIds.length} قسم` : `Applied to ${eligibleIds.length} categories`),
      );
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل التحديث' : 'Update failed'));
    } finally {
      setBulkApplying(false);
    }
  };

  const runBulk = (action) => {
    openBulkImpact(action);
  };

  const columns = useMemo(() => {
    const base = [
      {
        key: 'name',
        header: isAr ? 'الاسم' : 'Name',
        sortKey: 'nameEn',
        render: (c) => {
          const ancestorPath = getCategoryAncestorPath(c, allCategories, isAr);
          const { isLeaf } = categoryRoleMeta(c);
          return (
            <div className="min-w-0">
              {ancestorPath && (
                <p className="mb-0.5 truncate text-[11px] text-text-muted" title={ancestorPath}>
                  {ancestorPath}
                  <ChevronRight className="mx-0.5 inline h-3 w-3 opacity-50 rtl:rotate-180" />
                </p>
              )}
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${
                    isLeaf
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                  }`}
                >
                  {c.image ? (
                    <img src={c.image} alt="" className="h-7 w-7 rounded-md object-cover" />
                  ) : isLeaf ? (
                    <Package className="h-3.5 w-3.5" />
                  ) : (
                    <span>{c.icon}</span>
                  )}
                </span>
                <span className="truncate font-medium">{isAr ? c.nameAr : c.nameEn}</span>
              </div>
            </div>
          );
        },
      },
      { key: 'slug', header: 'Slug', cellClassName: 'text-text-muted' },
    ];

    if (tab !== '1') {
      base.push({
        key: 'parent',
        header: isAr ? 'القسم الأب' : 'Parent',
        render: (c) => (c.parentCategory
          ? parentSelectLabel(c.parentCategory, isAr)
          : '—'),
      });
    }

    base.push({
      key: 'level',
      header: isAr ? 'المستوى' : 'Level',
      render: (c) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {categoryLevelLabel(c.level || Number(tab), isAr)}
        </span>
      ),
    });

    base.push({
      key: 'role',
      header: isAr ? 'الدور' : 'Role',
      render: (c) => {
        const { isLeaf, childCount } = categoryRoleMeta(c);
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isLeaf ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
            title={isLeaf
              ? (isAr ? 'يمكن ربط المنتجات' : 'Can hold products')
              : (isAr ? `مجموعة — ${childCount} فرعي` : `Group — ${childCount} child(ren)`)}
          >
            {categoryRoleLabel(c, isAr)}
            {!isLeaf && (
              <span className="ms-1 opacity-75">({childCount})</span>
            )}
          </span>
        );
      },
    });

    base.push({
      key: 'products',
      header: isAr ? 'المنتجات' : 'Products',
      render: (c) => {
        const active = c.activeProductCount ?? 0;
        const total = c.productCount ?? 0;
        return (
          <span title={total !== active
            ? (isAr ? `${total} إجمالي` : `${total} total`)
            : undefined}
          >
            <span className={active > 0 ? 'font-medium text-text' : 'text-text-muted'}>{active}</span>
            {total > active && (
              <span className="text-[10px] text-text-muted">
                {' '}
                /
                {total}
              </span>
            )}
          </span>
        );
      },
    });

    base.push({
      key: 'isActive',
      header: isAr ? 'الحالة' : 'Status',
      render: (c) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
          {c.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
        </span>
      ),
    });

    return base;
  }, [tab, isAr, allCategories]);

  const rowClassName = useCallback((c) => {
    const selected = selectedTreeId === String(c._id);
    const { isLeaf } = categoryRoleMeta(c);
    const roleBorder = isLeaf ? 'border-s-4 border-s-emerald-400' : 'border-s-4 border-s-amber-400';
    const selectedBg = selected ? 'bg-primary-50/80' : '';
    return `${roleBorder} ${selectedBg}`.trim();
  }, [selectedTreeId]);

  const tabs = [
    { id: '1', labelAr: CATEGORY_LEVEL_LABELS[1].ar, labelEn: CATEGORY_LEVEL_LABELS[1].en, icon: Layers },
    { id: '2', labelAr: CATEGORY_LEVEL_LABELS[2].ar, labelEn: CATEGORY_LEVEL_LABELS[2].en, icon: FolderOpen },
    { id: '3', labelAr: CATEGORY_LEVEL_LABELS[3].ar, labelEn: CATEGORY_LEVEL_LABELS[3].en, icon: Tag },
    { id: '4', labelAr: CATEGORY_LEVEL_LABELS[4].ar, labelEn: CATEGORY_LEVEL_LABELS[4].en, icon: Tag },
  ];

  const activeTabHint = TAB_HINTS[Number(tab)] || TAB_HINTS[1];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {isAr ? 'إدارة الأقسام' : 'Manage categories'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'اختر قسماً من الشجرة أو أضف قسماً جديداً'
              : 'Select a category from the tree or create a new one'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="lg:hidden"
          onClick={() => setShowTreeMobile((v) => !v)}
        >
          <FolderOpen className="h-4 w-4" />
          {showTreeMobile
            ? (isAr ? 'إخفاء الشجرة' : 'Hide tree')
            : (isAr ? 'عرض الشجرة' : 'Show tree')}
        </Button>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:gap-5 lg:items-start">
        <div className={`${showTreeMobile ? 'block' : 'hidden'} lg:block`}>
          <div className="sticky top-4 flex h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)] min-h-0 flex-col lg:h-[calc(100vh-5.5rem)] lg:max-h-[calc(100vh-5.5rem)]">
            <AdminCategoryTree
              categories={allCategories}
              isAr={isAr}
              selectedId={selectedTreeId}
              onSelect={handleTreeSelect}
              onEdit={handleEdit}
              onDelete={(cat) => tryCategoryAction(cat, 'delete')}
              onAddRoot={handleTreeAddRoot}
              onAddRootAt={handleTreeAddRootAt}
              onAddChild={handleTreeAddChild}
              onAddProduct={goAddProduct}
              onToggleActive={handleToggleActive}
              onMoveProducts={(cat) => openReassignPanel(cat, 'delete')}
              onReorder={handleTreeReorder}
              categoryHasProducts={categoryHasActiveProducts}
              loading={treeLoading}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-5">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="flex gap-0 overflow-x-auto border-b border-slate-200">
        {tabs.map(({ id, labelAr, labelEn, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleTabChange(id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4 opacity-70" />
            {isAr ? labelAr : labelEn}
          </button>
        ))}
        </div>
        <p className="border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-500">
          {isAr ? activeTabHint.ar : activeTabHint.en}
        </p>
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
          level={tab}
          parentCategories={parentCategories}
          parentsLoading={parentsLoading}
          editingCategory={editingCategory}
          onAddProduct={
            editingCategory && categoryRoleMeta(editingCategory).isLeaf
              ? () => goAddProduct(editingCategory)
              : null
          }
        />
      )}

      {listParentCategory && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 ring-1 ring-slate-200/80">
          <p className="text-sm text-slate-600">
            {isAr ? 'عرض أقسام تحت: ' : 'Showing under: '}
            <span className="font-semibold text-slate-900">
              {categoryLabel(listParentCategory, isAr)}
            </span>
          </p>
          <button
            type="button"
            onClick={clearListParentFilter}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700"
          >
            {isAr ? 'عرض الكل في هذا المستوى' : 'Show all at this level'}
          </button>
        </div>
      )}

      <AdminListPage
        isAr={isAr}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث...' : 'Search...'}
        sort={list.sort}
        onSort={list.toggleSort}
        actions={(
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); if (tab !== '1') loadParentCategories(); }}>
            {(() => {
              const label = CATEGORY_LEVEL_LABELS[Number(tab)] || CATEGORY_LEVEL_LABELS[1];
              return isAr ? `+ ${label.ar}` : `+ ${label.en}`;
            })()}
          </Button>
        )}
        filters={(
          <ListFilterSelect
            label={isAr ? 'الحالة' : 'Status'}
            value={list.filters.isActive}
            onChange={(v) => list.setFilter('isActive', v)}
            options={[
              { value: '', label: isAr ? 'الكل' : 'All' },
              { value: 'true', label: isAr ? 'نشط' : 'Active' },
              { value: 'false', label: isAr ? 'معطل' : 'Inactive' },
            ]}
          />
        )}
        bulkBar={(
          <BulkActionsBar
            count={list.selectedIds.length}
            isAr={isAr}
            onActivate={() => runBulk('activate')}
            onDeactivate={() => runBulk('deactivate')}
            onDelete={() => runBulk('delete')}
            onClear={list.clearSelection}
          />
        )}
        columns={columns}
        data={list.data}
        loading={list.loading}
        rowClassName={rowClassName}
        selectable
        selectedIds={list.selectedIds}
        onToggleSelect={list.toggleSelect}
        onToggleSelectAll={list.toggleSelectAll}
        allSelected={list.allSelected}
        rowActions={(c) => [
          { label: isAr ? 'تعديل' : 'Edit', onClick: () => handleEdit(c) },
          ...(categoryRoleMeta(c).isLeaf
            ? [{
              label: isAr ? 'إضافة منتج' : 'Add product',
              onClick: () => goAddProduct(c),
            }]
            : []),
          ...(categoryHasActiveProducts(c)
            ? [{
              label: isAr ? 'نقل المنتجات' : 'Move products',
              onClick: () => openReassignPanel(c, 'delete'),
            }]
            : []),
          {
            label: isAr ? 'حذف' : 'Delete',
            danger: true,
            onClick: () => tryCategoryAction(c, 'delete'),
          },
        ]}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={FolderOpen}
        emptyTitle={(() => {
          const label = CATEGORY_LEVEL_LABELS[Number(tab)] || CATEGORY_LEVEL_LABELS[1];
          return isAr ? `لا توجد ${label.ar}` : `No ${label.en.toLowerCase()} categories`;
        })()}
      />

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
      </div>
    </div>
  );
}
