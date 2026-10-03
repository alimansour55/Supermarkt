import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import {
  DEFAULT_SPLIT_PROMO_CONFIG,
  gapClass,
  heightClass,
  itemCta,
  itemSubtitle,
  itemTitle,
  normalizeSplitPromoConfig,
  resolveAccentKey,
  splitPromoGridClass,
  splitPromoTileSpanClass,
  tileSurfaceClass,
} from '../../utils/splitPromoShared';

function PromoTile({ item, index, config, isAr, itemCount }) {
  const cardStyle = config.cardStyle;
  const accentKey = resolveAccentKey(item, index);
  const surface = tileSurfaceClass(cardStyle, accentKey);
  const title = itemTitle(item, isAr);
  const subtitle = itemSubtitle(item, isAr);
  const cta = itemCta(item, isAr);
  const span = splitPromoTileSpanClass(config, index, itemCount);
  const hasImage = cardStyle === 'overlay' && item.image;
  const textLight = hasImage || cardStyle === 'gradient';

  if (!title) return null;

  const tileInner = (
    <div
      className={`group relative flex h-full w-full min-w-0 items-end overflow-hidden rounded-2xl p-4 shadow-sm transition hover:shadow-md sm:p-5 ${heightClass(config.tileHeight)} ${surface}`}
    >
      {hasImage && (
        <>
          <img
            src={item.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
        </>
      )}
      <div className={`relative z-10 w-full min-w-0 ${textLight ? 'text-white' : 'text-text'}`}>
        <div className="flex items-end gap-2.5 sm:gap-3">
          {item.emoji && cardStyle !== 'overlay' && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur-sm sm:h-11 sm:w-11 sm:text-2xl">
              {item.emoji}
            </span>
          )}
          {item.emoji && cardStyle === 'overlay' && !hasImage && (
            <span className="shrink-0 text-2xl sm:text-3xl" aria-hidden>{item.emoji}</span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold leading-snug sm:text-base md:text-lg">{title}</h3>
            {subtitle && (
              <p className={`mt-0.5 line-clamp-2 text-xs sm:mt-1 sm:text-sm ${textLight ? 'text-white/90' : 'text-text-muted'}`}>
                {subtitle}
              </p>
            )}
            <span className="mt-2 inline-block text-xs font-semibold underline underline-offset-2 opacity-95 sm:mt-3 sm:text-sm">
              {cta}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const href = item.link || '/products';
  return (
    <Link to={href} className={`block h-full w-full min-w-0 ${span}`}>
      {tileInner}
    </Link>
  );
}

export default function HomepageSplitPromo({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const config = normalizeSplitPromoConfig(section.splitPromoConfig || DEFAULT_SPLIT_PROMO_CONFIG);
  const items = (section.items || []).filter((item) => itemTitle(item, isAr));
  const sectionTitle = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;

  if (!items.length) return null;

  return (
    <section className="container-app py-3 sm:py-4">
      {config.showTitle && sectionTitle && (
        <h2 className="mb-3 text-lg font-bold text-text sm:mb-4 sm:text-xl md:text-2xl">{sectionTitle}</h2>
      )}
      <div className={`min-w-0 ${splitPromoGridClass(config, items.length)} ${gapClass(config.gap)}`}>
        {items.map((item, index) => (
          <PromoTile
            key={item._id || `promo-${index}`}
            item={item}
            index={index}
            config={config}
            isAr={isAr}
            itemCount={items.length}
          />
        ))}
      </div>
    </section>
  );
}
