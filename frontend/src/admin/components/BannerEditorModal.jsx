import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ImagePlus, Monitor, Smartphone, Trash2, Upload, X,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import { useConfirm } from './ConfirmDialog';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';
import {
  BANNER_AUDIENCES,
  BANNER_PLACEMENTS,
  bannerId,
  bannerStatus,
  bannerToForm,
  formIsDirty,
  placementMeta,
  relativeTime,
  sectionName,
  STATUS_META,
  storeInputFromNow,
  storeInputToDate,
  validateBannerForm,
} from '../utils/bannerAdmin';

const CTA_PRESETS = [
  { ctaAr: 'تسوق الآن', ctaEn: 'Shop Now' },
  { ctaAr: 'اكتشف العروض', ctaEn: 'View Offers' },
  { ctaAr: 'تصفح المنتجات', ctaEn: 'Browse Products' },
  { ctaAr: 'اطلب الآن', ctaEn: 'Order Now' },
];

const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const EMPTY_FILES = { desktopImage: null, mobileImage: null };

const ERROR_TEXT = {
  title: { ar: 'اكتب عنواناً بالعربية أو الإنجليزية', en: 'Add a title in Arabic or English' },
  image: { ar: 'أضف صورة للبانر', en: 'Add a banner image' },
  dates: { ar: 'تاريخ البداية يجب أن يكون قبل النهاية', en: 'Start must be before the end' },
};

function Step({ number, title, description, children, id }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
          {number}
        </span>
        <div>
          <h3 className="text-sm font-bold text-text">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function useObjectUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function useImageSize(src) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    setSize(null);
    if (!src) return undefined;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => { if (!cancelled) setSize({ w: img.naturalWidth, h: img.naturalHeight, ok: true }); };
    img.onerror = () => { if (!cancelled) setSize({ ok: false }); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return size;
}

function ImageSlot({
  label, hint, recommended, url, file, preview, onUrl, onFile, onClear, isAr, optional = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const size = useImageSize(preview);

  const notes = [];
  if (size?.ok === false) notes.push(isAr ? 'تعذر تحميل الصورة — تأكد من الرابط' : 'Image could not load — check the link');
  if (size?.ok && size.w < recommended.w * 0.75) {
    notes.push(isAr
      ? `الصورة صغيرة (${size.w}×${size.h}) — قد تظهر مشوشة`
      : `Image is small (${size.w}×${size.h}) — it may look blurry`);
  }
  if (size?.ok) {
    const ratio = size.w / size.h;
    const target = recommended.w / recommended.h;
    if (Math.abs(ratio - target) / target > 0.35) {
      notes.push(isAr ? 'شكل الصورة مختلف عن المقاس المقترح — سيُقص جزء منها' : 'Shape differs from the suggested size — part of it will be cropped');
    }
  }
  if (file && file.size > MAX_FILE_BYTES) {
    notes.push(isAr ? 'حجم الملف كبير — قد يبطئ الصفحة' : 'Large file — may slow the page down');
  }

  const takeFile = (next) => {
    if (next && next.type?.startsWith('image/')) onFile(next);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-text">
          {label}
          {optional && <span className="ms-1 font-normal text-text-muted">{isAr ? '(اختياري)' : '(optional)'}</span>}
        </p>
        <p className="text-[11px] text-text-muted" dir="ltr">{recommended.w}×{recommended.h}</p>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]); }}
        className={`group relative flex min-h-[132px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
          dragging ? 'border-primary-500 bg-primary-50' : 'border-border bg-slate-50 hover:border-primary-300'
        }`}
      >
        {preview ? (
          <>
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-text">
                {isAr ? 'تغيير الصورة' : 'Replace image'}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-text-muted">
            <ImagePlus className="h-7 w-7" />
            <p className="text-xs font-semibold text-text">{isAr ? 'اسحب صورة هنا أو اضغط للرفع' : 'Drop an image here or click to upload'}</p>
            <p className="text-[11px]">{hint}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs"
          dir="ltr"
          placeholder={isAr ? 'أو الصق رابط صورة https://…' : 'or paste an image link https://…'}
          value={file ? '' : url || ''}
          disabled={Boolean(file)}
          onChange={(e) => onUrl(e.target.value.trim())}
        />
        {(preview) && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        )}
      </div>
      {file && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
          <Upload className="h-3 w-3" />
          {file.name} · {Math.round(file.size / 1024)} KB · {isAr ? 'سيُرفع عند الحفظ' : 'uploads when you save'}
        </p>
      )}
      {notes.map((note) => (
        <p key={note} className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          {note}
        </p>
      ))}
    </div>
  );
}

