import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Download, ImagePlus, Plus, Trash2 } from 'lucide-react';
import Input from '../../components/ui/Input';
import adminApi from '../adminApi';
import api from '../../services/api';
import { WEEKDAY_OPTIONS } from '../utils/homepageBuilderRules';
import {
  COUNTDOWN_STYLE_OPTIONS,
  COUPON_STYLE_OPTIONS,
  DEFAULT_BLOCK_CONFIG,
  EMPTY_BRANCH,
  EMPTY_OCCASION_TILE,
  SPACER_SIZE_OPTIONS,
  TILE_ACCENT_OPTIONS,
  PICKED_FALLBACK_OPTIONS,
  SIGNUP_MODE_OPTIONS,
  TAB_SORT_OPTIONS,
  VIDEO_ASPECT_OPTIONS,
  isPersonalSectionType,
} from '../utils/homepageBlockUtils';
import { priceRangeLabel } from '../../utils/homepageBlocks';
import ShopIconPicker from './ShopIconPicker';

const selectClass = 'w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm';
const label = (option, isAr) => (isAr ? option.labelAr : option.labelEn);

function Field({ title, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-text">{title}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, title, hint }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-600" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-semibold">{title}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Choice({ options, value, onChange, isAr }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
            value === option.value ? 'border-primary-500 bg-primary-50 text-primary-800 ring-2 ring-primary-200' : 'border-border bg-white hover:bg-surface-muted'
          }`}
        >
          {label(option, isAr)}
        </button>
      ))}
    </div>
  );
}

/** URL box with an "Upload" button (same Cloudinary upload as hero slides). */
function ImageField({ title, hint, value, onChange, isAr }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminApi.uploadHeroSlideImage(file);
      const url = res.data?.data?.url || res.data?.url;
      if (url) onChange(url);
    } catch {
      alert(isAr ? 'فشل رفع الصورة — جرّب رابطاً مباشراً' : 'Upload failed — try a direct image link');
    } finally {
      setUploading(false);
    }
  };
  return (
    <Field title={title} hint={hint}>
      <div className="flex gap-2">
        <input className={`${selectClass} min-w-0 flex-1`} dir="ltr" value={value || ''} placeholder="https://…" onChange={(e) => onChange(e.target.value)} />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-medium hover:bg-surface-muted">
          <ImagePlus className="h-4 w-4" aria-hidden />
          {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : (isAr ? 'رفع' : 'Upload')}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>
      {value && <img src={value} alt="" className="mt-2 h-20 rounded-lg border border-border object-cover" />}
    </Field>
  );
}

/** Move / delete buttons for one row of a list. */
function RowActions({ index, count, onMove, onRemove, isAr }) {
  const btn = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-text-muted hover:bg-surface-muted disabled:opacity-40';
  return (
    <div className="flex gap-1">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={isAr ? 'أعلى' : 'Move up'}><ArrowUp className="h-4 w-4" /></button>
      <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={isAr ? 'أسفل' : 'Move down'}><ArrowDown className="h-4 w-4" /></button>
      <button type="button" className={`${btn} hover:text-danger-600`} onClick={() => onRemove(index)} aria-label={isAr ? 'حذف' : 'Remove'}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function useList(config, key, onChange) {
  const rows = config[key] || [];
  const set = (next) => onChange({ ...config, [key]: next });
  return {
    rows,
    patch: (index, patch) => set(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))),
    add: (row) => set([...rows, row]),
    remove: (index) => set(rows.filter((_, i) => i !== index)),
    move: (from, to) => {
      if (to < 0 || to >= rows.length) return;
      const next = [...rows];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      set(next);
    },
  };
}

function ProductRowOptions({ config, patch, isAr, type }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field title={isAr ? 'عدد المنتجات' : 'How many products'}>
        <input type="number" min="1" max="24" className={selectClass} value={config.limit} onChange={(e) => patch({ limit: e.target.value })} />
      </Field>
      <Field title={isAr ? 'طريقة العرض' : 'Layout'}>
        <Choice
          isAr={isAr}
          value={config.layout}
          onChange={(layout) => patch({ layout })}
          options={[
            { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Sliding row' },
            { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid' },
          ]}
        />
      </Field>
      {config.layout === 'grid' && (
        <Field title={isAr ? 'أعمدة الكمبيوتر' : 'Columns on computers'}>
          <Choice
            isAr={isAr}
            value={Number(config.columns)}
            onChange={(columns) => patch({ columns })}
            options={[2, 3, 4].map((n) => ({ value: n, labelAr: String(n), labelEn: String(n) }))}
          />
        </Field>
      )}
      {type === 'picked_for_you' && (
        <Field
          title={isAr ? 'لزائر بدون سجل تصفح' : 'For a visitor with no history'}
          hint={isAr ? 'المقترحات تعتمد على ما شاهده العميل وطلبه.' : 'Suggestions come from what the shopper viewed and ordered.'}
        >
          <Choice isAr={isAr} options={PICKED_FALLBACK_OPTIONS} value={config.pickedFallback} onChange={(pickedFallback) => patch({ pickedFallback })} />
        </Field>
      )}
    </div>
  );
}

function CountdownOptions({ config, patch, isAr }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        title={isAr ? 'ينتهي في (توقيت القاهرة)' : 'Ends at (Cairo time)'}
        hint={isAr ? 'يعرض العدّاد الأيام والساعات والدقائق المتبقية.' : 'The timer shows the days, hours and minutes left.'}
      >
        <input type="datetime-local" className={selectClass} value={config.endsAt || ''} onChange={(e) => patch({ endsAt: e.target.value })} />
      </Field>
      <Field title={isAr ? 'الألوان' : 'Colours'}>
        <Choice isAr={isAr} options={COUNTDOWN_STYLE_OPTIONS} value={config.countdownStyle} onChange={(countdownStyle) => patch({ countdownStyle })} />
      </Field>
      <ImageField
        isAr={isAr}
        title={isAr ? 'صورة جانبية (اختياري)' : 'Side image (optional)'}
        value={config.image}
        onChange={(image) => patch({ image })}
      />
      <div className="space-y-3">
        <Toggle
          checked={config.hideWhenEnded}
          onChange={(hideWhenEnded) => patch({ hideWhenEnded })}
          title={isAr ? 'إخفاء القسم عند انتهاء الوقت' : 'Hide the section when time is up'}
        />
        {!config.hideWhenEnded && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={isAr ? 'نص بعد الانتهاء (عربي)' : 'Text after it ends (Arabic)'} value={config.endedTextAr} onChange={(e) => patch({ endedTextAr: e.target.value })} placeholder="انتهى العرض" />
            <Input label={isAr ? 'نص بعد الانتهاء (EN)' : 'Text after it ends (English)'} value={config.endedTextEn} onChange={(e) => patch({ endedTextEn: e.target.value })} placeholder="This offer has ended" />
          </div>
        )}
      </div>
    </div>
  );
}

function VideoOptions({ config, patch, isAr }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        title={isAr ? 'رابط يوتيوب' : 'YouTube link'}
        hint={isAr ? 'الصق رابط الفيديو أو رمزه — مثل youtu.be/…' : 'Paste the video link or its id — e.g. youtu.be/…'}
      >
        <input className={selectClass} dir="ltr" value={config.youtubeId || ''} placeholder="https://youtu.be/…" onChange={(e) => patch({ youtubeId: e.target.value })} />
      </Field>
      <Field
        title={isAr ? 'أو رابط ملف MP4' : 'Or an MP4 file link'}
        hint={isAr ? 'يُستخدم فقط إن لم يوجد رابط يوتيوب.' : 'Used only when there is no YouTube link.'}
      >
        <input className={selectClass} dir="ltr" value={config.videoUrl || ''} placeholder="https://…/video.mp4" onChange={(e) => patch({ videoUrl: e.target.value })} />
      </Field>
      <ImageField
        isAr={isAr}
        title={isAr ? 'صورة الغلاف' : 'Cover image'}
        hint={isAr ? 'تظهر قبل التشغيل وعلى الموبايل. ليوتيوب نستخدم صورته إن تركتها فارغة.' : 'Shown before playing and on phones. YouTube’s own image is used if empty.'}
        value={config.posterImage}
        onChange={(posterImage) => patch({ posterImage })}
      />
      <div className="space-y-4">
        <Field title={isAr ? 'شكل الفيديو' : 'Video shape'}>
          <Choice isAr={isAr} options={VIDEO_ASPECT_OPTIONS} value={config.aspect} onChange={(aspect) => patch({ aspect })} />
        </Field>
        <Toggle
          checked={config.autoplayDesktop}
          onChange={(autoplayDesktop) => patch({ autoplayDesktop })}
          title={isAr ? 'تشغيل تلقائي بدون صوت على الكمبيوتر' : 'Play by itself, muted, on computers'}
          hint={isAr ? 'على الموبايل يضغط العميل للتشغيل — لتوفير الباقة.' : 'On phones shoppers tap to play — saves their mobile data.'}
        />
      </div>
    </div>
  );
}

function ReviewsOptions({ config, patch, isAr }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field title={isAr ? 'أقل تقييم يظهر' : 'Lowest rating shown'}>
        <Choice
          isAr={isAr}
          value={Number(config.minRating)}
          onChange={(minRating) => patch({ minRating })}
          options={[3, 4, 5].map((n) => ({ value: n, labelAr: `${n}★ فأكثر`, labelEn: `${n}★ and up` }))}
        />
      </Field>
      <Field title={isAr ? 'عدد التقييمات' : 'How many reviews'}>
        <input type="number" min="1" max="24" className={selectClass} value={config.limit} onChange={(e) => patch({ limit: e.target.value })} />
      </Field>
      <Toggle
        checked={config.verifiedOnly}
        onChange={(verifiedOnly) => patch({ verifiedOnly })}
        title={isAr ? 'مشتريات مؤكدة فقط' : 'Verified purchases only'}
      />
      <p className="rounded-xl bg-surface-muted/60 px-4 py-3 text-xs text-text-muted md:col-span-2">
        {isAr
          ? 'تظهر فقط التقييمات المكتوبة التي وافقت عليها في «التقييمات»، المميزة والمثبتة أولاً. يظهر الاسم الأول والحرف الأول من العائلة فقط.'
          : 'Only written reviews you approved under Reviews appear, featured and pinned first. Shoppers show as first name and last initial only.'}
      </p>
    </div>
  );
}

function SignupOptions({ config, patch, isAr, section }) {
  const [downloading, setDownloading] = useState(false);
  const showEmail = config.signupMode !== 'whatsapp';
  const showWhatsapp = config.signupMode !== 'newsletter';
  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/homepage-sections/admin/newsletter-subscribers.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'newsletter-subscribers.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(isAr ? 'تعذّر التنزيل — تحتاج صلاحية «عرض العملاء».' : 'Could not download — you need the “View customers” permission.');
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="space-y-4">
      <Field title={isAr ? 'طريقة الاشتراك' : 'How shoppers sign up'}>
        <Choice isAr={isAr} options={SIGNUP_MODE_OPTIONS} value={config.signupMode} onChange={(signupMode) => patch({ signupMode })} />
      </Field>
      {showWhatsapp && (
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={isAr ? 'رقم واتساب' : 'WhatsApp number'}
            dir="ltr"
            value={config.whatsappNumber}
            placeholder="010 1234 5678"
            onChange={(e) => patch({ whatsappNumber: e.target.value })}
          />
          <div />
          <Input label={isAr ? 'أول رسالة (عربي)' : 'First message (Arabic)'} value={config.whatsappMessageAr} placeholder="أريد الاشتراك في العروض" onChange={(e) => patch({ whatsappMessageAr: e.target.value })} />
          <Input label={isAr ? 'أول رسالة (EN)' : 'First message (English)'} value={config.whatsappMessageEn} placeholder="I'd like to get your offers" onChange={(e) => patch({ whatsappMessageEn: e.target.value })} />
        </div>
      )}
      {showEmail && (
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={isAr ? 'ملاحظة الخصوصية (عربي)' : 'Privacy note (Arabic)'} value={config.privacyNoteAr} placeholder="يمكنك إلغاء الاشتراك في أي وقت." onChange={(e) => patch({ privacyNoteAr: e.target.value })} />
          <Input label={isAr ? 'ملاحظة الخصوصية (EN)' : 'Privacy note (English)'} value={config.privacyNoteEn} placeholder="You can unsubscribe at any time." onChange={(e) => patch({ privacyNoteEn: e.target.value })} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 md:col-span-2">
            <p className="text-sm">
              {Number.isFinite(section?.subscriberCount)
                ? (isAr ? `${section.subscriberCount} مشترك حتى الآن` : `${section.subscriberCount} people signed up so far`)
                : (isAr ? 'تُحفظ الرسائل المسجّلة لتصدّرها لاحقاً.' : 'Sign-ups are saved so you can export them.')}
            </p>
            <button type="button" onClick={download} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted">
              <Download className="h-4 w-4" aria-hidden />
              {isAr ? 'تنزيل القائمة (CSV)' : 'Download list (CSV)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceRangeOptions({ config, onChange, isAr }) {
  const list = useList(config, 'priceRanges', onChange);
  return (
    <div className="space-y-3">
      {list.rows.map((row, index) => (
        <div key={index} className="grid items-end gap-3 rounded-xl border border-border bg-white p-3 sm:grid-cols-[9rem_1fr_1fr_1fr_1fr_auto]">
          <ShopIconPicker label={isAr ? 'أيقونة' : 'Icon'} value={row.emoji} onChange={(name) => list.patch(index, { emoji: name })} isAr={isAr} />
          <Input label={isAr ? 'من (EGP)' : 'From (EGP)'} type="number" min="0" value={row.min ?? ''} placeholder="0" onChange={(e) => list.patch(index, { min: e.target.value })} />
          <Input label={isAr ? 'إلى (EGP)' : 'Up to (EGP)'} type="number" min="0" value={row.max ?? ''} placeholder={isAr ? 'بلا حد' : 'No limit'} onChange={(e) => list.patch(index, { max: e.target.value })} />
          <Input label={isAr ? 'الاسم (عربي)' : 'Label (Arabic)'} value={row.labelAr || ''} placeholder={priceRangeLabel({ ...row, labelAr: '', labelEn: '' }, true)} onChange={(e) => list.patch(index, { labelAr: e.target.value })} />
          <Input label={isAr ? 'الاسم (EN)' : 'Label (English)'} value={row.labelEn || ''} placeholder={priceRangeLabel({ ...row, labelAr: '', labelEn: '' }, false)} onChange={(e) => list.patch(index, { labelEn: e.target.value })} />
          <RowActions index={index} count={list.rows.length} onMove={list.move} onRemove={list.remove} isAr={isAr} />
        </div>
      ))}
      {list.rows.length < 8 && (
        <button type="button" onClick={() => list.add({ min: null, max: null, labelAr: '', labelEn: '', emoji: '' })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary-300 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50">
          <Plus className="h-4 w-4" aria-hidden /> {isAr ? 'إضافة فئة سعرية' : 'Add a price tile'}
        </button>
      )}
      <p className="text-xs text-text-muted">
        {isAr ? 'اترك الاسم فارغاً ليُكتب تلقائياً، مثل «أقل من 50 EGP». كل بلاطة تفتح المنتجات في هذا السعر.' : 'Leave the label empty to write it for you, e.g. “Under 50 EGP”. Each tile opens the products in that price range.'}
      </p>
    </div>
  );
}

function TabOptions({ config, onChange, patch, isAr, categories }) {
  const list = useList(config, 'tabs', onChange);
  const roots = categories.filter((c) => c && c._id);
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <Field title={isAr ? 'منتجات في كل تبويب' : 'Products per tab'}>
          <input type="number" min="1" max="24" className={selectClass} value={config.limit} onChange={(e) => patch({ limit: e.target.value })} />
        </Field>
        <Field title={isAr ? 'طريقة العرض' : 'Layout'}>
          <Choice
            isAr={isAr}
            value={config.layout}
            onChange={(layout) => patch({ layout })}
            options={[
              { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Sliding row' },
              { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid' },
            ]}
          />
        </Field>
      </div>
      {list.rows.map((tab, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{isAr ? `تبويب ${index + 1}` : `Tab ${index + 1}`}</p>
            <RowActions index={index} count={list.rows.length} onMove={list.move} onRemove={list.remove} isAr={isAr} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={isAr ? 'اسم التبويب (عربي)' : 'Tab name (Arabic)'} value={tab.labelAr || ''} onChange={(e) => list.patch(index, { labelAr: e.target.value })} />
            <Input label={isAr ? 'اسم التبويب (EN)' : 'Tab name (English)'} value={tab.labelEn || ''} onChange={(e) => list.patch(index, { labelEn: e.target.value })} />
            <Field title={isAr ? 'الترتيب' : 'Order by'}>
              <select className={selectClass} value={tab.sort} onChange={(e) => list.patch(index, { sort: e.target.value })}>
                {TAB_SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{label(o, isAr)}</option>)}
              </select>
            </Field>
            <Field title={isAr ? 'من قسم (اختياري)' : 'From a category (optional)'}>
              <select className={selectClass} value={tab.category || ''} onChange={(e) => list.patch(index, { category: e.target.value || null })}>
                <option value="">{isAr ? 'كل الأقسام' : 'All categories'}</option>
                {roots.map((c) => <option key={c._id} value={c._id}>{isAr ? c.nameAr || c.nameEn : c.nameEn || c.nameAr}</option>)}
              </select>
            </Field>
            <Toggle checked={tab.offers} onChange={(offers) => list.patch(index, { offers })} title={isAr ? 'منتجات العروض فقط' : 'Products on offer only'} />
            <Input label={isAr ? 'رابط «عرض الكل» (اختياري)' : '“View all” link (optional)'} dir="ltr" value={tab.link || ''} placeholder="/products?sort=newest" onChange={(e) => list.patch(index, { link: e.target.value })} />
          </div>
        </div>
      ))}
      {list.rows.length < 6 && (
        <button type="button" onClick={() => list.add({ labelAr: '', labelEn: '', sort: 'best-selling', offers: false, section: '', category: null, link: '' })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary-300 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50">
          <Plus className="h-4 w-4" aria-hidden /> {isAr ? 'إضافة تبويب' : 'Add a tab'}
        </button>
      )}
    </div>
  );
}

function BranchOptions({ config, onChange, isAr }) {
  const list = useList(config, 'branches', onChange);
  const toggleDay = (index, day) => {
    const days = list.rows[index].days || [];
    list.patch(index, { days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] });
  };
  return (
    <div className="space-y-3">
      {list.rows.map((row, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{(isAr ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || (isAr ? `فرع ${index + 1}` : `Branch ${index + 1}`)}</p>
            <RowActions index={index} count={list.rows.length} onMove={list.move} onRemove={list.remove} isAr={isAr} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={isAr ? 'اسم الفرع (عربي)' : 'Branch name (Arabic)'} value={row.nameAr} onChange={(e) => list.patch(index, { nameAr: e.target.value })} />
            <Input label={isAr ? 'اسم الفرع (EN)' : 'Branch name (English)'} value={row.nameEn} onChange={(e) => list.patch(index, { nameEn: e.target.value })} />
            <Input label={isAr ? 'العنوان (عربي)' : 'Address (Arabic)'} value={row.addressAr} onChange={(e) => list.patch(index, { addressAr: e.target.value })} />
            <Input label={isAr ? 'العنوان (EN)' : 'Address (English)'} value={row.addressEn} onChange={(e) => list.patch(index, { addressEn: e.target.value })} />
            <Input label={isAr ? 'الهاتف' : 'Phone'} dir="ltr" value={row.phone} onChange={(e) => list.patch(index, { phone: e.target.value })} />
            <Input label={isAr ? 'رابط الخريطة' : 'Map link'} dir="ltr" value={row.mapUrl} placeholder="https://maps.google.com/…" onChange={(e) => list.patch(index, { mapUrl: e.target.value })} />
            <Field title={isAr ? 'يفتح' : 'Opens'}>
              <input type="time" className={selectClass} value={row.opensAt || ''} onChange={(e) => list.patch(index, { opensAt: e.target.value })} />
            </Field>
            <Field title={isAr ? 'يغلق' : 'Closes'} hint={isAr ? 'وقت قبل الفتح = بعد منتصف الليل.' : 'A time before opening means after midnight.'}>
              <input type="time" className={selectClass} value={row.closesAt || ''} onChange={(e) => list.patch(index, { closesAt: e.target.value })} />
            </Field>
            <Field title={isAr ? 'أيام العمل' : 'Open on'} hint={isAr ? 'بدون اختيار = كل الأيام.' : 'None ticked = every day.'} className="md:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map((day) => {
                  const on = (row.days || []).includes(day.value);
                  return (
                    <button key={day.value} type="button" onClick={() => toggleDay(index, day.value)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-border bg-white'}`}>
                      {label(day, isAr)}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Input label={isAr ? 'نص المواعيد (عربي، اختياري)' : 'Hours text (Arabic, optional)'} value={row.hoursAr} placeholder="يومياً 9 ص – 11 م" onChange={(e) => list.patch(index, { hoursAr: e.target.value })} />
            <Input label={isAr ? 'نص المواعيد (EN، اختياري)' : 'Hours text (English, optional)'} value={row.hoursEn} placeholder="Daily 9am – 11pm" onChange={(e) => list.patch(index, { hoursEn: e.target.value })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => list.add({ ...EMPTY_BRANCH, days: [] })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary-300 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50">
        <Plus className="h-4 w-4" aria-hidden /> {isAr ? 'إضافة فرع' : 'Add a branch'}
      </button>
    </div>
  );
}

