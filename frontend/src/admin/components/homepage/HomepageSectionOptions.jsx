import { useMemo, useState } from 'react';
import {
  CalendarClock, ChevronDown, Image as ImageIcon, Link2, Palette, StickyNote, Users, X,
} from 'lucide-react';
import { adminApi } from '../../adminApi';
import {
  AUDIENCE_OPTIONS,
  BACKGROUND_OPTIONS,
  DEVICE_OPTIONS,
  EMPTY_APPEARANCE_FORM,
  EMPTY_VISIBILITY_FORM,
  SPACE_OPTIONS,
  WEEKDAY_OPTIONS,
  daysLabel,
  validateVisibilityForm,
} from '../../utils/homepageBuilderRules';
import { storeInputFromNow } from '../../utils/bannerAdmin';
import { isDarkColor, normalizeAnchor } from '../../../utils/homepageVisibility';

const txt = (option, isAr) => (isAr ? option.labelAr : option.labelEn);

function Card({ icon: Icon, title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-text">{title}</span>
          <span className="block truncate text-xs text-text-muted">{summary}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div className="space-y-4 border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
}

function Segmented({ value, options, onChange, isAr, size = 'md' }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface-muted/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            'rounded-lg font-semibold transition',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === option.value ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text',
          ].join(' ')}
          aria-pressed={value === option.value}
        >
          {txt(option, isAr)}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5">
      <p className="text-sm font-semibold text-text">{children}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

/**
 * Options every section type shares: when it shows, who sees it, how it looks,
 * and a private name/notes for the team.
 */