/** Mirrors the storefront components so the admin sees what customers will see. */
function StorefrontPreview({ form, desktopSrc, mobileSrc, device, lang }) {
  const isAr = lang === 'ar';
  const meta = placementMeta(form.placement);
  const src = device === 'mobile' ? mobileSrc || desktopSrc : desktopSrc || mobileSrc;
  const title = (isAr ? form.titleAr || form.titleEn : form.titleEn || form.titleAr) || (isAr ? 'عنوان البانر' : 'Banner title');
  const subtitle = isAr ? form.subtitleAr || form.subtitleEn : form.subtitleEn || form.subtitleAr;
  const cta = (isAr ? form.ctaAr : form.ctaEn) || (isAr ? 'تسوق الآن' : 'Shop now');
  const showText = form.showText || !src;
  const aspect = device === 'mobile' ? meta.previewAspectMobile : meta.previewAspect;

  const image = src
    ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
    : <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-800" />;

  let body;
  if (form.placement === 'hero') {
    body = (
      <div className={`relative ${aspect} overflow-hidden rounded-xl bg-slate-200`}>
        {image}
        {showText && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
              <div className="min-w-0 text-white">
                <p className="line-clamp-1 text-sm font-extrabold drop-shadow">{title}</p>
                {subtitle && <p className="line-clamp-1 text-[11px] text-white/90">{subtitle}</p>}
              </div>
              <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-extrabold text-primary-700">{cta}</span>
            </div>
          </>
        )}
      </div>
    );
  } else if (form.placement === 'promo') {
    body = (
      <div className={`relative ${aspect} overflow-hidden rounded-2xl bg-slate-200`}>
        {image}
        {showText && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-3 text-white">
              <p className="line-clamp-1 text-sm font-bold">{title}</p>
              {subtitle && <p className="line-clamp-1 text-[11px] text-white/85">{subtitle}</p>}
              <span className="mt-1.5 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                {cta} {isAr ? '←' : '→'}
              </span>
            </div>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <div className="flex gap-2 overflow-hidden">
        <div className="relative h-28 w-44 shrink-0 overflow-hidden rounded-xl bg-slate-200 shadow-sm">
          {src ? image : (
            <div className="flex h-full items-end bg-primary-600 p-3 text-sm font-bold text-white">{title}</div>
          )}
        </div>
        <div className="h-28 w-20 shrink-0 rounded-xl bg-slate-200/70" />
      </div>
    );
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className={device === 'mobile' ? 'mx-auto w-[260px] rounded-[1.6rem] border-4 border-slate-800 bg-surface-muted p-2' : ''}>
      {body}
    </div>
  );
}

