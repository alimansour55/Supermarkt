import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { centeredPromoGridClass, PROMO_TILE_HEIGHT_CLASS } from '../../utils/tileGridShared';
import { Skeleton } from '../ui/Skeleton';

export default function HomepagePromoGrid({ section, banners = [], loading = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const columns = Math.min(4, Math.max(2, Number(section?.gridColumns) || 3));
  const gridClass = centeredPromoGridClass(loading ? columns : banners.length, columns);

  if (loading) {
    return (
      <section className="container-app py-6">
        <div className={gridClass}>
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className={`${PROMO_TILE_HEIGHT_CLASS} rounded-2xl`} />
          ))}
        </div>
      </section>
    );
  }

  if (!banners.length) return null;

  return (
    <section className="container-app py-6">
      {(section.titleAr || section.titleEn) && (
        <h2 className="mb-4 text-xl font-bold text-text md:text-2xl">
          {isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr}
        </h2>
      )}
      <div className={centeredPromoGridClass(banners.length, columns)}>
        {banners.map((banner) => (
          <Link
            key={banner._id || banner.id}
            to={banner.link || '/offers'}
            className={`group relative flex w-full ${PROMO_TILE_HEIGHT_CLASS} items-end overflow-hidden rounded-2xl bg-gradient-to-l from-primary-600 to-primary-800 p-4 text-white shadow-sm transition-transform hover:scale-[1.01]`}
          >
            {banner.image && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-105"
                  style={{ backgroundImage: `url(${banner.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </>
            )}
            <div className="relative z-10">
              <h3 className="text-lg font-bold md:text-xl">
                {isAr ? banner.titleAr : banner.titleEn}
              </h3>
              <span className="mt-2 inline-block text-sm font-medium underline underline-offset-2 opacity-90">
                {isAr ? (banner.ctaAr || 'تسوق الآن') : (banner.ctaEn || 'Shop now')}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
