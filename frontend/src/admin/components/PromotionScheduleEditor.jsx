import { useRef } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Infinity as InfinityIcon,
  Sparkles,
  Zap,
} from 'lucide-react';
import Input from '../../components/ui/Input';
import {
  addDaysIso,
  addDurationToSchedule,
  clampScheduleToFuture,
  formatDurationShort,
  formatScheduleClock,
  formatScheduleDateShort,
  getScheduleDurationMinutes,
  inferScheduleMode,
  isScheduleInPast,
  minEndTimeForSchedule,
  normalizeLimitedScheduleFields,
  nowLocalSchedule,
  parseLocalSchedule,
  todayIso,
} from '../utils/promotionUtils';

const FLASH_PRESETS = [
  { id: '15m', minutes: 15, ar: '15 د', en: '15m' },
  { id: '30m', minutes: 30, ar: '30 د', en: '30m' },
  { id: '45m', minutes: 45, ar: '45 د', en: '45m' },
  { id: '1h', minutes: 60, ar: '1 س', en: '1h' },
];

const HOUR_PRESETS = [
  { id: '2h', minutes: 120, ar: '2 س', en: '2h' },
  { id: '4h', minutes: 240, ar: '4 س', en: '4h' },
  { id: '6h', minutes: 360, ar: '6 س', en: '6h' },
  { id: '12h', minutes: 720, ar: '12 س', en: '12h' },
  { id: '24h', minutes: 1440, ar: '24 س', en: '24h' },
];

const DAY_PRESETS = [
  { id: 'today', days: 0, sameDay: true, ar: 'اليوم', en: 'Today', highlight: true },
  { id: '3d', days: 2, ar: '3 أيام', en: '3 days' },
  { id: '7d', days: 6, ar: 'أسبوع', en: '1 week' },
  { id: '14d', days: 13, ar: 'أسبوعان', en: '2 weeks' },
  { id: '30d', days: 29, ar: 'شهر', en: '1 month' },
];