export default function HomepageSectionOptions({ form, setForm, isAr, zones = [] }) {
  const visibility = form.visibility || EMPTY_VISIBILITY_FORM;
  const appearance = form.appearance || EMPTY_APPEARANCE_FORM;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const errors = useMemo(() => validateVisibilityForm(visibility, isAr), [visibility, isAr]);

  const setVisibility = (patch) => setForm((prev) => ({ ...prev, visibility: { ...(prev.visibility || EMPTY_VISIBILITY_FORM), ...patch } }));
  const setAppearance = (patch) => setForm((prev) => ({ ...prev, appearance: { ...(prev.appearance || EMPTY_APPEARANCE_FORM), ...patch } }));

  const toggleDay = (day) => {
    const days = visibility.days.includes(day)
      ? visibility.days.filter((d) => d !== day)
      : [...visibility.days, day];
    setVisibility({ days: days.length === 7 ? [] : days });
  };

  const toggleZone = (id) => {
    const zonesNext = visibility.zones.includes(id)
      ? visibility.zones.filter((z) => z !== id)
      : [...visibility.zones, id];
    setVisibility({ zones: zonesNext });
  };

  const uploadBackground = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const res = await adminApi.uploadHeroSlideImage(file);
      const url = res.data?.data?.url || res.data?.url;
      if (url) setAppearance({ background: 'image', backgroundImage: url });
    } catch {
      setUploadError(isAr ? 'تعذّر رفع الصورة — ألصق رابطاً مباشراً بدلاً من ذلك' : 'Upload failed — paste an image link instead');
    } finally {
      setUploading(false);
    }
  };

  const hasSchedule = Boolean(visibility.startsAt || visibility.endsAt || visibility.days.length || visibility.timeFrom || visibility.timeTo);
  const scheduleText = hasSchedule
    ? [
      visibility.startsAt && `${isAr ? 'من' : 'From'} ${visibility.startsAt.replace('T', ' ')}`,
      visibility.endsAt && `${isAr ? 'حتى' : 'until'} ${visibility.endsAt.replace('T', ' ')}`,
      visibility.days.length ? daysLabel(visibility.days, isAr) : null,
      visibility.timeFrom && visibility.timeTo ? `${visibility.timeFrom}–${visibility.timeTo}` : null,
    ].filter(Boolean).join(' · ')
    : (isAr ? 'يظهر دائماً' : 'Always shown');

  const audienceText = [
    txt(AUDIENCE_OPTIONS.find((o) => o.value === visibility.audience) || AUDIENCE_OPTIONS[0], isAr),
    visibility.devices !== 'all' ? txt(DEVICE_OPTIONS.find((o) => o.value === visibility.devices), isAr) : null,
    visibility.zones.length ? (isAr ? `${visibility.zones.length} مناطق` : `${visibility.zones.length} zones`) : null,
  ].filter(Boolean).join(' · ');

  const bgOption = BACKGROUND_OPTIONS.find((o) => o.value === appearance.background) || BACKGROUND_OPTIONS[0];
  const lookText = [
    appearance.background !== 'none' ? txt(bgOption, isAr) : (isAr ? 'بدون خلفية' : 'No background'),
    appearance.spaceAbove !== 'none' || appearance.spaceBelow !== 'none' ? (isAr ? 'مسافات إضافية' : 'extra spacing') : null,
    appearance.anchor ? `#${appearance.anchor}` : null,
  ].filter(Boolean).join(' · ');

  const hasAudience = visibility.audience !== 'all' || visibility.devices !== 'all' || visibility.zones.length > 0;
  const hasLook = appearance.background !== 'none' || appearance.spaceAbove !== 'none' || appearance.spaceBelow !== 'none' || Boolean(appearance.anchor);
  const darkColor = appearance.background === 'custom' && isDarkColor(appearance.backgroundColor);

  return (
    <div className="space-y-3">
      <Card icon={CalendarClock} title={isAr ? 'متى يظهر' : 'When it shows'} summary={scheduleText} defaultOpen={hasSchedule}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>{isAr ? 'يبدأ' : 'Starts'}</FieldLabel>
            <input
              type="datetime-local"
              className={inputClass}
              value={visibility.startsAt}
              onChange={(e) => setVisibility({ startsAt: e.target.value })}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" className="text-xs font-semibold text-primary-700 hover:underline" onClick={() => setVisibility({ startsAt: storeInputFromNow() })}>
                {isAr ? 'الآن' : 'Now'}
              </button>
              {visibility.startsAt && (
                <button type="button" className="text-xs font-semibold text-text-muted hover:underline" onClick={() => setVisibility({ startsAt: '' })}>
                  {isAr ? 'مسح' : 'Clear'}
                </button>
              )}
            </div>
          </div>
          <div>
            <FieldLabel>{isAr ? 'ينتهي' : 'Ends'}</FieldLabel>
            <input
              type="datetime-local"
              className={`${inputClass} ${errors.endsAt ? 'border-red-400' : ''}`}
              value={visibility.endsAt}
              onChange={(e) => setVisibility({ endsAt: e.target.value })}
            />
            <div className="mt-1.5 flex flex-wrap gap-2">
              {[{ days: 1, ar: 'بعد يوم', en: '+1 day' }, { days: 7, ar: 'بعد أسبوع', en: '+1 week' }, { days: 30, ar: 'بعد شهر', en: '+1 month' }].map((q) => (
                <button key={q.days} type="button" className="text-xs font-semibold text-primary-700 hover:underline" onClick={() => setVisibility({ endsAt: storeInputFromNow({ days: q.days }) })}>
                  {isAr ? q.ar : q.en}
                </button>
              ))}
              {visibility.endsAt && (
                <button type="button" className="text-xs font-semibold text-text-muted hover:underline" onClick={() => setVisibility({ endsAt: '' })}>
                  {isAr ? 'بدون نهاية' : 'No end'}
                </button>
              )}
            </div>
            {errors.endsAt && <p className="mt-1 text-xs font-semibold text-red-600">{errors.endsAt}</p>}
          </div>
        </div>

        <div>
          <FieldLabel hint={isAr ? 'اترك الكل بدون اختيار ليظهر كل يوم' : 'Leave all unticked to show every day'}>
            {isAr ? 'أيام الأسبوع' : 'Days of the week'}
          </FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((day) => {
              const on = visibility.days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  aria-pressed={on}
                  className={[
                    'min-w-[3.25rem] rounded-lg border px-2.5 py-1.5 text-xs font-bold transition',
                    on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-border bg-white text-text-muted hover:border-primary-300',
                  ].join(' ')}
                >
                  {txt(day, isAr)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel hint={isAr ? 'بتوقيت القاهرة. مثال: 22:00 إلى 02:00 يستمر بعد منتصف الليل' : 'Cairo time. 22:00 to 02:00 runs past midnight'}>
            {isAr ? 'ساعات اليوم' : 'Hours of the day'}
          </FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <input type="time" className={`${inputClass} w-32`} value={visibility.timeFrom} onChange={(e) => setVisibility({ timeFrom: e.target.value })} aria-label={isAr ? 'من' : 'From'} />
            <span className="text-sm text-text-muted">{isAr ? 'إلى' : 'to'}</span>
            <input type="time" className={`${inputClass} w-32`} value={visibility.timeTo} onChange={(e) => setVisibility({ timeTo: e.target.value })} aria-label={isAr ? 'إلى' : 'To'} />
            {(visibility.timeFrom || visibility.timeTo) && (
              <button type="button" className="text-xs font-semibold text-text-muted hover:underline" onClick={() => setVisibility({ timeFrom: '', timeTo: '' })}>
                {isAr ? 'طوال اليوم' : 'All day'}
              </button>
            )}
          </div>
          {errors.time && <p className="mt-1 text-xs font-semibold text-red-600">{errors.time}</p>}
        </div>
      </Card>

      <Card icon={Users} title={isAr ? 'من يراه' : 'Who sees it'} summary={audienceText} defaultOpen={hasAudience}>
        <div>
          <FieldLabel>{isAr ? 'الزوار' : 'Visitors'}</FieldLabel>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {AUDIENCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={[
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                  visibility.audience === option.value ? 'border-primary-500 bg-primary-50/60 font-semibold text-primary-900' : 'border-border hover:border-primary-300',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="hp-audience"
                  className="accent-primary-600"
                  checked={visibility.audience === option.value}
                  onChange={() => setVisibility({ audience: option.value })}
                />
                {txt(option, isAr)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>{isAr ? 'الأجهزة' : 'Devices'}</FieldLabel>
          <Segmented value={visibility.devices} options={DEVICE_OPTIONS} onChange={(devices) => setVisibility({ devices })} isAr={isAr} />
        </div>

        <div>
          <FieldLabel hint={isAr ? 'بدون اختيار = كل المناطق. يعتمد على منطقة التوصيل التي اختارها الزائر.' : 'None picked = every zone. Uses the delivery zone the visitor picked.'}>
            {isAr ? 'مناطق التوصيل' : 'Delivery zones'}
          </FieldLabel>
          {zones.length === 0 ? (
            <p className="text-xs text-text-muted">{isAr ? 'لا توجد مناطق توصيل بعد.' : 'No delivery zones yet.'}</p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {zones.map((zone) => {
                const id = String(zone.id || zone._id);
                const on = visibility.zones.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleZone(id)}
                    aria-pressed={on}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-border bg-white text-text-muted hover:border-primary-300',
                    ].join(' ')}
                  >
                    {isAr ? zone.nameAr || zone.nameEn : zone.nameEn || zone.nameAr}
                  </button>
                );
              })}
            </div>
          )}
          {visibility.zones.some((id) => !zones.some((z) => String(z.id || z._id) === id)) && zones.length > 0 && (
            <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline" onClick={() => setVisibility({ zones: visibility.zones.filter((id) => zones.some((z) => String(z.id || z._id) === id)) })}>
              <X className="h-3 w-3" />
              {isAr ? 'إزالة مناطق محذوفة' : 'Remove deleted zones'}
            </button>
          )}
        </div>
      </Card>

      <Card icon={Palette} title={isAr ? 'الشكل' : 'Look'} summary={lookText} defaultOpen={hasLook}>
        <div>
          <FieldLabel>{isAr ? 'الخلفية' : 'Background'}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {BACKGROUND_OPTIONS.map((option) => {
              const on = appearance.background === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAppearance({ background: option.value })}
                  aria-pressed={on}
                  className={[
                    'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition',
                    on ? 'border-primary-500 ring-2 ring-primary-200' : 'border-border hover:border-primary-300',
                  ].join(' ')}
                >
                  {option.swatch ? (
                    <span className="h-4 w-4 rounded-full border border-slate-300" style={{ background: option.swatch }} />
                  ) : option.value === 'image' ? (
                    <ImageIcon className="h-4 w-4 text-text-muted" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-slate-300" style={{ background: appearance.backgroundColor || 'conic-gradient(#fca5a5,#fde68a,#86efac,#93c5fd,#c4b5fd,#fca5a5)' }} />
                  )}
                  {txt(option, isAr)}
                </button>
              );
            })}
          </div>

          {appearance.background === 'custom' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={appearance.backgroundColor || '#fff7ed'}
                onChange={(e) => setAppearance({ backgroundColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-white p-0.5"
                aria-label={isAr ? 'اللون' : 'Colour'}
              />
              <input
                className={`${inputClass} w-32 font-mono`}
                value={appearance.backgroundColor}
                placeholder="#fff7ed"
                onChange={(e) => setAppearance({ backgroundColor: e.target.value.trim() })}
              />
              {darkColor && (
                <p className="w-full text-xs font-semibold text-amber-700">
                  {isAr ? 'هذا اللون غامق — النص في المتجر داكن وقد يصعب قراءته. اختر لوناً فاتحاً.' : 'This colour is dark — store text is dark too and may be hard to read. Pick a light colour.'}
                </p>
              )}
            </div>
          )}

          {appearance.background === 'image' && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${inputClass} min-w-0 flex-1`}
                  value={appearance.backgroundImage}
                  placeholder="https://…"
                  onChange={(e) => setAppearance({ backgroundImage: e.target.value.trim() })}
                />
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-surface-muted">
                  {uploading ? '…' : (isAr ? 'رفع صورة' : 'Upload')}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => uploadBackground(e.target.files?.[0])} />
                </label>
              </div>
              {uploadError && <p className="text-xs font-semibold text-red-600">{uploadError}</p>}
              <div>
                <FieldLabel hint={isAr ? 'طبقة بيضاء فوق الصورة حتى يبقى النص مقروءاً' : 'A white layer over the image keeps text readable'}>
                  {isAr ? 'تفتيح الصورة' : 'Soften image'}
                </FieldLabel>
                <Segmented
                  size="sm"
                  value={appearance.overlay}
                  onChange={(overlay) => setAppearance({ overlay })}
                  isAr={isAr}
                  options={[
                    { value: 'none', labelAr: 'بدون', labelEn: 'None' },
                    { value: 'light', labelAr: 'قليل', labelEn: 'Light' },
                    { value: 'strong', labelAr: 'قوي', labelEn: 'Strong' },
                  ]}
                />
              </div>
            </div>
          )}

          {appearance.background !== 'none' && (
            <div className="mt-3">
              <FieldLabel>{isAr ? 'عرض الخلفية' : 'Background width'}</FieldLabel>
              <Segmented
                size="sm"
                value={appearance.width}
                onChange={(width) => setAppearance({ width })}
                isAr={isAr}
                options={[
                  { value: 'full', labelAr: 'عرض الشاشة', labelEn: 'Full width' },
                  { value: 'contained', labelAr: 'بطاقة بزوايا مستديرة', labelEn: 'Rounded card' },
                ]}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>{isAr ? 'مسافة إضافية أعلاه' : 'Extra space above'}</FieldLabel>
            <Segmented size="sm" value={appearance.spaceAbove} options={SPACE_OPTIONS} onChange={(spaceAbove) => setAppearance({ spaceAbove })} isAr={isAr} />
          </div>
          <div>
            <FieldLabel>{isAr ? 'مسافة إضافية أسفله' : 'Extra space below'}</FieldLabel>
            <Segmented size="sm" value={appearance.spaceBelow} options={SPACE_OPTIONS} onChange={(spaceBelow) => setAppearance({ spaceBelow })} isAr={isAr} />
          </div>
        </div>

        <div>
          <FieldLabel hint={isAr ? 'لتربط زراً أو قائمة بهذا القسم مباشرة' : 'Lets a button or menu link jump straight to this section'}>
            <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />{isAr ? 'اسم الرابط' : 'Link name'}</span>
          </FieldLabel>
          <input
            className={inputClass}
            value={appearance.anchor}
            placeholder={isAr ? 'مثال: عروض-رمضان' : 'e.g. ramadan-offers'}
            onChange={(e) => setAppearance({ anchor: e.target.value })}
          />
          {appearance.anchor && (
            <p className="mt-1 text-xs text-text-muted">
              {isAr ? 'الرابط:' : 'Link:'}{' '}
              <code className="rounded bg-surface-muted px-1.5 py-0.5" dir="ltr">
                /#{normalizeAnchor(appearance.anchor)}
              </code>
            </p>
          )}
        </div>
      </Card>

      <Card
        icon={StickyNote}
        title={isAr ? 'للفريق فقط' : 'For your team'}
        summary={form.adminLabel || (isAr ? 'اسم وملاحظات لا يراها الزوار' : 'A name and notes visitors never see')}
        defaultOpen={Boolean(form.adminLabel || form.adminNotes)}
      >
        <div>
          <FieldLabel hint={isAr ? 'يظهر في قائمة الأقسام بدلاً من العنوان' : 'Shown in the section list instead of the title'}>
            {isAr ? 'اسم داخلي' : 'Internal name'}
          </FieldLabel>
          <input
            className={inputClass}
            maxLength={80}
            value={form.adminLabel || ''}
            placeholder={isAr ? 'مثال: عروض الإفطار — رمضان' : 'e.g. Breakfast deals — Ramadan'}
            onChange={(e) => setForm((prev) => ({ ...prev, adminLabel: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel>{isAr ? 'ملاحظات' : 'Notes'}</FieldLabel>
          <textarea
            className={inputClass}
            rows={3}
            maxLength={1000}
            value={form.adminNotes || ''}
            placeholder={isAr ? 'مثال: يُحذف بعد العيد' : 'e.g. Remove after Eid'}
            onChange={(e) => setForm((prev) => ({ ...prev, adminNotes: e.target.value }))}
          />
        </div>
      </Card>
    </div>
  );
}
