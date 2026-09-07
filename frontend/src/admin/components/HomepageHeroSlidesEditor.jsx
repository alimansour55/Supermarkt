import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import HomepageHeroScheduleEditor from './HomepageHeroScheduleEditor';
import { bannerScheduleStatus, normalizeHeroRotation } from '../utils/bannerScheduleUtils';
import { CAMPAIGN_PLACEMENTS, LAYOUT_OPTIONS, normalizeHomepageLink } from '../utils/homepageSectionMeta';
import { EMPTY_HERO_SLIDE, slideFromBanner, slidePreviewUrl } from './homepageHeroSlideHelpers';

function BannerPickerModal({ open, onClose, onPick, existingBannerIds, isAr }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [placement, setPlacement] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setLoading(true);
    adminApi.getBanners()
      .then((res) => setBanners(res.data?.data || res.data || []))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return banners.filter((b) => {
      if (placement && b.placement !== placement) return false;
      if (!q) return true;
      const hay = `${b.titleAr || ''} ${b.titleEn || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [banners, placement, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-bold text-text">
            {isAr ? 'استيراد من مكتبة البانرات' : 'Import from banner library'}
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            {isAr
              ? 'اختر بانرات محددة — لن تُضاف كل البانرات تلقائياً.'
              : 'Pick specific banners — the hero will not show every banner automatically.'}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-xl border border-border px-3 py-2 text-sm"
              placeholder={isAr ? 'بحث...' : 'Search...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="rounded-xl border border-border px-3 py-2 text-sm"
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
            >
              <option value="">{isAr ? 'كل المواضع' : 'All placements'}</option>
              {CAMPAIGN_PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>{isAr ? p.labelAr : p.labelEn}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="py-8 text-center text-sm text-text-muted">{isAr ? 'جار التحميل...' : 'Loading...'}</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-text-muted">
              {isAr ? 'لا توجد بانرات مطابقة.' : 'No matching banners.'}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((banner) => {
              const used = existingBannerIds.has(String(banner._id));
              const thumb = banner.desktopImage || banner.image || banner.mobileImage;
              const status = bannerScheduleStatus(banner);
              return (
                <button
                  key={banner._id}
                  type="button"
                  disabled={used}
                  onClick={() => onPick(banner)}
                  className={`flex gap-3 rounded-xl border p-3 text-start transition ${
                    used
                      ? 'cursor-not-allowed border-border bg-surface-muted/40 opacity-60'
                      : 'border-border hover:border-primary-300 hover:bg-primary-50/40'
                  }`}
                >
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-text-muted">—</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{banner.titleAr || banner.titleEn || '—'}</p>
                    <p className="truncate text-xs text-text-muted">{banner.placement || 'promo'}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                      {isAr ? status.labelAr : status.labelEn}
                    </span>
                    {used && (
                      <span className="mt-1 inline-block text-xs font-medium text-primary-700">
                        {isAr ? 'مضاف مسبقاً' : 'Already added'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between gap-3 border-t border-border px-5 py-4">
          <Link to="/admin/banners" className="text-sm font-semibold text-primary-700 hover:underline">
            {isAr ? 'إدارة البانرات ←' : 'Manage banners →'}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageField({ label, value, onChange, onUpload, uploading, isAr }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-muted">{label}</label>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm"
          dir="ltr"
          placeholder="https://..."
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? '…' : (isAr ? 'رفع' : 'Upload')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {value && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border bg-surface-muted">
          <div className="aspect-[21/9] w-full">
            <img src={value} alt="" className="h-full w-full object-cover object-center" />
          </div>
          <p className="px-2 py-1 text-[10px] text-text-muted">
            {isAr ? 'معاينة — تُقص الصورة لتملأ البانر في الموقع' : 'Preview — image is cropped to fill the banner on site'}
          </p>
        </div>
      )}
    </div>
  );
}

const AUTOPLAY_PRESETS = [3, 5, 6, 8, 10, 15];

export default function HomepageHeroSlidesEditor({
  variant = 'hero',
  heroMode = 'curated',
  heroSlides = [],
  heroRotation = { startDate: '', cycleWeeks: 4, slots: [] },
  heroAutoplaySeconds = 6,
  gridColumns = 3,
  layout = '',
  campaignPlacement = 'hero',
  categories = [],
  onModeChange,
  onSlidesChange,
  onRotationChange,
  onAutoplayChange,
  onGridColumnsChange,
  onLayoutChange,
  onPlacementChange,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const isPromo = variant === 'promo';
  const isStrip = variant === 'strip';
  const isBannerGrid = isPromo || isStrip;
  const defaultPlacement = isPromo || isStrip ? 'promo' : 'hero';
  const effectivePlacement = campaignPlacement || defaultPlacement;
  const stripLayout = layout || 'scroll';
  const promoLayout = layout || 'grid';
  const stripLayoutOptions = LAYOUT_OPTIONS.image_strip || [];
  const promoLayoutOptions = LAYOUT_OPTIONS.promo_grid || [];
  const itemWord = (ar, enPlural = false) => {
    if (isStrip) return ar ? (enPlural ? 'بلاطات' : 'بلاطة') : (enPlural ? 'tiles' : 'tile');
    if (isPromo) return ar ? (enPlural ? 'بطاقات' : 'بطاقة') : (enPlural ? 'cards' : 'card');
    return ar ? (enPlural ? 'شرائح' : 'شريحة') : (enPlural ? 'slides' : 'slide');
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [uploadKey, setUploadKey] = useState(null);
  const [fallbackTab, setFallbackTab] = useState('before');

  const normalizedRotation = useMemo(() => normalizeHeroRotation(heroRotation), [heroRotation]);
  const sameFallback = normalizedRotation.sameFallback !== false;
  const isScheduleMode = heroMode === 'weekly_rotation';
  const isEditingAfterFallback = isScheduleMode && !sameFallback && fallbackTab === 'after';
  const currentSlides = isEditingAfterFallback
    ? (normalizedRotation.fallbackAfterSlides || [])
    : heroSlides;

  const updateCurrentSlides = (slides) => {
    if (isEditingAfterFallback) {
      onRotationChange({ ...normalizedRotation, fallbackAfterSlides: slides });
    } else {
      onSlidesChange(slides);
    }
  };

  const setSameFallback = (checked) => {
    if (checked) {
      onRotationChange({ ...normalizedRotation, sameFallback: true, fallbackAfterSlides: [] });
      setFallbackTab('before');
      return;
    }
    onRotationChange({
      ...normalizedRotation,
      sameFallback: false,
      fallbackAfterSlides: normalizedRotation.fallbackAfterSlides?.length
        ? normalizedRotation.fallbackAfterSlides
        : [...heroSlides],
    });
  };

  const copyBeforeToAfter = () => {
    onRotationChange({ ...normalizedRotation, fallbackAfterSlides: [...heroSlides] });
  };

  const existingBannerIds = useMemo(
    () => new Set(currentSlides.filter((s) => s.bannerId).map((s) => String(s.bannerId))),
    [currentSlides],
  );

  const activeCount = currentSlides.filter((s) => s.isActive !== false).length;

  const setSlide = (index, patch) => {
    updateCurrentSlides(currentSlides.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addManualSlide = () => {
    updateCurrentSlides([...currentSlides, { ...EMPTY_HERO_SLIDE }]);
    setExpanded(currentSlides.length);
  };

  const removeSlide = (index) => {
    updateCurrentSlides(currentSlides.filter((_, i) => i !== index));
    setExpanded(null);
  };

  const moveSlide = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= currentSlides.length) return;
    const next = [...currentSlides];
    [next[index], next[j]] = [next[j], next[index]];
    updateCurrentSlides(next);
    setExpanded(j);
  };

  const importBanner = (banner) => {
    updateCurrentSlides([...currentSlides, slideFromBanner(banner)]);
    setPickerOpen(false);
    setExpanded(currentSlides.length);
  };

  const uploadForSlide = async (index, field, file) => {
    const key = `${index}-${field}`;
    setUploadKey(key);
    try {
      const res = await adminApi.uploadHeroSlideImage(file);
      const url = res.data?.data?.url || res.data?.url;
      if (!url) return;
      const patch = { [field]: url };
      if (field === 'desktopImage' && !currentSlides[index]?.image) patch.image = url;
      setSlide(index, patch);
    } catch {
      alert(isAr ? 'فشل رفع الصورة — جرّب رابطاً مباشراً أو تحقق من Cloudinary' : 'Upload failed — try a direct URL or check Cloudinary');
    } finally {
      setUploadKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50/80 to-white p-4">
        <p className="text-sm font-bold text-primary-900">
          {isStrip
            ? (isAr ? 'إدارة شريط الصور' : 'Image strip manager')
            : isPromo
              ? (isAr ? 'إدارة شبكة العروض' : 'Promo grid manager')
              : (isAr ? 'إدارة شرائح السلايدر' : 'Hero slide manager')}
        </p>
        <p className="mt-1 text-xs text-primary-800/80">
          {isStrip
            ? (isAr
              ? 'بلاطات أفقية — تمرير أو شبكة، مع اختيار يدوي، جدولة دورية، أو تلقائي من الحملات.'
              : 'Horizontal tiles — scroll or grid, with manual pick, schedule, or auto from campaigns.')
            : isPromo
              ? (isAr
                ? 'اختر البطاقات يدوياً، جدولها دورياً، أو اعرضها تلقائياً من الحملات — مع عدد أعمدة مرن.'
                : 'Pick cards manually, schedule rotation, or auto-show from campaigns — with flexible column count.')
              : (isAr
                ? 'أضف الصور يدوياً أو استورد بانرات محددة. الترتيب هنا = ترتيب العرض في الموقع.'
                : 'Upload images or import specific banners. Order here = display order on the site.')}
        </p>

        {isStrip && stripLayoutOptions.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-white/80 p-3">
            <p className="text-xs font-bold text-text">{isAr ? 'نمط العرض' : 'Display style'}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {isAr ? 'شريط أفقي للتمرير أو شبكة ثابتة.' : 'Horizontal scroll strip or fixed grid.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {stripLayoutOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onLayoutChange?.(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    stripLayout === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'border border-border bg-white hover:bg-surface-muted'
                  }`}
                >
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {isPromo && promoLayoutOptions.length > 0 && onLayoutChange && (
          <div className="mt-4 rounded-xl border border-border bg-white/80 p-3">
            <p className="text-xs font-bold text-text">{isAr ? 'نمط العرض' : 'Display style'}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {isAr ? 'شبكة بطاقات أو شريط أفقي للتمرير.' : 'Card grid or horizontal scroll strip.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {promoLayoutOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onLayoutChange?.(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    promoLayout === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'border border-border bg-white hover:bg-surface-muted'
                  }`}
                >
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {((isPromo && promoLayout === 'grid') || (isStrip && stripLayout === 'grid')) && (
          <div className="mt-4 rounded-xl border border-border bg-white/80 p-3">
            <p className="text-xs font-bold text-text">{isAr ? 'عدد الأعمدة' : 'Column count'}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {isAr ? 'كم بلاطة في صف واحد على الشاشات الكبيرة.' : 'How many tiles per row on large screens.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(isStrip ? [2, 3, 4, 5, 6] : [2, 3, 4]).map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => onGridColumnsChange?.(cols)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    Number(gridColumns) === cols
                      ? 'bg-primary-600 text-white'
                      : 'border border-border bg-white hover:bg-surface-muted'
                  }`}
                >
                  {isAr ? `${cols} أعمدة` : `${cols} columns`}
                </button>
              ))}
            </div>
          </div>
        )}

        {((isPromo && promoLayout === 'scroll') || (isStrip && stripLayout === 'scroll')) && (
          <div className="mt-4 rounded-xl border border-border bg-white/80 p-3">
            <p className="text-xs font-bold text-text">{isAr ? 'شريط أفقي' : 'Horizontal strip'}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {isAr ? 'حتى 12 بلاطة — يتمرر أفقياً على الموقع.' : 'Up to 12 tiles — scrolls horizontally on site.'}
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => onModeChange('curated')}
            className={`rounded-xl border p-4 text-start transition ${
              heroMode === 'curated'
                ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                : 'border-border bg-white hover:border-primary-200'
            }`}
          >
            <p className="text-sm font-bold text-text">
              {isAr ? 'اختيار يدوي' : 'Manual selection'}
              <span className="ms-1 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {isAr ? 'موصى به' : 'Recommended'}
              </span>
            </p>
            <ul className="mt-2 space-y-1 text-xs text-text-muted">
              <li>{isBannerGrid
                ? (isAr ? `• ${itemWord(true, true)} متعددة في ${isStrip ? 'الشريط' : 'الشبكة'}` : `• Multiple ${itemWord(false, true)} in the ${isStrip ? 'strip' : 'grid'}`)
                : (isAr ? '• شرائح متعددة في السلايدر' : '• Multiple slides in the slider')}</li>
              <li>{isAr ? '• اختر بانرات محددة من المكتبة' : '• Pick specific banners from library'}</li>
              <li>{isAr ? '• تحكم بالترتيب والصور' : '• Control order and images'}</li>
            </ul>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('weekly_rotation')}
            className={`rounded-xl border p-4 text-start transition ${
              heroMode === 'weekly_rotation'
                ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                : 'border-border bg-white hover:border-violet-200'
            }`}
          >
            <p className="text-sm font-bold text-text">{isAr ? 'جدولة دورية' : 'Scheduled rotation'}</p>
            <ul className="mt-2 space-y-1 text-xs text-text-muted">
              <li>{isAr ? '• ساعة / يوم / أسبوع / شهر' : '• Hour / day / week / month'}</li>
              <li>{isBannerGrid
                ? (isAr ? `• أكثر من ${itemWord(true)} لنفس الفترة` : `• Multiple ${itemWord(false, true)} per period`)
                : (isAr ? '• أكثر من بانر لنفس الفترة' : '• Multiple banners per period')}</li>
              <li>{isAr ? '• يتكرر تلقائياً بعد آخر فترة' : '• Repeats after the last period'}</li>
            </ul>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('auto')}
            className={`rounded-xl border p-4 text-start transition ${
              heroMode === 'auto'
                ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                : 'border-border bg-white hover:border-amber-200'
            }`}
          >
            <p className="text-sm font-bold text-text">{isAr ? 'تلقائي من الحملات' : 'Auto from campaigns'}</p>
            <ul className="mt-2 space-y-1 text-xs text-text-muted">
              <li>{isAr ? '• كل البانرات النشطة للموضع' : '• All live banners for placement'}</li>
              <li>{isAr ? '• يحترم جدولة البانر (تاريخ البداية)' : '• Respects banner start/end dates'}</li>
              <li>{isAr ? '• بسيط لكن أقل تحكماً' : '• Simple but less control'}</li>
            </ul>
          </button>
        </div>

        {!isPromo && !isStrip && (
        <div className="mt-4 rounded-xl border border-border bg-white/80 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-text">
                {isAr ? 'مدة الانتقال بين الشرائح' : 'Time between slides'}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {heroAutoplaySeconds === 0
                  ? (isAr ? 'التمرير يدوي فقط — بدون انتقال تلقائي' : 'Manual only — no auto-advance')
                  : (isAr
                    ? `تنتقل الشرائح تلقائياً كل ${heroAutoplaySeconds} ثوانٍ`
                    : `Slides auto-advance every ${heroAutoplaySeconds} second(s)`)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="60"
                step="1"
                value={heroAutoplaySeconds}
                onChange={(e) => onAutoplayChange(Math.min(60, Math.max(0, Number(e.target.value) || 0)))}
                className="w-16 rounded-lg border border-border px-2 py-1.5 text-center text-sm font-semibold"
              />
              <span className="text-xs text-text-muted">{isAr ? 'ثانية' : 'sec'}</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={heroAutoplaySeconds}
            onChange={(e) => onAutoplayChange(Number(e.target.value))}
            className="mt-3 w-full accent-primary-600"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onAutoplayChange(0)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                heroAutoplaySeconds === 0
                  ? 'bg-primary-600 text-white'
                  : 'border border-border bg-white hover:bg-surface-muted'
              }`}
            >
              {isAr ? 'يدوي' : 'Manual'}
            </button>
            {AUTOPLAY_PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onAutoplayChange(sec)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  heroAutoplaySeconds === sec
                    ? 'bg-primary-600 text-white'
                    : 'border border-border bg-white hover:bg-surface-muted'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
        )}

        {heroMode === 'auto' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-xs text-amber-950">
              {isAr
                ? 'يعرض البانرات النشطة فقط (حسب تاريخ البداية/النهاية في البانرات). البانر المجدول لاحقاً لن يظهر حتى موعده — حتى ذلك الوقت تظهر البانرات الأخرى النشطة.'
                : 'Shows only live banners (per start/end dates in Banners). A future-scheduled banner stays hidden until its date — other live banners show until then.'}
            </p>
            <label className="mt-2 block text-xs font-medium text-amber-900">
              {isAr ? 'موضع البانرات' : 'Banner placement'}
            </label>
            <select
              className="mt-1 w-full max-w-xs rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
              value={effectivePlacement}
              onChange={(e) => onPlacementChange(e.target.value)}
            >
              {CAMPAIGN_PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>{isAr ? p.labelAr : p.labelEn}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {heroMode === 'weekly_rotation' && (
        <HomepageHeroScheduleEditor
          heroRotation={heroRotation}
          heroSlides={heroSlides}
          isAr={isAr}
          isPromo={isBannerGrid}
          onRotationChange={onRotationChange}
        />
      )}

      {(heroMode === 'curated' || heroMode === 'weekly_rotation') && (
        <>
          {heroMode === 'weekly_rotation' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <p className="text-sm font-bold text-amber-950">
                {isAr ? '③ المحتوى الاحتياطي' : '③ Fallback content'}
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-950">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-amber-300"
                  checked={sameFallback}
                  onChange={(e) => setSameFallback(e.target.checked)}
                />
                {isAr ? 'نفس المحتوى قبل البداية وبعد النهاية' : 'Same content before start and after end'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFallbackTab('before')}
                  className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${
                    sameFallback || fallbackTab === 'before'
                      ? 'border-amber-400 bg-amber-100 text-amber-950'
                      : 'border-border bg-white text-text-muted hover:border-amber-200'
                  }`}
                >
                  {isAr ? 'قبل البداية' : 'Before start'}
                </button>
                <div className="flex items-center justify-center rounded-xl border border-violet-200 bg-violet-50/60 px-2 py-2.5 text-center text-[10px] font-medium text-violet-900">
                  {isAr ? 'جدولة ↑' : 'Schedule ↑'}
                </div>
                <button
                  type="button"
                  disabled={sameFallback}
                  onClick={() => setFallbackTab('after')}
                  className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${
                    !sameFallback && fallbackTab === 'after'
                      ? 'border-amber-400 bg-amber-100 text-amber-950'
                      : 'border-border bg-white text-text-muted hover:border-amber-200 disabled:cursor-not-allowed disabled:opacity-50'
                  }`}
                >
                  {isAr ? 'بعد النهاية' : 'After end'}
                </button>
              </div>
              {!sameFallback && fallbackTab === 'after' && (
                <button
                  type="button"
                  onClick={copyBeforeToAfter}
                  className="text-xs font-semibold text-amber-800 underline hover:text-amber-950"
                >
                  {isAr ? 'نسخ من قبل البداية' : 'Copy from before start'}
                </button>
              )}
              <p className="text-xs text-amber-900/85">
                {sameFallback
                  ? (isAr
                    ? `يُستخدم نفس ${isPromo ? 'البطاقات' : 'الشرائح'} قبل البداية وبعد النهاية، وعند الإيقاف أو غياب بانر للفترة.`
                    : `Same ${isPromo ? 'cards' : 'slides'} used before start, after end, when paused, or when the period has no banner.`)
                  : fallbackTab === 'before'
                    ? (isAr
                      ? `تحرير ${isPromo ? 'البطاقات' : 'الشرائح'} التي تُعرض قبل تاريخ البداية (وعند الإيقاف).`
                      : `Edit ${isPromo ? 'cards' : 'slides'} shown before the start date (and when paused).`)
                    : (isAr
                      ? `تحرير ${isPromo ? 'البطاقات' : 'الشرائح'} التي تُعرض بعد تاريخ النهاية فقط.`
                      : `Edit ${isPromo ? 'cards' : 'slides'} shown after the end date only.`)}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-muted">
              {heroMode === 'weekly_rotation'
                ? (activeCount > 0
                  ? (isAr
                    ? `${activeCount} ${isPromo ? 'بطاقة' : 'شريحة'}${sameFallback ? ' (مشتركة)' : fallbackTab === 'before' ? ' (قبل)' : ' (بعد)'}`
                    : `${activeCount} active${sameFallback ? ' (shared)' : fallbackTab === 'before' ? ' (before)' : ' (after)'}`)
                  : (isAr
                    ? (isPromo ? 'لا بطاقات احتياطية بعد' : 'لا شرائح احتياطية بعد')
                    : 'No fallback yet'))
                : (activeCount > 0
                  ? (isAr
                    ? `${activeCount} ${isPromo ? 'بطاقة نشطة' : 'شريحة نشطة'} من ${heroSlides.length}`
                    : `${activeCount} active of ${heroSlides.length}`)
                  : (isAr ? (isPromo ? 'لا بطاقات بعد' : 'لا شرائح بعد') : (isPromo ? 'No cards yet' : 'No slides yet')))}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addManualSlide}
                className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
              >
                <Plus className="h-3.5 w-3.5" />
                {isPromo ? (isAr ? 'بطاقة جديدة' : 'New card') : (isAr ? 'شريحة جديدة' : 'New slide')}
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {isAr ? 'استيراد بانر' : 'Import banner'}
              </button>
            </div>
          </div>

          {currentSlides.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-surface-muted/30 px-4 py-10 text-center">
              <p className="text-sm font-medium text-text">
                {heroMode === 'weekly_rotation'
                  ? (isAr ? 'أضف بطاقات احتياطية' : 'Add fallback cards')
                  : (isAr ? (isPromo ? 'أضف بطاقات للشبكة' : 'ابدأ بإضافة شريحة') : (isPromo ? 'Add grid cards' : 'Start by adding a slide'))}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {heroMode === 'weekly_rotation'
                  ? (isAr
                    ? (isPromo ? 'تُعرض خارج فترة الجدولة أو عند غياب بانر للفترة الحالية.' : 'تُعرض خارج فترة الجدولة أو عند غياب بانر للفترة الحالية.')
                    : 'Shown outside the schedule window or when the current period has no banner.')
                  : (isAr ? 'ارفع صورة مباشرة أو استورد من مكتبة البانرات.' : 'Upload an image or import from the banner library.')}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {currentSlides.map((slide, index) => {
              const preview = slidePreviewUrl(slide);
              const isOpen = expanded === index;
              const isBannerLinked = slide.source === 'banner' && slide.bannerId;

              return (
                <div
                  key={slide._id || `slide-${index}`}
                  className={`rounded-xl border bg-white transition ${
                    slide.isActive === false ? 'border-border opacity-70' : 'border-border shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    <GripVertical className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                    <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                      {preview ? (
                        <img src={preview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-text-muted">
                          {isAr ? 'بدون صورة' : 'No image'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {slide.titleAr || slide.titleEn || (isAr ? `شريحة ${index + 1}` : `Slide ${index + 1}`)}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {isBannerLinked
                          ? (isAr ? '🔗 مرتبط ببانر' : '🔗 Linked to banner')
                          : (isAr ? 'صورة يدوية' : 'Manual upload')}
                        {' · '}
                        {slide.link || '/products'}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={slide.isActive !== false}
                        onChange={(e) => setSlide(index, { isActive: e.target.checked })}
                      />
                      {isAr ? 'نشط' : 'Active'}
                    </label>
                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" disabled={index === 0} onClick={() => moveSlide(index, -1)} className="rounded px-2 py-1 text-xs hover:bg-surface-muted disabled:opacity-30">↑</button>
                      <button type="button" disabled={index === currentSlides.length - 1} onClick={() => moveSlide(index, 1)} className="rounded px-2 py-1 text-xs hover:bg-surface-muted disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => setExpanded(isOpen ? null : index)} className="rounded px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50">
                        {isOpen ? (isAr ? 'إغلاق' : 'Close') : (isAr ? 'تعديل' : 'Edit')}
                      </button>
                      <button type="button" onClick={() => removeSlide(index)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border bg-surface-muted/20 p-4">
                      {isBannerLinked && (
                        <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
                          {isAr
                            ? 'مرتبط ببانر — يمكنك تخصيص النص والرابط أو تحديث الصورة من البانر عند الحفظ.'
                            : 'Linked to a banner — override text/link here; image refreshes from the banner on save.'}
                        </p>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'العنوان (عربي)' : 'Title (AR)'}</label>
                          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={slide.titleAr || ''} onChange={(e) => setSlide(index, { titleAr: e.target.value })} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'العنوان (EN)' : 'Title (EN)'}</label>
                          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={slide.titleEn || ''} onChange={(e) => setSlide(index, { titleEn: e.target.value })} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'الوصف (عربي)' : 'Subtitle (AR)'}</label>
                          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={slide.subtitleAr || ''} onChange={(e) => setSlide(index, { subtitleAr: e.target.value })} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'الوصف (EN)' : 'Subtitle (EN)'}</label>
                          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={slide.subtitleEn || ''} onChange={(e) => setSlide(index, { subtitleEn: e.target.value })} />
                        </div>
                        {!isBannerLinked && (
                          <>
                            <div className="sm:col-span-2">
                              <ImageField
                                label={isAr ? 'صورة سطح المكتب' : 'Desktop image'}
                                value={slide.desktopImage || slide.image}
                                onChange={(v) => setSlide(index, { desktopImage: v, image: v || slide.image })}
                                onUpload={(file) => uploadForSlide(index, 'desktopImage', file)}
                                uploading={uploadKey === `${index}-desktopImage`}
                                isAr={isAr}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <ImageField
                                label={isAr ? 'صورة الموبايل (اختياري)' : 'Mobile image (optional)'}
                                value={slide.mobileImage}
                                onChange={(v) => setSlide(index, { mobileImage: v })}
                                onUpload={(file) => uploadForSlide(index, 'mobileImage', file)}
                                uploading={uploadKey === `${index}-mobileImage`}
                                isAr={isAr}
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'نص الزر (عربي)' : 'CTA (AR)'}</label>
                          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={slide.ctaAr || ''} onChange={(e) => setSlide(index, { ctaAr: e.target.value })} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'نص الزر (EN)' : 'CTA (EN)'}</label>
                          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={slide.ctaEn || ''} onChange={(e) => setSlide(index, { ctaEn: e.target.value })} />
                        </div>
                        <div className="sm:col-span-2">
                          <HomepageDestinationPicker
                            href={slide.link}
                            isAr={isAr}
                            categories={categories}
                            onChange={(path) => setSlide(index, { link: normalizeHomepageLink(path) })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <BannerPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={importBanner}
        existingBannerIds={existingBannerIds}
        isAr={isAr}
      />
    </div>
  );
}
