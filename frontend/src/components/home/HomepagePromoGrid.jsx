import { useLanguage } from '../../context/LanguageContext';
import { centeredPromoGridClass } from '../../utils/tileGridShared';
import { Skeleton } from '../ui/Skeleton';
import PromoBannerTile, { PROMO_BANNER_TILE_HEIGHT } from './PromoBannerTile';

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
            <Skeleton key={i} className={`${PROMO_BANNER_TILE_HEIGHT} rounded-2xl`} />
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
          <PromoBannerTile key={banner._id || banner.id} banner={banner} isAr={isAr} />
        ))}
      </div>
    </section>
  );
}
