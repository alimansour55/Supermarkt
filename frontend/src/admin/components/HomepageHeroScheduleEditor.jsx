import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../adminApi';
import {
  SCHEDULE_UNITS,
  bannerScheduleStatus,
  dateInputValue,
  emptySchedulePeriod,
  formatPeriodLabel,
  formatScheduleNowLabel,
  formatSchedulePhaseLabel,
  getHeroSchedulePhase,
  getHeroSchedulePeriodIndex,
  normalizeHeroRotation,
  periodPluralLabel,
  scheduleUnitMeta,
} from '../utils/bannerScheduleUtils';
import { slideFromBanner, slidePreviewUrl } from './homepageHeroSlideHelpers';

function ScheduleTimeline({ phase, isAr }) {
  const steps = [
    { key: 'before', ar: 'احتياطي', en: 'Fallback', subAr: 'قبل البداية', subEn: 'Before start' },
    { key: 'active', ar: 'جدولة', en: 'Schedule', subAr: 'دورة البانرات', subEn: 'Banner rotation' },
    { key: 'after', ar: 'احتياطي', en: 'Fallback', subAr: 'بعد النهاية', subEn: 'After end' },
  ];
  const liveKey = phase === 'disabled' ? null : phase;

  return (
    <div>
      <p className="mb-2 text-center text-[11px] font-medium text-violet-800/90">
        {isAr
          ? 'معاينة ما يُعرض على الموقع الآن — يمكنك تعديل كل الأقسام أدناه في نفس الجلسة'
          : 'Live site preview — you can edit all sections below in the same session'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step) => {
          const liveNow = liveKey === step.key;
          return (
            <div
              key={step.key}
              className={`rounded-xl border px-2 py-3 text-center transition ${
                liveNow
                  ? 'border-violet-500 bg-violet-100 ring-2 ring-violet-300'
                  : 'border-border bg-white'
              }`}
            >
              <p className="text-xs font-bold">{isAr ? step.ar : step.en}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">{isAr ? step.subAr : step.subEn}</p>
              {liveNow && (
                <p className="mt-1 text-[10px] font-bold text-violet-800">
                  {isAr ? '← على الموقع الآن' : '← live on site'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeriodBannerPicker({ open, periodLabel, onClose, onPick, isAr }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setLoading(true);
    adminApi.getBanners()
      .then((res) => setBanners(res.data?.data || res.data || []))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false));
    return undefined;
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return banners.filter((b) => {
      if (!q) return true;
      return `${b.titleAr || ''} ${b.titleEn || ''}`.toLowerCase().includes(q);
    });
  }, [banners, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-bold">
            {isAr ? `إضافة بانر — ${periodLabel}` : `Add banner — ${periodLabel}`}
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            {isAr ? 'يمكنك إضافة أكثر من بانر لنفس الفترة — تظهر كسلايدر.' : 'Add multiple banners for the same period — they rotate as slides.'}
          </p>
          <input
            className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-sm"
            placeholder={isAr ? 'بحث في البانرات...' : 'Search banners...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="py-8 text-center text-sm text-text-muted">{isAr ? 'جار التحميل...' : 'Loading...'}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((banner) => {
              const thumb = banner.desktopImage || banner.image || banner.mobileImage;
              const status = bannerScheduleStatus(banner);
              return (
                <button
                  key={banner._id}
                  type="button"
                  onClick={() => { onPick(banner); }}
                  className="flex gap-3 rounded-xl border border-border p-3 text-start hover:border-primary-300 hover:bg-primary-50/40"
                >
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{banner.titleAr || banner.titleEn}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                      {isAr ? status.labelAr : status.labelEn}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-border p-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
            {isAr ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PeriodSlideRow({ slide, slideIndex, isAr, onRemove }) {
  const preview = slidePreviewUrl(slide);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-1.5">
      <div className="h-9 w-14 shrink-0 overflow-hidden rounded bg-surface-muted">
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <p className="min-w-0 flex-1 truncate text-xs font-medium">
        {slide.titleAr || slide.titleEn || (isAr ? `شريحة ${slideIndex + 1}` : `Slide ${slideIndex + 1}`)}
      </p>
      <button type="button" onClick={onRemove} className="rounded p-1 text-red-600 hover:bg-red-50">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function HomepageHeroScheduleEditor({
  heroRotation,
  isAr,
  onRotationChange,
}) {
  const [pickerPeriod, setPickerPeriod] = useState(null);
  const [expandedPeriod, setExpandedPeriod] = useState(null);

  const rotation = useMemo(() => normalizeHeroRotation(heroRotation), [heroRotation]);
  const unitMeta = scheduleUnitMeta(rotation.unit);
  const periods = rotation.periods || [];
  const cycleLength = rotation.cycleLength || periods.length || 4;
  const phase = useMemo(() => getHeroSchedulePhase(rotation), [rotation]);
  const runsForever = rotation.runsForever !== false;
  const isEnabled = rotation.isEnabled !== false;

  const currentPeriod = useMemo(() => {
    if (phase !== 'active') return 0;
    return getHeroSchedulePeriodIndex(rotation.startDate, rotation.unit, cycleLength);
  }, [phase, rotation.startDate, rotation.unit, cycleLength]);

  const patchRotation = (updates) => onRotationChange({ ...rotation, ...updates });

  const setPeriods = (nextPeriods) => {
    patchRotation({
      periods: nextPeriods,
      cycleLength: Math.max(cycleLength, nextPeriods.length),
    });
  };

  const addPeriod = () => {
    const periodIndex = periods.length + 1;
    setPeriods([...periods, emptySchedulePeriod(periodIndex)]);
    setExpandedPeriod(periodIndex);
  };

  const removePeriod = (index) => {
    const next = periods
      .filter((_, i) => i !== index)
      .map((period, i) => ({ ...period, periodIndex: i + 1 }));
    patchRotation({ periods: next, cycleLength: Math.max(1, next.length) });
  };

  const addBannerToPeriod = (periodIndex, banner) => {
    const next = periods.map((period) => {
      if (period.periodIndex !== periodIndex) return period;
      return {
        ...period,
        slides: [...(period.slides || []), slideFromBanner(banner)],
      };
    });
    setPeriods(next);
  };

  const removeSlideFromPeriod = (periodIndex, slideIndex) => {
    const next = periods.map((period) => {
      if (period.periodIndex !== periodIndex) return period;
      return {
        ...period,
        slides: (period.slides || []).filter((_, i) => i !== slideIndex),
      };
    });
    setPeriods(next);
  };

  const pickerLabel = pickerPeriod
    ? formatPeriodLabel(pickerPeriod, rotation.unit, isAr)
    : '';

  return (
    <div className="space-y-4">
      <label
        className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition ${
          isEnabled
            ? 'border-emerald-300 bg-emerald-50/80'
            : 'border-amber-300 bg-amber-50/80'
        }`}
      >
        <div>
          <p className="text-sm font-bold text-text">
            {isAr ? 'تفعيل الجدولة على الموقع' : 'Schedule active on site'}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {isEnabled
              ? (isAr
                ? 'الجدولة تعمل حسب التواريخ والدورة أدناه — عطّلها فوراً دون تغيير الإعدادات.'
                : 'Schedule runs per dates and rotation below — turn off instantly without changing settings.')
              : (isAr
                ? '⏸ متوقفة الآن — يُعرض الاحتياطي. فعّلها مجدداً بنقرة واحدة.'
                : '⏸ Paused — fallback is showing. Re-enable with one click.')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-xs font-bold ${isEnabled ? 'text-emerald-800' : 'text-amber-800'}`}>
            {isEnabled ? (isAr ? 'مفعّلة' : 'Active') : (isAr ? 'متوقفة' : 'Paused')}
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-border text-emerald-600 focus:ring-emerald-500"
            checked={isEnabled}
            onChange={(e) => patchRotation({ isEnabled: e.target.checked })}
          />
        </div>
      </label>

      <div className={`space-y-4 ${!isEnabled ? 'opacity-60' : ''}`}>
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 space-y-4">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
          <div>
            <p className="text-sm font-bold text-violet-950">
              {isAr ? 'جدولة دورية — كيف يعمل؟' : 'Recurring schedule — how it works'}
            </p>
            <p className="mt-1 text-xs text-violet-900/80">
              {isAr
                ? '① احتياطي قبل البداية → ② بانرات الدورة أثناء التفعيل → ③ احتياطي بعد النهاية (إن وُجد).'
                : '① Fallback before start → ② rotation banners while active → ③ fallback after end (if set).'}
            </p>
            <p className="mt-2 text-[11px] text-violet-800/90">
              {isAr
                ? '«متى تُفعّل» ≠ «كيف تتناوب البانرات» — إعدادان منفصلان.'
                : '«When active» ≠ «how banners rotate» — two separate settings.'}
            </p>
          </div>
        </div>
        <ScheduleTimeline phase={phase} isAr={isAr} />
        <p className="text-center text-xs font-semibold text-violet-900">
          {formatSchedulePhaseLabel(phase, isAr)}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-text-muted">
          {isAr ? '① متى تُفعّل الجدولة؟' : '① When is scheduling active?'}
        </p>
        <p className="mb-3 text-[11px] text-text-muted">
          {isAr
            ? 'يحدد متى تبدأ وتنتهي الجدولة على الموقع — لا علاقة له بعدد البانرات المتناوبة.'
            : 'Controls when scheduling is on for the site — unrelated to how many banners rotate.'}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text">
              {isAr ? 'تاريخ البداية' : 'Start date'}
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              value={dateInputValue(rotation.startDate) || rotation.startDate || ''}
              onChange={(e) => patchRotation({ startDate: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-text-muted">
              {isAr ? 'قبل هذا التاريخ → الشرائح الاحتياطية أدناه' : 'Before this → fallback slides below'}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text">
              {isAr ? 'متى تتوقف؟' : 'When does it stop?'}
            </label>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => patchRotation({ runsForever: true, endDate: '' })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  runsForever ? 'bg-violet-600 text-white' : 'border border-border bg-white'
                }`}
              >
                {isAr ? '∞ بدون نهاية' : '∞ No end date'}
              </button>
              <button
                type="button"
                onClick={() => patchRotation({ runsForever: false })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  !runsForever ? 'bg-violet-600 text-white' : 'border border-border bg-white'
                }`}
              >
                {isAr ? 'تاريخ محدد' : 'Fixed end date'}
              </button>
            </div>
            {!runsForever && (
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={dateInputValue(rotation.endDate) || rotation.endDate || ''}
                onChange={(e) => patchRotation({ runsForever: false, endDate: e.target.value })}
              />
            )}
            <p className="mt-1 text-[11px] text-text-muted">
              {runsForever
                ? (isAr ? 'الجدولة تبقى مفعّلة إلى أن توقفها يدوياً' : 'Scheduling stays on until you turn it off manually')
                : (isAr ? 'بعد هذا التاريخ → الشرائح الاحتياطية أدناه' : 'After this → fallback slides below')}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/20 p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-violet-900">
          {isAr ? '② كيف تتناوب البانرات؟' : '② How do banners rotate?'}
        </p>
        <p className="mb-3 text-[11px] text-text-muted">
          {isAr
            ? 'يحدد سرعة التبديل وعدد مجموعات البانرات قبل إعادة نفس الترتيب — يعمل فقط أثناء فترة التفعيل أعلاه.'
            : 'Sets how often banners change and how many sets repeat — only applies while scheduling is active above.'}
        </p>
        <p className="mb-2 text-xs font-semibold text-text">
          {isAr ? 'كل كم يتغير البانر؟' : 'How often does the banner change?'}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SCHEDULE_UNITS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => patchRotation({
                unit: opt.value,
                cycleLength: Math.min(opt.maxCycle, cycleLength),
              })}
              className={`rounded-xl border p-3 text-start transition ${
                rotation.unit === opt.value
                  ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                  : 'border-border bg-white hover:border-violet-200'
              }`}
            >
              <p className="text-sm font-bold">{isAr ? opt.labelAr : opt.labelEn}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">{isAr ? opt.descAr : opt.descEn}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text">
              {isAr
                ? `كم ${unitMeta.periodLabelPluralAr} مختلف قبل إعادة التكرار؟`
                : `How many different ${unitMeta.periodLabelPluralEn.toLowerCase()} before repeating?`}
            </label>
            <input
              type="number"
              min="1"
              max={unitMeta.maxCycle}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
              value={cycleLength}
              onChange={(e) => patchRotation({
                cycleLength: Math.min(unitMeta.maxCycle, Math.max(1, Number(e.target.value) || 1)),
              })}
            />
            <p className="mt-1 text-[11px] text-text-muted">
              {isAr
                ? `مثال: 4 = ${unitMeta.periodLabelAr} 1، 2، 3، 4 ثم يبدأ من ${unitMeta.periodLabelAr} 1 مجدداً`
                : `Example: 4 = ${unitMeta.periodLabelEn} 1, 2, 3, 4 then back to ${unitMeta.periodLabelEn} 1`}
            </p>
          </div>
          <div className="flex flex-col justify-end">
            <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-violet-900 ring-1 ring-violet-100">
              {formatScheduleNowLabel(rotation, isAr)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
        <p className="text-sm font-bold text-text">
          {isAr ? `بانرات الدورة — كل ${unitMeta.periodLabelAr}` : `Rotation banners — per ${unitMeta.periodLabelEn.toLowerCase()}`}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {isAr
            ? 'اربط بانرات بكل فترة — تُعرض فقط أثناء تفعيل الجدولة (القسم ①).'
            : 'Link banners to each slot — shown only while scheduling is active (section ①).'}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-text">
          {isAr ? `${periodPluralLabel(rotation.unit, true)} الدورة` : `${unitMeta.periodLabelPluralEn} in cycle`}
        </p>
        <button
          type="button"
          onClick={addPeriod}
          className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700"
        >
          <Plus className="h-3.5 w-3.5" />
          {isAr ? `إضافة ${unitMeta.periodLabelAr}` : `Add ${unitMeta.periodLabelEn.toLowerCase()}`}
        </button>
      </div>

      {periods.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted">
          {isAr
            ? `أضف ${periodPluralLabel(rotation.unit, true)} واربط بانرات — يمكن أكثر من بانر لكل فترة.`
            : `Add ${unitMeta.periodLabelPluralEn.toLowerCase()} and link banners — multiple per period allowed.`}
        </p>
      )}

      <div className="space-y-2">
        {periods.map((period, index) => {
          const isCurrent = currentPeriod > 0 && period.periodIndex === currentPeriod;
          const isOpen = expandedPeriod === period.periodIndex;
          const label = formatPeriodLabel(period.periodIndex, rotation.unit, isAr);
          const slideCount = period.slides?.length || 0;

          return (
            <div
              key={period._id || `period-${period.periodIndex}`}
              className={`rounded-xl border ${isCurrent ? 'border-violet-400 bg-violet-50/40' : 'border-border bg-white'}`}
            >
              <div className="flex items-center gap-3 p-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isCurrent ? 'bg-violet-600 text-white' : 'bg-surface-muted'}`}>
                  {period.periodIndex}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-text-muted">
                    {slideCount > 0
                      ? (isAr ? `${slideCount} بانر(ات)${isCurrent ? ' · يُعرض الآن' : ''}` : `${slideCount} banner(s)${isCurrent ? ' · live now' : ''}`)
                      : (isAr ? 'لا بانرات — أضف من المكتبة' : 'No banners — add from library')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerPeriod(period.periodIndex)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {isAr ? '+ بانر' : '+ Banner'}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedPeriod(isOpen ? null : period.periodIndex)}
                  className="rounded p-1.5 text-text-muted hover:bg-surface-muted"
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => removePeriod(index)} className="rounded p-1.5 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isOpen && slideCount > 0 && (
                <div className="space-y-1.5 border-t border-border px-3 pb-3 pt-2">
                  {(period.slides || []).map((slide, slideIndex) => (
                    <PeriodSlideRow
                      key={slide._id || `${period.periodIndex}-${slideIndex}`}
                      slide={slide}
                      slideIndex={slideIndex}
                      isAr={isAr}
                      onRemove={() => removeSlideFromPeriod(period.periodIndex, slideIndex)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PeriodBannerPicker
        open={pickerPeriod != null}
        periodIndex={pickerPeriod}
        periodLabel={pickerLabel}
        isAr={isAr}
        onClose={() => setPickerPeriod(null)}
        onPick={(banner) => {
          if (pickerPeriod != null) addBannerToPeriod(pickerPeriod, banner);
        }}
      />
      </div>
    </div>
  );
}
