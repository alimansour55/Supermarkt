const DAY_LABELS = [
  { ar: 'الأحد', en: 'Sunday' },
  { ar: 'الإثنين', en: 'Monday' },
  { ar: 'الثلاثاء', en: 'Tuesday' },
  { ar: 'الأربعاء', en: 'Wednesday' },
  { ar: 'الخميس', en: 'Thursday' },
  { ar: 'الجمعة', en: 'Friday' },
  { ar: 'السبت', en: 'Saturday' },
];

export default function WeeklyScheduleEditor({ schedule = [], onChange, isAr, disabled = false }) {
  const patchDay = (day, patch) => onChange(schedule.map((e) => (e.day === day ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-2">
      {schedule.map((entry) => (
        <div key={entry.day} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white px-3 py-2">
          <label className="flex w-32 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={entry.enabled !== false}
              disabled={disabled}
              onChange={(e) => patchDay(entry.day, { enabled: e.target.checked })}
            />
            {isAr ? DAY_LABELS[entry.day].ar : DAY_LABELS[entry.day].en}
          </label>
          <input
            type="time"
            value={entry.from}
            disabled={disabled || entry.enabled === false}
            onChange={(e) => patchDay(entry.day, { from: e.target.value })}
            className="rounded-lg border border-border px-2 py-1 text-sm disabled:opacity-50"
          />
          <span className="text-xs text-text-muted">{isAr ? 'إلى' : 'to'}</span>
          <input
            type="time"
            value={entry.to}
            disabled={disabled || entry.enabled === false}
            onChange={(e) => patchDay(entry.day, { to: e.target.value })}
            className="rounded-lg border border-border px-2 py-1 text-sm disabled:opacity-50"
          />
        </div>
      ))}
      <p className="text-xs text-text-muted">
        {isAr
          ? 'لو وقت النهاية أقل من البداية يعتبر يمتد لليوم التالي (مثلاً 18:00 → 02:00).'
          : 'An end time earlier than the start runs past midnight (e.g. 18:00 → 02:00).'}
      </p>
    </div>
  );
}
