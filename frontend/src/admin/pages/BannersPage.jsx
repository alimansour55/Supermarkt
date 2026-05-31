import { useEffect, useState } from 'react';
import { Image } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { CardSkeleton } from '../components/Skeleton';
import { EmptyState, PageHeader, useConfirm, useToast } from '../components';

const emptyBanner = {
  titleAr: '',
  titleEn: '',
  subtitleAr: '',
  subtitleEn: '',
  link: '/offers',
  placement: 'hero',
  sortOrder: 0,
  isActive: true,
  image: '',
};

export default function BannersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyBanner);
  const [file, setFile] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const load = () => {
    setLoading(true);
    adminApi.getBanners()
      .then(({ data }) => setBanners(data.data ?? []))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const buildFormData = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v != null) fd.append(k, v);
    });
    if (file) fd.append('image', file);
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = buildFormData();
    if (!editId && !file && !form.image) {
      toast.error(isAr ? 'أضف صورة أو رابط صورة' : 'Add image file or URL');
      return;
    }
    if (editId) {
      await adminApi.updateBanner(editId, fd);
    } else {
      await adminApi.createBanner(fd);
    }
    setShowForm(false);
    setEditId(null);
    setForm(emptyBanner);
    setFile(null);
    load();
  };

  const handleEdit = (b) => {
    setEditId(b._id);
    setForm({
      titleAr: b.titleAr,
      titleEn: b.titleEn,
      subtitleAr: b.subtitleAr || '',
      subtitleEn: b.subtitleEn || '',
      link: b.link || '/offers',
      placement: b.placement || 'hero',
      sortOrder: b.sortOrder || 0,
      isActive: b.isActive !== false,
      image: b.image,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: isAr ? 'حذف البanner' : 'Delete banner',
      message: isAr ? 'هل تريد حذف هذا الـ banner؟' : 'Are you sure you want to delete this banner?',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    await adminApi.deleteBanner(id);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={(
          <Button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyBanner); setFile(null); }}>
            {isAr ? '+ banner' : '+ Banner'}
          </Button>
        )}
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
          <Input label={isAr ? 'العنوان (عربي)' : 'Title AR'} value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} required />
          <Input label={isAr ? 'العنوان (EN)' : 'Title EN'} value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} required />
          <Input label={isAr ? 'الوصف (عربي)' : 'Subtitle AR'} value={form.subtitleAr} onChange={(e) => setForm({ ...form, subtitleAr: e.target.value })} />
          <Input label={isAr ? 'الوصف (EN)' : 'Subtitle EN'} value={form.subtitleEn} onChange={(e) => setForm({ ...form, subtitleEn: e.target.value })} />
          <Input label="Link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'الموضع' : 'Placement'}</label>
            <select className="w-full rounded-xl border border-border px-4 py-2.5" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
              <option value="hero">Hero</option>
              <option value="promo">Promo</option>
              <option value="sidebar">Sidebar</option>
            </select>
          </div>
          <Input label={isAr ? 'رابط الصورة' : 'Image URL'} value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'رفع صورة' : 'Upload image'}</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <Button type="submit">{isAr ? 'حفظ' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : banners.length === 0 ? (
        <EmptyState
          icon={Image}
          title={isAr ? 'لا توجد banners' : 'No banners'}
          description={isAr ? 'أضف banner للصفحة الرئيسية' : 'Add a banner for the homepage'}
          action={(
            <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyBanner); setFile(null); }}>
              {isAr ? 'banner جديد' : 'New banner'}
            </Button>
          )}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {banners.map((b) => (
            <div key={b._id} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <img src={b.image} alt={b.titleEn} className="h-36 w-full object-cover" />
              <div className="p-4">
                <p className="font-bold">{isAr ? b.titleAr : b.titleEn}</p>
                <p className="text-xs text-text-muted">{b.placement} · {b.link}</p>
                <div className="mt-3 flex gap-3">
                  <button type="button" className="text-sm text-primary-600 hover:underline" onClick={() => handleEdit(b)}>{isAr ? 'تعديل' : 'Edit'}</button>
                  <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => handleDelete(b._id)}>{isAr ? 'حذف' : 'Delete'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
