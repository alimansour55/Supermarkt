import { Link } from 'react-router-dom';
import { Plus, Tag, Trash2 } from 'lucide-react';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';
import {
  BRAND_ROW_LAYOUTS,
  DEFAULT_BRAND_ROW_CONFIG,
  emptyBrandItem,
  normalizeBrandRowConfig,
} from '../utils/brandRowUtils';

export default function HomepageBrandRowEditor({
  isAr,
  categories = [],
  titleAr = '',
  titleEn = '',
  link = '',
  icon = '',
  items = [],
  brandRowConfig,
  onFieldChange,
  onConfigChange,
  onItemsChange,
}) {
  const config = normalizeBrandRowConfig(brandRowConfig || DEFAULT_BRAND_ROW_CONFIG);
  const brands = Array.isArray(items) ? items : [];

  const patchConfig = (patch) => onConfigChange({ ...config, ...patch });

  const setItem = (index, patch) => {
    onItemsChange(brands.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-white p-4">
        <div className="flex items-start gap-3">
          <Tag className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-bold text-amber-950">{isAr ? 'صف العلامات' : 'Brand row'}</p>
            <p className="mt-1 text-xs text-amber-900/80">
              {isAr ? 'علامات يدوية أو من «العلامات التجارية» في لوحة التحكم — تمرير أو شبكة.' : 'Manual tiles or brands from Admin → Brands — scroll or grid.'}
            </p>
            <Link to="/admin/brands" className="mt-2 inline-block text-xs font-semibold text-amber-800 underline">
              {isAr ? '↗ إدارة كل العلامات' : '↗ Manage all brands'}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input className="rounded-xl border border-border px-3 py-2 text-sm" value={titleAr} onChange={(e) => onFieldChange({ titleAr: e.target.value })} placeholder={isAr ? 'عنوان عربي' : 'Title AR'} />
        <input className="rounded-xl border border-border px-3 py-2 text-sm" value={titleEn} onChange={(e) => onFieldChange({ titleEn: e.target.value })} placeholder="Title EN" />
        <input className="rounded-xl border border-border px-3 py-2 text-sm" maxLength={4} value={icon} onChange={(e) => onFieldChange({ icon: e.target.value })} placeholder={isAr ? 'أيقونة' : 'Icon'} />
        <HomepageDestinationPicker
          href={link || '/brands'}
          isAr={isAr}
          categories={categories}
          onChange={(path) => onFieldChange({ link: normalizeHomepageLink(path) })}
          titleAr="رابط «عرض الكل»"
          titleEn="“View all” link"
          hintAr="يفضّل «كل العلامات» — صفحة شبكة العلامات وليس كatalog المنتجات."
          hintEn="Prefer “All brands” — the brand grid page, not the product catalog."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {BRAND_ROW_LAYOUTS.map((layout) => (
          <button
            key={layout.value}
            type="button"
            onClick={() => patchConfig({ layout: layout.value })}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              config.layout === layout.value ? 'bg-amber-600 text-white' : 'border border-border'
            }`}
          >
            {isAr ? layout.labelAr : layout.labelEn}
          </button>
        ))}
      </div>

      {config.layout === 'grid' && (
        <div className="flex flex-wrap gap-2">
          {[4, 5, 6, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => patchConfig({ columns: n })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                config.columns === n ? 'bg-amber-600 text-white' : 'border border-border'
              }`}
            >
              {n} {isAr ? 'أعمدة' : 'cols'}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-border bg-surface-muted/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-text">{isAr ? 'العلامات' : 'Brands'}</p>
          <button
            type="button"
            onClick={() => onItemsChange([...brands, emptyBrandItem()])}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'علامة' : 'Brand'}
          </button>
        </div>
        {brands.length === 0 && (
          <p className="text-center text-xs text-text-muted py-4">
            {isAr ? 'فارغ = العلامات الافتراضية للمتجر' : 'Empty = store default brands'}
          </p>
        )}
        {brands.map((item, index) => (
          <div key={index} className="rounded-xl border border-border bg-white p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs font-bold text-text-muted">#{index + 1}</span>
              <button type="button" onClick={() => onItemsChange(brands.filter((_, i) => i !== index))} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'اسم عربي' : 'Name AR'} value={item.titleAr || ''} onChange={(e) => setItem(index, { titleAr: e.target.value })} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Name EN" value={item.titleEn || ''} onChange={(e) => setItem(index, { titleEn: e.target.value })} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" dir="ltr" placeholder="Logo URL" value={item.image || ''} onChange={(e) => setItem(index, { image: e.target.value })} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" maxLength={4} placeholder="Emoji" value={item.emoji || ''} onChange={(e) => setItem(index, { emoji: e.target.value })} />
            </div>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" dir="ltr" placeholder={isAr ? 'رابط أو ?brand=' : 'Link or ?brand='} value={item.link || item.query || ''} onChange={(e) => setItem(index, { link: normalizeHomepageLink(e.target.value) })} />
          </div>
        ))}
      </div>
    </div>
  );
}
