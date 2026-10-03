export default function ProductFormSideNav({ sections, active, onSelect, errorSections }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-white p-1.5 shadow-sm lg:flex-col lg:overflow-visible">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = active === section.id;
        const hasError = errorSections.has(section.id);
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={[
              'relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:w-full',
              isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-text-muted hover:bg-slate-50 hover:text-text',
            ].join(' ')}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{section.label}</span>
            {hasError && (
              <span
                className={`absolute end-2 top-2 h-2 w-2 rounded-full lg:static lg:ms-auto ${isActive ? 'bg-white' : 'bg-red-500'}`}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
