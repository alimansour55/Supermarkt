import { HEADER_TOOLBAR_STYLE_OPTIONS } from '../../utils/headerToolbarIcons';
import { getToolbarIconComponent, TOOLBAR_PILL_CLASS, TOOLBAR_PLAIN_CLASS } from '../../components/layout/ToolbarIcon';

export default function HeaderToolbarStylePicker({ value, onChange, isAr, icon, sampleLabel }) {
  const selected = value === 'plain' ? 'plain' : 'pill';
  const previewLabel = sampleLabel || (isAr ? 'مثال' : 'Sample');
  const PreviewIcon = getToolbarIconComponent(icon || 'layout-grid', 'link');

  return (
    <div className="lg:col-span-4">
      <p className="mb-2 text-xs font-medium text-text-muted">
        {isAr ? 'شكل الزر في الهيدر' : 'Header button style'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {HEADER_TOOLBAR_STYLE_OPTIONS.map((opt) => {
          const active = selected === opt.id;
          const isPill = opt.id === 'pill';

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`rounded-xl border p-4 text-start transition-all ${
                active
                  ? 'border-primary-600 bg-primary-50/60 ring-2 ring-primary-200'
                  : 'border-border bg-white hover:border-primary-200 hover:bg-surface/50'
              }`}
            >
              <p className="mb-1 text-sm font-semibold text-text">
                {isAr ? opt.labelAr : opt.labelEn}
              </p>
              <p className="mb-3 text-[11px] text-text-muted">
                {isAr ? opt.hintAr : opt.hintEn}
              </p>
              <div className="flex min-h-[52px] items-center justify-center rounded-lg bg-slate-100/80 px-3 py-3">
                <span className={isPill ? TOOLBAR_PILL_CLASS : TOOLBAR_PLAIN_CLASS}>
                  <PreviewIcon className="h-5 w-5 shrink-0" />
                  <span className="text-sm">{previewLabel}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
