import { useState } from 'react';
import { LayoutGrid, Plus, Trash2, Upload } from 'lucide-react';
import { adminApi } from '../adminApi';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';
import {
  DEFAULT_SPLIT_PROMO_CONFIG,
  emptySplitPromoItem,
  normalizeSplitPromoConfig,
  SPLIT_PROMO_ACCENTS,
  SPLIT_PROMO_CARD_STYLES,
  SPLIT_PROMO_GAPS,
  SPLIT_PROMO_HEIGHTS,
  SPLIT_PROMO_LAYOUTS,
  SPLIT_PROMO_PRESETS,
} from '../utils/splitPromoUtils';
import {
  gapClass,
  heightClass,
  itemCta,
  itemSubtitle,
  itemTitle,
  resolveAccentKey,
  splitPromoGridClass,
  splitPromoTileSpanClass,
  tileSurfaceClass,
} from '../../utils/splitPromoShared';

function TilePreview({ item, index, config, isAr }) {
  const cardStyle = config.cardStyle;
  const accentKey = resolveAccentKey(item, index);
  const surface = tileSurfaceClass(cardStyle, accentKey);
  const title = itemTitle(item, isAr) || (isAr ? 'عنوان البانر' : 'Banner title');
  const subtitle = itemSubtitle(item, isAr);
  const cta = itemCta(item, isAr);
  const span = splitPromoTileSpanClass(config, index, 99);
  const isOverlay = cardStyle === 'overlay' && item.image;
  const isBold = cardStyle === 'gradient' || (cardStyle === 'overlay' && !item.image);
  const textLight = isOverlay || cardStyle === 'gradient';

  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-xl p-4 shadow-sm ${heightClass(config.tileHeight)} ${surface} ${span}`}
    >
      {isOverlay && item.image && (
        <>
          <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        </>
      )}
      <div className={`relative z-10 w-full ${textLight ? 'text-white' : ''}`}>
        <div className="flex items-start gap-2">
          {item.emoji && !isOverlay && (
            <span className="text-2xl shrink-0" aria-hidden>{item.emoji}</span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug md:text-base">{title}</p>
            {subtitle && <p className={`mt-0.5 text-xs ${textLight ? 'text-white/90' : 'text-text-muted'}`}>{subtitle}</p>}
            <span className={`mt-2 inline-block text-xs font-semibold underline underline-offset-2 ${isBold ? 'opacity-95' : 'opacity-80'}`}>
              {cta}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageField({ value, onChange, onUpload, uploading, isAr }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-muted">
        {isAr ? 'صورة الخلفية' : 'Background image'}
      </label>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm"
          dir="ltr"
          placeholder="https://..."
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-surface-muted/50">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? '…' : (isAr ? 'رفع' : 'Upload')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}

export default function HomepageSplitPromoEditor({
  isAr,
  categories = [],
  titleAr = '',
  titleEn = '',
  items = [],
  splitPromoConfig,
  onFieldChange,
  onConfigChange,
  onItemsChange,
}) {
  const config = normalizeSplitPromoConfig(splitPromoConfig || DEFAULT_SPLIT_PROMO_CONFIG);
  const tiles = Array.isArray(items) ? items : [];
  const [uploadIndex, setUploadIndex] = useState(null);

  const patchConfig = (patch) => onConfigChange({ ...config, ...patch });

  const setItem = (index, patch) => {
    const next = tiles.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onItemsChange(next);
  };

  const applyPreset = (preset) => {
    onFieldChange({
      titleAr: preset.titleAr || titleAr,
      titleEn: preset.titleEn || titleEn,
    });
    onConfigChange({ ...DEFAULT_SPLIT_PROMO_CONFIG, ...preset.config });
    onItemsChange(preset.items.map((item) => ({ ...emptySplitPromoItem(), ...item })));
  };

  const uploadForTile = async (index, file) => {
    setUploadIndex(index);
    try {
      const res = await adminApi.uploadHeroSlideImage(file);
      const url = res.data?.data?.url || res.data?.url;
      if (url) setItem(index, { image: url });
    } catch {
      /* ignore */
    } finally {
      setUploadIndex(null);
    }
  };

  const featuredHint = config.layout !== 'balanced' && tiles.length < 2
    ? (isAr ? 'أضف عنصرين على الأقل للتخطيط البارز.' : 'Add at least 2 tiles for featured layout.')
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4">
        <div className="flex items-start gap-3">
          <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
          <div>
            <p className="text-sm font-bold text-violet-950">
              {isAr ? 'بانرات ترويج — محرر مرن' : 'Promo banners — flexible editor'}
            </p>
            <p className="mt-1 text-xs text-violet-900/80">
              {isAr
                ? '2–4 أعمدة، بانر بارز، أنماط متعددة — ليس مقتصراً على عمودين فقط.'
                : '2–4 columns, featured tile, multiple styles — not limited to two columns.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">
          {isAr ? 'معاينة مباشرة' : 'Live preview'}
        </p>
        {config.showTitle && (titleAr || titleEn) && (
          <h3 className="mb-3 text-lg font-bold">{isAr ? titleAr || titleEn : titleEn || titleAr}</h3>
        )}
        <div className={`${splitPromoGridClass(config, tiles.length)} ${gapClass(config.gap)}`}>
          {tiles.length === 0 ? (
            <div className={`col-span-full rounded-xl border border-dashed border-border py-10 text-center text-xs text-text-muted ${heightClass(config.tileHeight)}`}>
              {isAr ? 'أضف بانراً للمعاينة' : 'Add a banner to preview'}
            </div>
          ) : (
            tiles.map((item, index) => (
              <TilePreview key={item._id || `tile-${index}`} item={item} index={index} config={config} isAr={isAr} />
            ))
          )}
        </div>
        {featuredHint && <p className="mt-2 text-xs font-medium text-amber-700">{featuredHint}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'قوالب جاهزة' : 'Quick presets'}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SPLIT_PROMO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-xl border border-border bg-white p-3 text-start transition hover:border-violet-300 hover:bg-violet-50/40"
            >
              <p className="text-xs font-semibold">{isAr ? preset.labelAr : preset.labelEn}</p>
              <p className="mt-1 text-[11px] text-text-muted">
                {preset.config.columns} {isAr ? 'أعمدة' : 'cols'} · {preset.config.layout}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border bg-white p-4">
          <p className="text-sm font-bold text-text">{isAr ? 'تخطيط الشبكة' : 'Grid layout'}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SPLIT_PROMO_LAYOUTS.map((layout) => (
              <button
                key={layout.value}
                type="button"
                onClick={() => patchConfig({ layout: layout.value })}
                className={`rounded-xl border p-3 text-start text-xs transition ${
                  config.layout === layout.value
                    ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                    : 'border-border hover:border-violet-200'
                }`}
              >
                <p className="font-semibold">{isAr ? layout.labelAr : layout.labelEn}</p>
                <p className="mt-1 text-[11px] text-text-muted">{isAr ? layout.descAr : layout.descEn}</p>
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-text-muted">{isAr ? 'عدد الأعمدة' : 'Columns'}</p>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={config.layout !== 'balanced'}
                  onClick={() => patchConfig({ columns: n })}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                    config.columns === n
                      ? 'bg-violet-600 text-white'
                      : 'border border-border bg-white disabled:opacity-40'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {config.layout !== 'balanced' && (
              <p className="mt-1 text-[11px] text-text-muted">
                {isAr ? 'التخطيط البارز يستخدم عمودين تلقائياً.' : 'Featured layout uses 2 columns automatically.'}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-white p-4">
          <p className="text-sm font-bold text-text">{isAr ? 'نمط البطاقة' : 'Card style'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SPLIT_PROMO_CARD_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => patchConfig({ cardStyle: style.value })}
                className={`rounded-xl border p-3 text-start text-xs transition ${
                  config.cardStyle === style.value
                    ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                    : 'border-border hover:border-violet-200'
                }`}
              >
                <p className="font-semibold">{isAr ? style.labelAr : style.labelEn}</p>
                <p className="mt-1 text-[11px] text-text-muted">{isAr ? style.descAr : style.descEn}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-text-muted">{isAr ? 'ارتفاع البطاقة' : 'Tile height'}</p>
              <div className="flex flex-wrap gap-2">
                {SPLIT_PROMO_HEIGHTS.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => patchConfig({ tileHeight: h.value })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      config.tileHeight === h.value ? 'bg-violet-600 text-white' : 'border border-border'
                    }`}
                  >
                    {isAr ? h.labelAr : h.labelEn}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-text-muted">{isAr ? 'المسافة بين البطاقات' : 'Gap'}</p>
              <div className="flex flex-wrap gap-2">
                {SPLIT_PROMO_GAPS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => patchConfig({ gap: g.value })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      config.gap === g.value ? 'bg-violet-600 text-white' : 'border border-border'
                    }`}
                  >
                    {isAr ? g.labelAr : g.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.showTitle}
              onChange={(e) => patchConfig({ showTitle: e.target.checked })}
            />
            {isAr ? 'إظهار عنوان القسم فوق البانرات' : 'Show section title above banners'}
          </label>
          {config.showTitle && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-xl border border-border px-3 py-2 text-sm"
                placeholder={isAr ? 'عنوان (عربي)' : 'Title (Arabic)'}
                value={titleAr}
                onChange={(e) => onFieldChange({ titleAr: e.target.value })}
              />
              <input
                className="rounded-xl border border-border px-3 py-2 text-sm"
                placeholder="Title (English)"
                value={titleEn}
                onChange={(e) => onFieldChange({ titleEn: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface-muted/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-text">{isAr ? 'البانرات' : 'Promo tiles'}</p>
          <button
            type="button"
            onClick={() => onItemsChange([...tiles, emptySplitPromoItem()])}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'بانر' : 'Tile'}
          </button>
        </div>

        {tiles.map((item, index) => (
          <div key={item._id || `edit-${index}`} className="rounded-xl border border-border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-text-muted">
                {isAr ? `بانر ${index + 1}` : `Tile ${index + 1}`}
                {config.layout !== 'balanced' && index === 0 && ` (${isAr ? 'بارز' : 'featured'})`}
                {config.layout === 'featured-last' && index === tiles.length - 1 && tiles.length >= 2 && ` (${isAr ? 'بارز' : 'featured'})`}
              </span>
              <button
                type="button"
                onClick={() => onItemsChange(tiles.filter((_, i) => i !== index))}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'العنوان (عربي)' : 'Title (AR)'}</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={item.titleAr || ''}
                  onChange={(e) => setItem(index, { titleAr: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'العنوان (EN)' : 'Title (EN)'}</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={item.titleEn || ''}
                  onChange={(e) => setItem(index, { titleEn: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'وصف (عربي)' : 'Subtitle (AR)'}</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={item.subtitleAr || item.query || ''}
                  onChange={(e) => setItem(index, { subtitleAr: e.target.value, query: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'وصف (EN)' : 'Subtitle (EN)'}</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={item.subtitleEn || ''}
                  onChange={(e) => setItem(index, { subtitleEn: e.target.value })}
                />
              </div>
            </div>

            {(config.cardStyle === 'overlay' || item.image) && (
              <ImageField
                value={item.image}
                onChange={(url) => setItem(index, { image: url })}
                onUpload={(file) => uploadForTile(index, file)}
                uploading={uploadIndex === index}
                isAr={isAr}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'أيقونة' : 'Emoji'}</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  maxLength={4}
                  value={item.emoji || ''}
                  onChange={(e) => setItem(index, { emoji: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'لون' : 'Accent'}</label>
                <select
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={item.accent || ''}
                  onChange={(e) => setItem(index, { accent: e.target.value })}
                >
                  <option value="">{isAr ? 'تلقائي' : 'Auto'}</option>
                  {SPLIT_PROMO_ACCENTS.map((a) => (
                    <option key={a.value} value={a.value}>{isAr ? a.labelAr : a.labelEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'نص الزر (عربي)' : 'CTA (AR)'}</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={item.ctaAr || ''}
                  onChange={(e) => setItem(index, { ctaAr: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'نص الزر (EN)' : 'CTA (EN)'}</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={item.ctaEn || ''}
                  onChange={(e) => setItem(index, { ctaEn: e.target.value })}
                />
              </div>
              <div>
                <HomepageDestinationPicker
                  href={item.link || ''}
                  isAr={isAr}
                  categories={categories}
                  onChange={(path) => setItem(index, { link: normalizeHomepageLink(path) })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