/** Picks one of the store's coupons; only store-wide, active ones can show on the homepage. */
function CouponOptions({ config, patch, isAr, section }) {
  const [coupons, setCoupons] = useState(null);
  useEffect(() => {
    let alive = true;
    adminApi.getCoupons({ limit: 200 })
      .then((res) => {
        if (!alive) return;
        const rows = res.data?.data?.coupons || res.data?.data || [];
        setCoupons((Array.isArray(rows) ? rows : []).filter((c) => (c.source || 'admin') === 'admin' && !c.assignedUser));
      })
      .catch(() => alive && setCoupons([]));
    return () => { alive = false; };
  }, []);

  const offer = (c) => {
    if (c.discountType === 'free_delivery') return isAr ? 'توصيل مجاني' : 'Free delivery';
    if (c.discountType === 'percent') return `${c.discountValue}%`;
    return `${c.discountValue} EGP`;
  };
  const listed = coupons?.some((c) => c.code === config.couponCode);

  return (
    <div className="space-y-4">
      <Field
        title={isAr ? 'الكوبون' : 'Coupon'}
        hint={isAr
          ? 'تظهر هنا كوبونات المتجر العامة فقط. إذا انتهى الكوبون أو أوقفته يختفي القسم وحده.'
          : 'Only store-wide coupons are listed. If the coupon ends or you switch it off, the section hides itself.'}
      >
        {coupons === null ? (
          <p className="text-sm text-text-muted">{isAr ? 'جارٍ تحميل الكوبونات…' : 'Loading coupons…'}</p>
        ) : (
          <select className={selectClass} value={config.couponCode || ''} onChange={(e) => patch({ couponCode: e.target.value })}>
            <option value="">{isAr ? '— اختر كوبوناً —' : '— Pick a coupon —'}</option>
            {config.couponCode && !listed && <option value={config.couponCode}>{config.couponCode}</option>}
            {coupons.map((c) => (
              <option key={c._id || c.code} value={c.code}>
                {c.code} · {offer(c)}{c.isActive === false ? (isAr ? ' · متوقف' : ' · off') : ''}
              </option>
            ))}
          </select>
        )}
        {coupons?.length === 0 && (
          <p className="mt-2 text-xs text-text-muted">
            {isAr ? 'لا توجد كوبونات بعد — أنشئ واحداً من صفحة الكوبونات.' : 'No coupons yet — create one on the Coupons page.'}{' '}
            <a href="/admin/coupons" className="font-semibold text-primary-700 underline">{isAr ? 'الكوبونات' : 'Coupons'}</a>
          </p>
        )}
      </Field>
      {section?.couponProblem && section.couponProblemCode === config.couponCode && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {isAr ? 'هذا الكوبون لا يمكن عرضه الآن، لذلك القسم مخفي عن الزبائن.' : 'This coupon can’t be shown right now, so shoppers don’t see the section.'}
        </p>
      )}
      <Field title={isAr ? 'الشكل' : 'Look'}>
        <Choice options={COUPON_STYLE_OPTIONS} value={config.couponStyle} onChange={(v) => patch({ couponStyle: v })} isAr={isAr} />
      </Field>
      <p className="text-xs text-text-muted">
        {isAr
          ? 'العنوان اختياري — إذا تركته فارغاً نكتب العرض تلقائياً مثل «خصم 20%».'
          : 'The title is optional — leave it empty and we write the offer for you, like “20% off”.'}
      </p>
    </div>
  );
}

