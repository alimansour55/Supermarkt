import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import {
  centeredPromoGridClass,
  PROMO_TILE_HEIGHT_CLASS,
  PROMO_TILE_WIDTH_CLASS,
  promoScrollRowClass,
  promoUsesFullWidthGrid,
} from '../../utils/tileGridShared';

function StripTile({ entry, isAr }) {
  const image = entry.desktopImage || entry.image || entry.mobileImage;
  const title = isAr ? entry.titleAr || entry.titleEn : entry.titleEn || entry.titleAr;
  const cta = isAr ? entry.ctaAr || 'تسوق الآن' : entry.ctaEn || 'Shop now';

  return (
    <Link
      to={entry.link || '/products'}
      className={`group relative flex shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl text-white shadow-sm transition-transform hover:scale-[1.02] ${
        image ? 'bg-slate-800' : 'bg-gradient-to-br from-primary-700 to-primary-900'
      }`}
    >
      <div className={`relative w-full ${PROMO_TILE_HEIGHT_CLASS}`}>
        {image && (
          <>
            <picture>
              {entry.mobileImage && <source media="(max-width: 640px)" srcSet={entry.mobileImage} />}
              <img
                src={entry.desktopImage || entry.image || entry.mobileImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug md:text-lg">{title}</h3>
          <span className="mt-1.5 inline-block text-xs font-semibold underline underline-offset-2 opacity-90 md:text-sm">
            {cta}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ImageStripSection({ section = {}, banners = [], items = [] }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const entries = banners.length ? banners : items;
  const layout = section.layout || 'scroll';
  const isScroll = layout === 'scroll';
  const columns = Math.min(6, Math.max(2, Number(section.gridColumns) || 4));
  const fullWidthGrid = !isScroll || promoUsesFullWidthGrid(entries.length, columns);
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const viewAllLink = section.link || '';

  if (!entries.length) return null;

  return (
    <section className="container-app py-6">
      {(title || viewAllLink) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? (
            <h2 className="text-xl font-bold text-text md:text-2xl">{title}</h2>
          ) : (
            <span />
          )}
          {viewAllLink && (
            <Link to={viewAllLink} className="shrink-0 text-sm font-semibold text-primary-600 hover:text-primary-700">
              {isAr ? 'عرض الكل ←' : 'View all →'}
            </Link>
          )}
        </div>
      )}

      {fullWidthGrid ? (
        <div className={centeredPromoGridClass(entries.length, columns)}>
          {entries.map((entry) => (
            <StripTile key={entry._id || entry.id || entry.titleEn} entry={entry} isAr={isAr} />
          ))}
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border sm:-mx-6 sm:px-6">
          <div className={promoScrollRowClass()} style={{ scrollSnapType: 'x mandatory' }}>
            {entries.map((entry) => (
              <div
                key={entry._id || entry.id || entry.titleEn}
                className={PROMO_TILE_WIDTH_CLASS}
              >
                <StripTile entry={entry} isAr={isAr} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
