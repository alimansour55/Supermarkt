import { Compass } from 'lucide-react';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';
import {
  BROWSE_PRESETS,
  BROWSE_VARIANTS,
  DEFAULT_BROWSE_CONFIG,
  normalizeBrowseConfig,
} from '../utils/browseHubUtils';

export default function HomepageBrowseHubEditor({
  isAr,
  categories = [],
  titleAr = '',
  titleEn = '',
  subtitleAr = '',
  subtitleEn = '',
  ctaLabelAr = '',
  ctaLabelEn = '',
  browseConfig,
  onFieldChange,
  onConfigChange,
}) {
  const config = normalizeBrowseConfig(browseConfig || DEFAULT_BROWSE_CONFIG);

  const patchConfig = (patch) => onConfigChange({ ...config, ...patch });

  const applyPreset = (preset) => {
    onConfigChange({ ...DEFAULT_BROWSE_CONFIG, ...preset.config });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-4">
        <div className="flex items-start gap-3">
          <Compass className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <p className="text-sm font-bold text-blue-950">{isAr ? 'كتلة التصفّح' : 'Browse hub'}</p>
            <p className="mt-1 text-xs text-blue-900/80">
              {isAr
                ? 'خيار واحد مرن — يغني عن «معاينة الأقسام» و«بطاقة كل المنتجات».'
                : 'One flexible block — replaces Subcategories preview & All products card.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'قوالب سريعة' : 'Quick presets'}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {BROWSE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-xl border border-border bg-white p-3 text-start text-xs font-semibold transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              {isAr ? preset.labelAr : preset.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'نمط العرض' : 'Display variant'}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BROWSE_VARIANTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => patchConfig({ variant: v.value })}
              className={`rounded-xl border p-3 text-start text-xs transition ${
                config.variant === v.value
                  ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-border hover:border-blue-200'
              }`}
            >
              <p className="font-semibold">{isAr ? v.labelAr : v.labelEn}</p>
              <p className="mt-1 text-[11px] text-text-muted">{isAr ? v.descAr : v.descEn}</p>
            </button>
          ))}
        </div>
      </div>

      {(config.variant === 'split' || config.variant === 'subcategories' || config.variant === 'banner') && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">
            {isAr ? 'عدد الأقسام الفرعية في المعاينة' : 'Subcategories in preview'}
          </label>
          <input
            type="range"
            min="4"
            max="12"
            value={config.subcategoryCount}
            onChange={(e) => patchConfig({ subcategoryCount: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
          <p className="text-center text-xs font-bold text-text">{config.subcategoryCount}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <HomepageDestinationPicker
          href={config.productsLink}
          isAr={isAr}
          categories={categories}
          onChange={(path) => patchConfig({ productsLink: normalizeHomepageLink(path) })}
        />
        <HomepageDestinationPicker
          href={config.subcategoriesLink}
          isAr={isAr}
          categories={categories}
          onChange={(path) => patchConfig({ subcategoriesLink: normalizeHomepageLink(path) })}
        />
      </div>

      {(config.variant === 'products' || config.variant === 'split') && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-muted/20 p-4">
          <p className="text-sm font-bold text-text">{isAr ? 'نص «كل المنتجات»' : 'All products copy'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder={isAr ? 'عنوان عربي' : 'Title AR'} value={titleAr} onChange={(e) => onFieldChange({ titleAr: e.target.value })} />
            <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder="Title EN" value={titleEn} onChange={(e) => onFieldChange({ titleEn: e.target.value })} />
            <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder={isAr ? 'وصف عربي' : 'Subtitle AR'} value={subtitleAr} onChange={(e) => onFieldChange({ subtitleAr: e.target.value })} />
            <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder="Subtitle EN" value={subtitleEn} onChange={(e) => onFieldChange({ subtitleEn: e.target.value })} />
            <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder={isAr ? 'زر عربي' : 'CTA AR'} value={ctaLabelAr} onChange={(e) => onFieldChange({ ctaLabelAr: e.target.value })} />
            <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder="CTA EN" value={ctaLabelEn} onChange={(e) => onFieldChange({ ctaLabelEn: e.target.value })} />
          </div>
        </div>
      )}

      {config.variant === 'banner' && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-muted/20 p-4">
          <p className="text-sm font-bold text-text">{isAr ? 'نص البانر' : 'Banner copy'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="rounded-xl border border-border px-3 py-2 text-sm" value={titleAr} onChange={(e) => onFieldChange({ titleAr: e.target.value })} placeholder={isAr ? 'عنوان' : 'Title AR'} />
            <input className="rounded-xl border border-border px-3 py-2 text-sm" value={titleEn} onChange={(e) => onFieldChange({ titleEn: e.target.value })} placeholder="Title EN" />
            <input className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" value={subtitleAr} onChange={(e) => onFieldChange({ subtitleAr: e.target.value })} placeholder={isAr ? 'وصف' : 'Subtitle AR'} />
            <input className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" value={subtitleEn} onChange={(e) => onFieldChange({ subtitleEn: e.target.value })} placeholder="Subtitle EN" />
          </div>
        </div>
      )}
    </div>
  );
}
