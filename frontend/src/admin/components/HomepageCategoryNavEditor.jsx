import { FolderTree } from 'lucide-react';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';
import {
  CATEGORY_NAV_LAYOUTS,
  DEFAULT_CATEGORY_NAV_CONFIG,
  normalizeCategoryNavConfig,
} from '../utils/categoryNavUtils';

export default function HomepageCategoryNavEditor({
  isAr,
  categories = [],
  titleAr = '',
  titleEn = '',
  categoryNavConfig,
  onFieldChange,
  onConfigChange,
}) {
  const config = normalizeCategoryNavConfig(categoryNavConfig || DEFAULT_CATEGORY_NAV_CONFIG);

  const patchConfig = (patch) => onConfigChange({ ...config, ...patch });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4">
        <div className="flex items-start gap-3">
          <FolderTree className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-bold text-emerald-950">{isAr ? 'أقسام المتجر' : 'Store categories'}</p>
            <p className="mt-1 text-xs text-emerald-900/80">
              {isAr ? 'الأقسام الرئيسية — تمرير أو شبكة، من بيانات المتجر مباشرة.' : 'Root departments — scroll or grid from live store data.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'نمط العرض' : 'Layout'}</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_NAV_LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              type="button"
              onClick={() => patchConfig({ layout: layout.value })}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                config.layout === layout.value ? 'bg-emerald-600 text-white' : 'border border-border'
              }`}
            >
              {isAr ? layout.labelAr : layout.labelEn}
            </button>
          ))}
        </div>
      </div>

      {config.layout === 'grid' && (
        <div>
          <p className="mb-2 text-xs font-semibold text-text-muted">{isAr ? 'أعمدة الشبكة' : 'Grid columns'}</p>
          <div className="flex flex-wrap gap-2">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => patchConfig({ columns: n })}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  config.columns === n ? 'bg-emerald-600 text-white' : 'border border-border'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={config.showTitle} onChange={(e) => patchConfig({ showTitle: e.target.checked })} />
        {isAr ? 'إظهار عنوان القسم' : 'Show section title'}
      </label>

      {config.showTitle && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="rounded-xl border border-border px-3 py-2 text-sm" value={titleAr} onChange={(e) => onFieldChange({ titleAr: e.target.value })} placeholder={isAr ? 'عنوان عربي' : 'Title AR'} />
          <input className="rounded-xl border border-border px-3 py-2 text-sm" value={titleEn} onChange={(e) => onFieldChange({ titleEn: e.target.value })} placeholder="Title EN" />
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={config.showViewAll} onChange={(e) => patchConfig({ showViewAll: e.target.checked })} />
        {isAr ? 'زر «كل الأقسام»' : 'Show “All departments” link'}
      </label>

      {config.showViewAll && (
        <HomepageDestinationPicker
          href={config.viewAllLink}
          isAr={isAr}
          categories={categories}
          onChange={(path) => patchConfig({ viewAllLink: normalizeHomepageLink(path) })}
        />
      )}
    </div>
  );
}
