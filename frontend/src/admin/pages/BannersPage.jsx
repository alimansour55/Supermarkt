import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Image, Megaphone, Pencil, Power, Search, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import { CardSkeleton } from '../components/Skeleton';
import BannerEditorModal from '../components/BannerEditorModal';
import { EmptyState, PageHeader, useConfirm, useToast } from '../components';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';

const emptyBanner = {
  titleAr: '',
  titleEn: '',
  subtitleAr: '',
  subtitleEn: '',
  ctaAr: 'تسوق الآن',
  ctaEn: 'Shop Now',
  link: '/offers',
  placement: 'hero',
  targetAudience: 'all',
  startsAt: '',
  endsAt: '',
  priority: 0,
  sortOrder: 0,
  isActive: true,
  image: '',
  desktopImage: '',
  mobileImage: '',
};

function bannerId(banner) {
  return banner?._id || banner?.id || null;
}

function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function campaignStatus(banner, isAr) {
  const now = Date.now();
  if (!banner.isActive) return { label: isAr ? 'مسودة' : 'Draft', className: 'bg-slate-100 text-slate-700' };
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now) {
    return { label: isAr ? 'مجدول' : 'Scheduled', className: 'bg-blue-100 text-blue-800' };
  }
  if (banner.endsAt && new Date(banner.endsAt).getTime() < now) {
    return { label: isAr ? 'منتهي' : 'Expired', className: 'bg-amber-100 text-amber-800' };
  }
  return { label: isAr ? 'منشور' : 'Live', className: 'bg-green-100 text-green-800' };
}