function PresetChip({ active, onClick, children, tone = 'default' }) {
  const tones = {
    flash: active
      ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
      : 'border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100',
    hours: active
      ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
      : 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-100',
    days: active
      ? 'border-orange-500 bg-orange-600 text-white shadow-sm'
      : 'border-border bg-white text-text hover:border-orange-300 hover:bg-orange-50',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-xs font-bold tabular-nums transition-all ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function ScheduleEndpoint({ label, date, time, isAr }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-text">
        {formatScheduleDateShort(date, isAr)}
      </p>
      <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-primary-700" dir="ltr">
        {formatScheduleClock(time)}
      </p>
    </div>
  );
}

export default function PromotionScheduleEditor({
  form,
  setForm,
  isAr = true,
  compact = false,
  isEdit = false,
}) {
  const mode = inferScheduleMode(form);
  const now = nowLocalSchedule();
  const today = todayIso();
  const lockedStartRef = useRef(null);

  if (isEdit && lockedStartRef.current === null && form.startsAt
    && isScheduleInPast(form.startsAt, form.startsAtTime || '00:00')) {
    lockedStartRef.current = {
      date: form.startsAt,
      time: form.startsAtTime || '00:00',
    };
  }

  const lockedStart = lockedStartRef.current;
  const startDateMin = lockedStart?.date && lockedStart.date < today
    ? lockedStart.date
    : today;
  const startTimeMin = form.startsAt === today && !(
    lockedStart && form.startsAt === lockedStart.date && form.startsAt < today
  ) ? now.time : undefined;
  const endDateMin = form.startsAt && form.startsAt > today ? form.startsAt : today;
  const endTimeMin = mode === 'limited' && form.endsAt
    ? minEndTimeForSchedule(form, now)
    : undefined;

  const durationMinutes = mode === 'limited' ? getScheduleDurationMinutes(form) : null;

  const patchSchedule = (patch) => {
    setForm((prev) => normalizeLimitedScheduleFields(
      { ...prev, ...patch, scheduleMode: 'limited' },
      { lockedStart },
    ));
  };

  const setMode = (scheduleMode) => {
    setForm((prev) => {
      if (scheduleMode === 'open') {
        return {
          ...prev,
          scheduleMode: 'open',
          startsAt: prev.startsAt || today,
          startsAtTime: prev.startsAtTime || '00:00',
          endsAt: '',
          endsAtTime: '23:59',
        };
      }
      const start = clampScheduleToFuture(prev.startsAt || today, prev.startsAtTime || now.time);
      return normalizeLimitedScheduleFields({
        ...prev,
        scheduleMode: 'limited',
        startsAt: start.date,
        startsAtTime: start.time,
        endsAt: prev.endsAt || addDaysIso(start.date, 6),
        endsAtTime: prev.endsAtTime || '23:59',
      }, { lockedStart });
    });
  };

  const applyDurationPreset = (minutes) => {
    const start = clampScheduleToFuture(form.startsAt || today, now.time);
    const end = addDurationToSchedule(start.date, start.time, minutes);
    patchSchedule({
      startsAt: start.date,
      startsAtTime: start.time,
      endsAt: end.date,
      endsAtTime: end.time,
    });
  };

  const applyDayPreset = (preset) => {
    const start = clampScheduleToFuture(form.startsAt || today, preset.sameDay ? now.time : '00:00');
    patchSchedule({
      startsAt: start.date,
      startsAtTime: preset.sameDay ? start.time : '00:00',
      endsAt: preset.sameDay ? start.date : addDaysIso(start.date, preset.days),
      endsAtTime: '23:59',
    });
  };

  const startFromNow = () => {
    const start = clampScheduleToFuture(today, now.time);
    const end = addDurationToSchedule(start.date, start.time, 60);
    patchSchedule({
      startsAt: start.date,
      startsAtTime: start.time,
      endsAt: end.date,
      endsAtTime: end.time,
    });
  };

  const patchOpenStart = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (!next.startsAt) return next;
      const clamped = clampScheduleToFuture(next.startsAt, next.startsAtTime || now.time);
      return { ...next, startsAt: clamped.date, startsAtTime: clamped.time };
    });
  };

  const isMinutePresetActive = (minutes) => {
    if (durationMinutes == null) return false;
    return Math.abs(durationMinutes - minutes) <= 1
      && form.startsAt === form.endsAt;
  };

  const isDayPresetActive = (preset) => {
    if (!form.startsAt || !form.endsAt) return false;
    if (preset.sameDay) {
      return form.startsAt === form.endsAt
        && form.endsAtTime === '23:59'
        && (form.startsAtTime || '00:00') !== '00:00';
    }
    const expectedEnd = addDaysIso(form.startsAt, preset.days);
    return form.endsAt === expectedEnd && form.endsAtTime === '23:59';
  };

  const scheduleStatus = (() => {
    if (mode !== 'limited' || !form.startsAt || !form.endsAt) return null;
    if (isScheduleInPast(form.startsAt, form.startsAtTime || '00:00')
      && !(lockedStart && form.startsAt === lockedStart.date && form.startsAtTime === lockedStart.time)) {
      return { type: 'error', text: isAr ? 'لا يمكن اختيار وقت في الماضي' : 'Start time cannot be in the past' };
    }
    const start = parseLocalSchedule(form.startsAt, form.startsAtTime || '00:00');
    const end = parseLocalSchedule(form.endsAt, form.endsAtTime || '23:59');
    const ms = end.getTime() - start.getTime();
    if (ms <= 0) {
      return { type: 'error', text: isAr ? 'وقت النهاية يجب أن يكون بعد البداية' : 'End must be after start' };
    }
    if (isScheduleInPast(form.endsAt, form.endsAtTime || '23:59')) {
      return { type: 'error', text: isAr ? 'وقت النهاية لا يمكن أن يكون في الماضي' : 'End time cannot be in the past' };
    }

    const isFullDay = form.startsAt === form.endsAt
      && form.startsAtTime === '00:00'
      && form.endsAtTime === '23:59';

    return {
      type: 'ok',
      duration: formatDurationShort(durationMinutes, isAr),
      isFullDay,
      sameDay: form.startsAt === form.endsAt,
    };
  })();

  return (
    <div className={`space-y-4 rounded-2xl border border-border bg-gradient-to-b from-slate-50 to-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <CalendarClock className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-text">
              {isAr ? 'مدة العرض' : 'Offer schedule'}
            </p>
            <p className="text-[11px] text-text-muted">
              {isAr ? 'كل الأوقات بتوقيت المتجر (24 ساعة)' : 'All times in store timezone (24h)'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode('limited')}
          className={`rounded-2xl border p-3.5 text-start transition-all ${
            mode === 'limited'
              ? 'border-orange-400 bg-orange-50 shadow-sm ring-2 ring-orange-200'
              : 'border-border bg-white hover:border-orange-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <Zap className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <span className="text-sm font-bold text-text">{isAr ? 'عرض محدود' : 'Limited time'}</span>
              <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                {isAr ? 'دقائق، ساعات، أو أيام — مثالي للعروض السريعة' : 'Minutes, hours, or days — ideal for flash deals'}
              </p>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode('open')}
          className={`rounded-2xl border p-3.5 text-start transition-all ${
            mode === 'open'
              ? 'border-slate-400 bg-slate-100 shadow-sm ring-2 ring-slate-200'
              : 'border-border bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
              <InfinityIcon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <span className="text-sm font-bold text-text">{isAr ? 'مفتوح' : 'Open-ended'}</span>
              <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                {isAr ? 'بدون انتهاء — أوقفه يدوياً من قائمة الحملات' : 'No end date — pause manually from campaigns'}
              </p>
            </div>
          </div>
        </button>
      </div>

      {mode === 'limited' && (
        <>
          <div className="rounded-2xl border border-border/80 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-text">
                {isAr ? 'النافذة الزمنية' : 'Time window'}
              </p>
              <button
                type="button"
                onClick={startFromNow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-[11px] font-bold text-primary-800 transition-colors hover:bg-primary-100"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'يبدأ الآن + ساعة' : 'Start now + 1h'}
              </button>
            </div>

            <div className="flex items-stretch gap-2 sm:gap-3">
              <ScheduleEndpoint
                label={isAr ? 'البداية' : 'Starts'}
                date={form.startsAt}
                time={form.startsAtTime || '00:00'}
                isAr={isAr}
              />
              <div className="flex shrink-0 items-center text-text-muted">
                <ArrowLeft className={`h-5 w-5 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
              </div>
              <ScheduleEndpoint
                label={isAr ? 'النهاية' : 'Ends'}
                date={form.endsAt}
                time={form.endsAtTime || '23:59'}
                isAr={isAr}
              />
            </div>

            {scheduleStatus?.type === 'ok' && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <Clock className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
                <p className="text-xs font-semibold text-text">
                  {scheduleStatus.isFullDay
                    ? (isAr ? `عرض ليوم كامل — ${form.endsAt}` : `Full day — ${form.endsAt}`)
                    : (isAr
                      ? `المدة: ${scheduleStatus.duration}`
                      : `Duration: ${scheduleStatus.duration}`)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-dashed border-border bg-white/80 p-4">
            <p className="text-xs font-bold text-text">
              {isAr ? 'ضبط يدوي' : 'Custom times'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={isAr ? 'تاريخ البداية' : 'Start date'}
                type="date"
                min={startDateMin}
                value={form.startsAt || ''}
                onChange={(e) => patchSchedule({ startsAt: e.target.value })}
                inputClassName="font-mono text-sm"
              />
              <Input
                label={isAr ? 'وقت البداية (24 س)' : 'Start time (24h)'}
                type="time"
                step="60"
                min={startTimeMin}
                value={formatScheduleClock(form.startsAtTime || '00:00')}
                onChange={(e) => patchSchedule({ startsAtTime: e.target.value })}
                inputClassName="font-mono text-sm"
              />
              <Input
                label={isAr ? 'تاريخ النهاية' : 'End date'}
                type="date"
                min={endDateMin}
                value={form.endsAt || ''}
                onChange={(e) => patchSchedule({ endsAt: e.target.value })}
                inputClassName="font-mono text-sm"
              />
              <Input
                label={isAr ? 'وقت النهاية (24 س)' : 'End time (24h)'}
                type="time"
                step="60"
                min={endTimeMin}
                value={formatScheduleClock(form.endsAtTime || '23:59')}
                onChange={(e) => patchSchedule({ endsAtTime: e.target.value })}
                inputClassName="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-800">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'عروض سريعة (دقائق)' : 'Flash deals (minutes)'}
              </p>
              <div className="flex flex-wrap gap-2">
                {FLASH_PRESETS.map((preset) => (
                  <PresetChip
                    key={preset.id}
                    tone="flash"
                    active={isMinutePresetActive(preset.minutes)}
                    onClick={() => applyDurationPreset(preset.minutes)}
                  >
                    {isAr ? preset.ar : preset.en}
                  </PresetChip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-800">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'مدة بالساعات' : 'Hour blocks'}
              </p>
              <div className="flex flex-wrap gap-2">
                {HOUR_PRESETS.map((preset) => (
                  <PresetChip
                    key={preset.id}
                    tone="hours"
                    active={isMinutePresetActive(preset.minutes)}
                    onClick={() => applyDurationPreset(preset.minutes)}
                  >
                    {isAr ? preset.ar : preset.en}
                  </PresetChip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-orange-800">
                {isAr ? 'مدة بالأيام' : 'Multi-day'}
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_PRESETS.map((preset) => (
                  <PresetChip
                    key={preset.id}
                    tone="days"
                    active={isDayPresetActive(preset)}
                    onClick={() => applyDayPreset(preset)}
                  >
                    {isAr ? preset.ar : preset.en}
                  </PresetChip>
                ))}
              </div>
            </div>
          </div>

          {scheduleStatus && (
            <p className={`rounded-xl border px-3 py-2.5 text-xs font-medium ${
              scheduleStatus.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-orange-200 bg-orange-50 text-orange-950'
            }`}
            >
              {scheduleStatus.type === 'error' ? (
                scheduleStatus.text
              ) : (
                <>
                  {isAr ? '✓ ' : '✓ '}
                  {scheduleStatus.isFullDay
                    ? (isAr
                      ? `عرض ليوم واحد — ينتهي ${form.endsAt} الساعة 23:59`
                      : `One-day offer — ends ${form.endsAt} at 23:59`)
                    : (isAr
                      ? `${scheduleStatus.duration} — من ${formatScheduleClock(form.startsAtTime)} إلى ${formatScheduleClock(form.endsAtTime)} (${form.startsAt}${form.startsAt !== form.endsAt ? ` → ${form.endsAt}` : ''})`
                      : `${scheduleStatus.duration} — ${formatScheduleClock(form.startsAtTime)} → ${formatScheduleClock(form.endsAtTime)} (${form.startsAt}${form.startsAt !== form.endsAt ? ` → ${form.endsAt}` : ''})`)}
                </>
              )}
            </p>
          )}

          <p className="text-[10px] leading-relaxed text-text-muted">
            {isAr
              ? 'الأوقات المعروضة بصيغة 24 ساعة. الضغط على أي مدة يبدأ العرض من الآن ويحسب النهاية تلقائياً.'
              : 'Times use 24-hour format. Presets start from now and calculate the end automatically.'}
          </p>
        </>
      )}

      {mode === 'open' && (
        <div className="grid max-w-md gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
          <Input
            label={isAr ? 'تاريخ البداية (اختياري)' : 'Start date (optional)'}
            type="date"
            min={today}
            value={form.startsAt || ''}
            onChange={(e) => patchOpenStart({ startsAt: e.target.value })}
          />
          <Input
            label={isAr ? 'وقت البداية (24 س)' : 'Start time (24h)'}
            type="time"
            step="60"
            min={form.startsAt === today ? now.time : undefined}
            value={formatScheduleClock(form.startsAtTime || '00:00')}
            onChange={(e) => patchOpenStart({ startsAtTime: e.target.value })}
            inputClassName="font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}
