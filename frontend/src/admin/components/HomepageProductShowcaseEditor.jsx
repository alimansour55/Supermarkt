import { Package } from 'lucide-react';
import {
  HOMEPAGE_CAROUSEL_PRESETS,
  applyCarouselPreset,
} from '../utils/homepageSectionMeta';
import {
  DEFAULT_PRODUCT_SHOWCASE_CONFIG,
  PRODUCT_SHOWCASE_LAYOUTS,
  normalizeProductShowcaseConfig,
} from '../utils/productShowcaseUtils';
import HomepageProductSourceEditor from './HomepageProductSourceEditor';

export default function HomepageProductShowcaseEditor({
  isAr,
  form,
  categories = [],
  onConfigChange,
  onApplyPreset,
  onQueryChange,
  onFieldChange,
}) {
  const config = normalizeProductShowcaseConfig(form.productShowcaseConfig || {}, form);

  const patchConfig = (patch) => {
    const next = normalizeProductShowcaseConfig({ ...config, ...patch }, form);
    onConfigChange(next, next.layout);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4">
        <div className="flex items-start gap-3">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-bold text-emerald-950">
              {isAr ? 'عرض المنتجات' : 'Product showcase'}
            </p>
            <p className="mt-1 text-xs text-emerald-900/80">
              {isAr
                ? 'شريط أفقي أو شبكة — قوالب جاهزة أو فلاتر مخصّصة.'
                : 'Scroll row or grid — quick presets or custom filters.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'نمط العرض' : 'Display layout'}</p>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_SHOWCASE_LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              type="button"
              onClick={() => patchConfig({ layout: layout.value })}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                config.layout === layout.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-border hover:border-emerald-300'
              }`}
            >
              {isAr ? layout.labelAr : layout.labelEn}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-text-muted">
          {config.layout === 'grid'
            ? (isAr ? '✓ شبكة — بطاقات منتجات عادية' : '✓ Grid — normal product cards')
            : (isAr ? '↔ شريط أفقي قابل للتمرير' : '↔ Horizontal scroll strip')}
        </p>
      </div>

      {config.layout === 'grid' && (
        <div>
          <p className="mb-2 text-xs font-semibold text-text-muted">{isAr ? 'أعمدة الشبكة' : 'Grid columns'}</p>
          <div className="flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
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

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'قوالب سريعة' : 'Quick presets'}</p>
        <div className="flex flex-wrap gap-2">
          {HOMEPAGE_CAROUSEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(applyCarouselPreset(form, preset.id))}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:border-emerald-400 hover:bg-emerald-50"
            >
              {preset.icon} {isAr ? preset.labelAr : preset.labelEn}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onApplyPreset({
              ...form,
              titleAr: 'الأعلى تقييماً',
              titleEn: 'Top rated',
              icon: '💫',
              link: '/products?sort=top',
              productQuery: { ...form.productQuery, section: 'top', sort: 'top', limit: 12, offers: false },
              products: [],
            })}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:border-emerald-400 hover:bg-emerald-50"
          >
            💫 {isAr ? 'الأعلى تقييماً' : 'Top rated'}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.showViewAll}
          onChange={(e) => patchConfig({ showViewAll: e.target.checked })}
        />
        {isAr ? 'إظهار رابط «عرض الكل»' : 'Show “View all” link'}
      </label>

      <HomepageProductSourceEditor
        isAr={isAr}
        form={form}
        categories={categories}
        onQueryChange={onQueryChange}
        onFieldChange={onFieldChange}
        accent="emerald"
      />
    </div>
  );
}

export { DEFAULT_PRODUCT_SHOWCASE_CONFIG };
