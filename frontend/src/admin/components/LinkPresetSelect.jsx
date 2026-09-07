import {
  ACCOUNT_PAGE_PRESETS,
  CONTENT_PAGE_PRESETS,
  SPECIAL_PAGE_PRESETS,
  normalizeNavHref,
} from '../utils/navigationHelpers';

export default function LinkPresetSelect({ href, isAr, onApply, className = '' }) {
  const normalized = normalizeNavHref(href);
  const contentMatch = CONTENT_PAGE_PRESETS.find((p) => p.path === normalized);
  const accountMatch = ACCOUNT_PAGE_PRESETS.find((p) => p.path === normalized);
  const specialMatch = SPECIAL_PAGE_PRESETS.find((p) => p.path === normalized);
  const value = contentMatch
    ? `content:${contentMatch.slug}`
    : accountMatch
      ? `account:${accountMatch.path}`
      : specialMatch
        ? `special:${specialMatch.path}`
        : 'custom';

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-text-muted">
        {isAr ? 'نوع الرابط' : 'Link type'}
      </label>
      <select
        className="w-full rounded-xl border border-border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'custom') return;
          if (v.startsWith('content:')) {
            const slug = v.replace('content:', '');
            const preset = CONTENT_PAGE_PRESETS.find((p) => p.slug === slug);
            if (preset) onApply(preset);
          } else if (v.startsWith('account:')) {
            const path = v.replace('account:', '');
            const preset = ACCOUNT_PAGE_PRESETS.find((p) => p.path === path);
            if (preset) onApply({ ...preset, isExternal: false });
          } else if (v.startsWith('special:')) {
            const path = v.replace('special:', '');
            const preset = SPECIAL_PAGE_PRESETS.find((p) => p.path === path);
            if (preset) onApply({ ...preset, isExternal: false });
          }
        }}
      >
        <option value="custom">{isAr ? 'رابط مخصص' : 'Custom URL'}</option>
        <optgroup label={isAr ? 'صفحات محتوى (قابلة للتحرير)' : 'Content pages (editable)'}>
          {CONTENT_PAGE_PRESETS.map((p) => (
            <option key={p.slug} value={`content:${p.slug}`}>
              {isAr ? p.labelAr : p.labelEn}
            </option>
          ))}
        </optgroup>
        <optgroup label={isAr ? 'حساب العميل' : 'Customer account'}>
          {ACCOUNT_PAGE_PRESETS.map((p) => (
            <option key={p.path} value={`account:${p.path}`}>
              {isAr ? p.labelAr : p.labelEn}
            </option>
          ))}
        </optgroup>
        <optgroup label={isAr ? 'صفحات أخرى' : 'Other pages'}>
          {SPECIAL_PAGE_PRESETS.map((p) => (
            <option key={p.path} value={`special:${p.path}`}>
              {isAr ? p.labelAr : p.labelEn}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