export default function BannersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyBanner);
  const [files, setFiles] = useState({ image: null, desktopImage: null, mobileImage: null });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [placementFilter, setPlacementFilter] = useState('all');

  const desktopPreview = useMemo(() => (
    files.desktopImage ? URL.createObjectURL(files.desktopImage) : form.desktopImage || form.image
  ), [files.desktopImage, form.desktopImage, form.image]);

  const mobilePreview = useMemo(() => (
    files.mobileImage ? URL.createObjectURL(files.mobileImage) : form.mobileImage || form.desktopImage || form.image
  ), [files.mobileImage, form.desktopImage, form.image, form.mobileImage]);

  const load = () => {
    setLoading(true);
    adminApi.getBanners()
      .then(({ data }) => setBanners(data.data ?? []))
      .catch(() => {
        setBanners([]);
        toast.error(isAr ? 'تعذر تحميل البانرات' : 'Could not load banners');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    adminApi.getCategories()
      .then(({ data }) => setCategories(data.data ?? data ?? []))
      .catch(() => setCategories([]));
  }, []);

  const filteredBanners = useMemo(() => {
    const q = search.trim().toLowerCase();
    return banners.filter((banner) => {
      if (placementFilter !== 'all' && banner.placement !== placementFilter) return false;
      if (!q) return true;
      const hay = `${banner.titleAr || ''} ${banner.titleEn || ''} ${banner.link || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [banners, placementFilter, search]);

  useEffect(() => () => {
    if (files.desktopImage && desktopPreview?.startsWith('blob:')) URL.revokeObjectURL(desktopPreview);
    if (files.mobileImage && mobilePreview?.startsWith('blob:')) URL.revokeObjectURL(mobilePreview);
  }, [desktopPreview, files.desktopImage, files.mobileImage, mobilePreview]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyBanner);
    setFiles({ image: null, desktopImage: null, mobileImage: null });
    setEditorOpen(true);
  };

  const openEdit = (banner) => {
    const id = bannerId(banner);
    if (!id) {
      toast.error(isAr ? 'تعذر فتح هذا البانر' : 'Could not open this banner');
      return;
    }
    setEditId(id);
    setForm({
      titleAr: banner.titleAr || '',
      titleEn: banner.titleEn || '',
      subtitleAr: banner.subtitleAr || '',
      subtitleEn: banner.subtitleEn || '',
      ctaAr: banner.ctaAr || 'تسوق الآن',
      ctaEn: banner.ctaEn || 'Shop Now',
      link: banner.link || '/offers',
      placement: banner.placement || 'hero',
      targetAudience: banner.targetAudience || 'all',
      startsAt: dateInputValue(banner.startsAt),
      endsAt: dateInputValue(banner.endsAt),
      priority: banner.priority ?? 0,
      sortOrder: banner.sortOrder ?? 0,
      isActive: banner.isActive !== false,
      image: banner.image || '',
      desktopImage: banner.desktopImage || banner.image || '',
      mobileImage: banner.mobileImage || '',
    });
    setFiles({ image: null, desktopImage: null, mobileImage: null });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditId(null);
    setForm(emptyBanner);
    setFiles({ image: null, desktopImage: null, mobileImage: null });
  };

  const buildFormData = () => {
    const fd = new FormData();
    const payload = {
      ...form,
      link: normalizeHomepageLink(form.link) || '/offers',
    };
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== '' && v != null) fd.append(k, v);
    });
    if (files.image) fd.append('image', files.image);
    if (files.desktopImage) fd.append('desktopImage', files.desktopImage);
    if (files.mobileImage) fd.append('mobileImage', files.mobileImage);
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.startsAt && form.endsAt && new Date(form.startsAt) > new Date(form.endsAt)) {
      toast.error(isAr ? 'تاريخ البداية يجب أن يكون قبل النهاية' : 'Start date must be before end date');
      return;
    }
    if (!editId && !files.image && !files.desktopImage && !form.image && !form.desktopImage) {
      toast.error(isAr ? 'أضف صورة أو رابط صورة' : 'Add an image file or image URL');
      return;
    }

    setSaving(true);
    try {
      const fd = buildFormData();
      if (editId) await adminApi.updateBanner(editId, fd);
      else await adminApi.createBanner(fd);
      toast.success(isAr ? 'تم حفظ البانر' : 'Banner saved');
      closeEditor();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Could not save banner'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (banner, e) => {
    e?.stopPropagation?.();
    const id = bannerId(banner);
    if (!id) return;

    const ok = await confirm({
      title: isAr ? 'حذف البانر' : 'Delete banner',
      message: isAr ? 'هل تريد حذف هذا البانر نهائياً؟' : 'Delete this banner permanently?',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await adminApi.deleteBanner(id);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      if (editId === id) closeEditor();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحذف' : 'Could not delete'));
    }
  };

  const handleToggleActive = async (banner, e) => {
    e?.stopPropagation?.();
    const id = bannerId(banner);
    if (!id || togglingId) return;

    setTogglingId(id);
    try {
      const fd = new FormData();
      fd.append('isActive', String(!banner.isActive));
      fd.append('titleAr', banner.titleAr || '');
      fd.append('titleEn', banner.titleEn || '');
      fd.append('link', banner.link || '/offers');
      fd.append('placement', banner.placement || 'hero');
      fd.append('image', banner.image || banner.desktopImage || '');
      fd.append('desktopImage', banner.desktopImage || banner.image || '');
      await adminApi.updateBanner(id, fd);
      toast.success(!banner.isActive
        ? (isAr ? 'تم تفعيل البانر' : 'Banner activated')
        : (isAr ? 'تم إيقاف البانر' : 'Banner deactivated'));
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر التحديث' : 'Could not update'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={isAr ? 'إدارة بانرات الصفحة الرئيسية والعروض — انقر على أي بانر للتعديل' : 'Manage homepage and promo banners — click any banner to edit'}
        action={(
          <Button onClick={openCreate}>
            {isAr ? '+ بانر جديد' : '+ New banner'}
          </Button>
        )}
      />

      <BannerEditorModal
        open={editorOpen}
        isAr={isAr}
        isEditing={Boolean(editId)}
        form={form}
        setForm={setForm}
        files={files}
        setFiles={setFiles}
        desktopPreview={desktopPreview}
        mobilePreview={mobilePreview}
        saving={saving}
        categories={categories}
        allBanners={banners}
        editId={editId}
        onClose={closeEditor}
        onSubmit={handleSubmit}
      />

      {!loading && banners.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث في البانرات...' : 'Search banners...'}
              className="w-full rounded-xl border border-border py-2.5 ps-9 pe-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', labelAr: 'الكل', labelEn: 'All' },
              { value: 'hero', labelAr: 'Hero', labelEn: 'Hero' },
              { value: 'promo', labelAr: 'Promo', labelEn: 'Promo' },
              { value: 'sidebar', labelAr: 'Sidebar', labelEn: 'Sidebar' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPlacementFilter(tab.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  placementFilter === tab.value
                    ? 'bg-primary-600 text-white'
                    : 'border border-border bg-white hover:bg-surface-muted'
                }`}
              >
                {isAr ? tab.labelAr : tab.labelEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : banners.length === 0 ? (
        <EmptyState
          icon={Image}
          title={isAr ? 'لا توجد بانرات' : 'No banners yet'}
          description={isAr ? 'أضف بانراً للصفحة الرئيسية أو صفحة العروض' : 'Add a banner for the homepage or offers page'}
          action={<Button size="sm" onClick={openCreate}>{isAr ? 'بانر جديد' : 'New banner'}</Button>}
        />
      ) : filteredBanners.length === 0 ? (
        <EmptyState
          icon={Image}
          title={isAr ? 'لا توجد بانرات مطابقة' : 'No matching banners'}
          description={isAr ? 'جرّب فلتراً آخر أو أضف بانراً جديداً' : 'Try another filter or add a new banner'}
          action={<Button size="sm" onClick={openCreate}>{isAr ? 'بانر جديد' : 'New banner'}</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredBanners.map((banner) => {
            const id = bannerId(banner);
            const status = campaignStatus(banner, isAr);
            const imageSrc = banner.desktopImage || banner.image || banner.mobileImage;
            const isToggling = togglingId === id;

            return (
              <article
                key={id || banner.titleEn}
                className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => openEdit(banner)}
                  className="block w-full text-start"
                >
                  <div className="relative h-44 bg-slate-100">
                    {imageSrc ? (
                      <img src={imageSrc} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-text-muted">
                        <Image className="h-10 w-10" />
                      </div>
                    )}
                    <span className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="absolute end-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="inline h-3.5 w-3.5" />
                      {' '}
                      {isAr ? 'تعديل' : 'Edit'}
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="font-bold line-clamp-1">{isAr ? banner.titleAr : banner.titleEn}</p>
                    <p className="text-xs text-text-muted">
                      {banner.placement} · {banner.targetAudience || 'all'} · {banner.link}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Megaphone className="h-3.5 w-3.5" />
                        {isAr ? banner.ctaAr : banner.ctaEn}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {banner.startsAt ? new Date(banner.startsAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : (isAr ? 'الآن' : 'Now')}
                        {' — '}
                        {banner.endsAt ? new Date(banner.endsAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : (isAr ? 'مفتوح' : 'Open')}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="flex border-t border-border bg-slate-50/80">
                  <button
                    type="button"
                    onClick={() => openEdit(banner)}
                    className="flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
                  >
                    <Pencil className="h-4 w-4" />
                    {isAr ? 'تعديل' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={(e) => handleToggleActive(banner, e)}
                    className="flex flex-1 items-center justify-center gap-2 border-s border-border px-3 py-3 text-sm font-semibold text-text hover:bg-white disabled:opacity-50"
                  >
                    <Power className="h-4 w-4" />
                    {banner.isActive ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تفعيل' : 'Activate')}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(banner, e)}
                    className="flex items-center justify-center px-4 py-3 text-red-600 hover:bg-red-50"
                    aria-label={isAr ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
