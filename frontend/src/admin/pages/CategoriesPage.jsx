import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';

export default function CategoriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [allCategories, setAllCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', slug: '', icon: '🛒', sortOrder: 0, parentCategory: '', isActive: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getCategories(params),
    initialFilters: { isActive: '' },
  });

  useEffect(() => {
    adminApi.getCategories({ limit: 200 }).then(({ data }) => setAllCategories(data.data));
  }, [list.data]);

  const parents = allCategories.filter((c) => !c.parentCategory);

  const resetForm = () => {
    setForm({ nameAr: '', nameEn: '', slug: '', icon: '🛒', sortOrder: 0, parentCategory: '', isActive: true });
    setImageFile(null);
    setImagePreview('');
    setEditId(null);
    setShowForm(false);
  };

  const buildFormData = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value === '' || value == null) return;
      fd.append(key, key === 'isActive' ? String(value) : value);
    });
    if (imageFile) fd.append('image', imageFile);
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildFormData();
    if (editId) await adminApi.updateCategory(editId, payload);
    else await adminApi.createCategory(payload);
    resetForm();
    list.reload();
    adminApi.getCategories({ limit: 200 }).then(({ data }) => setAllCategories(data.data));
  };

  const handleEdit = (cat) => {
    setEditId(cat._id);
    setForm({
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      slug: cat.slug,
      icon: cat.icon || '🛒',
      sortOrder: cat.sortOrder || 0,
      parentCategory: cat.parentCategory?._id || cat.parentCategory || '',
      isActive: cat.isActive !== false,
    });
    setImagePreview(cat.image || '');
    setShowForm(true);
  };

  const runBulk = async (action, title) => {
    const ok = await confirm({ title, confirmLabel: isAr ? 'تأكيد' : 'Confirm', variant: action === 'delete' ? 'danger' : 'primary' });
    if (!ok) return;
    try {
      await adminApi.bulkCategories(list.selectedIds, action);
      list.clearSelection();
      list.reload();
    } catch (err) {
      toast.error(err.response?.data?.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: isAr ? 'القسم' : 'Category',
      sortKey: 'nameEn',
      render: (c) => (
        <>
          <span className="me-2">{c.icon}</span>
          {isAr ? c.nameAr : c.nameEn}
        </>
      ),
    },
    { key: 'slug', header: 'Slug', cellClassName: 'text-text-muted' },
    {
      key: 'type',
      header: isAr ? 'النوع' : 'Type',
      render: (c) => (c.parentCategory ? (isAr ? 'فرعي' : 'Sub') : (isAr ? 'رئيسي' : 'Main')),
    },
    {
      key: 'isActive',
      header: isAr ? 'الحالة' : 'Status',
      render: (c) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
          {c.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
          <Input label={isAr ? 'الاسم (عربي)' : 'Name AR'} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
          <Input label={isAr ? 'الاسم (EN)' : 'Name EN'} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input label="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'القسم الأب' : 'Parent'}</label>
            <select className="w-full rounded-xl border border-border px-4 py-2.5" value={form.parentCategory} onChange={(e) => setForm({ ...form, parentCategory: e.target.value })}>
              <option value="">{isAr ? 'قسم رئيسي' : 'Main'}</option>
              {parents.map((c) => (
                <option key={c._id} value={c._id}>{isAr ? c.nameAr : c.nameEn}</option>
              ))}
            </select>
          </div>
          <Input label={isAr ? 'الترتيب' : 'Sort'} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            {isAr ? 'نشط' : 'Active'}
          </label>
          <div className="sm:col-span-2">
            <input type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              setImageFile(file || null);
              if (file) setImagePreview(URL.createObjectURL(file));
            }} />
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{isAr ? 'حفظ' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={resetForm}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </form>
      )}

      <AdminListPage
        isAr={isAr}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث...' : 'Search...'}
        sort={list.sort}
        onSort={list.toggleSort}
        actions={(
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            {isAr ? '+ قسم' : '+ Category'}
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
            onActivate={() => runBulk('activate', isAr ? 'تفعيل' : 'Activate')}
            onDeactivate={() => runBulk('deactivate', isAr ? 'تعطيل' : 'Deactivate')}
            onDelete={() => runBulk('delete', isAr ? 'حذف' : 'Delete')}
            onClear={list.clearSelection}
          />
        )}
        columns={columns}
        data={list.data}
        loading={list.loading}
        selectable
        selectedIds={list.selectedIds}
        onToggleSelect={list.toggleSelect}
        onToggleSelectAll={list.toggleSelectAll}
        allSelected={list.allSelected}
        rowActions={(c) => [
          { label: isAr ? 'تعديل' : 'Edit', onClick: () => handleEdit(c) },
          {
            label: isAr ? 'حذف' : 'Delete',
            danger: true,
            onClick: async () => {
              const ok = await confirm({ title: isAr ? 'حذف القسم' : 'Delete', confirmLabel: isAr ? 'حذف' : 'Delete' });
              if (!ok) return;
              try {
                await adminApi.deleteCategory(c._id);
                list.reload();
              } catch (err) {
                toast.error(err.response?.data?.message);
              }
            },
          },
        ]}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={FolderOpen}
        emptyTitle={isAr ? 'لا توجد أقسام' : 'No categories'}
      />
    </div>
  );
}