function OccasionOptions({ config, onChange, patch, isAr }) {
  const list = useList(config, 'tiles', onChange);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field title={isAr ? 'الترتيب' : 'Arrangement'}>
          <Choice
            options={[
              { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid' },
              { value: 'scroll', labelAr: 'صف يُسحب', labelEn: 'Swipeable row' },
            ]}
            value={config.layout === 'scroll' ? 'scroll' : 'grid'}
            onChange={(v) => patch({ layout: v })}
            isAr={isAr}
          />
        </Field>
        {config.layout !== 'scroll' && (
          <Field title={isAr ? 'عدد الأعمدة على الكمبيوتر' : 'Columns on computers'}>
            <Choice
              options={[2, 3, 4].map((n) => ({ value: n, labelAr: String(n), labelEn: String(n) }))}
              value={Number(config.columns) || 4}
              onChange={(v) => patch({ columns: v })}
              isAr={isAr}
            />
          </Field>
        )}
      </div>

      {list.rows.map((row, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-text-muted">{isAr ? `مناسبة ${index + 1}` : `Occasion ${index + 1}`}</span>
            <RowActions index={index} count={list.rows.length} onMove={list.move} onRemove={list.remove} isAr={isAr} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={isAr ? 'الاسم (عربي)' : 'Name (Arabic)'} value={row.titleAr || ''} onChange={(e) => list.patch(index, { titleAr: e.target.value })} />
            <Input label={isAr ? 'الاسم (EN)' : 'Name (English)'} value={row.titleEn || ''} onChange={(e) => list.patch(index, { titleEn: e.target.value })} />
            <Input label={isAr ? 'سطر صغير (عربي، اختياري)' : 'Small line (Arabic, optional)'} value={row.subtitleAr || ''} onChange={(e) => list.patch(index, { subtitleAr: e.target.value })} />
            <Input label={isAr ? 'سطر صغير (EN، اختياري)' : 'Small line (English, optional)'} value={row.subtitleEn || ''} onChange={(e) => list.patch(index, { subtitleEn: e.target.value })} />
            <ShopIconPicker label={isAr ? 'الأيقونة' : 'Icon'} value={row.icon} onChange={(name) => list.patch(index, { icon: name })} isAr={isAr} allowNone={false} />
            <Input label={isAr ? 'يفتح عند الضغط' : 'Opens when tapped'} dir="ltr" value={row.link || ''} placeholder="/offers" onChange={(e) => list.patch(index, { link: e.target.value })} />
          </div>
          <Field title={isAr ? 'اللون' : 'Colour'}>
            <div className="flex flex-wrap gap-2">
              {TILE_ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={label(option, isAr)}
                  aria-label={label(option, isAr)}
                  onClick={() => list.patch(index, { accent: option.value })}
                  className={`h-8 w-8 rounded-full ${option.swatch} ${row.accent === option.value ? 'ring-2 ring-primary-600 ring-offset-2' : 'ring-1 ring-border'}`}
                />
              ))}
            </div>
          </Field>
          <ImageField
            title={isAr ? 'صورة (اختياري — تحلّ محل الأيقونة)' : 'Picture (optional — replaces the icon)'}
            value={row.image}
            onChange={(url) => list.patch(index, { image: url })}
            isAr={isAr}
          />
        </div>
      ))}
      {list.rows.length < 8 && (
        <button
          type="button"
          onClick={() => list.add({ ...EMPTY_OCCASION_TILE })}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary-300 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {isAr ? 'إضافة مناسبة' : 'Add an occasion'}
        </button>
      )}
    </div>
  );
}

