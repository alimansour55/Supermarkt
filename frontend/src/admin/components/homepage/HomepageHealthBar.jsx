import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react';

const LEVEL = {
  error: { icon: AlertCircle, className: 'text-red-600' },
  warn: { icon: AlertTriangle, className: 'text-amber-600' },
  info: { icon: Info, className: 'text-sky-600' },
};

/**
 * "3 things need attention" — page-wide problems with a jump to the section.
 * issues: [{ sectionId, level, text, name }]
 */
export default function HomepageHealthBar({ issues, liveCount, total, isAr, onOpen }) {
  const [open, setOpen] = useState(false);
  const serious = issues.filter((i) => i.level !== 'info');

  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        <span className="font-semibold">
          {isAr ? `كل شيء جيد — ${liveCount} من ${total} أقسام ظاهرة الآن` : `All good — ${liveCount} of ${total} sections are live now`}
        </span>
      </div>
    );
  }

  const tone = serious.some((i) => i.level === 'error')
    ? 'border-red-200 bg-red-50 text-red-950'
    : serious.length ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950';
  const headline = serious.length
    ? (isAr ? `${serious.length} ${serious.length === 1 ? 'شيء يحتاج' : 'أشياء تحتاج'} انتباهك` : `${serious.length} ${serious.length === 1 ? 'thing needs' : 'things need'} your attention`)
    : (isAr ? `${issues.length} اقتراحات` : `${issues.length} suggestion${issues.length === 1 ? '' : 's'}`);
  const HeadIcon = serious.length ? AlertTriangle : Info;

  return (
    <div className={`rounded-2xl border ${tone}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm"
        aria-expanded={open}
      >
        <HeadIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 font-semibold">{headline}</span>
        <span className="text-xs opacity-75">
          {isAr ? `${liveCount} من ${total} ظاهرة` : `${liveCount} of ${total} live`}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul className="divide-y divide-black/5 border-t border-black/5 bg-white/60">
          {issues.map((issue, i) => {
            const { icon: Icon, className } = LEVEL[issue.level] || LEVEL.info;
            return (
              <li key={`${issue.sectionId}-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm text-text">
                <Icon className={`h-4 w-4 shrink-0 ${className}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  {issue.name && <span className="font-semibold">{issue.name}: </span>}
                  {issue.text}
                </span>
                {issue.sectionId && (
                  <button type="button" onClick={() => onOpen(issue.sectionId)} className="shrink-0 text-xs font-bold text-primary-700 hover:underline">
                    {isAr ? 'إصلاح' : 'Fix'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
