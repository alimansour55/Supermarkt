import { Link } from 'react-router-dom';

/** Shared height for the 3-up promo banner row (homepage + offers page). */
export const PROMO_BANNER_TILE_HEIGHT = 'h-[128px] sm:h-[148px] lg:h-[160px]';

/**
 * A single promo banner card: background image (or gradient fallback) with a
 * legibility scrim, title, optional subtitle, and a pill call-to-action.
 */
export default function PromoBannerTile({ banner = {}, isAr = false }) {
  const title = isAr
    ? banner.titleAr || banner.titleEn
    : banner.titleEn || banner.titleAr;
  const subtitle = isAr
    ? banner.subtitleAr || banner.subtitleEn
    : banner.subtitleEn || banner.subtitleAr;
  const cta = isAr
    ? banner.ctaAr || 'تسوق الآن'
    : banner.ctaEn || 'Shop now';
  const href = banner.link || '/offers';
  const fallbackBg = banner.bg || 'bg-gradient-to-br from-primary-600 to-primary-800';

  return (
    <Link
      to={href}
      className={`group relative flex ${PROMO_BANNER_TILE_HEIGHT} w-full items-end overflow-hidden rounded-2xl ${fallbackBg} p-4 text-white shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:p-5`}
    >
      {banner.image && (
        <img
          src={banner.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div
        className={`absolute inset-0 ${
          banner.image
            ? 'bg-gradient-to-t from-black/85 via-black/45 to-black/10'
            : 'bg-gradient-to-t from-black/35 to-transparent'
        }`}
      />

      <div className="relative z-10 w-full">
        <h3 className="line-clamp-1 text-base font-bold leading-tight drop-shadow-sm sm:text-lg md:text-xl">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 line-clamp-1 text-xs text-white/85 sm:text-sm">{subtitle}</p>
        )}
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm transition-colors group-hover:bg-white/25 sm:mt-3 sm:text-sm">
          {cta}
          <span
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
          >
            {isAr ? '←' : '→'}
          </span>
        </span>
      </div>
    </Link>
  );
}