function SpacerOptions({ config, patch, isAr }) {
  return (
    <div className="space-y-4">
      <Field title={isAr ? 'حجم المسافة' : 'How much space'}>
        <Choice options={SPACER_SIZE_OPTIONS} value={config.spacerSize} onChange={(v) => patch({ spacerSize: v })} isAr={isAr} />
      </Field>
      <Toggle
        checked={config.showLine}
        onChange={(v) => patch({ showLine: v })}
        title={isAr ? 'خط رفيع في المنتصف' : 'Thin line in the middle'}
      />
    </div>
  );
}

/** The type-specific settings of the blockConfig section types. */
export default function HomepageBlockEditor({ type, config: rawConfig, onChange, isAr, categories = [], section = null }) {
  const config = { ...DEFAULT_BLOCK_CONFIG, ...(rawConfig || {}) };
  const patch = (next) => onChange({ ...config, ...next });

  if (isPersonalSectionType(type)) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs text-sky-950">
          {isAr
            ? 'كل عميل يرى منتجاته الخاصة، وتُحمَّل بعد فتح الصفحة. في المعاينة نعرض أمثلة من الأكثر مبيعاً.'
            : 'Every shopper sees their own products, loaded after the page opens. The preview shows best sellers as an example.'}
        </p>
        <ProductRowOptions config={config} patch={patch} isAr={isAr} type={type} />
      </div>
    );
  }
  switch (type) {
    case 'countdown_banner': return <CountdownOptions config={config} patch={patch} isAr={isAr} />;
    case 'video_banner': return <VideoOptions config={config} patch={patch} isAr={isAr} />;
    case 'reviews_carousel': return <ReviewsOptions config={config} patch={patch} isAr={isAr} />;
    case 'signup_block': return <SignupOptions config={config} patch={patch} isAr={isAr} section={section} />;
    case 'price_ranges': return <PriceRangeOptions config={config} onChange={onChange} isAr={isAr} />;
    case 'tabbed_products': return <TabOptions config={config} onChange={onChange} patch={patch} isAr={isAr} categories={categories} />;
    case 'store_branches': return <BranchOptions config={config} onChange={onChange} isAr={isAr} />;
    case 'coupon_card': return <CouponOptions config={config} patch={patch} isAr={isAr} section={section} />;
    case 'occasion_tiles': return <OccasionOptions config={config} onChange={onChange} patch={patch} isAr={isAr} />;
    case 'spacer': return <SpacerOptions config={config} patch={patch} isAr={isAr} />;
    case 'delivery_slot_bar':
      return (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-950">
          {isAr
            ? 'لا يحتاج إعداداً: كل زبون يرى أقرب موعد لمنطقته من إعدادات مناطق التوصيل، ومن لم يختر منطقة يُطلب منه اختيارها.'
            : 'Nothing to set up: each shopper sees the next time for their area from your delivery zones, and shoppers without an area are asked to pick one.'}
        </p>
      );
    default: return null;
  }
}