export default function BannerEditorModal({
  open,
  isAr,
  banner = null,
  allBanners = [],
  categories = [],
  placementSections = null,
  saving = false,
  onClose,
  onSave,
}) {
  const confirm = useConfirm();
  const editing = Boolean(banner && bannerId(banner));
  const initial = useMemo(() => bannerToForm(banner || {}), [banner]);
  const [form, setForm] = useState(initial);
  const [files, setFiles] = useState(EMPTY_FILES);
  const [errors, setErrors] = useState([]);
  const [device, setDevice] = useState('desktop');
  const [lang, setLang] = useState(isAr ? 'ar' : 'en');

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setFiles(EMPTY_FILES);
    setErrors([]);
    setDevice('desktop');
    setLang(isAr ? 'ar' : 'en');
  }, [open, initial, isAr]);

  const desktopBlob = useObjectUrl(files.desktopImage);
  const mobileBlob = useObjectUrl(files.mobileImage);
  const desktopSrc = desktopBlob || form.desktopImage;
  const mobileSrc = mobileBlob || form.mobileImage;
  const meta = placementMeta(form.placement);
  const dirty = formIsDirty(form, initial, files);
  const patch = (updates) => setForm((prev) => ({ ...prev, ...updates }));

  const requestClose = async () => {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: isAr ? 'تجاهل التغييرات؟' : 'Discard changes?',
        message: isAr ? 'لديك تغييرات لم تُحفظ.' : 'You have changes that are not saved.',
        confirmLabel: isAr ? 'تجاهل' : 'Discard',
        cancelLabel: isAr ? 'متابعة التعديل' : 'Keep editing',
        variant: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  });

  const schedule = useMemo(() => {
    const now = Date.now();
    const status = bannerStatus({
      isActive: form.isActive,
      startsAt: storeInputToDate(form.startsAt),
      endsAt: storeInputToDate(form.endsAt),
    }, now);
    const siblings = allBanners.filter((b) => (
      b.placement === form.placement
      && String(bannerId(b)) !== String(bannerId(banner))
      && bannerStatus(b, now).key === 'live'
    ));
    return { status, siblings, now };
  }, [allBanners, banner, form.endsAt, form.isActive, form.placement, form.startsAt]);

  const submit = async (e) => {
    e.preventDefault();
    const found = validateBannerForm(form, files);
    setErrors(found);
    if (found.length) return;
    await onSave({ form: { ...form, link: normalizeHomepageLink(form.link) || '/offers' }, files });
  };

  if (!open) return null;

  const statusMeta = STATUS_META[schedule.status.key];
  const sections = placementSections?.[form.placement] || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label={isAr ? 'إغلاق' : 'Close'} onClick={requestClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-editor-title"
        className="relative flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-border bg-slate-50 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="banner-editor-title" className="text-lg font-bold text-text">
              {editing ? (isAr ? 'تعديل البانر' : 'Edit banner') : (isAr ? 'بانر جديد' : 'New banner')}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {dirty ? (isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes') : (isAr ? 'لا توجد تغييرات' : 'No changes yet')}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="rounded-xl p-2 text-text-muted hover:bg-slate-100 disabled:opacity-50"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden" noValidate>
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              {errors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                  {errors.map((key) => <p key={key}>• {isAr ? ERROR_TEXT[key].ar : ERROR_TEXT[key].en}</p>)}
                </div>
              )}

              <Step number={1} title={isAr ? 'أين يظهر البانر؟' : 'Where does it show?'} description={isAr ? 'يحدد هذا مقاس الصورة المناسب.' : 'This sets the right image size.'}>
                <div className="grid gap-2 sm:grid-cols-3">
                  {BANNER_PLACEMENTS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => patch({ placement: p.value })}
                      aria-pressed={form.placement === p.value}
                      className={`rounded-xl border p-3 text-start transition ${
                        form.placement === p.value
                          ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-border bg-white hover:border-primary-200'
                      }`}
                    >
                      <p className="text-sm font-bold">{isAr ? p.labelAr : p.labelEn}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{isAr ? p.descAr : p.descEn}</p>
                    </button>
                  ))}
                </div>
                {placementSections && form.placement !== 'promo' && !sections.some((s) => s.isActive) && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    {isAr
                      ? 'لا يوجد قسم في الصفحة الرئيسية يعرض هذا المكان تلقائياً. أضفه من «الصفحة الرئيسية» حتى يظهر البانر.'
                      : 'No homepage section shows this placement automatically. Add one in the Homepage editor so the banner appears.'}
                  </p>
                )}
              </Step>

              <Step number={2} title={isAr ? 'الصور' : 'Images'} description={isAr ? 'تُقص الصور لتملأ المساحة. ارفع صورة منفصلة للموبايل لنتيجة أفضل.' : 'Images crop to fill the space. A separate phone image looks best.'}>
                <div className="grid gap-4 md:grid-cols-2">
                  <ImageSlot
                    isAr={isAr}
                    label={isAr ? 'صورة الكمبيوتر' : 'Desktop image'}
                    hint={isAr ? 'PNG أو JPG أو WebP' : 'PNG, JPG or WebP'}
                    recommended={meta.sizeDesktop}
                    url={form.desktopImage}
                    file={files.desktopImage}
                    preview={desktopSrc}
                    onUrl={(url) => patch({ desktopImage: url })}
                    onFile={(file) => setFiles((prev) => ({ ...prev, desktopImage: file }))}
                    onClear={() => { setFiles((prev) => ({ ...prev, desktopImage: null })); patch({ desktopImage: '' }); }}
                  />
                  <ImageSlot
                    isAr={isAr}
                    optional
                    label={isAr ? 'صورة الموبايل' : 'Phone image'}
                    hint={isAr ? 'إن لم تضفها تُستخدم صورة الكمبيوتر' : 'Falls back to the desktop image'}
                    recommended={meta.sizeMobile}
                    url={form.mobileImage}
                    file={files.mobileImage}
                    preview={mobileSrc}
                    onUrl={(url) => patch({ mobileImage: url })}
                    onFile={(file) => setFiles((prev) => ({ ...prev, mobileImage: file }))}
                    onClear={() => { setFiles((prev) => ({ ...prev, mobileImage: null })); patch({ mobileImage: '' }); }}
                  />
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-slate-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!form.showText}
                    onChange={(e) => patch({ showText: !e.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{isAr ? 'الكلام مكتوب داخل الصورة' : 'The words are already in the image'}</span>
                    <span className="block text-xs text-text-muted">
                      {isAr ? 'لن نكتب العنوان والزر فوق الصورة، ويصبح البانر كله قابلاً للضغط.' : "We won't draw the title and button on top, and the whole banner becomes the link."}
                    </span>
                  </span>
                </label>
              </Step>

              <Step number={3} title={isAr ? 'النص والزر' : 'Text & button'} description={isAr ? 'يكفي لغة واحدة — نكمل الأخرى تلقائياً. لكن الأفضل كتابة الاثنتين.' : 'One language is enough — we fill in the other. Both is best.'}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={isAr ? 'العنوان بالعربية' : 'Title (Arabic)'} dir="rtl" name="banner-titleAr" value={form.titleAr} onChange={(e) => patch({ titleAr: e.target.value })} />
                  <Input label={isAr ? 'العنوان بالإنجليزية' : 'Title (English)'} dir="ltr" name="banner-titleEn" value={form.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} />
                  <Input label={isAr ? 'سطر إضافي بالعربية' : 'Extra line (Arabic)'} dir="rtl" name="banner-subtitleAr" value={form.subtitleAr} onChange={(e) => patch({ subtitleAr: e.target.value })} />
                  <Input label={isAr ? 'سطر إضافي بالإنجليزية' : 'Extra line (English)'} dir="ltr" name="banner-subtitleEn" value={form.subtitleEn} onChange={(e) => patch({ subtitleEn: e.target.value })} />
                  <Input label={isAr ? 'نص الزر بالعربية' : 'Button text (Arabic)'} dir="rtl" name="banner-ctaAr" value={form.ctaAr} onChange={(e) => patch({ ctaAr: e.target.value })} />
                  <Input label={isAr ? 'نص الزر بالإنجليزية' : 'Button text (English)'} dir="ltr" name="banner-ctaEn" value={form.ctaEn} onChange={(e) => patch({ ctaEn: e.target.value })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CTA_PRESETS.map((preset) => (
                    <button
                      key={preset.ctaEn}
                      type="button"
                      onClick={() => patch(preset)}
                      className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-1 text-xs font-semibold hover:border-primary-200 hover:bg-primary-50"
                    >
                      {isAr ? preset.ctaAr : preset.ctaEn}
                    </button>
                  ))}
                </div>
                {!form.showText && (
                  <p className="mt-3 text-xs text-text-muted">
                    {isAr ? 'النص لن يظهر فوق الصورة، لكنه يُستخدم لقارئات الشاشة ومحركات البحث.' : "The text won't show on the image, but screen readers and search engines still use it."}
                  </p>
                )}
              </Step>

              <Step number={4} title={isAr ? 'إلى أين يذهب الزائر عند الضغط؟' : 'Where does a click go?'}>
                <HomepageDestinationPicker
                  href={form.link}
                  isAr={isAr}
                  categories={categories}
                  titleAr="وجهة الضغط"
                  titleEn="Click destination"
                  hintAr="صفحات المتجر، الأقسام، العروض..."
                  hintEn="Store pages, categories, offers..."
                  customLabelAr="رابط مخصص"
                  customLabelEn="Custom link"
                  onChange={(path) => patch({ link: normalizeHomepageLink(path) || '/offers' })}
                />
              </Step>

              <Step number={5} title={isAr ? 'متى ولمن يظهر؟' : 'When and for whom?'} description={isAr ? 'الأوقات بتوقيت القاهرة.' : 'Times are Cairo time.'}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'always', ar: 'دائماً', en: 'Always', apply: () => patch({ startsAt: '', endsAt: '' }) },
                    { key: 'week', ar: 'من الآن لمدة أسبوع', en: 'Now, for 1 week', apply: () => patch({ startsAt: storeInputFromNow(), endsAt: storeInputFromNow({ days: 7 }) }) },
                    { key: 'month', ar: 'من الآن لمدة شهر', en: 'Now, for 1 month', apply: () => patch({ startsAt: storeInputFromNow(), endsAt: storeInputFromNow({ months: 1 }) }) },
                    { key: 'tomorrow', ar: 'يبدأ غداً', en: 'Starts tomorrow', apply: () => patch({ startsAt: `${storeInputFromNow({ days: 1 }).slice(0, 10)}T00:00` }) },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={preset.apply}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                    >
                      {isAr ? preset.ar : preset.en}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Input label={isAr ? 'يبدأ في' : 'Starts'} type="datetime-local" name="banner-startsAt" value={form.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
                  <Input label={isAr ? 'ينتهي في' : 'Ends'} type="datetime-local" name="banner-endsAt" value={form.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} />
                </div>
                <p className="mt-2 text-[11px] text-text-muted">{isAr ? 'اترك الحقل فارغاً = بدون حد.' : 'Leave empty for no limit.'}</p>

                <p className="mb-2 mt-5 text-xs font-semibold text-text">{isAr ? 'من يراه؟' : 'Who sees it?'}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {BANNER_AUDIENCES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ targetAudience: opt.value })}
                      aria-pressed={form.targetAudience === opt.value}
                      className={`rounded-xl border px-3 py-2.5 text-start transition ${
                        form.targetAudience === opt.value ? 'border-primary-400 bg-primary-50' : 'border-border bg-white hover:bg-surface-muted'
                      }`}
                    >
                      <p className="text-sm font-semibold">{isAr ? opt.labelAr : opt.labelEn}</p>
                      <p className="text-xs text-text-muted">{isAr ? opt.descAr : opt.descEn}</p>
                    </button>
                  ))}
                </div>
                {form.targetAudience === 'staff' && (
                  <p className="mt-2 text-xs text-amber-700">{isAr ? 'هذا البانر يظهر للموظفين فقط.' : 'This banner is shown to staff only.'}</p>
                )}
              </Step>
            </div>

            <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-2xl border border-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{isAr ? 'كما سيراه العميل' : 'What customers see'}</p>
                  <div className="flex gap-1">
                    <div className="flex rounded-lg border border-border p-0.5">
                      {[{ v: 'desktop', Icon: Monitor }, { v: 'mobile', Icon: Smartphone }].map(({ v, Icon }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setDevice(v)}
                          aria-pressed={device === v}
                          aria-label={v === 'desktop' ? (isAr ? 'كمبيوتر' : 'Desktop') : (isAr ? 'موبايل' : 'Phone')}
                          className={`rounded-md p-1.5 ${device === v ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-100'}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                    <div className="flex rounded-lg border border-border p-0.5 text-[11px] font-bold">
                      {['ar', 'en'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setLang(v)}
                          aria-pressed={lang === v}
                          className={`rounded-md px-2 py-1 ${lang === v ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-100'}`}
                        >
                          {v === 'ar' ? 'ع' : 'EN'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <StorefrontPreview form={form} desktopSrc={desktopSrc} mobileSrc={mobileSrc} device={device} lang={lang} />
                <p className="mt-2 text-center text-[11px] text-text-muted">{isAr ? meta.labelAr : meta.labelEn}</p>
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                  <span className="font-bold text-text">{isAr ? statusMeta.labelAr : statusMeta.labelEn}</span>
                  {schedule.status.at && (
                    <span className="text-text-muted">
                      · {schedule.status.key === 'scheduled' ? (isAr ? 'يبدأ' : 'starts') : (isAr ? 'ينتهي' : 'ends')} {relativeTime(schedule.status.at, isAr, schedule.now)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-text-muted">
                  {schedule.siblings.length > 0
                    ? (isAr
                      ? `${schedule.siblings.length} بانر(ات) أخرى تظهر الآن في نفس المكان.`
                      : `${schedule.siblings.length} other banner(s) are live in this spot right now.`)
                    : (isAr ? 'لا توجد بانرات أخرى تظهر الآن في هذا المكان.' : 'No other banners are live in this spot right now.')}
                </p>
                {banner?.usedIn?.length > 0 && (
                  <p className="mt-2 text-text-muted">
                    {isAr ? 'مختار يدوياً في: ' : 'Hand-picked in: '}
                    {banner.usedIn.map((s) => sectionName(s, isAr)).join(isAr ? '، ' : ', ')}
                  </p>
                )}
              </div>
            </aside>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-white px-5 py-3 sm:px-6">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <span className="relative inline-flex">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={form.isActive}
                  onChange={(e) => patch({ isActive: e.target.checked })}
                />
                <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-green-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300" />
                <span className="absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
              </span>
              {form.isActive ? (isAr ? 'مُفعّل' : 'Turned on') : (isAr ? 'متوقف' : 'Paused')}
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={requestClose} disabled={saving}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saving || (editing && !dirty)}>
                <Check className="me-1 inline h-4 w-4" />
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
