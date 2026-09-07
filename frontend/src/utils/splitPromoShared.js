export const SPLIT_PROMO_ACCENTS = {
  primary: {
    gradient: 'from-primary-600 to-primary-800',
    solid: 'bg-primary-600',
    soft: 'bg-primary-50 border-primary-200 text-primary-900',
    text: 'text-white',
  },
  emerald: {
    gradient: 'from-emerald-600 to-emerald-800',
    solid: 'bg-emerald-600',
    soft: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    text: 'text-white',
  },
  amber: {
    gradient: 'from-amber-500 to-orange-600',
    solid: 'bg-amber-500',
    soft: 'bg-amber-50 border-amber-200 text-amber-900',
    text: 'text-white',
  },
  rose: {
    gradient: 'from-rose-500 to-rose-700',
    solid: 'bg-rose-600',
    soft: 'bg-rose-50 border-rose-200 text-rose-900',
    text: 'text-white',
  },
  sky: {
    gradient: 'from-sky-500 to-blue-700',
    solid: 'bg-sky-600',
    soft: 'bg-sky-50 border-sky-200 text-sky-900',
    text: 'text-white',
  },
  violet: {
    gradient: 'from-violet-600 to-purple-800',
    solid: 'bg-violet-600',
    soft: 'bg-violet-50 border-violet-200 text-violet-900',
    text: 'text-white',
  },
};

export const DEFAULT_SPLIT_PROMO_CONFIG = {
  columns: 2,
  layout: 'balanced',
  cardStyle: 'overlay',
  tileHeight: 'medium',
  gap: 'normal',
  showTitle: false,
};

export function normalizeSplitPromoConfig(config = {}) {
  const columns = Math.min(4, Math.max(2, Number(config.columns) || 2));
  const layout = ['balanced', 'featured-first', 'featured-last'].includes(config.layout)
    ? config.layout
    : 'balanced';
  const cardStyle = ['overlay', 'gradient', 'minimal', 'bordered'].includes(config.cardStyle)
    ? config.cardStyle
    : 'overlay';
  const tileHeight = ['compact', 'medium', 'tall'].includes(config.tileHeight)
    ? config.tileHeight
    : 'medium';
  const gap = ['tight', 'normal', 'wide'].includes(config.gap) ? config.gap : 'normal';
  return {
    columns,
    layout: layout === 'featured-first' || layout === 'featured-last' ? layout : 'balanced',
    cardStyle,
    tileHeight,
    gap,
    showTitle: !!config.showTitle,
  };
}

export function resolveAccentKey(item, index) {
  if (item?.accent && SPLIT_PROMO_ACCENTS[item.accent]) return item.accent;
  const cycle = ['primary', 'emerald', 'amber', 'rose', 'sky', 'violet'];
  return cycle[index % cycle.length];
}

export function itemSubtitle(item, isAr) {
  if (isAr) return item.subtitleAr || item.subtitleEn || item.query || '';
  return item.subtitleEn || item.subtitleAr || item.query || '';
}

export function itemTitle(item, isAr) {
  if (isAr) return item.titleAr || item.titleEn || '';
  return item.titleEn || item.titleAr || '';
}

export function itemCta(item, isAr) {
  if (isAr) return item.ctaAr || item.ctaEn || 'تسوق الآن ←';
  return item.ctaEn || item.ctaAr || 'Shop now →';
}

export function gapClass(gap) {
  if (gap === 'tight') return 'gap-2.5 md:gap-2';
  if (gap === 'wide') return 'gap-4 md:gap-6';
  return 'gap-3 md:gap-4';
}

export function heightClass(tileHeight) {
  if (tileHeight === 'compact') return 'md:min-h-[100px]';
  if (tileHeight === 'tall') return 'md:min-h-[220px]';
  return 'md:min-h-[150px]';
}

function mobileAspectClass(tileHeight, isFeatured) {
  if (isFeatured) {
    if (tileHeight === 'tall') return 'aspect-[4/5] max-h-[min(78vw,360px)]';
    if (tileHeight === 'compact') return 'aspect-[16/10] max-h-[min(72vw,220px)]';
    return 'aspect-[5/4] max-h-[min(80vw,300px)]';
  }
  if (tileHeight === 'compact') return 'aspect-[5/2]';
  if (tileHeight === 'tall') return 'aspect-[2/1]';
  return 'aspect-[2.15/1]';
}

/** Grid wrapper classes for the promo layout */
export function splitPromoGridClass(config, itemCount) {
  const { columns, layout } = normalizeSplitPromoConfig(config);
  const count = Math.max(1, itemCount);

  if (layout === 'featured-first' && count >= 2) {
    if (count === 2) return 'grid grid-cols-1 md:grid-cols-5 md:items-stretch';
    return 'grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 md:items-stretch';
  }
  if (layout === 'featured-last' && count >= 2) {
    if (count === 2) return 'grid grid-cols-1 md:grid-cols-5 md:items-stretch';
    return 'grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 md:items-stretch';
  }

  if (columns === 4) return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  if (columns === 3) return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  return 'grid grid-cols-1 md:grid-cols-2';
}

export function splitPromoTileSpanClass(config, index, itemCount) {
  const { layout, tileHeight } = normalizeSplitPromoConfig(config);
  const count = Math.max(1, itemCount);
  const isFirst = index === 0;
  const isLast = index === count - 1;
  const featuredFirst = layout === 'featured-first' && count >= 2 && isFirst;
  const featuredLast = layout === 'featured-last' && count >= 2 && isLast;
  const mobileAspect = `${mobileAspectClass(tileHeight, featuredFirst || featuredLast)} w-full min-w-0 md:aspect-auto md:max-h-none`;

  if (layout === 'featured-first' && count >= 2) {
    if (count === 2 && isFirst) return `${mobileAspect} md:col-span-3 md:min-h-[200px]`;
    if (count === 2 && isLast) return `${mobileAspect} md:col-span-2 md:min-h-[200px]`;
    if (isFirst) return `${mobileAspect} md:row-span-2 md:min-h-[280px]`;
    return `${mobileAspect} md:min-h-[130px]`;
  }
  if (layout === 'featured-last' && count >= 2) {
    if (count === 2 && isLast) return `${mobileAspect} order-first md:order-last md:col-span-3 md:min-h-[200px]`;
    if (count === 2 && isFirst) return `${mobileAspect} md:col-span-2 md:min-h-[200px]`;
    if (isLast) return `${mobileAspect} order-first md:order-none md:row-span-2 md:col-start-2 md:row-start-1 md:min-h-[280px]`;
    return `${mobileAspect} md:min-h-[130px]`;
  }
  return `${mobileAspect}`;
}

export function tileSurfaceClass(cardStyle, accentKey) {
  const accent = SPLIT_PROMO_ACCENTS[accentKey] || SPLIT_PROMO_ACCENTS.primary;
  switch (cardStyle) {
    case 'gradient':
      return `bg-gradient-to-br ${accent.gradient} ${accent.text}`;
    case 'minimal':
      return `${accent.soft} border`;
    case 'bordered':
      return 'border-2 border-border bg-white text-text shadow-sm';
    case 'overlay':
    default:
      return `bg-gradient-to-br ${accent.gradient} ${accent.text}`;
  }
}
