import { AlertCircle, AlertTriangle } from 'lucide-react';
import {
  resolveSectionCategoryHealth,
  sectionCategoryWarningCopy,
} from '../utils/sectionCategoryHealth';

export default function SectionCategoryWarning({
  categoryId = '',
  category = null,
  categoryIssue = null,
  categories = [],
  isAr = true,
  compact = false,
  className = '',
}) {
  const health = resolveSectionCategoryHealth({
    categoryId,
    category,
    categoryIssue,
    categories,
  });
  const copy = sectionCategoryWarningCopy(health, isAr);
  if (!copy) return null;

  const isDanger = copy.tone === 'danger';
  const Icon = isDanger ? AlertCircle : AlertTriangle;

  return (
    <div
      className={[
        'flex items-start gap-2 rounded-xl border px-3 py-2.5',
        isDanger ? 'border-red-300 bg-red-50 text-red-950' : 'border-amber-300 bg-amber-50 text-amber-950',
        compact ? 'text-[11px] leading-snug' : 'text-sm leading-relaxed',
        className,
      ].join(' ')}
      role="alert"
    >
      <Icon className={`mt-0.5 shrink-0 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
      <div className="min-w-0">
        <p className={`font-bold ${compact ? 'text-[11px]' : 'text-sm'}`}>
          {isAr ? copy.titleAr : copy.titleEn}
        </p>
        <p className={`mt-0.5 ${compact ? 'text-[11px]' : 'text-xs'} opacity-90`}>
          {isAr ? copy.bodyAr : copy.bodyEn}
        </p>
      </div>
    </div>
  );
}
