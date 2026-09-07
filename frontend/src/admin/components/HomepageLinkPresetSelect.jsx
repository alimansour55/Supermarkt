import { findLinkPreset, HOMEPAGE_LINK_GROUPS } from '../utils/homepageLinkPresets';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';

export default function HomepageLinkPresetSelect({ href, isAr, onChange, className = '' }) {
  const normalized = normalizeHomepageLink(href);
  const match = findLinkPreset(normalized);
  const value = match?.path || 'custom';

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-text-muted">
        {isAr ? 'قالب الرابط' : 'Link preset'}
      </label>
      <select
        className="w-full rounded-xl border border-border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'custom') return;
          onChange(v);
        }}
      >
        <option value="custom">{isAr ? 'رابط مخصص' : 'Custom URL'}</option>
        {HOMEPAGE_LINK_GROUPS.map((group) => (
          <optgroup key={group.id} label={isAr ? group.labelAr : group.labelEn}>
            {group.items.map((item) => (
              <option key={item.path} value={item.path}>
                {isAr ? item.labelAr : item.labelEn}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
