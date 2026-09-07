import { useEffect, useMemo, useState } from 'react';
import { Eye, Smartphone, Upload, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';
import { bannerIsLiveNow, bannerScheduleStatus } from '../utils/bannerScheduleUtils';

const PLACEMENTS = [
  {
    value: 'hero',
    labelAr: 'السلايدر الرئيسي',
    labelEn: 'Hero slider',
    descAr: 'بانر كبير — يُستورد يدوياً من «الصفحة الرئيسية» أو يُعرض تلقائياً في وضع Auto.',
    descEn: 'Large hero — import manually in Homepage builder or show in Auto mode.',
  },
  {
    value: 'promo',
    labelAr: 'بانرات العروض',
    labelEn: 'Promo banners',
    descAr: 'شبكة العروض وشريط الصور في الصفحة الرئيسية.',
    descEn: 'Promo grid and image strip on the homepage.',
  },
  {
    value: 'sidebar',
    labelAr: 'الشريط الجانبي',
    labelEn: 'Sidebar',
    descAr: 'بانرات جانبية في أقسام الصفحة الرئيسية.',
    descEn: 'Sidebar banner row on the homepage.',
  },
];

const CTA_PRESETS = [
  { ctaAr: 'تسوق الآن', ctaEn: 'Shop Now' },
  { ctaAr: 'اكتشف العروض', ctaEn: 'View Offers' },
  { ctaAr: 'تصفح المنتجات', ctaEn: 'Browse Products' },
  { ctaAr: 'اطلب الآن', ctaEn: 'Order Now' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all', labelAr: 'الكل', labelEn: 'Everyone', descAr: 'جميع الزوار', descEn: 'All visitors' },
  { value: 'guests', labelAr: 'الزوار', labelEn: 'Guests', descAr: 'غير مسجّلين', descEn: 'Not logged in' },
  { value: 'customers', labelAr: 'العملاء', labelEn: 'Customers', descAr: 'مسجّلون فقط', descEn: 'Logged-in only' },
];

function FormBlock({ title, description, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-border bg-white p-4 sm:p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-text">{title}</h3>
        {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function BannerImageField({
  label,
  value,
  file,
  onUrlChange,
  onFileChange,
  isAr,
  variant = 'desktop',
}) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const preview = blobUrl || value;

  return (
    <div className="rounded-xl border border-border bg-slate-50/80 p-3">
      <label className="mb-2 block text-xs font-semibold text-text">{label}</label>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
          dir="ltr"
          placeholder="https://..."
          value={value || ''}
          onChange={(e) => onUrlChange(e.target.value)}
        />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100">
          <Upload className="h-3.5 w-3.5" />
          {isAr ? 'رفع' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      {(preview || value) && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-muted">
          <div className={variant === 'mobile' ? 'aspect-[9/16] max-h-40 w-24 mx-auto' : 'aspect-[21/9] w-full'}>
            <img
              src={preview || value}
              alt=""
              className="h-full w-full object-cover object-center"
            />
          </div>
          <p className="px-2 py-1 text-[10px] text-text-muted">
            {isAr ? 'معاينة — تُقص الصورة لتملأ البانر' : 'Preview — image crops to fill the banner'}
          </p>
        </div>
      )}
    </div>
  );
}

function BannerPreview({ form, desktopPreview, mobilePreview, isAr }) {
  const title = isAr ? form.titleAr : form.titleEn;
  const subtitle = isAr ? form.subtitleAr : form.subtitleEn;
  const cta = isAr ? form.ctaAr : form.ctaEn;
  const placement = PLACEMENTS.find((p) => p.value === form.placement);

  return (
    <div className="space-y-4 lg:sticky lg:top-4">
      <div className="rounded-2xl border border-border bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
          <Eye className="h-4 w-4 text-primary-600" aria-hidden />
          {isAr ? 'معاينة مباشرة' : 'Live preview'}
        </div>
        <div className="relative min-h-[160px] overflow-hidden rounded-2xl bg-slate-800">
          {desktopPreview && (
            <>
              <img src={desktopPreview} alt="" className="absolute inset-0 h-full w-full min-h-full min-w-full object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-black/10" />
            </>
          )}
          <div className="relative z-10 p-5 text-white">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-white/70">
              {isAr ? placement?.labelAr : placement?.labelEn || form.placement}
            </p>
            <h3 className="text-xl font-extrabold">{title || (isAr ? 'عنوان الحملة' : 'Campaign title')}</h3>
            {subtitle && <p className="mt-2 text-sm text-white/90">{subtitle}</p>}
            <span className="mt-4 inline-flex rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-primary-700">
              {cta || (isAr ? 'تسوق الآن' : 'Shop now')}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-white p-3">
          <Smartphone className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {mobilePreview ? (
              <img src={mobilePreview} alt="" className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-text-muted">Mobile</div>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {isAr ? 'صورة الموبايل (اختياري)' : 'Mobile image (optional)'}
          </p>
        </div>

        <div className="mt-3 space-y-1 rounded-xl border border-dashed border-border bg-white px-3 py-2 text-xs text-text-muted">
          <p>
            <span className="font-semibold text-text">{isAr ? 'الرابط:' : 'Link:'}</span>
            {' '}
            {form.link || '/offers'}
          </p>
          <p>
            <span className="font-semibold text-text">{isAr ? 'الحالة:' : 'Status:'}</span>
            {' '}
            {form.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'متوقف' : 'Paused')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BannerEditorModal({
  open,
  isAr,
  isEditing,
  form,
  setForm,
  files,
  setFiles,
  desktopPreview,
  mobilePreview,
  saving,
  categories = [],
  allBanners = [],
  editId = null,
  onClose,
  onSubmit,
}) {
  const patch = (updates) => setForm({ ...form, ...updates });

  const schedulePreview = useMemo(() => {
    const now = new Date();
    const mockBanner = {
      isActive: form.isActive,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
    };
    const status = bannerScheduleStatus(mockBanner, now);
    const liveSiblings = allBanners.filter(
      (b) => b.placement === form.placement
        && String(b._id) !== String(editId)
        && bannerIsLiveNow(b, now),
    );
    const startsFuture = form.startsAt && new Date(form.startsAt) > now;
    return { status, liveSiblings, startsFuture };
  }, [allBanners, editId, form.isActive, form.placement, form.startsAt, form.endsAt]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, saving]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={isAr ? 'إغلاق' : 'Close'}
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-editor-title"
        className="relative flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-border bg-slate-50 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id="banner-editor-title" className="text-lg font-bold text-text sm:text-xl">
              {isEditing ? (isAr ? 'تعديل البانر' : 'Edit banner') : (isAr ? 'بانر جديد' : 'New banner')}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {isAr ? 'نصوص، صور، رابط الوجهة، والجدولة — كل شيء في مكان واحد' : 'Copy, images, destination link, and schedule — all in one place'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-text-muted hover:bg-slate-100 disabled:opacity-50"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <FormBlock
                title={isAr ? 'النصوص والزر' : 'Copy & button'}
                description={isAr ? 'العناوين بالعربية والإنجليزية كما تظهر للعميل.' : 'Titles in Arabic and English as customers see them.'}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={isAr ? 'العنوان (عربي)' : 'Title AR'} value={form.titleAr} onChange={(e) => patch({ titleAr: e.target.value })} required />
                  <Input label={isAr ? 'العنوان (EN)' : 'Title EN'} value={form.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} required />
                  <Input label={isAr ? 'الوصف (عربي)' : 'Subtitle AR'} value={form.subtitleAr} onChange={(e) => patch({ subtitleAr: e.target.value })} />
                  <Input label={isAr ? 'الوصف (EN)' : 'Subtitle EN'} value={form.subtitleEn} onChange={(e) => patch({ subtitleEn: e.target.value })} />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label={isAr ? 'نص الزر (عربي)' : 'CTA AR'} value={form.ctaAr} onChange={(e) => patch({ ctaAr: e.target.value })} />
                  <Input label={isAr ? 'نص الزر (EN)' : 'CTA EN'} value={form.ctaEn} onChange={(e) => patch({ ctaEn: e.target.value })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CTA_PRESETS.map((preset) => (
                    <button
                      key={preset.ctaEn}
                      type="button"
                      onClick={() => patch({ ctaAr: preset.ctaAr, ctaEn: preset.ctaEn })}
                      className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-1 text-xs font-semibold hover:border-primary-200 hover:bg-primary-50"
                    >
                      {isAr ? preset.ctaAr : preset.ctaEn}
                    </button>
                  ))}
                </div>
              </FormBlock>

              <FormBlock
                title={isAr ? 'الرابط — إلى أين يذهب الزائر؟' : 'Link — where does the click go?'}
                description={isAr ? 'اختر صفحة أو قسم من المتجر، أو اكتب رابطاً مخصصاً.' : 'Pick a store page or category, or type a custom URL.'}
              >
                <HomepageDestinationPicker
                  href={form.link}
                  isAr={isAr}
                  categories={categories}
                  titleAr="وجهة النقر"
                  titleEn="Click destination"
                  hintAr="صفحات المتجر، الأقسام، العروض، الحساب..."
                  hintEn="Store pages, categories, offers, account..."
                  customLabelAr="رابط مخصص"
                  customLabelEn="Custom URL"
                  onChange={(path) => patch({ link: normalizeHomepageLink(path) || '/offers' })}
                />
              </FormBlock>

              <FormBlock
                title={isAr ? 'الصور' : 'Images'}
                description={isAr ? 'ارفع صورة أو الصق رابطاً — تُقص تلقائياً لتملأ البانر.' : 'Upload or paste a URL — images auto-crop to fill the banner.'}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <BannerImageField
                    label={isAr ? 'صورة سطح المكتب / الرئيسية' : 'Desktop / main image'}
                    value={form.desktopImage || form.image}
                    file={files.desktopImage || files.image}
                    isAr={isAr}
                    variant="desktop"
                    onUrlChange={(url) => patch({ desktopImage: url, image: url || form.image })}
                    onFileChange={(file) => setFiles({ ...files, desktopImage: file, image: file || files.image })}
                  />
                  <BannerImageField
                    label={isAr ? 'صورة الموبايل (اختياري)' : 'Mobile image (optional)'}
                    value={form.mobileImage}
                    file={files.mobileImage}
                    isAr={isAr}
                    variant="mobile"
                    onUrlChange={(url) => patch({ mobileImage: url })}
                    onFileChange={(file) => setFiles({ ...files, mobileImage: file })}
                  />
                </div>
              </FormBlock>

              <FormBlock
                title={isAr ? 'الموضع والجمهور' : 'Placement & audience'}
                description={isAr ? 'أين يظهر البانر ومن يراه.' : 'Where the banner appears and who sees it.'}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {PLACEMENTS.map((placement) => (
                    <button
                      key={placement.value}
                      type="button"
                      onClick={() => patch({ placement: placement.value })}
                      className={`rounded-xl border p-3 text-start transition ${
                        form.placement === placement.value
                          ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-border bg-white hover:border-primary-200'
                      }`}
                    >
                      <p className="text-sm font-bold">{isAr ? placement.labelAr : placement.labelEn}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                        {isAr ? placement.descAr : placement.descEn}
                      </p>
                    </button>
                  ))}
                </div>

                {form.placement === 'hero' && (
                  <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
                    {isAr
                      ? '💡 للتحكم الدقيق بالسلايدر الرئيسي (ترتيب واختيار شرائح محددة) استخدم «الصفحة الرئيسية» في لوحة التحكم.'
                      : '💡 For precise hero slider control (order & hand-picked slides), use Homepage builder in admin.'}
                  </p>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ targetAudience: opt.value })}
                      className={`rounded-xl border px-3 py-2.5 text-start transition ${
                        form.targetAudience === opt.value
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-border bg-white hover:bg-surface-muted'
                      }`}
                    >
                      <p className="text-sm font-semibold">{isAr ? opt.labelAr : opt.labelEn}</p>
                      <p className="text-xs text-text-muted">{isAr ? opt.descAr : opt.descEn}</p>
                    </button>
                  ))}
                </div>
              </FormBlock>

              <FormBlock
                title={isAr ? 'الجدولة والترتيب' : 'Schedule & ordering'}
                description={isAr ? 'متى يُعرض البانر وأولويته بين البانرات الأخرى.' : 'When the banner runs and its priority vs other banners.'}
              >
                <div className={`rounded-xl border p-4 text-sm ${
                  schedulePreview.startsFuture ? 'border-blue-200 bg-blue-50/70' : 'border-green-200 bg-green-50/60'
                }`}>
                  <p className="font-bold text-text">
                    {isAr ? 'ماذا يظهر على الموقع؟' : 'What shows on the site?'}
                  </p>
                  {schedulePreview.startsFuture ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-text-muted">
                      <li>
                        {isAr
                          ? `هذا البانر «مجدول» — لن يظهر قبل ${new Date(form.startsAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}.`
                          : `This banner is scheduled — hidden until ${new Date(form.startsAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}.`}
                      </li>
                      <li>
                        {schedulePreview.liveSiblings.length > 0
                          ? (isAr
                            ? `حتى ذلك الوقت: ${schedulePreview.liveSiblings.length} بانر(ات) نشطة أخرى في موضع «${form.placement}» ستظهر بدلاً منه.`
                            : `Until then: ${schedulePreview.liveSiblings.length} other live banner(s) in «${form.placement}» will show instead.`)
                          : (isAr
                            ? 'حتى ذلك الوقت: لا بانرات نشطة أخرى في نفس الموضع — قد لا يظهر شيء (أضف بانراً احتياطياً أو استخدم الصفحة الرئيسية).'
                            : 'Until then: no other live banners in this placement — nothing may show (add a fallback or use Homepage CMS).')}
                      </li>
                      <li>
                        {isAr
                          ? 'للسلايدر الرئيسي: استخدم «جدولة أسبوعية» في الصفحة الرئيسية لربط بانرات مختلفة كل أسبوع.'
                          : 'For the hero: use «Weekly rotation» in Homepage CMS to link different banners each week.'}
                      </li>
                    </ul>
                  ) : (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-text-muted">
                      <li>
                        {isAr
                          ? `الحالة: ${schedulePreview.status.labelAr}${form.isActive ? '' : ' (البانر متوقف — لن يظهر)'}.`
                          : `Status: ${schedulePreview.status.labelEn}${form.isActive ? '' : ' (banner paused — hidden)'}.`}
                      </li>
                      <li>
                        {isAr
                          ? 'يظهر مع البانرات الأخرى النشطة في نفس الموضع — الأعلى أولوية أولاً.'
                          : 'Shows alongside other live banners in this placement — highest priority first.'}
                      </li>
                    </ul>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label={isAr ? 'تاريخ البداية' : 'Start date'} type="datetime-local" value={form.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
                  <Input label={isAr ? 'تاريخ النهاية' : 'End date'} type="datetime-local" value={form.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} />
                  <Input label={isAr ? 'الأولوية' : 'Priority'} type="number" value={form.priority} onChange={(e) => patch({ priority: e.target.value })} />
                  <Input label={isAr ? 'الترتيب' : 'Sort order'} type="number" value={form.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => patch({ startsAt: '', endsAt: '' })} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted">
                    {isAr ? 'دائماً (بدون جدولة)' : 'Always (no schedule)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const start = new Date();
                      const end = new Date();
                      end.setDate(end.getDate() + 7);
                      patch({
                        startsAt: start.toISOString().slice(0, 16),
                        endsAt: end.toISOString().slice(0, 16),
                      });
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                  >
                    {isAr ? 'أسبوع واحد' : 'One week'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const start = new Date();
                      const end = new Date();
                      end.setMonth(end.getMonth() + 1);
                      patch({
                        startsAt: start.toISOString().slice(0, 16),
                        endsAt: end.toISOString().slice(0, 16),
                      });
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                  >
                    {isAr ? 'شهر واحد' : 'One month'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {isAr ? 'الأولوية الأعلى تظهر أولاً. الترتيب يُستخدم عند تساوي الأولوية.' : 'Higher priority shows first. Sort order breaks ties.'}
                </p>
              </FormBlock>

              <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => patch({ isActive: e.target.checked })} />
                {isAr ? 'نشط — يظهر للعملاء حسب الجدولة والموضع' : 'Active — visible to customers per schedule and placement'}
              </label>
            </div>

            <BannerPreview
              form={form}
              desktopPreview={desktopPreview}
              mobilePreview={mobilePreview}
              isAr={isAr}
            />
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-border bg-white px-5 py-4 sm:px-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save changes')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
