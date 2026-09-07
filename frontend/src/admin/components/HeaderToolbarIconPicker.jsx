import { HEADER_TOOLBAR_ICON_OPTIONS, getIconOptionLabel } from '../../utils/headerToolbarIcons';
import { getToolbarIconComponent } from '../../components/layout/ToolbarIcon';

export default function HeaderToolbarIconPicker({ value, onChange, isAr, sampleLabel }) {
  const selected = value || 'layout-grid';
  const previewLabel = sampleLabel || (isAr ? 'مثال' : 'Sample');

  return (
    <div className="lg:col-span-4">
      <p className="mb-2 text-xs font-medium text-text-muted">
        {isAr ? 'اختر الأيقونة (الشكل)' : 'Pick icon shape'}
      </p>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {HEADER_TOOLBAR_ICON_OPTIONS.map((opt) => {
          const Icon = getToolbarIconComponent(opt.id, 'link');
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              title={isAr ? opt.labelAr : opt.labelEn}
              onClick={() => onChange(opt.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-all ${
                active
                  ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200'
                  : 'border-border bg-white hover:border-primary-300 hover:bg-surface'
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-primary-100 text-primary-700' : 'bg-surface text-text'}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="line-clamp-1 w-full text-center text-[9px] font-medium leading-tight text-text-muted">
                {isAr ? opt.labelAr : opt.labelEn}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-surface/50 px-3 py-2">
        <span className="text-[11px] text-text-muted">{isAr ? 'معاينة:' : 'Preview:'}</span>
        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-semibold text-text">
          {(() => {
            const PreviewIcon = getToolbarIconComponent(selected, 'link');
            return <PreviewIcon className="h-4 w-4 text-primary-600" />;
          })()}
          {previewLabel}
        </span>
        <span className="text-[11px] text-text-muted">
          ({getIconOptionLabel(selected, isAr)})
        </span>
      </div>
    </div>
  );
}
